import {enhanceHtml, directUrl, enrichEvidence, compareContent, goldPrices, lotteryResults, liveStreams, publisherIconHosts} from './news-features.js';
import {fetchSourceArticle, compareSourceToEvidence, sourceAccessSnapshot} from './source-comparison.js';
import {ARCHIVE_START,ARCHIVE_START_ISO,searchText,searchTokens,archiveReports,archivedSourceEvent,activeReports,archiveStats,saveReports,validDay,getRefreshTime,setRefreshTime,getDailySnapshot,setDailySnapshot} from './news-archive.js';
const BRAND = "Thai Check News";
const GOOGLE_NEWS = "https://news.google.com/rss";
const THAI_PBS = "https://www.thaipbs.or.th";
const CACHE_SECONDS = 1800;
const FEED_REFRESH_MS = 30*60*1000;
const DIRECT_FEEDS = [
  { source: "มติชนออนไลน์", url: "https://www.matichon.co.th/feed", kind: "สำนักข่าวหลัก" },
  { source: "ไทยโพสต์", url: "https://www.thaipost.net/feed/", kind: "สำนักข่าวหลัก" },
  { source: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/topstories.xml", kind: "สำนักข่าวหลัก" }
];
const STOP_WORDS = new Set(["และ","หรือ","ที่","ใน","ของ","จาก","เป็น","ว่า","มี","ยัง","แล้ว","เพื่อ","กับ","ให้","ได้","โดย","หลัง","ก่อน","วันนี้","ข่าว","ล่าสุด","เมื่อ","นี้","นั้น","การ","ไทย","จะ","ไป","มา","เผย","ระบุ","รายงาน"]);
const ACTIONS = ["หารือ","อนุมัติ","ประกาศ","เตือน","จับกุม","แจ้งความ","อุ้ม","คุมขัง","ถูกขัง","พาตัว","เสียชีวิต","บาดเจ็บ","ลดค่าไฟ","ช่วยเหลือ","น้ำท่วม","แผ่นดินไหว","เลือกตั้ง","ลาออก","แต่งตั้ง","เปิดเผย","ชี้แจง","อพยพ","ยกเลิก","เลื่อน","ปิด","เปิด","เพิ่ม","ลด","สั่ง","เร่ง","ตรวจสอบ"];
const PLACES = ["กรุงเทพ","กทม","เชียงใหม่","เชียงราย","ภูเก็ต","ชลบุรี","สงขลา","ปัตตานี","ยะลา","นราธิวาส","ขอนแก่น","นครราชสีมา","โคราช","อุบลราชธานี","สุราษฎร์ธานี","นครศรีธรรมราช","อยุธยา","นนทบุรี","ปทุมธานี","สมุทรปราการ","ประเทศไทย"];
const SOURCE_WEIGHTS = [
  [/thai\s*pbs|กรม|กระทรวง|สำนักงาน|ตำรวจ|กกพ|go\.th/i, 1],
  [/มติชน|ไทยรัฐ|ข่าวสด|เดลินิวส์|ไทยโพสต์|ประชาชาติ|กรุงเทพธุรกิจ|the standard|pptv|ช่อง 3|ช่อง 7|workpoint|nation|bangkok post/i, .92],
  [/ท้องถิ่น|จังหวัด|เทศบาล|อบต|เพจ/i, .76]
];
const FALLBACK = [
  {id:"f1",title:"กทม.เร่งระบายน้ำและช่วยเหลือประชาชนหลังฝนตกหนัก",publishedAt:"2026-09-28T13:09:22+07:00",reports:[
    {source:"Thai PBS News",title:"กทม.เร่งระบายน้ำ หลังหลายพื้นที่ได้รับผลกระทบจากฝนตกหนัก",url:"https://www.thaipbs.or.th/news",publishedAt:"2026-09-28T13:09:22+07:00",kind:"สำนักข่าวหลัก"},
    {source:"ข่าวท้องถิ่นกรุงเทพ",title:"หลายเขตเร่งสูบน้ำและเปิดจุดช่วยเหลือประชาชน",url:"https://news.google.com/",publishedAt:"2026-09-28T13:30:00+07:00",kind:"ข่าวพื้นที่"}
  ]},
  {id:"f2",title:"กกพ.หารือมาตรการลดค่าไฟช่วยผู้ประสบภัยน้ำท่วม",publishedAt:"2026-09-28T12:38:42+07:00",reports:[
    {source:"Thai PBS News",title:"กกพ.จ่อชงลดค่าไฟช่วยน้ำท่วม หารือหน่วยงานใน 1-2 สัปดาห์",url:"https://www.thaipbs.or.th/news/content/558750",publishedAt:"2026-09-28T12:38:42+07:00",kind:"สำนักข่าวหลัก"},
    {source:"อีจัน",title:"ลุ้นลดค่าไฟ! กกพ.เตรียมถกมาตรการช่วยคนเจอน้ำท่วม ต้นเดือน ต.ค. 69",url:"https://www.ejan.co/economics/4j5um8pp54ay",publishedAt:"2026-09-28T15:14:00+07:00",kind:"ข่าวเฉพาะทาง"}
  ]}
];

function decodeEntities(v){return String(v||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&#(\d+);/g,function(_,c){return String.fromCodePoint(Number(c));}).replace(/&#x([0-9a-f]+);/gi,function(_,c){return String.fromCodePoint(parseInt(c,16));}).replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&nbsp;/g," ");}
function cleanText(v){return decodeEntities(v).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function field(block,tag){var m=block.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","i"));return m?m[1]:"";}
function stripPublisher(v){return cleanText(v).replace(/\s+-\s+[^-]{2,80}$/u,"").trim();}
const textCache=new Map(),profileCache=new Map(),runtimeCache=new Map(),pendingJobs=new Map();
function memo(map,key,fn){if(map.has(key))return map.get(key);const value=fn();if(map.size>=4000)map.clear();map.set(key,value);return value;}
function normalize(v){return memo(textCache,String(v||''),()=>searchText(cleanText(v)));}
async function shared(key,ttl,fn){const old=runtimeCache.get(key);if(old&&old.until>Date.now())return old.value;if(pendingJobs.has(key))return pendingJobs.get(key);const p=fn().then(value=>{if(runtimeCache.size>=180)runtimeCache.clear();runtimeCache.set(key,{until:Date.now()+ttl,value});return value;}).finally(()=>pendingJobs.delete(key));pendingJobs.set(key,p);return p;}
function stableId(v){var h=2166136261;for(var ch of String(v)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function ngrams(v,n){n=n||3;var s=normalize(v).replace(/\s/g,""),out=new Set();for(var i=0;i<=s.length-n;i++)out.add(s.slice(i,i+n));return out;}
function dice(a,b){var A=ngrams(a),B=ngrams(b);if(!A.size||!B.size)return 0;var hit=0;for(var x of A)if(B.has(x))hit++;return 2*hit/(A.size+B.size);}
function words(v){return searchTokens(v).filter(w=>!STOP_WORDS.has(w));}
function setOverlap(A,B){if(!A.length||!B.length)return 0;var b=new Set(B),hit=A.filter(function(x){return b.has(x)||[...b].some(function(y){return x.includes(y)||y.includes(x);});}).length;return hit/Math.max(A.length,B.length);}
function numbers(v){return normalize(v).match(/\d+(?:[.,]\d+)?/g)||[];}
function extractActions(v){var t=normalize(v);return ACTIONS.filter(function(x){return t.includes(x);});}
function extractPlaces(v){var raw=cleanText(v),t=normalize(v);var found=PLACES.filter(function(x){return t.includes(x);});var provinces=[...raw.matchAll(/(?:จ\.|จังหวัด)\s*([ก-๙]{3,20})/g)].map(function(m){return m[1];});return [...new Set(found.concat(provinces))];}
function extractTimePhrases(v){var text=cleanText(v),patterns=[/วันนี้(?:\s*\([^)]{2,24}\))?/g,/เมื่อวาน(?:นี้)?/g,/ต้นเดือน\s+[ก-๙.]+\s*\d{2,4}/g,/ปลายเดือน\s+[ก-๙.]+\s*\d{2,4}/g,/\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:วัน|สัปดาห์|เดือน)/g,/\d{1,2}\s*(?:วัน|สัปดาห์|เดือน)/g,/(?:เวลา\s*)?\d{1,2}[.:]\d{2}\s*น\.?/g,/\d{1,2}\s+[ก-๙.]+\s+\d{2,4}/g],out=[];for(var p of patterns)for(var m of text.matchAll(p))out.push(m[0]);return [...new Set(out)].slice(0,5);}
function extractEntities(v){var t=cleanText(v),out=[];for(var m of t.matchAll(/[“"]([^”"]{3,40})[”"]/g))out.push(normalize(m[1]));for(var m2 of t.matchAll(/\b[A-Z][A-Z0-9.]{1,9}\b/g))out.push(normalize(m2[0]));var hints=["กกพ","กทม","รัฐบาล","ตำรวจ","ปภ","กกต","สภา","ครม","นายก","กระทรวง","กรม","สำนักงาน","บริษัท","มหาวิทยาลัย"];for(var h of hints)if(normalize(t).includes(h))out.push(h);return [...new Set(out)];}
function sourceWeight(source,url){var text=String(source||"")+" "+String(url||"");for(var pair of SOURCE_WEIGHTS)if(pair[0].test(text))return pair[1];return .64;}
function hoursApart(a,b){var d=Math.abs(new Date(a)-new Date(b))/36e5;return Number.isFinite(d)?d:999;}
function features(a,b,meta){
  function profile(text){return memo(profileCache,text,()=>({terms:words(text),entities:extractEntities(text),actions:extractActions(text),places:extractPlaces(text),numbers:numbers(text),grams:ngrams(text)}));}
  var A=profile(a),B=profile(b),wa=A.terms,wb=B.terms,ea=A.entities,eb=B.entities,aa=A.actions,ab=B.actions,pa=A.places,pb=B.places,na=A.numbers,nb=B.numbers;
  var hits=0;for(var gram of A.grams)if(B.grams.has(gram))hits++;
  return {
    language:A.grams.size&&B.grams.size?2*hits/(A.grams.size+B.grams.size):0,terms:setOverlap(wa,wb),entities:ea.length&&eb.length?setOverlap(ea,eb):.35,
    actions:aa.length&&ab.length?setOverlap(aa,ab):.3,places:pa.length&&pb.length?setOverlap(pa,pb):.35,
    numbers:na.length&&nb.length?setOverlap(na,nb):na.length||nb.length?.35:.55,
    time:meta&&meta.time!=null?Math.max(0,1-meta.time/72):.7,
    source:meta&&meta.source!=null?meta.source:.75
  };
}

function trainModel(){
  var base=[
    [[.82,.82,.9,.85,.8,.8,.9,.9],1],[[.62,.72,.85,.9,.55,.75,.8,.85],1],[[.48,.63,.9,.8,.85,.7,.88,.8],1],[[.42,.58,.75,.9,.9,.85,.8,.9],1],
    [[.28,.32,.2,.2,.3,.3,.8,.8],0],[[.52,.38,.2,.15,.2,.2,.7,.8],0],[[.18,.25,.5,.25,.1,.65,.1,.7],0],[[.35,.45,.3,.4,.2,.1,.9,.5],0]
  ],samples=[];
  for(var i=0;i<18;i++)for(var item of base){var x=item[0].map(function(v,j){return Math.max(0,Math.min(1,v+(((i*17+j*11)%9)-4)*.012));});samples.push([x,item[1]]);}
  var w=[-2.3,.7,.9,1.05,1.15,.65,.55,.55,.35],rate=.075;
  for(var e=0;e<240;e++)for(var sample of samples){var z=w[0];for(var j=0;j<8;j++)z+=w[j+1]*sample[0][j];var p=1/(1+Math.exp(-z)),err=p-sample[1];w[0]-=rate*err;for(var k=0;k<8;k++)w[k+1]-=rate*(err*sample[0][k]+.001*w[k+1]);}
  return w;
}
const MODEL=trainModel();
function modelScore(f){var x=[f.language,f.terms,f.entities,f.actions,f.places,f.numbers,f.time,f.source],z=MODEL[0];for(var i=0;i<x.length;i++)z+=MODEL[i+1]*x[i];return 1/(1+Math.exp(-z));}
const longGramCache=new Map();
function longGrams(value){return memo(longGramCache,value,()=>ngrams(value,8));}
function sharedLongGrams(a,b){const A=longGrams(a),B=longGrams(b);let hit=0;for(const g of A)if(B.has(g))hit++;return hit;}
function reportingActor(value){const text=normalize(value).replace(/^[“"'‘\s]+/,'');return /^(แม่|พ่อ|ลูกชาย|ลูกสาว)/.exec(text)?.[1]||'';}
const GENERIC_EVENT_WORDS=new Set(['ข่าว','วันนี้','ล่าสุด','รายงาน','เรื่อง','คน','ประชาชน','ผู้','เจ้าหน้าที่','รัฐบาล','กรม','กทม','ไทย','ประเทศ','พื้นที่','จังหวัด','ร่วม','หลัง','ก่อน','กำลัง','เร่ง','เพิ่ม','ลด','ประกาศ','เตือน','น้ำท่วม','ฝน','อากาศ','สภาพ','เลือก','ตั้ง','เลือกตั้ง','ประกัน','สังคม','สิทธิ','บอร์ด','ผล','ราย','ช่วง','ใหม่','หลาย','ทั่ว','พบ','เผย','ชี้','วัน','เวลา','กกต','พรรค','การเมือง','บริจาค','เงิน','ข้อมูล','กฎหมาย','สอบ','คดี']);
const eventSegmenter=new Intl.Segmenter('th',{granularity:'word'});
function specificEventTerms(value){return new Set([...eventSegmenter.segment(normalize(value))].filter(x=>x.isWordLike&&x.segment.length>=2&&!/^\d+$/.test(x.segment)&&!GENERIC_EVENT_WORDS.has(x.segment)).map(x=>x.segment));}
function bulletinNumber(value){return /(?:เตือน)?\s*ฉ(?:บับ)?\.?\s*(\d{1,3})/u.exec(cleanText(value))?.[1]||'';}
function electionStage(value){const t=normalize(value);if(!/เลือกตั้ง|ประกันสังคม|บอร์ด/.test(t))return '';
  if(/รองเท้า|ส่วนลด|ลด\s*\d+\s*%/.test(t))return 'promotion';
  if(/ปิดหีบ|ปิดคูหา|นับคะแนน|ผลเลือกตั้ง|คะแนนนำ|ขึ้นนำ/.test(t))return 'counting';
  if(/เปิดหีบ|เปิดคูหา|เริ่มลงคะแนน/.test(t))return 'opening';
  if(/ยอดใช้สิทธิ|ผู้ใช้สิทธิ|ออกมาใช้สิทธิ/.test(t))return 'turnout';
  return '';
}
function claimStage(value){const t=normalize(value);if(/(?:ร้อง|แจ้งความ|ยื่น|ขอสอบ).*(?:สอบ|กกต|ตำรวจ|ปปช)/u.test(t))return 'complaint';if(/(?:โต้|ปฏิเสธ|ชี้แจง|ยืนยัน).*(?:สุจริต|ไม่ผิด|ไม่เกี่ยว|ข้อกล่าวหา)/u.test(t))return 'response';return '';}
function eventRole(value){const t=normalize(value);if(/(?:imf|world bank|ธนาคารโลก)/iu.test(t)){if(/(?:ม็อบ|ต้าน|คัดค้าน|ประท้วง|ชุมนุม)/u.test(t))return 'protest';if(/(?:นายก|เปิดประชุม|เจ้าภาพ|ความสำเร็จ)/u.test(t))return 'official';}return '';}
export function sameNewsEvent(a,b,atA,atB){
  const hours=hoursApart(atA,atB);if(hours>96)return {same:false,score:0};
  const f=features(a,b,{time:hours,source:.82}),score=modelScore(f),actionsA=extractActions(a),actionsB=extractActions(b),actionMatch=setOverlap(actionsA,actionsB),placesA=extractPlaces(a),placesB=extractPlaces(b),actorA=reportingActor(a),actorB=reportingActor(b);
  if(placesA.length&&placesB.length&&setOverlap(placesA,placesB)===0)return {same:false,score};
  if(actionsA.includes('แจ้งความ')&&actionsB.includes('แจ้งความ')&&actorA&&actorB&&actorA!==actorB)return {same:false,score};
  const stageA=electionStage(a),stageB=electionStage(b);
  if(stageA&&stageB&&stageA!==stageB)return {same:false,score,features:f};
  const claimA=claimStage(a),claimB=claimStage(b);if(claimA&&claimB&&claimA!==claimB)return {same:false,score,features:f};
  const roleA=eventRole(a),roleB=eventRole(b);if(roleA&&roleB&&roleA!==roleB)return {same:false,score,features:f};
  const named=value=>[...cleanText(value).matchAll(/[“”"‘’']([^“”"‘’']{3,35})[“”"‘’']/gu)].map(x=>normalize(x[1])).filter(x=>!GENERIC_EVENT_WORDS.has(x));
  const namedA=named(a),namedB=named(b);
  if((namedA.length>=2||namedB.length>=2)&&!namedA.some(x=>namedB.some(y=>x===y||x.length>=5&&y.includes(x)||y.length>=5&&x.includes(y)))&&f.language<.4)return {same:false,score,features:f};
  const firstBulletin=bulletinNumber(a),secondBulletin=bulletinNumber(b);
  if(firstBulletin&&secondBulletin&&firstBulletin!==secondBulletin)return {same:false,score,features:f};
  if(Boolean(firstBulletin)!==Boolean(secondBulletin)&&f.language<.55)return {same:false,score,features:f};
  const A=specificEventTerms(a),B=specificEventTerms(b),specific=[...A].filter(term=>B.has(term)).length;
  const coreActions=actions=>actions.filter(x=>!['เร่ง','เพิ่ม','ลด','เปิด','ปิด','เตือน'].includes(x));
  const coreA=coreActions(actionsA),coreB=coreActions(actionsB),coreOverlap=setOverlap(coreA,coreB);
  const actionConflict=coreA.length&&coreB.length&&coreOverlap===0;
  const exact=normalize(a)===normalize(b),tight=f.language>=.52&&f.terms>=.44&&actionMatch>=.3&&!actionConflict;
  const anchored=specific>=2&&f.language>=.20&&f.terms>=.18&&!actionConflict&&(coreOverlap>=.25||specific>=3);
  const sameBulletin=firstBulletin&&firstBulletin===secondBulletin&&f.language>=.27&&f.terms>=.3&&actionMatch>=.3;
  return {same:!!(exact||tight||anchored||sameBulletin),score,features:f};
}
function uniqueReports(reports){var seenTitles=new Set(),seenUrls=new Set();return reports.filter(function(r){var title=normalize(r.source)+"|"+normalize(r.title),url=directUrl(r.url);if(!r.title||seenTitles.has(title)||url&&seenUrls.has(url))return false;seenTitles.add(title);if(url)seenUrls.add(url);return true;});}
function sourceField(block){var m=block.match(/<source(?:\s+url="([^"]+)")?[^>]*>([\s\S]*?)<\/source>/i);return {url:m?m[1]:"",name:cleanText(m?m[2]:"Google News")};}
function imageFrom(block){var m=block.match(/<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i)||block.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)||decodeEntities(field(block,"description")+" "+field(block,"content:encoded")).match(/<img[^>]+src=["']([^"']+)["']/i);return m?decodeEntities(m[1]).replace(/^\/\//,"https://"):null;}
function parseGenericRss(xml,feed){
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(function(m,i){var b=m[1],raw=cleanText(field(b,"title")),title=stripPublisher(raw),url=cleanText(field(b,"link"))||cleanText(field(b,"guid")),date=cleanText(field(b,"pubDate"))||cleanText(field(b,"dc:date")),publishedAt=new Date(date||Date.now()).toISOString(),source=sourceField(b),name=source.name&&source.name!=="Google News"?source.name:feed.source;return {id:stableId(url||title+i),title:title,publishedAt:publishedAt,reports:[{source:name,title:title,url:url||feed.url,publishedAt:publishedAt,image:imageFrom(b),kind:feed.kind||"สำนักข่าว"}]};}).filter(function(x){return x.title;});
}
function parseGoogleNews(xml){
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(function(m,i){var b=m[1],raw=cleanText(field(b,"title")),title=stripPublisher(raw),url=cleanText(field(b,"link")),date=new Date(cleanText(field(b,"pubDate"))||Date.now()).toISOString(),src=sourceField(b),desc=decodeEntities(field(b,"description"));var related=[...desc.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<font[^>]*>([\s\S]*?)<\/font>/gi)].map(function(x){return {url:decodeEntities(x[1]),title:cleanText(x[2]),source:cleanText(x[3])||"Google News",publishedAt:date,kind:"สำนักข่าว/ข่าวพื้นที่"};});return {id:cleanText(field(b,"guid"))||stableId(title+i),title:title,publishedAt:date,reports:uniqueReports([{source:src.name,sourceHome:src.url,title:title,url:url,publishedAt:date,image:imageFrom(b),kind:"สำนักข่าว/ข่าวพื้นที่"}].concat(related))};}).filter(function(x){return x.title&&x.reports.length;});
}
function parseBing(xml){
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(function(m,i){var b=m[1],title=stripPublisher(field(b,"title")),url=cleanText(field(b,"link")),date=new Date(cleanText(field(b,"pubDate"))||Date.now()).toISOString(),src=cleanText(field(b,"News:Source"))||cleanText(field(b,"source"))||"Bing News";return {id:stableId(url||title+i),title:title,publishedAt:date,reports:[{source:src,title:title,url:url,publishedAt:date,image:cleanText(field(b,"News:Image"))||imageFrom(b),kind:"ข่าวเฉพาะ/ข่าวพื้นที่"}]};}).filter(function(x){return x.title;});
}
function bangkokDates(){var parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),v=Object.fromEntries(parts.map(function(p){return [p.type,p.value];})),today=v.year+"-"+v.month+"-"+v.day,point=new Date(today+"T05:00:00Z");point.setUTCDate(point.getUTCDate()-1);return {today:today,yesterday:point.toISOString().slice(0,10)};}
function parseThaiPBS(html,date){var matches=[...html.matchAll(/<a[^>]+title="([^"]+)"[^>]+data-url="(\/news\/content\/(\d+))"[^>]*>/gi)],map=new Map();for(var m of matches){if(map.has(m[3]))continue;var near=html.slice(m.index,m.index+6500),published=near.match(/<time[^>]+dateTime="([^"]+)"/i),img=near.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i),title=cleanText(m[1]),publishedAt=published?published[1]:date+"T00:00:00+07:00";map.set(m[3],{id:m[3],title:title,publishedAt:publishedAt,reports:[{source:"Thai PBS News",title:title,url:THAI_PBS+m[2],publishedAt:publishedAt,image:img?decodeEntities(img[1]):null,kind:"สำนักข่าวหลัก"}]});}return [...map.values()].slice(0,80);}
async function fetchWithTimeout(url,ms){var c=new AbortController(),t=setTimeout(function(){c.abort();},ms||4500);try{var r=await fetch(url,{headers:{"user-agent":"ThaiCheckNews/0.6 event-monitor"},signal:c.signal,cf:{cacheTtl:CACHE_SECONDS,cacheEverything:true}});var body=await r.text();return {ok:r.ok,status:r.status,text:async()=>body};}finally{clearTimeout(t);}}
function publisherIconFromHtml(markup,host){
  const root=host.replace(/^www\./,''),tags=String(markup).match(/<link\b[^>]*>/gi)||[];
  for(const tag of tags){const rel=/\brel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]||'',href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]||'';
    if(!/^(?:shortcut\s+)?icon$/i.test(rel.trim())||!href)continue;
    try{const icon=new URL(decodeEntities(href),'https://'+host+'/'),iconHost=icon.hostname.toLowerCase();if(icon.protocol==='https:'&&(iconHost===root||iconHost.endsWith('.'+root)))return icon.href;}catch{}
  }
  return 'https://'+host+'/favicon.ico';
}
async function publisherIconResponse(rawHost){
  const host=String(rawHost||'').trim().toLowerCase(),root=host.replace(/^www\./,'');
  if(!/^[a-z0-9.-]{4,100}$/.test(host)||!publisherIconHosts.includes(root)||host!==root&&host!=='www.'+root)return new Response(null,{status:404});
  const icon=await shared('publisher-icon:'+host,3600000,async()=>{try{const homepage=await fetchWithTimeout('https://'+host+'/',3500);if(homepage.ok)return publisherIconFromHtml(await homepage.text(),host);}catch{}return 'https://'+host+'/favicon.ico';});
  const image=await shared('publisher-icon-image:'+host,3600000,async()=>{
    for(const candidate of new Set([icon,'https://'+host+'/favicon.ico'])){
      try{let target=new URL(candidate);for(let redirect=0;redirect<3;redirect++){
        if(target.protocol!=='https:'||target.hostname!==root&&!target.hostname.endsWith('.'+root))break;
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);let response;
        try{response=await fetch(target.href,{redirect:'manual',signal:controller.signal,headers:{accept:'image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,image/gif'}});}finally{clearTimeout(timer);}
        if(response.status>=300&&response.status<400){const next=response.headers.get('location');if(!next)break;target=new URL(next,target);continue;}
        if(!response.ok)break;
        let type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
        if(type==='application/octet-stream'&&/\.ico$/i.test(target.pathname))type='image/x-icon';
        if(!['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon','image/gif','image/avif'].includes(type)||Number(response.headers.get('content-length')||0)>262144)break;
        const chunks=[],reader=response.body?.getReader(),sizeLimit=262144;let size=0;if(!reader)break;
        while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>sizeLimit){await reader.cancel();break;}chunks.push(part.value);}
        if(!size||size>sizeLimit)break;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return {bytes,type};
      }}catch{}
    }
    return null;
  });
  return image?new Response(image.bytes,{headers:{'content-type':image.type,'cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}}):new Response(null,{status:404});
}
export function clusterItems(items){
  var clusters=[],clusterTerms=new Map(),urlCluster=new Map();
  for(var item of items.sort(function(a,b){return new Date(b.publishedAt)-new Date(a.publishedAt);})){
    const matchedReports=(item.reports||[]).filter(r=>sameNewsEvent(item.title,r.title,item.publishedAt,r.publishedAt).same);
    var best=null,bestScore=0,itemTerms=searchTokens(item.title),itemUrls=matchedReports.map(r=>directUrl(r.url)||r.url).filter(Boolean);
    for(const url of itemUrls)if(urlCluster.has(url)){best=urlCluster.get(url);bestScore=1;break;}
    if(!best)for(var c of clusters){
      if(hoursApart(item.publishedAt,c.publishedAt)>96)continue;
      const tokens=clusterTerms.get(c),common=itemTerms.filter(t=>tokens.has(t)).length;
      if(common<2)continue;
      if(!sameNewsEvent(item.title,c.anchorTitle,c.publishedAt,item.publishedAt).same)continue;
      for(const title of [c.title,...c.reports.slice(0,4).map(r=>r.title)]){
        const match=sameNewsEvent(item.title,title,item.publishedAt,c.publishedAt);
        if(match.same&&match.score>=bestScore){bestScore=match.score;best=c;}
      }
    }
    if(best){best.reports=uniqueReports(best.reports.concat(matchedReports));if(new Date(item.publishedAt)>new Date(best.publishedAt)){best.publishedAt=item.publishedAt;best.title=item.title;}best.clusterScore=Math.max(best.clusterScore||0,bestScore);for(const t of itemTerms)clusterTerms.get(best).add(t);}
    else{best={id:item.id||stableId(item.title),eventKey:stableId(normalize(item.title)),anchorTitle:item.title,title:item.title,publishedAt:item.publishedAt,reports:uniqueReports(matchedReports),clusterScore:1};clusters.push(best);clusterTerms.set(best,new Set(itemTerms));}
    for(const url of itemUrls)urlCluster.set(url,best);
  }
  return clusters.sort(function(a,b){return new Date(b.publishedAt)-new Date(a.publishedAt);});
}
function flatten(clusters){return uniqueReports(clusters.flatMap(function(c){return c.reports.map(function(r){return Object.assign({},r,{eventTitle:c.title,eventKey:c.eventKey||r.eventKey||stableId(normalize(c.title))});});}));}
async function persistReports(env,reports,options={}){try{await saveReports(env,reports,{stableId,entities:extractEntities,terms:words,...options});}catch(e){console.error('news_archive_write',String(e));throw e;}}
function reportsAsItems(reports){return reports.map(r=>({id:r.id||stableId(r.url),title:r.title,publishedAt:r.publishedAt,reports:[r]}));}
async function loadArchive(env,options={}){return reportsAsItems(await archiveReports(env,options));}
export function activeClusters(reports,at=new Date()){
  return clusterItems(reportsAsItems(reports)).map(c=>{const changed=Math.max(0,...c.reports.map(r=>Date.parse(r.materialUpdatedAt||'')||0));return {...c,sourceCount:independent(c.reports).length,lastChanged:changed,expiresAt:new Date(changed+86400000).toISOString()};}).filter(c=>Date.parse(c.expiresAt)>+at).sort((a,b)=>b.lastChanged-a.lastChanged||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
function homepageCategory(title){
  const t=normalize(title);
  if(/แจ้งความ|ตำรวจ|ตร\.|จับกุม|จับ|อุ้ม|คดี|ผู้เสียหาย|ศบส|ศูนย์ดูแล|บ่อน/.test(t))return 'justice';
  if(/น้ำท่วม|ฝนหนัก|อุทกภัย|ระบายน้ำ|เยียวยา|เขื่อน/.test(t))return 'weather';
  if(/ในหลวง|พระราชินี|พระบรม|พระราชทาน/.test(t))return 'royal';
  if(/นายก|รัฐบาล|สภา|รัฐมนตรี|กกต|เลือกตั้ง|พรรค|ป\.ป\.ช/.test(t))return 'politics';
  if(/ฟุตบอล|กีฬา|กอล์ฟ|เทเบิลเทนนิส|นักกีฬา|ทีมชาติ|เวิลด์|แชมป์/.test(t))return 'sports';
  if(/เศรษฐกิจ|ราคาทอง|ดีเซล|น้ำมัน|โรงงาน|ตลาดหุ้น|ค่าไฟ|เงินบาท|ภาษี/.test(t))return 'economy';
  return 'other';
}
function homepageAnchors(title){
  const quoted=[...String(title).matchAll(/[“"‘']([^”"’']{5,35})[”"’']/g)].map(m=>normalize(m[1]));
  const people=[...String(title).matchAll(/แม่[ก-๙]{3,14}/g)].map(m=>normalize(m[0]));
  return [...new Set(quoted.concat(people))].filter(s=>s.length>=5&&!/^(?:ผู้เสียหาย|ลูกชาย|ลูกสาว|ผู้เกี่ยวข้อง|รัฐบาล|ประชาชน|ข่าวล่าสุด)$/.test(s));
}
function sameHomepageTopic(a,b){
  if(sameNewsEvent(a.title,b.title,a.publishedAt,b.publishedAt).same)return true;
  const A=normalize(a.title),B=normalize(b.title);
  if(homepageAnchors(a.title).some(x=>B.includes(x))||homepageAnchors(b.title).some(x=>A.includes(x)))return true;
  const f=features(a.title,b.title);return f.language>=.48&&f.terms>=.4;
}
function homepageCandidate(c){const t=cleanText(c.title);return t.length>=26&&!/(?:ชวนคนไทย|เสริมแกร่งพันธมิตร|ประกาศความสำเร็จ|ลัคนาราศีใด|เคล็ดลับเสริมดวง|ฉบับวันที่\s*\d|บอกรักผ่านกิจกรรม)/.test(t);}
export function selectHomepageStories(clusters,limit=12){
  const pool=clusters.filter(c=>!c.expiresAt||Date.parse(c.expiresAt)>Date.now()).filter(homepageCandidate).slice(0,120),topics=[];
  for(const c of pool){let topic=topics.find(group=>group.items.some(other=>sameHomepageTopic(c,other)));if(!topic){topic={items:[],lead:c};topics.push(topic);}topic.items.push(c);if((c.sourceCount||c.reports.length)>(topic.lead.sourceCount||topic.lead.reports.length))topic.lead=c;}
  const representatives=topics.map(group=>group.lead),selected=[],usedCategories=new Set();
  for(const c of representatives){if(selected.length>=Math.min(limit,5))break;const category=homepageCategory(c.title);if(category==='other'||usedCategories.has(category))continue;selected.push(c);usedCategories.add(category);}
  for(const c of representatives){if(selected.length>=limit)break;if(selected.includes(c))continue;selected.push(c);}
  return selected;
}
export function corroboratedStories(clusters,limit=4){
  return clusters.map(c=>{
    const byPublisher=new Map();
    for(const r of c.reports){
      const url=directUrl(r.url);let host='';try{host=new URL(url).hostname.replace(/^www\./,'');}catch{}
      if(!host||/(?:^|\.)(?:google\.com|bing\.com|msn\.com)$/.test(host))continue;
      if(host==='thaipbs.th')host='thaipbs.or.th';
      if(!byPublisher.has(host))byPublisher.set(host,{source:r.source,title:r.title,url});
    }
    return {title:c.title,publishedAt:c.publishedAt,reports:[...byPublisher.values()],sourceCount:byPublisher.size};
  }).filter(c=>c.sourceCount>=2).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,limit);
}
function visibleFeed(feed){return {...feed,clusters:(feed.clusters||[]).filter(c=>!c.expiresAt||Date.parse(c.expiresAt)>Date.now())};}
async function refreshFeed(env){
  var dates=bangkokDates(),items=[],live=false;
  try{
    var urls=[GOOGLE_NEWS+"?hl=th&gl=TH&ceid=TH:th",THAI_PBS+"/news/archive/"+dates.today,THAI_PBS+"/news/archive/"+dates.yesterday].concat(DIRECT_FEEDS.map(function(f){return f.url;}));
    var results=await Promise.allSettled(urls.map(async function(u){var r=await fetchWithTimeout(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.text();}));
    var bodies=results.map(function(r,i){if(r.status==="rejected")console.error("feed_failed",urls[i],String(r.reason));return r.status==="fulfilled"?r.value:"";});
    items=items.concat(bodies[0]?parseGoogleNews(bodies[0]):[],parseThaiPBS(bodies[1]||"",dates.today),parseThaiPBS(bodies[2]||"",dates.yesterday));
    DIRECT_FEEDS.forEach(function(feed,i){if(bodies[i+3])items=items.concat(parseGenericRss(bodies[i+3],feed));});
    live=items.length>0;
  }catch(e){console.error("live_feed",String(e));}
  items=items.filter(x=>Date.parse(x.publishedAt)>=Math.max(Date.parse(ARCHIVE_START_ISO),Date.now()-48*3600000)&&Date.parse(x.publishedAt)<=Date.now()+300000);
  await backfillDay(env,ARCHIVE_START);
  var archive=await loadArchive(env,{limit:240}),clusters=clusterItems(items.concat(archive));
  await persistReports(env,flatten(clusters));
  const checkedAt=new Date().toISOString();await setRefreshTime(env,'feed',checkedAt);
  runtimeCache.delete('active-feed');
  const stored=await activeReports(env);
  return {live:live,checkedAt,dates:dates,sources:["Google News RSS","Thai PBS News","มติชนออนไลน์","ไทยโพสต์","Bangkok Post"],archiveEnabled:!!(env&&env.DB),archiveStart:ARCHIVE_START,clusters:env?.DB?activeClusters(stored).slice(0,240):clusters.slice(0,240).map(c=>({...c,expiresAt:new Date(Date.now()+86400000).toISOString()}))};
}
async function backfillDay(env,day){return shared('archive-day:'+day,86400000,async()=>{try{if((await archiveReports(env,{day,limit:1})).length)return [];const r=await fetchWithTimeout(THAI_PBS+'/news/archive/'+day);if(!r.ok)throw Error('HTTP '+r.status);const items=parseThaiPBS(await r.text(),day);await persistReports(env,flatten(items),{historical:true});return items;}catch(e){console.error('archive_day',day,String(e));return [];}});}
async function getLiveFeed(request,env,ctx){
  const force=new URL(request.url).searchParams.has('refresh');
  const checkedAt=await getRefreshTime(env,'feed'),due=Date.now()-Date.parse(checkedAt||0)>=FEED_REFRESH_MS;
  if(force)runtimeCache.delete('feed-update');
  if(env?.DB?.prepare){
    const reports=await activeReports(env),clusters=activeClusters(reports);
    if(!force&&reports.length&&due&&ctx?.waitUntil){ctx.waitUntil(shared('feed-update',FEED_REFRESH_MS,()=>refreshFeed(env)).catch(e=>console.error('feed_refresh',String(e))));return {live:true,refreshing:true,checkedAt:checkedAt||new Date().toISOString(),sources:DIRECT_FEEDS.map(x=>x.source),archiveEnabled:true,archiveStart:ARCHIVE_START,clusters};}
    if(!force&&reports.length&&!due)return {live:true,checkedAt,sources:DIRECT_FEEDS.map(x=>x.source),archiveEnabled:true,archiveStart:ARCHIVE_START,clusters};
    if(!force&&!reports.length&&!due)return {live:false,checkedAt,sources:[],archiveEnabled:true,archiveStart:ARCHIVE_START,clusters:[]};
  }
  return visibleFeed(await shared('feed-update',force?0:FEED_REFRESH_MS,()=>refreshFeed(env)));
}
function thaiDailyCycle(kind,now=new Date()){
  const shifted=new Date(+now+7*3600000);
  if(kind==='lottery'&&shifted.getUTCHours()<12)shifted.setUTCDate(shifted.getUTCDate()-1);
  return shifted.toISOString().slice(0,10);
}
async function dailyUtility(env,kind){
  const cycle=thaiDailyCycle(kind),prior=await getDailySnapshot(env,kind);
  if(prior?.cycle===cycle&&(!prior.data?.stale&&prior.data?.available||Date.now()-Date.parse(prior.checkedAt)<FEED_REFRESH_MS))return {...prior.data,snapshotCheckedAt:prior.checkedAt,refreshCycle:cycle};
  const data=kind==='gold'?await goldPrices():await lotteryResults(),checkedAt=new Date().toISOString();
  if(kind==='lottery'&&/-(01|16)$/.test(cycle)){
    const parts=cycle.split('-').map(Number),months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const expected=parts[2]+' '+months[parts[1]-1]+' '+(parts[0]+543);
    data.stale=data.available&&!String(data.drawDate||'').includes(expected);
  }
  await setDailySnapshot(env,kind,cycle,data,checkedAt);
  return {...data,snapshotCheckedAt:checkedAt,refreshCycle:cycle};
}
async function searchNews(query,day=''){
  return shared('search:'+normalize(query)+':'+day,300000,async()=>{
  const range=validDay(day)?' after:'+day+' before:'+new Date(Date.parse(day+'T12:00:00Z')+864e5).toISOString().slice(0,10):' after:2026-09-27';
  var google=GOOGLE_NEWS+"/search?q="+encodeURIComponent(normalize(query)+range)+"&hl=th&gl=TH&ceid=TH:th";
  var bing="https://www.bing.com/news/search?q="+encodeURIComponent(query)+"&format=rss&setlang=th-th";
  var rs=await Promise.allSettled([google,bing].map(async function(u){var r=await fetchWithTimeout(u);if(!r.ok)throw Error('HTTP '+r.status);return r.text();})),texts=rs.map(function(r){return r.status==="fulfilled"?r.value:"";});return {items:parseGoogleNews(texts[0]).concat(parseBing(texts[1])).filter(x=>Date.parse(x.publishedAt)>=Date.parse(ARCHIVE_START_ISO)&&Date.parse(x.publishedAt)<=Date.now()+300000&&(!validDay(day)||new Date(x.publishedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})===day)),available:rs.some(r=>r.status==='fulfilled')};});
}
function independent(reports){var map=new Map();for(var r of reports){var label=normalize(r.source),key=label.replace(/news|online|ออนไลน์|ข่าว/g,"").trim()||label;const aliases=[[/matichon|มติชน/,'matichon'],[/thai\s*pbs|ไทยพีบีเอส/,'thaipbs'],[/thaipost|ไทยโพสต์/,'thaipost'],[/bangkok\s*post/,'bangkokpost']];let host='';try{host=new URL(directUrl(r.url)).hostname;}catch{}for(const [pattern,id]of aliases)if(pattern.test(label+' '+host)){key=id;break;}var old=map.get(key),direct=directUrl(r.url),original=direct&&!/news\.google\.com/.test(direct),oldOriginal=old&&directUrl(old.url)&&!/news\.google\.com/.test(old.url);if(!old||original&&!oldOriginal||original===oldOriginal&&sourceWeight(r.source,r.url)>sourceWeight(old.source,old.url))map.set(key,Object.assign({},r,{url:direct||r.url}));}return [...map.values()];}
function rankQuery(query,cluster){
  var all=[cluster.title].concat(cluster.reports.map(function(r){return r.title;})),best=0,bestFeatures=null;
  for(var i=0;i<all.length;i++){var r=cluster.reports[Math.max(0,i-1)]||{},f=features(query,all[i],{time:hoursApart(cluster.publishedAt,r.publishedAt||cluster.publishedAt),source:sourceWeight(r.source,r.url)}),s=modelScore(f);if(s>best){best=s;bestFeatures=f;}}
  var corroboration=independent(cluster.reports).length,mass=Math.min(1,corroboration/4),intent=queryIntentMatch(query,all.join(' ')),score=Math.min(1,best*.69+mass*.11+intent*.20);
  return {cluster:cluster,score:score,features:bestFeatures||features(query,cluster.title),sourceCount:corroboration,intent};
}
export function queryIntentMatch(query,candidate){
  const q=normalize(query),c=normalize(candidate);
  if(/(?:ประกันสังคม|สปส)/u.test(q)&&/เลือกตั้ง/u.test(q)&&/(?:ผล|คะแนน|ชนะ|กวาด|นับ)/u.test(q)){
    const social=/(?:ประกันสังคม|สปส)/u.test(c),election=/(?:เลือกตั้ง|เลือก|บอร์ด)/u.test(c),outcome=/(?:ผลเลือกตั้ง|คะแนน|นับ|ชนะ|กวาด|นำ|รับรองผล)/u.test(c);
    return social&&election&&outcome?1:0;
  }
  const tokens=searchTokens(query).filter(t=>t.length>=2),hits=tokens.filter(t=>c.includes(t)).length;
  return tokens.length?hits/tokens.length:Number(c.includes(q));
}
function formatThaiDate(v){try{return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}).format(new Date(v));}catch{return v;}}
function publisherArticle(cluster){return [...cluster.reports].map(r=>({...r,url:directUrl(r.url)})).filter(r=>{try{var u=new URL(r.url);return !/(^|\.)(google\.com|bing\.com)$/.test(u.hostname)&&u.pathname!=="/"&&!/\/feed\/?$|\.xml$/.test(u.pathname);}catch{return false;}}).sort((a,b)=>Number(normalize(b.title)===normalize(cluster.title))-Number(normalize(a.title)===normalize(cluster.title)))[0]||null;}
function plainHeadline(value){return cleanText(value).replace(/(?:\s*[|｜]\s*\d{1,2})?\s*(?:\.{2,}|…)+\s*$/u,'').replace(/[“”"‘’]/g,'').replace(/\s*[-–]\s*/g,'และ').replace(/\s*ปม\s*/g,' กรณี').replace(/ฯ\s*$/,'').replace(/\s+/g,' ').trim();}
function narrativeFacts(report,headline){
  if(!report.contentRead||!report.excerpt)return [];
  const fragments=String(report.excerpt).split(/(?:\n+|(?<=[.!?。])\s+|(?=ก่อนหน้านี้|ต่อมา|ขณะที่|เบื้องต้น|ทั้งนี้|จากนั้น))/u).map(s=>cleanText(s)).filter(s=>s.length>=48&&s.length<=300&&!/(?:https?:|bit\.ly|Subscribe|กดกระดิ่ง|สมัครสมาชิก|#\S{2,})/iu.test(s)&&!/^(อ่านเพิ่มเติม|ติดตามข่าว|คลิกอ่าน|ผู้สื่อข่าวรายงาน)/u.test(s));
  const headlineTerms=searchTokens(headline),headlineActions=extractActions(headline),selected=[];
  for(const fragment of fragments){
    const matchingActions=extractActions(fragment).some(action=>headlineActions.includes(action));
    const matchingTerms=headlineTerms.filter(term=>normalize(fragment).includes(term)).length;
    if(!matchingActions&&matchingTerms<2||dice(fragment,headline)>=.82)continue;
    if([...new Intl.Segmenter('th',{granularity:'word'}).segment(fragment)].filter(x=>x.isWordLike).length>75)continue;
    const fact=fragment.replace(/[.!?。]+$/,'').trim();if(selected.every(previous=>dice(previous,fact)<.66))selected.push(fact);
    if(selected.length===2)break;
  }
  return selected;
}
function eventDateFromContent(reports){
  const patterns=[/(?:เหตุเกิด|เกิดเหตุ|เหตุการณ์เกิดขึ้น|ถูกพาตัว|ถูกอุ้ม)\s*(?:เมื่อวันที่|วันที่|เมื่อ)\s*(\d{1,2}\s+[ก-๙.]+\s+\d{2,4})/u,/(?:เหตุเกิด|เกิดเหตุ|เหตุการณ์เกิดขึ้น)\s*(?:เมื่อเวลา|เวลา)\s*(\d{1,2}[.:]\d{2}\s*น\.?)/u];
  for(const r of reports)for(const p of patterns){const value=p.exec(String(r.excerpt||''))?.[1];if(value)return value;}
  return '';
}
export function buildNarrative(query,best,evidence){
  if(!best||!evidence.length)return 'ยังไม่พบรายงานที่ตรวจสอบย้อนกลับได้ จึงยังสรุปเหตุการณ์นี้ไม่ได้';
  const ordered=[...evidence].sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
  const leadReport=[...ordered].filter(r=>r.title&&plainHeadline(r.title).length>=25).map(r=>{
    const title=plainHeadline(r.title),others=ordered.filter(x=>x!==r),agreement=others.length?others.reduce((sum,x)=>sum+dice(title,x.title),0)/others.length:0;
    const sensational=/(?:จุกอก|คิดผิดเลย|ช็อก|อึ้ง|ด่วนมาก|สะเทือนใจ)/u.test(title),truncated=/(?:\.{2,}|…)/u.test(r.title);
    const queryMatch=normalize(plainHeadline(query))===normalize(title)? .25:0;
    return {report:r,quality:agreement*.38+dice(query,title)*.34+setOverlap(extractActions(query),extractActions(title))*.12+queryMatch+sourceWeight(r.source,r.url)*.20+Number(!!r.contentRead)*.08-Number(sensational)*.28-Number(truncated)*.16};
  }).sort((a,b)=>b.quality-a.quality||Date.parse(a.report.publishedAt)-Date.parse(b.report.publishedAt))[0]?.report||ordered[0];
  const lead=plainHeadline(leadReport.title||best.cluster.title),paragraphs=[lead];
  const distinctUpdate=[...ordered].reverse().find(r=>Date.parse(r.publishedAt)>Date.parse(leadReport.publishedAt)&&r.title&&dice(r.title,lead)<.48&&sameNewsEvent(r.title,lead,r.publishedAt,leadReport.publishedAt).same);
  if(distinctUpdate)paragraphs.push('รายงานที่เผยแพร่ภายหลังระบุว่า '+plainHeadline(distinctUpdate.title));
  const facts=[];for(const report of ordered){for(const fact of narrativeFacts(report,lead)){if(dice(fact,paragraphs.join(' '))<.75&&facts.every(previous=>dice(fact,previous)<.66))facts.push(fact);if(facts.length===2)break;}if(facts.length===2)break;}if(facts.length)paragraphs.push(facts.join(' '));
  const placeCounts=new Map();for(const r of ordered)for(const place of [...extractPlaces(r.title),...extractPlaces(r.contentRead?r.excerpt:''),...(r.locations||[])])placeCounts.set(place,(placeCounts.get(place)||0)+1);
  const place=[...placeCounts].sort((a,b)=>b[1]-a[1])[0]?.[0],venue=/ศูนย์ดูแลผู้สูงอายุ/u.test(ordered.map(r=>r.title).join(' '))?'ศูนย์ดูแลผู้สูงอายุ':'';
  const eventDate=eventDateFromContent(ordered),context=[];
  if(place)context.push('พื้นที่ที่กล่าวถึง: '+place);else if(venue)context.push('สถานที่ที่กล่าวถึง: '+venue+' (ยังไม่ยืนยันพื้นที่เกิดเหตุ)');
  context.push(eventDate?'วันหรือเวลาที่เนื้อหาระบุว่าเกิดเหตุ: '+eventDate:'วันเวลาเกิดเหตุยังไม่ระบุชัด');
  paragraphs.push(context.join(' · '));
  const sources=[...new Set(ordered.map(r=>r.source))];
  paragraphs.push('ที่มา: '+sources.join(', ')+' · รายงานที่ตรวจได้เผยแพร่ระหว่าง '+formatThaiDate(ordered[0].publishedAt)+' ถึง '+formatThaiDate(ordered[ordered.length-1].publishedAt)+' (เป็นเวลาเผยแพร่ ไม่ใช่เวลาเกิดเหตุ)');
  return paragraphs.join('\n\n');
}
async function verifyQuery(query,live,env,{remote=true,day=''}={}){
  var discovery=remote?await searchNews(query,day):{items:[],available:true},searched=discovery.items,pool=clusterItems(searched.concat(live.clusters));
  const canonical=normalize(query);
  var ranked=pool.map(function(c){return rankQuery(query,c);}).filter(x=>{const text=normalize(x.cluster.title+' '+x.cluster.reports.map(r=>r.title).join(' '));if(/(?:ประกันสังคม|สปส)/u.test(canonical)&&/เลือกตั้ง/u.test(canonical)&&/(?:ผล|คะแนน|ชนะ|กวาด|นับ)/u.test(canonical))return x.intent===1;return text.includes(canonical)||x.intent>=.55||x.intent>=.35&&x.features.language>=.36;}).sort(function(a,b){return b.score-a.score;}),best=ranked[0],topScore=best?best.score:0;
  var related=ranked.filter(function(x){return x!==best&&x.score>=Math.max(.42,topScore-.18)&&(!best||!sameNewsEvent(x.cluster.title,best.cluster.title,x.cluster.publishedAt,best.cluster.publishedAt).same);}).slice(0,8);
  var candidateReports=best?best.cluster.reports:[];
  var evidence=best?independent(candidateReports): [];
  if(remote)evidence=await enrichEvidence(evidence);
  evidence.sort(function(a,b){return new Date(b.publishedAt)-new Date(a.publishedAt);});
  var sourceCount=evidence.length,official=evidence.some(function(r){return sourceWeight(r.source,r.url)>=.99;}),variantCount=new Set(evidence.map(function(r){return normalize(r.title).slice(0,55);})).size,coherence=best?Math.round(best.score*100):0;
  var anchor=best&&best.features&&(best.features.entities>=.95&&best.features.actions>=.5||best.features.actions>=.95&&best.features.terms>=.25);
  var approved=(sourceCount>=3&&variantCount>=2&&topScore>=.50)||(official&&sourceCount>=2&&variantCount>=2&&(topScore>=.52||anchor));
  var likely=!approved&&sourceCount>=2&&topScore>=.48;
  var status=approved?"ยืนยันจากหลายแหล่ง":likely?"พบข้อมูลสนับสนุน — อ่านต่อ":"กำลังพิจารณา — หลักฐานยังไม่พอ";
  var reason=approved?"พบรายงานอิสระ "+sourceCount+" แหล่ง พาดหัวต่างกันแต่ผู้เกี่ยวข้อง เหตุการณ์ และช่วงเวลาสอดคล้องกัน":likely?"พบ "+sourceCount+" แหล่งที่กล่าวถึงเหตุการณ์ใกล้เคียงกัน แต่ยังควรตรวจรายละเอียดจากต้นทาง":"ยังพบแหล่งข่าวอิสระหรือองค์ประกอบของเหตุการณ์ไม่พอ จึงไม่ฟันธงว่าเป็นข่าวเท็จ";
  if(remote)await persistReports(env,flatten(searched).concat(evidence));
  var timeline=[...evidence].reverse().map(function(r){return {publishedAt:r.publishedAt,source:r.source,title:r.title,url:r.url};});
  return {approved:approved,related:likely,status:status,reason:reason,score:coherence,sourceCount:sourceCount,evidenceCount:evidence.length,variantCount:variantCount,details:buildNarrative(query,best,evidence),timeline:timeline,keywords:words(query+" "+(best?best.cluster.title:"")).slice(0,8),evidence:evidence.slice(0,14),searchAvailable:discovery.available,fromArchive:!remote,archiveStart:ARCHIVE_START,similar:related.map(function(x){var original=publisherArticle(x.cluster);return {id:x.cluster.id,title:x.cluster.title,publishedAt:x.cluster.publishedAt,relevance:Math.round(x.score*100),sources:independent(x.cluster.reports).length,url:original?.url||null,source:original?.source||null,image:x.cluster.reports.find(function(r){return r.image;})?.image||null};}),signals:{language:best?.features.language||0,entities:best?.features.entities||0,event:best?.features.actions||0,context:((best?.features.places||0)+(best?.features.numbers||0))/2,mass:Math.min(1,sourceCount/4)},method:"จัดกลุ่มข่าวด้วยองค์ประกอบเหตุการณ์และแบบจำลองความคล้าย แล้วเรียบเรียงจากข้อมูลต้นทางที่อ่านได้; ยังไม่ใช่โมเดลสรุปข่าวที่ฝึกจากคลังข่าวจริง",limitation:"สถานะยืนยันหมายถึงพบหลักฐานสอดคล้องหลายแหล่ง ไม่ใช่การรับรองว่าทุกรายละเอียดถูกต้อง โปรดเปิดข่าวต้นทางก่อนนำไปเผยแพร่"};
}
async function suggestions(query,live,remote=false){
  var queryTerms=searchTokens(query),searched=remote&&query.length>=2?(await searchNews(query)).items:[],ranked=clusterItems(searched.concat(live.clusters)).map(function(c){return rankQuery(query,c);}).filter(function(x){var text=normalize(x.cluster.title+" "+x.cluster.reports.map(function(r){return r.title;}).join(" ")),exact=text.includes(normalize(query)),lexical=exact||queryTerms.length&&queryTerms.filter(t=>text.includes(t)).length>=Math.min(2,queryTerms.length)||dice(query,text)>=.28;return x.intent>=.65&&(lexical||x.intent===1)&&(exact||x.score>.28);}).sort(function(a,b){return b.intent-a.intent||b.score-a.score||new Date(b.cluster.publishedAt)-new Date(a.cluster.publishedAt);});
  return ranked.slice(0,7).map(function(x){var image=x.cluster.reports.find(function(r){return r.image;});return {title:x.cluster.title,short:x.cluster.title.length>92?x.cluster.title.slice(0,89)+"…":x.cluster.title,publishedAt:x.cluster.publishedAt,sources:independent(x.cluster.reports).length,score:Math.round(x.score*100),image:image?image.image:null};});
}
function json(data,status){return new Response(JSON.stringify(data),{status:status||200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}});}
function matchingSecret(provided,expected){if(!provided||!expected||provided.length!==expected.length)return false;let diff=0;for(let i=0;i<provided.length;i++)diff|=provided.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}

var html=String.raw`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Thai Check News ติดตามและตรวจสอบเหตุการณ์ข่าวจากหลายแหล่ง"><title>Thai Check News</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
:root{--ink:#111;--paper:#f3f2ef;--white:#fff;--orange:#ef651e;--orange-soft:#fff0e7;--line:#d3d1cb;--muted:#696969;--good:#17643a;--good-bg:#eaf6ee;--warn:#984700}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Sarabun",Tahoma,sans-serif;line-height:1.65}button,input{font:inherit}button{cursor:pointer}a{color:inherit}.mast{background:#0f0f0f;color:#fff;border-top:6px solid var(--orange)}.mast-in{max-width:1260px;margin:auto;padding:17px 24px;display:flex;align-items:center}.brand{font-family:"IBM Plex Sans Thai",sans-serif;font-size:1.28rem;font-weight:700;letter-spacing:.03em}.brand i{font-style:normal;color:var(--orange)}.mast-meta{margin-left:auto;color:#aaa;font-size:.78rem;text-align:right}.mast-meta b{color:#fff}.ticker{background:var(--orange);border-bottom:1px solid #bd470b}.ticker-in{max-width:1260px;margin:auto;display:flex;min-height:44px}.ticker-label{background:#111;color:#fff;padding:10px 17px;font-weight:700;white-space:nowrap}.ticker-track{display:flex;overflow:auto;scrollbar-width:none}.ticker-item{border:0;border-right:1px solid rgba(0,0,0,.2);background:transparent;padding:9px 18px;white-space:nowrap;font-weight:600;font-size:.83rem}.ticker-item:hover{background:#fff3}main{max-width:1260px;margin:auto;padding:24px 24px 64px}.hero{position:relative;height:360px;background:#171717;overflow:hidden;border-bottom:6px solid var(--orange);margin-bottom:22px}.slide{position:absolute;inset:0;opacity:0;transition:opacity .45s}.slide.active{opacity:1}.slide-bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:saturate(.8)}.slide-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.94),rgba(0,0,0,.35)),linear-gradient(0deg,rgba(0,0,0,.7),transparent 70%)}.slide-copy{position:absolute;left:clamp(22px,5vw,64px);bottom:48px;color:#fff;max-width:720px}.slide-copy span{font-size:.78rem;color:#ffaf83;font-weight:700}.slide-copy h1{font-family:"IBM Plex Sans Thai",sans-serif;font-size:clamp(1.65rem,3.3vw,2.75rem);line-height:1.3;margin:8px 0}.slide-copy p{color:#ddd;margin:0}.slide-nav{position:absolute;left:clamp(22px,5vw,64px);bottom:18px;display:flex;gap:7px}.slide-dot{width:34px;height:4px;border:0;background:#777;padding:0}.slide-dot.active{background:var(--orange)}.fallback-art{background:linear-gradient(135deg,#272727,#101010 55%,#85330c)}.intro{display:grid;grid-template-columns:1fr auto;gap:20px;border-bottom:3px solid #111;padding-bottom:15px;margin-bottom:17px}.eyebrow{color:var(--orange);font-size:.75rem;font-weight:700;margin:0}.intro h2{font-family:"IBM Plex Sans Thai",sans-serif;font-size:clamp(1.7rem,3vw,2.6rem);line-height:1.2;margin:3px 0}.intro p{margin:4px 0;color:var(--muted)}.feed-state{text-align:right;font-size:.78rem;color:var(--muted)}.feed-state b{display:block;color:#111;font-size:.95rem}.checker{background:#fff;border:1px solid var(--line);border-left:7px solid var(--orange);padding:18px;margin-bottom:20px}.search-row{display:grid;grid-template-columns:1fr auto;gap:10px;position:relative}.search-row input{min-width:0;padding:14px 15px;border:1px solid #999;outline:0}.search-row input:focus{border-color:var(--orange);box-shadow:0 0 0 3px #ef651e22}.primary{border:0;background:#111;color:#fff;padding:12px 20px;font-weight:700}.primary:hover{background:var(--orange);color:#111}.suggestions{display:none;position:absolute;top:100%;left:0;right:155px;z-index:20;background:#fff;border:1px solid #aaa;box-shadow:0 14px 28px #0002;max-height:390px;overflow:auto}.suggestions.open{display:block}.suggestion{display:grid;grid-template-columns:62px 1fr auto;gap:11px;align-items:center;width:100%;text-align:left;border:0;border-bottom:1px solid #e2e2de;background:#fff;padding:9px}.suggestion:hover,.suggestion.active{background:var(--orange-soft)}.suggestion img,.suggestion-art{width:62px;height:46px;object-fit:cover;background:#1a1a1a}.suggestion b{display:block;font-size:.85rem;line-height:1.35}.suggestion span{display:block;color:var(--muted);font-size:.7rem}.suggestion em{font-style:normal;color:var(--orange);font-size:.72rem;font-weight:700}.checker-note{display:flex;justify-content:space-between;gap:20px;color:var(--muted);font-size:.76rem;margin-top:8px}.layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,.75fr);gap:20px}.panel{background:#fff;border:1px solid var(--line)}.result-top{padding:22px 24px;border-top:5px solid var(--orange)}.status-line{display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-size:.78rem;font-weight:700}.status{padding:5px 9px;background:var(--orange-soft);color:var(--warn);border:1px solid #f5af83}.status.approved{background:var(--good-bg);color:var(--good);border-color:#94cca7}.result h2{font-family:"IBM Plex Sans Thai",sans-serif;font-size:clamp(1.45rem,2.5vw,2.05rem);line-height:1.35;margin:13px 0 7px}.reason{margin:0;color:var(--muted)}.story{margin-top:18px;padding:18px;background:#f7f7f4;border-left:4px solid #111}.story h3{font-size:.9rem;margin:0 0 7px}.story p{margin:0;font-size:1rem}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--line)}.metric{padding:13px 16px;border-right:1px solid var(--line)}.metric:last-child{border:0}.metric b{display:block;font-size:1.35rem}.metric span{color:var(--muted);font-size:.71rem}.section{padding:18px 22px;border-bottom:1px solid var(--line)}.section:last-child{border:0}.section-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:11px}.section-head h3{margin:0;font-size:1rem}.section-head span{font-size:.73rem;color:var(--muted)}.timeline{border-left:2px solid #ddd;margin-left:8px}.time-row{position:relative;padding:0 0 15px 20px}.time-row:last-child{padding-bottom:0}.time-row:before{content:"";position:absolute;left:-6px;top:7px;width:10px;height:10px;background:var(--orange);border-radius:50%}.time-row time{display:block;color:var(--orange);font-size:.72rem;font-weight:700}.time-row b{display:block;font-size:.86rem}.time-row span{font-size:.75rem;color:var(--muted)}.similar-bar{display:flex;gap:9px;overflow:auto;padding-bottom:6px}.similar-item{position:relative;min-width:235px;max-width:270px;min-height:112px;border:1px solid var(--line);padding:11px;background:#fff;overflow:hidden}.similar-item.has-image{color:#fff;padding-top:50px;background-size:cover;background-position:center}.similar-item.has-image:before{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#000e,#0002)}.similar-item>*{position:relative}.similar-item b{display:block;font-size:.82rem;line-height:1.4}.similar-item span{font-size:.71rem;color:var(--muted)}.similar-item.has-image span{color:#ddd}.evidence{display:grid;grid-template-columns:105px 1fr auto;gap:13px;padding:13px 0;border-top:1px solid var(--line);text-decoration:none}.evidence:first-child{border-top:2px solid #111}.publisher{color:var(--orange);font-weight:700;font-size:.72rem}.evidence b{font-size:.87rem;line-height:1.4}.evidence time{color:var(--muted);font-size:.71rem;white-space:nowrap}.empty{padding:16px;border:1px dashed #aaa;color:var(--muted)}.limitation{font-size:.76rem;color:var(--muted)}.side{display:grid;gap:17px;align-content:start}.side-head{background:#111;color:#fff;border-left:5px solid var(--orange);padding:12px 15px}.side-head h3{margin:0;font-size:.95rem}.trend-list{padding:0 15px}.trend{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:13px 0;border-top:1px solid var(--line);cursor:pointer}.trend:first-child{border:0}.trend i{font-family:Georgia,serif;font-size:1.3rem;color:var(--orange);font-style:normal;font-weight:700}.trend b{display:block;font-size:.82rem;line-height:1.4}.trend span{display:block;color:var(--muted);font-size:.7rem}.refresh{width:calc(100% - 30px);margin:0 15px 15px}.method{padding:17px}.method h3{margin:0 0 11px}.step{display:grid;grid-template-columns:25px 1fr;gap:9px;margin-top:11px}.step i{width:24px;height:24px;background:var(--orange);display:grid;place-items:center;font-style:normal;font-weight:700;font-size:.8rem}.step b{display:block;font-size:.8rem}.step span{display:block;font-size:.73rem;color:var(--muted)}.signal{margin-top:9px}.signal div{display:flex;justify-content:space-between;font-size:.73rem}.track{height:5px;background:#ddd}.track i{display:block;height:100%;background:var(--orange)}.loading{opacity:.55;pointer-events:none}footer{background:#111;color:#aaa;padding:23px}.footer-in{max-width:1260px;margin:auto;display:flex;justify-content:space-between;gap:20px;font-size:.76rem}footer b{color:#fff}@media(max-width:900px){.layout{grid-template-columns:1fr}.side{grid-template-columns:1fr 1fr}.hero{height:330px}.evidence{grid-template-columns:90px 1fr}.evidence time{grid-column:2}}@media(max-width:640px){main,.mast-in{padding-left:14px;padding-right:14px}.mast-meta{display:none}.hero{height:400px;margin-inline:-14px}.intro{grid-template-columns:1fr}.feed-state{text-align:left}.search-row{grid-template-columns:1fr}.suggestions{right:0}.checker-note{display:block}.side{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.metric:nth-child(2){border-right:0}.evidence{grid-template-columns:1fr;gap:3px}.evidence time{grid-column:auto}.ticker-label{padding-inline:12px}.footer-in{display:block}}
</style></head><body><header class="mast"><div class="mast-in"><div class="brand">THAI <i>CHECK</i> NEWS</div><div class="mast-meta"><b>ห้องข่าวตรวจสอบเหตุการณ์</b><br>รวบรวมต่อเนื่อง · เปิดดูแหล่งต้นทางได้</div></div></header><nav class="ticker"><div class="ticker-in"><div class="ticker-label">ข่าวล่าสุด</div><div class="ticker-track" id="ticker"><button class="ticker-item">กำลังดึงข่าวล่าสุด…</button></div></div></nav><main><section class="hero" id="hero"><div class="slide active"><div class="slide-bg fallback-art"></div><div class="slide-copy"><span>กำลังอัปเดตจากแหล่งข่าว</span><h1>ติดตามเหตุการณ์เดียวกัน แม้แต่ละแหล่งจะพาดหัวต่างกัน</h1><p>ตรวจผู้เกี่ยวข้อง สถานที่ ตัวเลข และลำดับเวลา ก่อนให้สถานะ</p></div></div></section><section class="intro"><div><p class="eyebrow">ห้องข่าวตรวจสอบ · อัปเดตต่อเนื่อง</p><h2>ข่าวที่น่าเชื่อถือ เริ่มจากหลักฐานที่เปิดอ่านได้</h2><p>รวบรวมข่าวหลัก ข่าวพื้นที่ และข่าวเฉพาะทาง แล้วจัดกลุ่มตามเหตุการณ์จริงแทนการเทียบแค่พาดหัว</p></div><div class="feed-state"><b id="feedState">กำลังเชื่อมต่อแหล่งข่าว</b><span id="updatedAt">ข่าววันนี้และย้อนหลัง 7 วัน</span></div></section><section class="checker"><div class="search-row"><input id="query" autocomplete="off" aria-label="ข้อความข่าว" placeholder="วางพาดหัว ข้อความ หรือคำสำคัญที่ต้องการตรวจ"><button class="primary" id="checkButton">ตรวจสอบข่าว</button><div class="suggestions" id="suggestions" role="listbox"></div></div><div class="checker-note"><span>พิมพ์อย่างน้อย 2 ตัวอักษร ระบบจะแสดงข่าวที่คล้ายกันแบบย่อ</span><span>“หลักฐานยังไม่พอ” ไม่ได้แปลว่าเป็นข่าวเท็จ</span></div></section><div class="layout" id="workspace"><article class="panel result"><div class="result-top"><div class="status-line"><span class="status" id="statusBadge">รอการตรวจสอบ</span><span id="resultMeta">เลือกข่าวด้านบน หรือวางข้อความจากโซเชียลมีเดีย</span></div><h2 id="resultTitle">ระบบจะค้นหาเหตุการณ์ที่เกี่ยวข้องจากหลายแหล่ง</h2><p class="reason" id="resultReason">พาดหัวไม่จำเป็นต้องเหมือนกัน หากบุคคล เหตุการณ์ สถานที่ ตัวเลข และช่วงเวลาสอดคล้องกัน</p><div class="story"><h3>รายละเอียดเหตุการณ์</h3><p id="details">เมื่อเริ่มตรวจ ระบบจะเรียบเรียงสิ่งที่แหล่งข่าวระบุตรงกัน และแสดงลำดับเวลาที่เผยแพร่โดยไม่เติมข้อมูลที่หาไม่พบ</p></div></div><div class="metrics"><div class="metric"><b id="scoreMetric">—</b><span>ความเป็นเหตุการณ์เดียวกัน</span></div><div class="metric"><b id="sourceMetric">—</b><span>แหล่งข่าวอิสระ</span></div><div class="metric"><b id="variantMetric">—</b><span>รูปแบบรายงานต่างกัน</span></div><div class="metric"><b id="evidenceMetric">—</b><span>หลักฐานที่เปิดอ่านได้</span></div></div><section class="section"><div class="section-head"><h3>ลำดับเวลาที่พบ</h3><span>แสดงเวลาเผยแพร่ ไม่เดาเวลาเกิดเหตุ</span></div><div class="timeline" id="timeline"><div class="empty">ยังไม่มีผลตรวจสอบ</div></div></section><section class="section"><div class="section-head"><h3>ข่าวที่คล้ายกัน</h3><span>รายการล่าสุดอยู่ด้านหน้า</span></div><div class="similar-bar" id="similarBar"><div class="similar-item"><b>รอผลการค้นหา</b><span>ข่าวใกล้เคียงจะปรากฏที่นี่</span></div></div></section><section class="section"><div class="section-head"><h3>แหล่งข่าวที่ใช้ตรวจสอบ</h3><span id="evidenceLabel">ยังไม่มีผลตรวจสอบ</span></div><div id="evidenceList"><div class="empty">วางข้อความข่าวด้านบนเพื่อเริ่มตรวจ</div></div><p class="limitation" id="limitation">ระบบพิจารณาเนื้อหาและความเป็นอิสระของแหล่งข่าวร่วมกัน</p></section></article><aside class="side"><section class="panel"><div class="side-head"><h3>ข่าวที่กำลังติดตาม</h3></div><div class="trend-list" id="trendList"><div class="trend"><i>01</i><div><b>กำลังโหลดข่าวล่าสุด</b><span>จากหลายแหล่ง</span></div></div></div><button class="primary refresh" id="refreshButton">อัปเดตข่าวล่าสุด</button></section><section class="panel method"><h3>เกณฑ์การยืนยันฉบับใหม่</h3><div class="step"><i>1</i><div><b>จัดกลุ่มตามเหตุการณ์</b><span>ดูผู้เกี่ยวข้อง การกระทำ สถานที่ ตัวเลข และช่วงเวลา</span></div></div><div class="step"><i>2</i><div><b>ตรวจความเป็นอิสระ</b><span>ตัดข่าวซ้ำและไม่นับการคัดลอกพาดหัวเป็นหลายเสียง</span></div></div><div class="step"><i>3</i><div><b>ยืนยันเมื่อหลักฐานพอ</b><span>อย่างน้อย 3 แหล่ง หรือแหล่งทางการร่วมกับข่าวอิสระ</span></div></div><div id="signalList"></div></section></aside></div></main><footer><div class="footer-in"><span><b>Thai Check News</b> · แหล่งข่าวและลิงก์ต้นทางตรวจสอบย้อนหลังได้</span><span>สถานะอาจเปลี่ยนเมื่อมีรายงานใหม่เข้ามา</span></div></footer><script>
const q=document.getElementById("query"),workspace=document.getElementById("workspace"),ticker=document.getElementById("ticker"),trendList=document.getElementById("trendList"),suggestBox=document.getElementById("suggestions");let suggestTimer,activeSuggestion=-1,slides=[],slideIndex=0;const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const fmt=v=>new Date(v).toLocaleString("th-TH",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
document.getElementById("details").style.whiteSpace="pre-line";
function choose(text){q.value=text;suggestBox.classList.remove("open");check();window.scrollTo({top:370,behavior:"smooth"});}
function renderTicker(items){ticker.innerHTML=items.slice(0,12).map(x=>'<a class="ticker-item" href="'+esc(storyHref(x.title))+'" data-title="'+esc(x.title)+'">'+esc(x.title)+'</a>').join("");bindStoryLinks(ticker);updateTickerControls();}
function renderHero(items){slides=items.slice(0,5);const hero=document.getElementById("hero");hero.innerHTML=slides.map((x,i)=>{const img=x.reports.find(r=>r.image)?.image;return '<article class="slide '+(i===0?"active":"")+'"><div class="slide-bg '+(!img?"fallback-art":"")+'"'+(img?' style="background-image:url(&quot;'+esc(img)+'&quot;)"':"")+'></div><div class="slide-copy"><span>'+esc(x.reports[0]?.source||"ข่าวล่าสุด")+' · '+esc(fmt(x.publishedAt))+'</span><h1>'+esc(x.title)+'</h1><p>'+x.reports.length+' รายงานที่เกี่ยวข้อง</p></div></article>';}).join("")+'<div class="slide-nav">'+slides.map((_,i)=>'<button class="slide-dot '+(i===0?"active":"")+'" data-index="'+i+'" aria-label="ข่าว '+(i+1)+'"></button>').join("")+"</div>";hero.querySelectorAll(".slide-dot").forEach(b=>b.onclick=()=>showSlide(Number(b.dataset.index)));}
function showSlide(i){slideIndex=i;document.querySelectorAll(".slide").forEach((x,n)=>x.classList.toggle("active",n===i));document.querySelectorAll(".slide-dot").forEach((x,n)=>x.classList.toggle("active",n===i));}
function renderTrends(items){trendList.innerHTML=items.slice(0,9).map((x,i)=>'<a class="trend" href="'+esc(storyHref(x.title))+'" data-title="'+esc(x.title)+'"><i>'+String(i+1).padStart(2,"0")+'</i><div><b>'+esc(x.title)+'</b><span>'+x.reports.length+' รายงาน · '+esc(fmt(x.publishedAt))+'</span></div></a>').join("");bindStoryLinks(trendList);}
function renderSignals(s={}){const labels={language:"รูปภาษาใกล้เคียง",entities:"ผู้เกี่ยวข้องตรงกัน",event:"เหตุการณ์ตรงกัน",context:"สถานที่และตัวเลข",mass:"จำนวนแหล่งอิสระ"};document.getElementById("signalList").innerHTML=Object.entries(labels).map(([k,l])=>{const n=Math.round((s[k]||0)*100);return '<div class="signal"><div><span>'+l+'</span><b>'+n+'%</b></div><div class="track"><i style="width:'+n+'%"></i></div></div>';}).join("");}
function renderResult(r,query){const badge=document.getElementById("statusBadge");badge.textContent=r.status;badge.className="status "+(r.approved?"approved":"");document.getElementById("resultMeta").textContent="ตรวจเมื่อ "+new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})+" น.";document.getElementById("resultTitle").textContent=query;document.getElementById("resultReason").textContent=r.reason;document.getElementById("details").textContent=r.details;document.getElementById("scoreMetric").textContent=r.score+"%";document.getElementById("sourceMetric").textContent=r.sourceCount;document.getElementById("variantMetric").textContent=r.variantCount||0;document.getElementById("evidenceMetric").textContent=r.evidenceCount;document.getElementById("evidenceLabel").textContent=r.approved?"ผ่านเกณฑ์หลายแหล่ง":"ยังต้องติดตามเพิ่ม";document.getElementById("limitation").textContent=r.limitation;document.getElementById("timeline").innerHTML=r.timeline?.length?r.timeline.map(x=>'<div class="time-row"><time>'+esc(fmt(x.publishedAt))+'</time><b>'+esc(x.title)+'</b><span>'+esc(x.source)+'</span></div>').join(""):'<div class="empty">ยังไม่มีลำดับเวลาที่เชื่อถือได้</div>';document.getElementById("similarBar").innerHTML=r.similar?.length?r.similar.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).map(x=>'<div class="similar-item '+(x.image?"has-image":"")+'"'+(x.image?' style="background-image:url(&quot;'+esc(x.image)+'&quot;)"':"")+'><b>'+esc(x.title)+'</b><span>'+esc(fmt(x.publishedAt))+' · '+x.sources+' แหล่ง · '+x.relevance+'%</span></div>').join(""):'<div class="similar-item"><b>ยังไม่พบข่าวใกล้เคียง</b><span>ระบบจะติดตามเมื่อมีรายงานใหม่</span></div>';document.getElementById("evidenceList").innerHTML=r.evidence?.length?r.evidence.map(x=>'<a class="evidence" href="'+esc(x.url)+'" target="_blank" rel="noreferrer"><span class="publisher">'+esc(x.source)+'</span><b>'+esc(x.title)+'</b><time>'+esc(fmt(x.publishedAt))+' ↗</time></a>').join(""):'<div class="empty">ยังพบข้อมูลไม่พอ ข่าวนี้อยู่ในช่วงพิจารณา ไม่ได้ถูกระบุว่าเป็นข่าวเท็จ</div>';renderSignals(r.signals);}
let feedSnapshot=null,lastVisibleCount=-1;
function paintFeed(d){const visible=(d.clusters||[]).filter(x=>!x.expiresAt||Date.parse(x.expiresAt)>Date.now()),featured=(d.featured||visible).filter(x=>!x.expiresAt||Date.parse(x.expiresAt)>Date.now());lastVisibleCount=visible.length;renderTicker(featured);renderHero(featured);renderTrends(featured);document.getElementById("feedState").textContent=d.live?"เชื่อมต่อข่าว "+d.sources.length+" ช่องทางแล้ว":"ยังไม่มีข่าวสดในรอบ 24 ชั่วโมง";document.getElementById("updatedAt").textContent="ตรวจล่าสุด "+new Date(d.checkedAt).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})+" น. · หน้าแรก "+featured.length+" ประเด็นไม่ซ้ำ · เก็บข่าวไว้ 24 ชั่วโมงจากข่าวใหม่หรืออัปเดต";}
async function loadFeed(force=false){const btn=document.getElementById("refreshButton");btn.disabled=true;try{const res=await fetch("/api/live"+(force?"?refresh="+Date.now():""),{cache:"no-store"});if(!res.ok)throw Error();feedSnapshot=await res.json();paintFeed(feedSnapshot);}catch{document.getElementById("feedState").textContent="แหล่งข่าวขัดข้องชั่วคราว";}finally{btn.disabled=false;}}
async function suggest(){const text=q.value.trim();if(text.length<2){suggestBox.classList.remove("open");return;}try{const res=await fetch("/api/suggest?q="+encodeURIComponent(text),{cache:"no-store"}),items=await res.json();activeSuggestion=-1;suggestBox.innerHTML=items.length?items.map((x,i)=>'<button class="suggestion" data-i="'+i+'" data-title="'+esc(x.title)+'">'+(x.image?'<img src="'+esc(x.image)+'" alt="">':'<i class="suggestion-art"></i>')+'<span><b>'+esc(x.short)+'</b><span>'+esc(fmt(x.publishedAt))+' · '+x.sources+' แหล่ง</span></span><em>'+x.score+'%</em></button>').join(""):'<button class="suggestion" type="button"><i class="suggestion-art"></i><span><b>ยังไม่พบข่าวใกล้เคียง</b><span>กดตรวจสอบเพื่อค้นหาเพิ่มจากข่าวพื้นที่</span></span></button>';suggestBox.classList.add("open");suggestBox.querySelectorAll("[data-title]").forEach(b=>b.onclick=()=>choose(b.dataset.title));}catch{}}
let resultRequestSerial=0,resultRequestAbort;
function clearSearchResult(text,message='กำลังค้นหาข่าวที่เกี่ยวข้อง'){document.getElementById('statusBadge').textContent='กำลังตรวจสอบ';document.getElementById('statusBadge').className='status';document.getElementById('resultMeta').textContent='';document.getElementById('resultTitle').textContent=text;document.getElementById('resultReason').textContent=message;document.getElementById('details').textContent='รอผลค้นหาและแหล่งข่าวต้นทาง';for(const id of ['scoreMetric','sourceMetric','variantMetric','evidenceMetric'])document.getElementById(id).textContent='—';document.getElementById('timeline').innerHTML='<div class="empty">กำลังค้นหา</div>';document.getElementById('similarBar').innerHTML='<div class="similar-item"><b>กำลังค้นหาข่าวที่เกี่ยวข้อง</b></div>';document.getElementById('evidenceList').innerHTML='<div class="empty">กำลังตรวจแหล่งข่าว</div>';document.getElementById('evidenceLabel').textContent='';document.getElementById('articleContent')?.remove();}
async function check(){
 const text=q.value.trim();if(!text){q.focus();return;}const serial=++resultRequestSerial;resultRequestAbort?.abort();const abort=new AbortController();resultRequestAbort=abort;suggestBox.classList.remove('open');q.setAttribute('aria-expanded','false');setResultNotice('');clearSearchResult(text);setNewsLoading(true,text);
 const day=document.getElementById('archiveDate')?.value||'',base='/api/check?q='+encodeURIComponent(text)+(day?'&date='+day:'');let archived;
 async function requestResult(phase){const res=await fetch(base+'&phase='+phase,{signal:abort.signal});if(!res.ok)throw Error('ตรวจเพิ่มเติมไม่ได้');return res.json();}
 try{
   try{archived=await requestResult('archive');if(serial!==resultRequestSerial)return;renderResult(archived,text);if(archived.evidenceCount){setNewsLoading(false);setResultNotice('แสดงข้อมูลในคลัง · กำลังตรวจแหล่งข่าวเพิ่มเติม','progress');}}catch(e){if(e.name==='AbortError')throw e;}
   const data=await requestResult('full');if(serial!==resultRequestSerial)return;
   if(!data.searchAvailable){if(data.evidenceCount>=Number(archived?.evidenceCount||0))renderResult(data,text);setResultNotice('แหล่งค้นหาขัดข้องชั่วคราว · แสดงเฉพาะข้อมูลที่ค้นได้จากคลังสำหรับคำนี้','error');}
   else{renderResult(data,text);setResultNotice('');}
 }catch(e){if(e.name==='AbortError'||serial!==resultRequestSerial)return;if(!archived)clearSearchResult(text,'ยังค้นหาคำนี้ไม่ได้ชั่วคราว');setResultNotice('ค้นหา “'+text+'” เพิ่มเติมไม่ได้ชั่วคราว · กรุณาลองอีกครั้ง','error');}
 finally{if(serial===resultRequestSerial)setNewsLoading(false);}
}
q.addEventListener("input",()=>{clearTimeout(suggestTimer);suggestTimer=setTimeout(suggest,180);});q.addEventListener("keydown",e=>{const rows=[...suggestBox.querySelectorAll("[data-title]")];if(e.key==="ArrowDown"&&rows.length){e.preventDefault();activeSuggestion=Math.min(rows.length-1,activeSuggestion+1);}else if(e.key==="ArrowUp"&&rows.length){e.preventDefault();activeSuggestion=Math.max(0,activeSuggestion-1);}else if(e.key==="Enter"){e.preventDefault();if(activeSuggestion>=0&&rows[activeSuggestion])choose(rows[activeSuggestion].dataset.title);else check();}else if(e.key==="Escape")suggestBox.classList.remove("open");rows.forEach((x,i)=>x.classList.toggle("active",i===activeSuggestion));});document.addEventListener("click",e=>{if(!e.target.closest(".search-row"))suggestBox.classList.remove("open");});document.getElementById("checkButton").onclick=check;document.getElementById("refreshButton").onclick=()=>loadFeed(true);renderSignals();loadFeed().then(()=>{const incoming=new URLSearchParams(location.search).get("q");if(incoming){q.value=incoming;check();}});setInterval(()=>{if(!document.hidden)loadFeed(false);},1800000);setInterval(()=>{if(feedSnapshot&&feedSnapshot.clusters.filter(x=>!x.expiresAt||Date.parse(x.expiresAt)>Date.now()).length!==lastVisibleCount)paintFeed(feedSnapshot);},60000);setInterval(()=>{if(slides.length)showSlide((slideIndex+1)%slides.length);},6500);
</script><script>
let newsIndex=[],searchGeneration=0,searchAbort;
const originalTicker=renderTicker;
renderTicker=function(items){newsIndex=items;originalTicker(items);if(q.value.trim()&&document.activeElement===q){instantSuggestions();clearTimeout(suggestTimer);suggestTimer=setTimeout(suggest,180);}};
q.setAttribute('role','combobox');q.setAttribute('aria-autocomplete','list');q.setAttribute('aria-controls','suggestions');q.setAttribute('aria-expanded','false');
document.querySelector('.checker-note span').textContent='พิมพ์คำค้น ข่าวที่เกี่ยวข้องจะแสดงทันที';
const loadingRow='<div class="search-loading" role="status"><span class="news-loader" aria-hidden="true"><i></i><i></i><i></i></span><span>กำลังค้นหาข่าวที่เกี่ยวข้อง…</span></div>';
function localMatches(text){const canonical=canonicalSearch(text),terms=canonical.split(/\s+/).filter(Boolean);return newsIndex.filter(x=>{const hay=canonicalSearch(x.title+' '+x.reports.map(r=>r.title).join(' '));return hay.includes(canonical)||terms.every(t=>hay.includes(t));}).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,7).map(x=>({title:x.title,short:x.title.length>92?x.title.slice(0,89)+'…':x.title,publishedAt:x.publishedAt,sources:new Set(x.reports.map(r=>r.source)).size,image:x.reports.find(r=>r.image)?.image}));}
function paintSuggestions(items,busy=false,message=''){activeSuggestion=-1;suggestBox.innerHTML=items.map((x,i)=>'<a href="'+esc(storyHref(x.title))+'" role="option" class="suggestion" data-title="'+esc(x.title)+'">'+(x.image?'<img src="'+esc(x.image)+'" alt="" loading="lazy">':'<i class="suggestion-art"></i>')+'<span><b>'+esc(x.short||x.title)+'</b><span>'+esc(fmt(x.publishedAt))+' · '+x.sources+' แหล่ง</span></span><em>อ่านต่อ ↗</em></a>').join('')+(busy?loadingRow:(!items.length?'<div class="search-empty" role="status">'+esc(message||'ยังไม่พบข่าวที่เกี่ยวข้อง ลองเพิ่มคำหรือเปลี่ยนคำค้น')+'</div>':''));suggestBox.classList.add('open');suggestBox.setAttribute('aria-busy',String(busy));q.setAttribute('aria-expanded','true');bindStoryLinks(suggestBox);}
function instantSuggestions(){searchGeneration++;searchAbort?.abort();const text=q.value.trim();if(!text){suggestBox.classList.remove('open');q.setAttribute('aria-expanded','false');return;}paintSuggestions(localMatches(text),true);}
suggest=async function(){const text=q.value.trim(),generation=searchGeneration;if(!text)return;searchAbort=new AbortController();let items=localMatches(text);try{const cached=await fetch('/api/suggest?q='+encodeURIComponent(text),{signal:searchAbort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();});if(generation!==searchGeneration||q.value.trim()!==text)return;items=[...new Map([...items,...cached].map(x=>[canonicalSearch(x.title),x])).values()].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,7);paintSuggestions(items);}catch(e){if(e.name==='AbortError'||generation!==searchGeneration)return;paintSuggestions(items,false,'ค้นจากคลังไม่ได้ชั่วคราว · ข่าวที่โหลดไว้ยังเลือกอ่านได้');}};
q.addEventListener('input',instantSuggestions);q.addEventListener('focus',()=>{if(q.value.trim()){instantSuggestions();clearTimeout(suggestTimer);suggestTimer=setTimeout(suggest,180);}});q.addEventListener('compositionstart',()=>{clearTimeout(suggestTimer);});q.addEventListener('compositionend',()=>{clearTimeout(suggestTimer);instantSuggestions();suggestTimer=setTimeout(suggest,180);});
const originalChoose=choose;choose=function(text){searchGeneration++;searchAbort?.abort();clearTimeout(suggestTimer);q.setAttribute('aria-expanded','false');originalChoose(text);};
let activeChecks=0;const originalCheck=check;check=async function(){searchGeneration++;searchAbort?.abort();clearTimeout(suggestTimer);suggestBox.classList.remove('open');const btn=document.getElementById('checkButton');activeChecks++;btn.disabled=true;btn.textContent='ตรวจสอบข่าว';try{await originalCheck();}finally{if(--activeChecks===0)btn.disabled=false;}};
document.getElementById('checkButton').onclick=()=>check();
document.getElementById('refreshButton').addEventListener('click',()=>{document.getElementById('feedState').innerHTML='<span class="small-spinner" aria-hidden="true"></span> กำลังอัปเดตข่าว…';});
document.getElementById('feedState').innerHTML='<span class="small-spinner" aria-hidden="true"></span> กำลังโหลดข่าวล่าสุด…';
function dismissSearch(){searchGeneration++;searchAbort?.abort();clearTimeout(suggestTimer);suggestBox.classList.remove('open');q.setAttribute('aria-expanded','false');}
q.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Tab')dismissSearch();});document.addEventListener('click',e=>{if(!e.target.closest('.search-row'))dismissSearch();});
</script></body></html>`;

html=html.replace('</head>',`<style>.suggestions{right:0;top:calc(100% + 7px);border-color:#d3d1cb;box-shadow:0 12px 28px #0002}.search-loading,.search-empty{padding:15px 18px;font-size:.83rem;color:#696969;display:flex;align-items:center;gap:12px;background:#faf9f6}.news-loader{display:flex;align-items:flex-end;gap:3px;height:22px;width:25px}.news-loader i{width:5px;height:17px;background:#ef651e;animation:newsPulse 1s ease-in-out infinite}.news-loader i:nth-child(2){animation-delay:.15s}.news-loader i:nth-child(3){animation-delay:.3s}.small-spinner{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:newsSpin .8s linear infinite;vertical-align:middle}.suggestion-art{background:#fff0e7;position:relative}.suggestion-art:after{content:'≡';color:#ef651e;font-size:30px;position:absolute;inset:0;text-align:center}.suggestion b{color:#111}.suggestion em{white-space:nowrap}.primary:disabled{opacity:.7;cursor:wait}@keyframes newsPulse{0%,100%{transform:scaleY(.45);opacity:.5}50%{transform:scaleY(1);opacity:1}}@keyframes newsSpin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.news-loader i,.small-spinner{animation:none}}@media(max-width:640px){.suggestion{grid-template-columns:48px 1fr}.suggestion img,.suggestion-art{width:48px;height:40px}.suggestion em{display:none}}</style></head>`);

export default {
  async fetch(request,env,ctx){
    var url=new URL(request.url);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS"}});
    if(url.pathname==="/api/publisher-icon")return publisherIconResponse(url.searchParams.get('host'));
    if(url.pathname==="/api/gold")return json(await dailyUtility(env,'gold'));
    if(url.pathname==="/api/lottery")return json(await dailyUtility(env,'lottery'));
    if(url.pathname==="/api/streams")return json(await liveStreams());
    if(url.pathname==="/api/source-access")return json(sourceAccessSnapshot);
    if(url.pathname==="/api/refresh"){
      if(request.method!=="POST")return json({error:'method_not_allowed'},405);
      if(!matchingSecret(request.headers.get('x-tcn-refresh-token'),env?.TCN_REFRESH_TOKEN))return json({error:'forbidden'},403);
      try{runtimeCache.delete('feed-update');const feed=await shared('feed-update',0,()=>refreshFeed(env));const [gold,lottery]=await Promise.all([dailyUtility(env,'gold'),dailyUtility(env,'lottery')]);return json({checkedAt:feed.checkedAt,activeEvents:feed.clusters.length,goldCycle:gold.refreshCycle,lotteryCycle:lottery.refreshCycle});}catch(e){console.error('scheduled_refresh',String(e));return json({error:'refresh_failed'},503);}
    }
    if(url.pathname==="/api/live"||url.pathname==="/api/news")try{const feed=await getLiveFeed(request,env,ctx);return json({...feed,featured:selectHomepageStories(feed.clusters),corroborated:corroboratedStories(feed.clusters)});}catch(e){console.error('live_unavailable',String(e));return json({error:'feed_unavailable'},503);}
    if(url.pathname==="/api/archive")try{const day=url.searchParams.get('date')||'',offset=Math.max(0,Number(url.searchParams.get('offset'))||0);if(day&&!validDay(day))return json({error:'invalid_date'},400);if(day===ARCHIVE_START)await backfillDay(env,day);const rows=await archiveReports(env,{day,query:url.searchParams.get('q')||'',limit:41,offset});return json({items:rows.slice(0,40),hasMore:rows.length>40,nextOffset:offset+40,stats:await archiveStats(env),day});}catch(e){console.error('archive_unavailable',String(e));return json({error:'archive_unavailable'},503);}
    if(url.pathname==="/api/suggest")try{var sq=(url.searchParams.get("q")||"").trim(),day=url.searchParams.get('date')||'';if(!sq)return json([]);if(day&&!validDay(day))return json({error:'invalid_date'},400);return json(await shared('suggest:'+normalize(sq)+':'+day,60000,async()=>suggestions(sq,{clusters:await loadArchive(env,{query:sq,day,limit:300})},false)));}catch(e){console.error('suggest_unavailable',String(e));return json({error:'archive_unavailable'},503);}
    if(url.pathname==="/api/compare-source"){
      if(request.method!=="GET")return json({error:'method_not_allowed'},405);
      const sourceUrl=url.searchParams.get('url')||'';
      try{return json(await shared('compare-source:'+sourceUrl,60000,async()=>{
        const source=await fetchSourceArticle(sourceUrl);
        if(source.state!=='readable')return source;
        const article=source.article,query=article.title.replace(/\s*[-|｜]\s*(?:Thai PBS|ไทยโพสต์|Bangkok Post|มติชนออนไลน์|ไทยรัฐ).*$/i,'').slice(0,220);
        const storedEvent=await archivedSourceEvent(env,article.url);
        const verified=storedEvent.length?null:await verifyQuery(query,{clusters:await loadArchive(env,{query,limit:300})},env,{remote:false});
        const candidates=storedEvent.length?independent(storedEvent):verified.evidence;
        const sameEvent=candidates.filter(r=>directUrl(r.url)===article.url||sameNewsEvent(query,r.title,r.publishedAt,r.publishedAt).same);
        if((!storedEvent.length&&verified.score<60)||!sameEvent.length)return {state:'no_archive',message:'ยังไม่มีข่าวอ้างอิงเรื่องเดียวกันในคลังเพียงพอ จึงเปรียบเทียบความถูกต้องไม่ได้',source:{url:article.url,title:article.title,paragraphCount:article.paragraphCount}};
        // A feed excerpt or meta description is not sufficient for a judgement about the article's wording.
        const evidence=await Promise.all(sameEvent.slice(0,5).map(async r=>{
          const text=await fetchSourceArticle(directUrl(r.url)||r.url);
          return text.state==='readable'?{...r,contentRead:true,excerpt:text.article.body}:{...r,contentRead:false,excerpt:''};
        }));
        const comparison=compareSourceToEvidence(article,evidence);
        if(article.kind==='opinion'&&comparison.assessment)comparison.assessment={code:'opinion',label:'บทความความเห็น — ไม่จัดเป็นรายงานข่าวตรง'};
        return {...comparison,source:{url:article.url,title:article.title,paragraphCount:article.paragraphCount,publishedAt:article.publishedAt,kind:article.kind},matchScore:storedEvent.length?100:verified.score,method:'เปรียบเทียบข้อความรายย่อหน้ากับบทความที่อ่านได้จากแหล่งอิสระ ไม่ใช่โมเดล AI ที่ฝึกให้ตัดสินข่าวเท็จ'};
      }));}catch(e){console.error('source_comparison_unavailable',String(e));return json({state:'temporary_error',message:'ระบบเปรียบเทียบขัดข้องชั่วคราว โปรดลองใหม่ภายหลัง'},503);}
    }
    if(url.pathname==="/api/check"){
      var query=url.searchParams.get("q")||"";if(request.method==="POST")try{query=(await request.json()).query||query;}catch{}if(!query.trim())return json({error:"query_required"},400);
      const remote=url.searchParams.get('phase')!=='archive',day=url.searchParams.get('date')||'';if(day&&!validDay(day))return json({error:'invalid_date'},400);
      try{const result=await shared('check:'+normalize(query)+':'+day+':'+remote,remote?300000:15000,async()=>{
        const archived=await loadArchive(env,{query,day,limit:300});const snapshot=runtimeCache.get('feed')?.value?.clusters||[];
        const local=snapshot.filter(c=>!validDay(day)||new Date(c.publishedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})===day);
        const data=await verifyQuery(query.trim(),{clusters:archived.concat(local)},env,{remote,day});return {...data,contentAnalysis:compareContent(data.evidence),checkedAt:new Date().toISOString()};});return json(result);
      }catch(e){console.error('check_unavailable',String(e));return json({error:'check_unavailable',message:'ตรวจเพิ่มเติมไม่ได้ชั่วคราว ข้อมูลในคลังยังเปิดอ่านได้'},503);}
    }
    if(url.pathname==="/favicon.ico")return new Response(null,{status:204});
    return new Response(enhanceHtml(html),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=120"}});
  }
};
