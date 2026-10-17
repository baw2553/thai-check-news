import { searchText, searchTokens } from './news-archive.js';

// Only public publisher sites: do not turn this endpoint into an arbitrary URL fetcher.
const publisherHosts = new Set([
  'thaipbs.or.th', 'thaipbs.th', 'matichon.co.th', 'thaipost.net',
  'bangkokpost.com', 'thairath.co.th', 'khaosod.co.th', 'dailynews.co.th',
  'pptvhd36.com', 'tnnthailand.com', 'nationtv.tv', 'nationthailand.com',
  'bangkokbiznews.com', 'prachachat.net', 'ejan.co', 'thestandard.co',
  'sanook.com', 'naewna.com', 'mgronline.com', 'ch7.com', 'ch3plus.com',
  'workpointtoday.com', 'innnews.co.th', 'thebangkokinsight.com',
  'komchadluek.net', 'tnews.co.th'
]);

export const sourceAccessSnapshot = {
  checkedAt: '2026-10-10',
  note: 'ตรวจ URL ตัวอย่างจากเครื่องทดสอบ; ผลจริงอาจเปลี่ยนตามเวลาและฝั่งเซิร์ฟเวอร์',
  sites: [
    { host: 'thaipbs.or.th', name: 'Thai PBS', status: 'tested_readable', sample: '2/2' },
    { host: 'thaipost.net', name: 'ไทยโพสต์', status: 'tested_readable', sample: '2/2' },
    { host: 'bangkokpost.com', name: 'Bangkok Post', status: 'tested_readable', sample: '2/2' },
    { host: 'matichon.co.th', name: 'มติชนออนไลน์', status: 'variable', sample: 'เครื่องทดสอบ 0/2; เว็บเผยแพร่บางครั้งอ่านได้' },
    { host: 'thairath.co.th', name: 'ไทยรัฐ', status: 'partial', sample: 'หน้าวิดีโอ 1 รายการ' },
    { host: 'innnews.co.th', name: 'INN', status: 'partial', sample: '1 รายการ' },
    { host: 'thebangkokinsight.com', name: 'The Bangkok Insight', status: 'partial', sample: '1 รายการ' },
    { host: 'komchadluek.net', name: 'คมชัดลึก', status: 'partial', sample: '1 รายการ' },
    { host: 'tnews.co.th', name: 'TNews', status: 'partial', sample: '1 รายการ' }
  ]
};

export function validatedPublisherUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (![...publisherHosts].some(host => url.hostname === host || url.hostname === `www.${host}`)) return null;
    if (url.pathname === '/' || /\/(feed|rss)\/?$/i.test(url.pathname) || /\.xml$/i.test(url.pathname)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function plain(value) {
  return String(value || '').replace(/<(?:script|style|nav|aside|footer)\b[^>]*>[\s\S]*?<\/(?:script|style|nav|aside|footer)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&quot;|&#34;/g, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\s+/g, ' ').trim();
}

function meta(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
      .map(x => [x[1].toLowerCase(), x[2]]));
    if (attrs.property === name || attrs.name === name) return plain(attrs.content);
  }
  return '';
}

function structuredArticle(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(match[1]);
      const graph = Array.isArray(root) ? root : root['@graph'] || root;
      const candidates = Array.isArray(graph) ? graph : [graph];
      const article = candidates.find(item => /NewsArticle|Article|ReportageNewsArticle/.test([item?.['@type']].flat().join(' ')) && item.articleBody);
      if (article) return article;
    } catch { /* A malformed JSON-LD block should not hide a readable article. */ }
  }
  return null;
}

