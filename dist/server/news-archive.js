export const ARCHIVE_START = '2026-09-28';
export const ARCHIVE_START_ISO = '2026-09-27T17:00:00.000Z';

export function searchText(value){
  return String(value||'').normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g,'').toLocaleLowerCase('th-TH')
    .replace(/[“”"'’‘()[\]{}.,!?;:|/\\\-–—]/g,' ').replace(/\s+/g,' ').trim();
}
const segmenter = new Intl.Segmenter('th',{granularity:'word'});
const stop = new Set(['และ','หรือ','ที่','ใน','ของ','จาก','เป็น','ว่า','มี','ยัง','แล้ว','เพื่อ','กับ','ให้','ได้','โดย','หลัง','ก่อน','วันนี้','ข่าว','ล่าสุด','เมื่อ','นี้','นั้น','การ','ไทย','จะ','ไป','มา','เผย','ระบุ','รายงาน','คน','หนึ่ง']);
export function searchTokens(value){return [...new Set([...segmenter.segment(searchText(value))].filter(x=>x.isWordLike&&x.segment.length>=2&&!stop.has(x.segment)).map(x=>x.segment))].sort((a,b)=>b.length-a.length).slice(0,8);}
export function validDay(day){return /^\d{4}-\d{2}-\d{2}$/.test(day||'')&&day>=ARCHIVE_START&&Number.isFinite(Date.parse(day+'T00:00:00+07:00'));}
function bounds(day){const start=new Date(day+'T00:00:00+07:00');return [start.toISOString(),new Date(+start+86400000).toISOString()];}
export function reportRows(rows){return rows.map(r=>{let content={};try{content=JSON.parse(r.contentJson||'{}');}catch{}return {...content,id:r.id,eventKey:r.eventKey,title:r.title,source:r.source,url:r.url,publishedAt:r.publishedAt,image:r.image,kind:r.kind,firstSeenAt:r.firstSeenAt,materialUpdatedAt:r.materialUpdatedAt};});}
const fields='id,event_key AS eventKey,title,source,url,published_at AS publishedAt,image_url AS image,source_type AS kind,content_json AS contentJson,first_seen_at AS firstSeenAt,material_updated_at AS materialUpdatedAt';
export const LIVE_HOURS=24;
export async function activeReports(env,at=new Date()){
  if(!env?.DB?.prepare)return [];
  const since=new Date(+at-LIVE_HOURS*3600000).toISOString();
  const r=await env.DB.prepare('SELECT '+fields+' FROM news_articles WHERE event_key IN (SELECT DISTINCT event_key FROM news_articles WHERE material_updated_at > ?) ORDER BY published_at DESC LIMIT 480').bind(since).all();
  return reportRows(r.results||[]);
}
export async function getRefreshTime(env,name){if(!env?.DB?.prepare)return '';return (await env.DB.prepare('SELECT checked_at AS checkedAt FROM refresh_state WHERE name=?').bind(name).first())?.checkedAt||'';}
export async function setRefreshTime(env,name,at){if(env?.DB?.prepare)await env.DB.prepare('INSERT INTO refresh_state (name,checked_at) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET checked_at=excluded.checked_at').bind(name,at).run();}
export async function getDailySnapshot(env,kind){if(!env?.DB?.prepare)return null;const row=await env.DB.prepare('SELECT cycle,payload,checked_at AS checkedAt FROM daily_snapshots WHERE kind=?').bind(kind).first();if(!row)return null;try{return {...row,data:JSON.parse(row.payload)};}catch{return null;}}
export async function setDailySnapshot(env,kind,cycle,data,at){if(env?.DB?.prepare)await env.DB.prepare('INSERT INTO daily_snapshots (kind,cycle,payload,checked_at) VALUES (?,?,?,?) ON CONFLICT(kind) DO UPDATE SET cycle=excluded.cycle,payload=excluded.payload,checked_at=excluded.checked_at').bind(kind,cycle,JSON.stringify(data),at).run();}
export async function archiveReports(env,{query='',day='',limit=160,offset=0}={}){
  if(!env?.DB?.prepare)return [];
  const params=[ARCHIVE_START_ISO],where=['published_at >= ?'];
  if(validDay(day)){const [a,b]=bounds(day);where.push('published_at >= ? AND published_at < ?');params.push(a,b);}
  if(query){const exact=searchText(query),tokens=searchTokens(query);
    if(/(?:ประกันสังคม|สปส)/u.test(exact)&&/เลือกตั้ง/u.test(exact)&&/(?:ผล|คะแนน|ชนะ|กวาด|นับ)/u.test(exact)){
      where.push("(title LIKE '%ประกันสังคม%' OR title LIKE '%สปส%') AND (title LIKE '%เลือกตั้ง%' OR title LIKE '%บอร์ด%') AND (title LIKE '%ผล%' OR title LIKE '%คะแนน%' OR title LIKE '%นับ%' OR title LIKE '%ชนะ%' OR title LIKE '%กวาด%' OR title LIKE '%นำ%')");
    }else{where.push('(normalized_title = ? OR '+(tokens.length?tokens.map(()=>'(normalized_title LIKE ? ESCAPE \'!\' OR title LIKE ? ESCAPE \'!\')').join(' OR '):'(normalized_title LIKE ? ESCAPE \'!\' OR title LIKE ? ESCAPE \'!\')')+')');params.push(exact);for(const word of tokens.length?tokens:[exact]){const escaped='%'+word.replace(/[!%_]/g,'!$&')+'%';params.push(escaped,escaped);}}
  }
  params.push(Math.min(300,Math.max(1,limit)),Math.max(0,offset));
  const r=await env.DB.prepare('SELECT '+fields+' FROM news_articles WHERE '+where.join(' AND ')+' ORDER BY published_at DESC,id DESC LIMIT ? OFFSET ?').bind(...params).all();
  return reportRows(r.results||[]);
}
export async function archivedSourceEvent(env,url){
  if(!env?.DB?.prepare)return [];
  const source=await env.DB.prepare('SELECT '+fields+' FROM news_articles WHERE url=? LIMIT 1').bind(url).first();
  if(!source)return [];
  const rows=await env.DB.prepare('SELECT '+fields+' FROM news_articles WHERE event_key=? ORDER BY published_at DESC LIMIT 80').bind(source.eventKey).all();
  return reportRows(rows.results||[]);
}
export async function archiveStats(env){
  if(!env?.DB?.prepare)return {total:0,start:ARCHIVE_START,persistent:false};
  const r=await env.DB.prepare('SELECT COUNT(*) AS total,MIN(published_at) AS earliest,MAX(published_at) AS latest FROM news_articles WHERE published_at >= ?').bind(ARCHIVE_START_ISO).first();
  return {...r,start:ARCHIVE_START,persistent:true};
}
export async function saveReports(env,reports,{stableId,entities,terms,historical=false,at=new Date()}={}){
  if(!env?.DB?.prepare)return;
  const seen=new Set(),rows=reports.filter(r=>{const t=Date.parse(r.publishedAt),key=r.url||r.source+r.title;if(!r.title||!r.url||!Number.isFinite(t)||t<Date.parse(ARCHIVE_START_ISO)||t>Date.now()+300000||seen.has(key))return false;seen.add(key);return true;});
  const now=new Date(at).toISOString();
  for(let i=0;i<rows.length;i+=50){
    const page=rows.slice(i,i+50),prior=await env.DB.prepare('SELECT url,title,event_key AS eventKey,content_json AS contentJson,fingerprint,first_seen_at AS firstSeenAt,material_updated_at AS materialUpdatedAt FROM news_articles WHERE url IN ('+page.map(()=>'?').join(',')+')').bind(...page.map(r=>r.url)).all(),oldByUrl=new Map((prior.results||[]).map(r=>[r.url,r]));
    const statements=[];
    for(const r of page){
      const old=oldByUrl.get(r.url),content=r.contentRead?JSON.stringify({contentRead:true,excerpt:r.excerpt,timeMentions:r.timeMentions||[],actions:r.actions||[],locations:r.locations||[],articlePublishedAt:r.articlePublishedAt,articleUpdatedAt:r.articleUpdatedAt,contentFetchedAt:r.contentFetchedAt}):old?.contentJson||null;
      let detail={};try{detail=JSON.parse(content||'{}');}catch{}
      const fingerprint=stableId(searchText(r.title)+'|'+searchText(detail.excerpt||'')+'|'+String(detail.articleUpdatedAt||''));
      const changed=!old||(old.fingerprint?old.fingerprint!==fingerprint:searchText(old.title)!==searchText(r.title));
      const fresh=Date.parse(r.publishedAt)>=Date.now()-48*3600000||Date.parse(detail.articleUpdatedAt||'')>=Date.now()-48*3600000;
      const materialAt=historical||!fresh?(old?.materialUpdatedAt||''):changed?now:old?.materialUpdatedAt||'';
      const eventKey=r.eventKey||stableId(searchText(r.eventTitle||r.title));
      if(old&&!changed&&old.eventKey===eventKey&&content===old.contentJson)continue;
      statements.push(env.DB.prepare("INSERT INTO news_articles (id,event_key,title,source,url,published_at,collected_at,image_url,source_type,entities,event_terms,normalized_title,content_json,first_seen_at,material_updated_at,fingerprint) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET event_key=excluded.event_key,title=excluded.title,source=excluded.source,normalized_title=excluded.normalized_title,published_at=CASE WHEN news_articles.published_at LIKE '%+%' THEN excluded.published_at ELSE news_articles.published_at END,image_url=COALESCE(excluded.image_url,news_articles.image_url),content_json=COALESCE(excluded.content_json,news_articles.content_json),material_updated_at=excluded.material_updated_at,fingerprint=excluded.fingerprint")
        .bind(stableId(r.url),eventKey,r.title,r.source,r.url,new Date(r.publishedAt).toISOString(),now,r.image||null,r.kind||'news',JSON.stringify(entities(r.title)),JSON.stringify(terms(r.title).slice(0,12)),searchText(r.title),content,old?.firstSeenAt||now,materialAt,fingerprint));
    }
    if(statements.length)await env.DB.batch(statements);
  }
}
