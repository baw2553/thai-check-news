import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {archiveReports,activeReports,archiveStats,saveReports,searchText} from '../dist/server/news-archive.js';
import worker,{sameNewsEvent,clusterItems,activeClusters,selectHomepageStories,corroboratedStories,queryIntentMatch,buildNarrative} from '../dist/server/index.js';

function adapter(db){function prepare(sql,args=[]){return {sql,args,bind(...a){return prepare(sql,a);},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;}};}return {DB:{prepare,async batch(stmts){return stmts.map(s=>db.prepare(s.sql).run(...s.args));}}};}
const headline='คนตกสีที่อยู่อีกฝั่งหนึ่ง : ‘กรมอุตุฯ’ กับ ‘วุ้นแปลภาษา’ ที่หายไป';
test('permanent archive, date boundaries, pagination and normalised selection search',async()=>{
 const db=new DatabaseSync(':memory:');for(const name of ['0000_news_archive','0001_archive_search','0002_live_retention'])db.exec(await readFile(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));const env=adapter(db);
 const reports=Array.from({length:125},(_,i)=>({title:i===0?headline:'ข่าวทดสอบน้ำท่วม รายงาน '+i,source:'มติชนออนไลน์',url:'https://www.matichon.co.th/article/'+i,publishedAt:i===0?'2026-09-28T08:00:00+07:00':'2026-09-29T10:00:00+07:00'}));
 await saveReports(env,reports,{stableId:v=>v,entities:()=>[],terms:()=>[]});assert.equal((await archiveStats(env)).total,125);
 const old=await archiveReports(env,{day:'2026-09-28'});assert.equal(old.length,1);assert.equal(old[0].title,headline);
 assert.equal((await archiveReports(env,{query:headline.replace(/[‘’]/g,"'")}))[0].title,headline);
 const a=await archiveReports(env,{limit:40}),b=await archiveReports(env,{limit:40,offset:40});assert.equal(a.length,40);assert.equal(b.length,40);assert.ok(!a.some(x=>b.some(y=>x.id===y.id)));
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('archive phase must not fetch external sources');};
 try{const t=performance.now();const r=await worker.fetch(new Request('https://test/api/check?phase=archive&q='+encodeURIComponent(headline)),env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.evidenceCount,1);assert.ok(performance.now()-t<1000);assert.ok(data.fromArchive);const stats=await worker.fetch(new Request('https://test/api/archive?date=2026-09-29'),env).then(x=>x.json());assert.ok(stats.hasMore);}finally{globalThis.fetch=originalFetch;db.close();}
});
test('24-hour live retention renews only for a material update or a new corroborating report',async()=>{
 const db=new DatabaseSync(':memory:');for(const name of ['0000_news_archive','0001_archive_search','0002_live_retention'])db.exec(await readFile(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));const env=adapter(db),helpers={stableId:v=>v,entities:()=>[],terms:()=>[]};
 const start=Date.now(),instant=hours=>new Date(start+hours*3600000),first={title:'ข่าวน้ำท่วมพื้นที่ ก',source:'แหล่งหนึ่ง',url:'https://example.com/1',eventKey:'flood-a',publishedAt:instant(-1).toISOString()};
 await saveReports(env,[first],{...helpers,at:instant(0)});
 assert.equal((await activeReports(env,instant(23.98))).length,1);
 await saveReports(env,[first],{...helpers,at:instant(24.02)});
 assert.equal((await activeReports(env,instant(24.02))).length,0);
 const second={...first,title:'ข่าวน้ำท่วมพื้นที่ ก เพิ่มจุดช่วยเหลือ'};
 await saveReports(env,[second],{...helpers,at:instant(24.04)});
 assert.equal((await activeReports(env,instant(24.05))).length,1);
 await saveReports(env,[{...first,url:'https://other.example.com/2',source:'แหล่งสอง'}],{...helpers,at:instant(25)});
 assert.equal((await activeReports(env,instant(48.98))).length,2);
 assert.equal((await activeReports(env,instant(49.02))).length,0);
 assert.equal((await archiveReports(env,{query:'ข่าวน้ำท่วมพื้นที่ ก'})).length,2);
 db.close();
});
test('special quotes, NBSP and zero-width text share a canonical query',()=>{
 assert.equal(searchText(headline),searchText(headline.replace(/[‘’]/g,"'").replace(/ /g,'\u00a0').replace('กรม','ก\u200bรม')));
});
test('scheduled writer rejects missing credentials and cannot be invoked with GET',async()=>{
 const post=await worker.fetch(new Request('https://test/api/refresh',{method:'POST'}),{});
 assert.equal(post.status,403);
 const get=await worker.fetch(new Request('https://test/api/refresh'),{});
 assert.equal(get.status,405);
});
test('one event from Thai Rath and two Thai PBS feeds appears only once; similar words alone do not merge',()=>{
 const at='2026-10-08T06:01:00Z',titles=[
  '“แม่ภัทร” แจ้งความ “ลูกชาย” ปมถูกอุ้มขังศูนย์ดูแลผู้สูงอายุ',
  'แม่แจ้งความ "ลูกชาย-ผู้เกี่ยวข้อง" ปมถูกอุ้มไปศูนย์ดูแลผู้สูงอายุฯ',
  'แม่แจ้งความ "ลูกชาย-ผู้เกี่ยวข้อง" ปมถูกอุ้มไปศูนย์ดูแลผู้สูงอายุ',
  'ผู้สูงอายุในศูนย์ดูแลเชียงใหม่ได้รับความช่วยเหลือหลังน้ำท่วม'
 ];
 assert.ok(sameNewsEvent(titles[0],titles[1],at,at).same);
 assert.ok(!sameNewsEvent(titles[0],'ลูกชายแจ้งความแม่ ปมถูกอุ้มไปศูนย์ดูแลผู้สูงอายุ',at,at).same);
 const items=titles.map((title,i)=>({id:String(i),title,publishedAt:new Date(Date.parse(at)-i*3600000).toISOString(),reports:[{title,source:['ไทยรัฐ','Thai PBS News','Thai PBS','ข่าวท้องถิ่น'][i],url:'https://example.com/'+i,publishedAt:at}]}));
 const grouped=clusterItems(items);assert.equal(grouped.length,2);assert.equal(grouped.find(x=>x.reports.length===3)?.reports.length,3);
 const reports=items.map((x,i)=>({...x.reports[0],eventKey:'old-'+i,materialUpdatedAt:at}));
 const live=activeClusters(reports,new Date(at));assert.equal(live.length,2);assert.equal(live.find(x=>x.reports.length===3)?.sourceCount,2);
});
test('homepage carousel keeps one representative of a repeated case, then shows other subjects',()=>{
 const at='2026-10-09T10:00:00Z';
 const titles=[
  '2 อาสากู้ภัย พบ ตร.วังทองหลาง แจงปมจับ ‘แม่ภัทร’ ยันบริสุทธิ์ใจ',
  '2อาสาฯ โร่พบตร. แจงปม ลูกชายจ้างอุ้ม แม่ภัทร',
  '“แม่ภัทร” แจ้งความ “ลูกชาย” ปมถูกอุ้มขังศูนย์ดูแลผู้สูงอายุ',
  'แม่ภัทร เอาจริง แจ้งจับลูกชาย ปมอุ้มส่งเนิร์สซิ่งโฮมไม่สมัครใจ',
  'นายกฯจี้เร่งกำจัดขยะและสั่งบิ๊กคลีนนิงหลายพื้นที่',
  'พระราชินีเสด็จฯเยือนญี่ปุ่นระหว่างวันที่ 14-22 ตุลาคม',
  'แข้งทีมชาติไทยยู15 รายงานตัวซ้อมครั้งแรกเตรียมลุยบอลโลก',
  'โตโยต้าขยายหยุดผลิต 3 โรงงาน น้ำท่วมกระทบส่งชิ้นส่วน'
 ];
 const items=titles.map((title,i)=>({id:String(i),title,publishedAt:at,sourceCount:i===2?6:1,reports:[{title,source:'แหล่ง '+i,url:'https://example.com/'+i,publishedAt:at}]}));
 const featured=selectHomepageStories(items,5);
 assert.equal(featured.length,5);
 assert.equal(featured.filter(x=>x.title.includes('แม่ภัทร')).length,1);
 assert.equal(featured[0].sourceCount,6);
 assert.ok(featured.some(x=>x.title.includes('โตโยต้า')));
 assert.ok(featured.some(x=>x.title.includes('ทีมชาติไทย')));
});
test('story begins with the event, distinguishes event date from publication, and names sources once at the end',()=>{
 const title='แม่แจ้งความลูกชาย กรณีถูกอุ้มไปศูนย์ดูแลผู้สูงอายุ';
 const evidence=[
  {title,source:'Thai PBS News',publishedAt:'2026-10-08T04:20:00Z',contentRead:true,excerpt:'แม่เดินทางเข้าแจ้งความกรณีลูกชายพาไปศูนย์ดูแลผู้สูงอายุ เจ้าหน้าที่รับเรื่องและอยู่ระหว่างตรวจสอบข้อเท็จจริง',locations:[]},
  {title:'แม่แจ้งความลูกชาย ปมถูกอุ้มไปศูนย์ดูแลผู้สูงอายุ',source:'ไทยรัฐ',publishedAt:'2026-10-08T06:01:00Z',contentRead:false,locations:[]}
 ];
 const story=buildNarrative(title,{cluster:{title}},evidence),parts=story.split('\n\n');
 assert.match(parts[0],/แม่แจ้งความลูกชาย/);assert.ok(!parts[0].includes('Thai PBS'));
 assert.match(story,/วันเวลาเกิดเหตุยังไม่ระบุชัด/);assert.match(parts.at(-1),/^ที่มา: /);
 assert.match(parts.at(-1),/Thai PBS News/);assert.match(parts.at(-1),/ไทยรัฐ/);
 assert.equal(story.split('ที่มา:').length,2);
});
test('an earlier short or truncated report leads the story before a later related report',()=>{
 const first={title:'“แม่ภัทร” แจ้งความ “ลูกชาย” ปมถูกอุ้มขังศูนย์ดูแลผู้สูงอายุ ...',source:'ไทยรัฐ',publishedAt:'2026-10-08T06:01:00Z',contentRead:false};
 const later={title:'ตร.วังทองหลาง พา "ผู้เสียหาย" ชี้จุดถูกอุ้มขึ้นรถส่งศูนย์ดูแลผู้สูงอายุ',source:'Thai PBS News',publishedAt:'2026-10-08T06:42:32Z',contentRead:false};
 const story=buildNarrative(first.title,{cluster:{title:later.title}},[later,first]),parts=story.split('\n\n');
 assert.match(parts[0],/แม่ภัทร.*แจ้งความ/);assert.ok(!parts[0].includes('...'));
 assert.match(parts[1],/^รายงานที่เผยแพร่ภายหลังระบุว่า ตร\.วังทองหลาง/);
 assert.match(parts.at(-1),/^ที่มา: ไทยรัฐ, Thai PBS News/);
});
test('readable article details survive long excerpts without promotional text or clipped headline suffixes',()=>{
 const q='แม่แจ้งความ ลูกชาย ถูกอุ้ม ศูนย์ดูแลผู้สูงอายุ';
 const evidence=[
  {title:'“แม่ภัทร” แจ้งความ “ลูกชาย” ปมถูกอุ้มขังศูนย์ดูแลผู้สูงอายุ | 8 ...',source:'ไทยรัฐ',publishedAt:'2026-10-08T10:11:00Z',contentRead:true,excerpt:'แม่ภัทร แจ้งความลูกชายหลังถูกอุ้มขังศูนย์ดูแลผู้สูงอายุ #ข่าววันนี้ 🔔 กด Subscribe ติดตามช่อง'},
  {title:'ตร.วังทองหลาง พาผู้เสียหายชี้จุดถูกอุ้มขึ้นรถ',source:'Thai PBS News',publishedAt:'2026-10-08T06:42:32Z',contentRead:true,excerpt:'วันนี้ (8 ต.ค.2569) ผู้เสียหายพร้อมตำรวจ สน.วังทองหลาง ลงพื้นที่ตรวจสอบจุดที่มีการอุ้มขึ้นรถตู้ และบริเวณบ้านพักของนางภัทร ก่อนหน้านี้เมื่อช่วงเช้าที่ผ่านมา นายเอกภพ เหลืองประเสริฐ ผู้ก่อตั้งเพจสายไหมต้องรอด ได้พานางภัทร ผู้เสียหายที่ถูกกักขังหน่วงเหนี่ยวภายในศูนย์ดูแลผู้สูงอายุแห่งหนึ่งใน จ.กาญจบุรี นานกว่า 2 ปี เข้าแจ้งความที่ สน.วังทองหลาง'}
 ];
 const story=buildNarrative(q,{cluster:{title:q}},evidence);
 assert.match(story,/ลงพื้นที่ตรวจสอบจุดที่มีการอุ้ม/);
 assert.match(story,/กาญจบุรี/);
 assert.ok(!story.includes('Subscribe'));assert.ok(!story.includes('| 8'));
 assert.equal(story.split('ที่มา:').length,2);
});
test('incoming searches are independent of feed readiness; errors retain the result',async()=>{
 const html=await worker.fetch(new Request('https://test/')).then(x=>x.text());assert.ok(!html.includes('loadFeed().then('));assert.ok(html.includes("requestResult('archive')"));assert.ok(html.includes("requestResult('full')"));assert.ok(html.includes('setResultNotice'));assert.ok(!html.includes('status:"กำลังพิจารณา — เชื่อมต่อไม่ได้"'));assert.ok(!html.includes('/api/suggest?remote=1'));assert.ok(html.includes('archiveDate'));assert.ok(html.includes('canonicalSearch'));
});
test('outcome search recognises synonymous election headlines and rejects merely related uses of the word election',async()=>{
 const q='ผลเลือกตั้งประกันสังคม';
 assert.equal(queryIntentMatch(q,'เลือกตั้งบอร์ดประกันสังคมนับคะแนนครบ 100% ทีมก้าวหน้าชนะ'),1);
 assert.equal(queryIntentMatch(q,'สปส. นับคะแนนเลือกตั้งบอร์ด ทีมก้าวหน้านำ'),1);
 assert.equal(queryIntentMatch(q,'เซเลนสกีพร้อมเลือกตั้งหากหยุดยิง'),0);
 const db=new DatabaseSync(':memory:');for(const name of ['0000_news_archive','0001_archive_search','0002_live_retention'])db.exec(await readFile(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));const env=adapter(db);
 const reports=[{title:'เลือกตั้งบอร์ดประกันสังคมนับคะแนนครบ 100% ทีมก้าวหน้าชนะ',source:'สำนัก ก',url:'https://example.com/election',publishedAt:'2026-10-11T10:00:00Z'},{title:'เซเลนสกีพร้อมเลือกตั้งหากหยุดยิง',source:'สำนัก ข',url:'https://example.com/other',publishedAt:'2026-10-12T10:00:00Z'}];
 await saveReports(env,reports,{stableId:v=>v,entities:()=>[],terms:()=>[]});
 const found=await archiveReports(env,{query:q});assert.equal(found.length,1);assert.equal(found[0].title,reports[0].title);
 const suggestions=await worker.fetch(new Request('https://test/api/suggest?q='+encodeURIComponent(q)),env).then(r=>r.json());assert.equal(suggestions.length,1);assert.equal(suggestions[0].title,reports[0].title);db.close();
});
test('unrelated search terms do not borrow evidence from another news event',async()=>{
 const db=new DatabaseSync(':memory:');for(const name of ['0000_news_archive','0001_archive_search','0002_live_retention'])db.exec(await readFile(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));const env=adapter(db);
 await saveReports(env,[{title:'หนุ่ม กรรชัย เข้าให้ข้อมูล DSI กรณีบริจาคเงินให้ กัน จอมพลัง',source:'Thai PBS News',url:'https://www.thaipbs.or.th/news/content/test',publishedAt:'2026-10-09T12:17:15Z'}],{stableId:v=>v,entities:()=>[],terms:()=>[]});
 const q='ทดสอบคำค้นที่ไม่มีข่าวตรงกัน 123xyz',data=await worker.fetch(new Request('https://test/api/check?phase=archive&q='+encodeURIComponent(q)),env).then(r=>r.json());
 assert.equal(data.evidenceCount,0);assert.equal(data.sourceCount,0);assert.equal(data.approved,false);assert.ok(!data.details.includes('กรรชัย'));db.close();
});
test('corroborated board counts two direct publishers once and excludes aggregator-only stories',()=>{
 const at='2026-10-11T10:00:00Z';const titles=['กรมอุตุฯ เตือนฉ.10 อากาศแปรปรวน ฝนหนักทั่วประเทศ','อุตุฯ เตือนฉบับ 10 อากาศแปรปรวน 11-13 ต.ค. ฝนหนักหลายภาค'];
 const items=titles.map((title,i)=>({title,publishedAt:at,reports:[{title,source:i?'มติชนออนไลน์':'ไทยโพสต์',url:i?'https://www.matichon.co.th/local/news_1':'https://www.thaipost.net/general-news/1/',publishedAt:at}]}));
 const grouped=clusterItems(items),board=corroboratedStories(grouped);assert.equal(grouped.length,1);assert.equal(board.length,1);assert.equal(board[0].sourceCount,2);
 assert.equal(corroboratedStories(clusterItems([{title:'ข่าวทดสอบ',publishedAt:at,reports:[{title:'ข่าวทดสอบ',source:'Google News',url:'https://news.google.com/articles/1',publishedAt:at}]}])).length,0);
 assert.equal(sameNewsEvent('‘พี่ศรี’ รับลูก ‘ศิริโชค’ ร้อง กกต. สอบ ‘ไอเดียร์’ ปมบริจาคเงินให้ ภท.','กกต.แจงหลักเกณฑ์บริจาคเงินให้พรรคการเมือง ย้ำเปิดเผยข้อมูลตามกฎหมาย',at,at).same,false);
 assert.equal(sameNewsEvent('‘พี่ศรี’ รับลูก ‘ศิริโชค’ ร้อง กกต. สอบ ‘ไอเดียร์’ ปมบริจาคเงินให้ ภท.','"ภท." โต้ "ศิริโชค" ยืนยันเงิน "ไอเดียร์" บริจาคเข้าพรรค เป็นเงินสุจริต',at,at).same,false);
 assert.equal(sameNewsEvent('ปิดฉาก 2 วันม็อบต้าน IMF-World Bank ปลุกรื้อโครงสร้างอำนาจรัฐ','นายกฯ เปิด IMF-World Bank ชูขอบฟ้าใหม่ไทย ปลุกนานาชาติร่วมมือ',at,at).same,false);
});
