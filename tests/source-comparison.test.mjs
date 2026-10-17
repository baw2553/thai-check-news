import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validatedPublisherUrl, extractComparisonArticle, fetchSourceArticle, compareSourceToEvidence } from '../dist/server/source-comparison.js';
import worker from '../dist/server/index.js';

const url = 'https://www.thaipbs.or.th/news/content/570729';
const first = 'วันนี้ (10 ต.ค. 2569) เจ้าหน้าที่ประกาศแผนช่วยเหลือประชาชนในพื้นที่กรุงเทพ หลังเกิดฝนตกหนักและระดับน้ำเพิ่มสูงขึ้น พร้อมตั้งศูนย์ประสานงานในชุมชน';
const second = 'หน่วยงานท้องถิ่นเตรียมรถรับส่งและจุดพักพิงสำหรับผู้ที่ได้รับผลกระทบ โดยจะประเมินสถานการณ์น้ำอีกครั้งในช่วงเย็นและแจ้งรายละเอียดเพิ่มเติม';
const html = `<html><head><meta property="og:title" content="กทม. ประกาศแผนช่วยเหลือน้ำท่วม"></head><body><nav><p>ข่าวอื่นยาวมากที่ไม่ควรนำไปเปรียบเทียบ ข่าวอื่นยาวมากที่ไม่ควรนำไปเปรียบเทียบ</p></nav><article><p>${first}</p><p>${second}</p></article></body></html>`;

test('source URL validation blocks SSRF and non-publisher pages', () => {
  assert.equal(validatedPublisherUrl(url), url);
  for (const bad of ['http://127.0.0.1/news', 'https://127.0.0.1/news', 'https://thaipbs.or.th.evil.test/news',
    'https://user:pass@www.thaipbs.or.th/news', 'https://www.thaipbs.or.th:8443/news', 'https://www.thaipbs.or.th/']) {
    assert.equal(validatedPublisherUrl(bad), null, bad);
  }
});

test('article comparison uses real article paragraphs, not metadata or navigation', () => {
  const article = extractComparisonArticle(html, url);
  assert.ok(article.readable);
  assert.match(article.body, /แผนช่วยเหลือประชาชน/);
  assert.doesNotMatch(article.body, /ข่าวอื่นยาวมาก/);
  assert.equal(extractComparisonArticle('<meta property="og:description" content="ข่าวยาวเพียงพอ">', url).readable, false);
  const structured = `<script type="application/ld+json">${JSON.stringify({'@type': 'NewsArticle', headline: 'Market update', articleBody: first + ' ' + second})}</script>`;
  assert.equal(extractComparisonArticle(structured, url).readable, true);
  const tracked = url + '?utm_source=social';
  const canonical = html.replace('</head>', `<link rel="canonical" href="${url}"></head>`);
  assert.equal(extractComparisonArticle(canonical, tracked).url, url);
  const withRelated=html.replace('</article>','<p>อ่านข่าว :</p><p><a href="/news/other">ข่าวเขื่อนระบายน้ำในอีกจังหวัดที่ไม่ได้เป็นส่วนหนึ่งของบทความต้นทาง</a></p></article>');
  assert.doesNotMatch(extractComparisonArticle(withRelated,url).body,/ข่าวเขื่อนระบายน้ำ/);
});

test('source fetch exposes inaccessible and redirect states rather than guessing', async () => {
  const read = await fetchSourceArticle(url, async () => new Response(html, {headers: {'content-type': 'text/html'}}));
  assert.equal(read.state, 'readable');
  const blocked = await fetchSourceArticle(url, async () => new Response('blocked', {status: 403, headers: {'content-type': 'text/html'}}));
  assert.equal(blocked.state, 'source_unavailable');
  const redirected = await fetchSourceArticle(url, async () => new Response(null, {status: 302, headers: {location: 'http://127.0.0.1/private'}}));
  assert.equal(redirected.state, 'source_unavailable');
});

test('findings distinguish shared text, extra detail, and tone from truth', () => {
  const article = extractComparisonArticle(html.replace('กทม. ประกาศ', 'ช็อก! กทม. ประกาศ'), url);
  const reports = [
    {source: 'ไทยโพสต์', url: 'https://www.thaipost.net/news/1', title: 'กทม. ช่วยเหลือผู้ประสบภัยน้ำท่วม', excerpt: first, contentRead: true},
    {source: 'Thai PBS', url, title: article.title, excerpt: article.body, contentRead: true}
  ];
  const result = compareSourceToEvidence(article, reports);
  assert.equal(result.state, 'compared');
  assert.ok(result.shared.length);
  assert.ok(result.additional.length);
  assert.deepEqual(result.toneCues, ['ช็อก']);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.assessment.code, 'limited');
  assert.equal(result.numberDifferences.length, 0);
});

test('two independent articles can support a cautious alignment label', () => {
  const article = extractComparisonArticle(html, url);
  const reports = [
    {source:'ไทยโพสต์',url:'https://www.thaipost.net/news/1',title:article.title,excerpt:article.body,contentRead:true},
    {source:'Bangkok Post',url:'https://www.bangkokpost.com/news/2',title:article.title,excerpt:article.body,contentRead:true}
  ];
  const result=compareSourceToEvidence(article,reports);
  assert.equal(result.assessment.code,'aligned');
  assert.equal(result.evidence.length,2);
});

test('extension sends the page URL and the site offers a source-comparison panel', async () => {
  let created;
  let menuClick,menuOptions;
  const noop = () => {};
  const context = vm.createContext({URL, chrome: {runtime: {onInstalled: {addListener: noop}, onMessage: {addListener: noop}},
    contextMenus: {create: options=>{menuOptions=options;}, onClicked: {addListener: fn=>{menuClick=fn;}}}, storage: {sync: {get: async defaults => defaults}},
    tabs: {create: async value => { created = value; }}}});
  vm.runInContext(await readFile(new URL('../extension/background.js', import.meta.url), 'utf8'), context);
  await context.openChecker('ข่าวทดสอบ', url);
  assert.equal(new URL(created.url).searchParams.get('sourceUrl'), url);
  menuClick({menuItemId:'check-thai-news',pageUrl:url},{});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(new URL(created.url).searchParams.get('sourceUrl'),url);
  assert.ok(!new URL(created.url).searchParams.has('q'));
  const page = await worker.fetch(new Request('https://example.test/'), {}).then(r => r.text());
  assert.match(page, /sourceComparison/);
  assert.match(page, /sourceUrlInput/);
  for (const match of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  const access=await worker.fetch(new Request('https://example.test/api/source-access'),{}).then(r=>r.json());
  assert.ok(access.sites.some(site=>site.host==='thaipbs.or.th'));
});