export function extractComparisonArticle(html, url) {
  const structured = structuredArticle(html);
  const title = plain(meta(html, 'og:title') || structured?.headline || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  const canonicalTag=[...html.matchAll(/<link\b[^>]*>/gi)].find(m=>/\brel=["']canonical["']/i.test(m[0]))?.[0]||'';
  const canonicalCandidate=canonicalTag.match(/\bhref=["']([^"']+)["']/i)?.[1]||meta(html,'og:url');
  const canonical=validatedPublisherUrl(canonicalCandidate);
  const requestedHost=new URL(url).hostname.replace(/^www\./,'');
  const canonicalHost=canonical?new URL(canonical).hostname.replace(/^www\./,''):'';
  const resolvedUrl=canonicalHost===requestedHost?canonical:url;
  const blocks = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(x => x[1]);
  if (!blocks.length) blocks.push(...[...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)].map(x => x[1]));
  function paragraphsIn(block) {
    const cleaned=block.replace(/<(?:nav|aside|footer|script|style)\b[^>]*>[\s\S]*?<\/(?:nav|aside|footer|script|style)>/gi,'');
    const paragraphs=[];
    for(const match of cleaned.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)){
      const raw=match[1],value=plain(raw);
      if(/^(?:อ่านข่าว|อ่านเพิ่มเติม|ข่าวที่เกี่ยวข้อง|เรื่องที่เกี่ยวข้อง)\s*[:：]?\s*$/i.test(value))break;
      if(/^\s*<a\b[^>]*>[\s\S]*<\/a>\s*$/i.test(raw))continue;
      paragraphs.push(value);
    }
    return paragraphs;
  }
  const choices = blocks.map(paragraphsIn).sort((a, b) => b.join('').length - a.join('').length);
  const paragraphs = structured?.articleBody ? String(structured.articleBody).split(/\n+/).map(plain) : choices[0] || [];
  const filtered = [...new Set(paragraphs.filter(p => p.length >= 60 && !/^(อ่านข่าว|อ่านเพิ่มเติม|ติดตาม|แชร์|สงวนลิขสิทธิ์|นโยบาย|Advertisement)/i.test(p)))];
  const body = filtered.join('\n\n').slice(0, 18000);
  return { url:resolvedUrl, requestedUrl:url, title, body, paragraphCount: filtered.length,
    publishedAt:structured?.datePublished||meta(html,'article:published_time')||null,
    kind:/\/opinion\//i.test(resolvedUrl)?'opinion':'news',
    readable:title.length>=12&&body.length >= 250 && (filtered.length >= 2 || Boolean(structured?.articleBody)) };
}

async function boundedHtml(response) {
  const reader=response.body?.getReader();
  if(!reader)return (await response.text()).slice(0,2_000_000);
  const decoder=new TextDecoder(),parts=[];let bytes=0;
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;
    if(bytes>2_000_000){await reader.cancel();throw Error('article_too_large');}
    parts.push(decoder.decode(value,{stream:true}));}
  parts.push(decoder.decode());return parts.join('');
}

export async function fetchSourceArticle(value, fetcher = fetch) {
  let url = validatedPublisherUrl(value);
  if (!url) return { state: 'unsupported_url', message: 'ยังไม่รองรับการดึงบทความจาก URL หรือเว็บไซต์นี้' };
  for (let redirect = 0; redirect < 3; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    let response;
    try {
      response = await fetcher(url, { signal: controller.signal, redirect: 'manual',
        headers: { 'user-agent': 'ThaiCheckNews/0.6 (+public article comparison)' } });
      if (response.status >= 300 && response.status < 400) {
        const next = validatedPublisherUrl(new URL(response.headers.get('location') || '', url).href);
        if (!next) return { state: 'source_unavailable', message: 'เว็บไซต์ต้นทางเปลี่ยนเส้นทางไปยังหน้าที่ไม่รองรับ' };
        url = next;
        continue;
      }
      if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || ''))
        return { state: 'source_unavailable', message: `ไม่สามารถดึงเนื้อหาข่าวจากเว็บไซต์ต้นทางได้ (HTTP ${response.status})` };
      const length = Number(response.headers.get('content-length') || 0);
      if (length > 2_000_000) return { state: 'source_unavailable', message: 'หน้าเว็บมีขนาดใหญ่เกินกว่าระบบจะอ่านอย่างปลอดภัย' };
      const html = await boundedHtml(response);
      const article = extractComparisonArticle(html, url);
      if (!article.readable) return { state: 'source_unavailable', message: 'เปิดหน้าเว็บได้ แต่ดึงเนื้อหาบทความจริงไม่เพียงพอสำหรับเปรียบเทียบ' };
      return { state: 'readable', article };
    } catch (error) {
      if(String(error).includes('article_too_large'))return { state: 'source_unavailable', message: 'หน้าเว็บมีขนาดใหญ่เกินกว่าระบบจะอ่านอย่างปลอดภัย' };
      return { state: 'source_unavailable', message: 'ไม่สามารถเชื่อมต่อหรือดึงเนื้อหาข่าวจากเว็บไซต์ต้นทางได้' };
    } finally { clearTimeout(timer); }
  }
  return { state: 'source_unavailable', message: 'เว็บไซต์ต้นทางเปลี่ยนเส้นทางหลายครั้งเกินไป' };
}

