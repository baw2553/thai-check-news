import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {extractArticle,parseLottery,parseStream,directUrl,compareContent} from '../dist/server/news-features.js';
import worker from '../dist/server/index.js';

test('inline UI scripts parse; widgets, arrows and internal story links are wired',async()=>{
  const html=await worker.fetch(new Request('https://example.test/'),{}).then(r=>r.text());
  for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  for(const text of ['ข่าวก่อนหน้า','ข่าวถัดไป','ผลสลากกินแบ่งรัฐบาล','ราคาทองคำ','data-title','contentAnalysis','onAutoplayBlocked'])assert.ok(html.includes(text));
});
test('publisher logos use a verified publisher domain, declared icon and text fallback',async()=>{
  const html=await worker.fetch(new Request('https://example.test/'),{}).then(r=>r.text());
  assert.ok(html.includes("/api/publisher-icon?host="));assert.ok(html.includes('publisher-fallback'));assert.ok(html.includes('publisherLogoDomains'));
  const invalid=await worker.fetch(new Request('https://example.test/api/publisher-icon?host=127.0.0.1'),{});assert.equal(invalid.status,404);
  const originalFetch=globalThis.fetch,requested=[];globalThis.fetch=async url=>{requested.push(String(url));return requested.length===1?new Response('<link rel="icon" href="/static/img/favicon/logo-192.png"><link rel="icon" href="http://127.0.0.1/private.png">'):new Response(Uint8Array.of(137,80,78,71),{headers:{'content-type':'image/png'}});};
  try{const icon=await worker.fetch(new Request('https://example.test/api/publisher-icon?host=www.thairath.co.th'),{});assert.equal(icon.status,200);assert.equal(icon.headers.get('content-type'),'image/png');assert.equal(icon.headers.get('x-content-type-options'),'nosniff');assert.equal(requested[1],'https://www.thairath.co.th/static/img/favicon/logo-192.png');assert.deepEqual([...new Uint8Array(await icon.arrayBuffer())],[137,80,78,71]);}
  finally{globalThis.fetch=originalFetch;}
});
test('article extracts content, not navigation, and retains publication time',()=>{
  const article=extractArticle('<nav><p>ข่าวที่ไม่เกี่ยวข้อง '.repeat(8)+'</p></nav><article><p>วันนี้ (29 ก.ย.2569) เจ้าหน้าที่ประกาศเตือนน้ำท่วมในพื้นที่กรุงเทพ และจัดเจ้าหน้าที่ช่วยเหลือประชาชนพร้อมประสานหน่วยงานที่เกี่ยวข้อง</p><p>การช่วยเหลือยังดำเนินต่อไปโดยเจ้าหน้าที่เร่งตรวจระดับน้ำและอพยพประชาชนออกจากพื้นที่เสี่ยง พร้อมกำหนดจุดพักชั่วคราวสำหรับผู้ได้รับผลกระทบ</p></article>',{source:'ทดสอบ',url:'https://example.test/'});
  assert.ok(article.contentRead);assert.ok(!article.excerpt.includes('ไม่เกี่ยวข้อง'));
  assert.ok(article.actions.includes('อพยพ'));assert.ok(article.timeMentions.length);
});
test('comparison requires multiple readable sources; never claims terms prove truth',()=>{
  assert.equal(compareContent([{contentRead:true,actions:['อพยพ'],locations:[]}]).sharedFacts.length,0);
  const r=compareContent([{contentRead:true,actions:['อพยพ'],locations:[]},{contentRead:true,actions:['อพยพ'],locations:[]}]);
  assert.equal(r.sharedFacts[0].count,2);assert.match(r.explanation,/ยังไม่ยืนยัน/);
});
test('lottery preserves leading zeros and refuses incomplete/future preview numbers',()=>{
  const html='<title>ตรวจหวย 16 กันยายน 2569 ผลสลากกินแบ่งรัฐบาล</title>'+['730640','060','521','266','041','64','730639','730641'].map(n=>'<strong class="lotto__number">'+n+'</strong>').join('');
  assert.equal(parseLottery(html,'https://news.sanook.com/lotto/').frontThree[0],'060');
  assert.equal(parseLottery('<title>ตรวจหวย 1 ตุลาคม 2569</title><strong class="lotto__number">รอผล</strong>','test'),null);
});
test('live discovery rejects ended and non-embeddable streams',()=>{
  function page(live,embed=true){return '<link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk"><script>var ytInitialPlayerResponse = '+JSON.stringify({playabilityStatus:{status:'OK',playableInEmbed:embed},videoDetails:{title:'ข่าวสด'},microformat:{playerMicroformatRenderer:{liveBroadcastDetails:{isLiveNow:live}}}})+';</script>';}
  assert.ok(parseStream(page(true),{name:'ทดสอบ'}));assert.equal(parseStream(page(false),{}),null);assert.equal(parseStream(page(true,false),{}),null);
});
test('only safe links are retained and Bing wrapper is unwrapped',()=>{
  assert.equal(directUrl('javascript:alert(1)'),'');
  assert.equal(directUrl('https://www.bing.com/news/apiclick?url=https%3A%2F%2Fwww.thaipbs.or.th%2Fnews%2Fcontent%2F1'),'https://www.thaipbs.or.th/news/content/1');
});
test('navigation uses real anchors, middle clicks stay native, and loading is scoped to news',async()=>{
  const html=await worker.fetch(new Request('https://example.test/'),{}).then(r=>r.text());
  assert.match(html,/<a class="brand" href="\/"/);
  assert.ok(html.includes('class="ticker-item" href="'));
  assert.ok(html.includes('class="trend" href="'));
  assert.ok(html.includes('href="\'+esc(storyHref(x.title))+\'" role="option"'));
  assert.ok(html.includes('e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey'));
  assert.ok(html.includes('ticker.addEventListener(\'wheel\''));
  assert.ok(html.includes("result.classList.toggle('news-loading',busy)"));
  assert.ok(!html.includes('workspace.classList.add("loading")'));
  assert.ok(html.includes('navigationQuery'));assert.ok(html.includes("checkerSection.id='search'"));
});
test('extension links retain the selection and jump to search',async()=>{
  let created;
  const noop=()=>{};
  const context=vm.createContext({URL,chrome:{runtime:{onInstalled:{addListener:noop},onMessage:{addListener:noop}},contextMenus:{create:noop,onClicked:{addListener:noop}},storage:{sync:{get:async defaults=>defaults}},tabs:{create:async value=>{created=value;}}}});
  vm.runInContext(await readFile(new URL('../extension/background.js',import.meta.url),'utf8'),context);
  await context.openChecker('พาดหัวข่าวทดสอบ');
  const url=new URL(created.url);assert.equal(url.hash,'#search');assert.equal(url.searchParams.get('q'),'พาดหัวข่าวทดสอบ');assert.equal(url.searchParams.get('from'),'extension');
});