const toneWords = ['ช็อก', 'ตะลึง', 'สนั่น', 'เดือด', 'แฉ', 'พังยับ', 'สุดสลด', 'ถล่ม', 'ด่วนที่สุด'];
function publisherKey(value) { try { const host=new URL(value).hostname.replace(/^www\./, '');return host==='thaipbs.th'?'thaipbs.or.th':host; } catch { return ''; } }
function numericFacts(value){return [...new Set((String(value).match(/\d+(?:[.,]\d+)?/g)||[]).filter(n=>!/^(?:20|25)\d{2}$/.test(n)&&n.length<10))];}

export function compareSourceToEvidence(article, reports) {
  const sourceHost = publisherKey(article.url);
  const independent = [...new Map(reports.filter(r => r.contentRead && r.excerpt && publisherKey(r.url) !== sourceHost)
    .map(r => [publisherKey(r.url) || r.source, r])).values()];
  const cues = [...new Set(toneWords.filter(word => article.title.includes(word)))];
  if (!independent.length) return { state: 'insufficient_comparison',
    message: 'มีข่าวในคลัง แต่ยังอ่านเนื้อหาจากแหล่งอิสระอื่นได้ไม่พอสำหรับเปรียบเทียบการเล่า',
    toneCues: cues, shared: [], additional: [], evidence: [] };
  const otherTexts = independent.map(r => searchText(`${r.title} ${r.excerpt}`));
  const otherPassages=independent.map(r=>String(r.excerpt).split(/\n\n+/).filter(p=>p.length>=60));
  const passages = article.body.split(/\n\n+/).map(plain).filter(p => p.length >= 60).slice(0, 12);
  const shared = [], additional = [], numberDifferences=[];
  for (const passage of passages) {
    const terms = searchTokens(passage).filter(term => term.length >= 3);
    if (terms.length < 3) continue;
    const supporting = otherTexts.map((text, i) => ({ report: independent[i], count: terms.filter(term => text.includes(term)).length }))
      .filter(item => item.count >= Math.max(2, Math.ceil(terms.length * .5)));
    const item = { text: passage.slice(0, 220), sources: supporting.map(s => s.report.source) };
    if (supporting.length) shared.push(item);
    else additional.push(item);
    const ownNumbers=numericFacts(passage);
    if(ownNumbers.length===1&&Number(ownNumbers[0])>=3)for(let i=0;i<otherPassages.length;i++)for(const other of otherPassages[i]){
      const otherTerms=searchTokens(other).filter(term=>term.length>=3);
      const overlap=terms.filter(term=>otherTerms.some(t=>t===term||t.includes(term)||term.includes(t))).length;
      const theirNumbers=numericFacts(other);
      if(overlap>=Math.max(3,Math.ceil(terms.length*.7))&&theirNumbers.length===1&&Number(theirNumbers[0])>=3&&ownNumbers[0]!==theirNumbers[0]){
        numberDifferences.push({sourceNumbers:ownNumbers.slice(0,4),otherNumbers:theirNumbers.slice(0,4),source:independent[i].source,url:independent[i].url});break;
      }
    }
  }
  const assessment=independent.length<2?{code:'limited',label:'เทียบเบื้องต้น — ยังไม่ฟันธง'}
    :numberDifferences.length?{code:'numbers',label:'ตัวเลขต่างกัน — ต้องตรวจช่วงเวลาและบริบท'}
    :shared.length>=2&&additional.length===0&&!cues.length?{code:'aligned',label:'ประเด็นหลักสอดคล้องกับหลายแหล่ง'}
    :{code:'review',label:'มีรายละเอียดหรือสำนวนที่ควรตรวจต่อ'};
  return {
    state: 'compared',
    message: `เทียบกับเนื้อหาจาก ${independent.length} แหล่งอิสระ: พบประเด็นสอดคล้อง ${shared.length} จุด และรายละเอียดที่ยังไม่พบในแหล่งเทียบ ${additional.length} จุด`,
    assessment,
    toneCues: cues, shared: shared.slice(0, 3), additional: additional.slice(0, 3),
    numberDifferences:numberDifferences.slice(0,3),
    evidence: independent.map(r => ({ source: r.source, title: r.title, url: r.url, publishedAt: r.publishedAt }))
  };
}
