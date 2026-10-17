import { extractArticle } from '../dist/server/news-features.js';

const base = 'https://check-thai-news-today.ruby-hippo-1728.chatgpt.site';
const maxPages = Number(process.argv[2] || 14);
const archive = [];
let offset = 0;

for (let page = 0; page < maxPages; page++) {
  const response = await fetch(`${base}/api/archive?offset=${offset}`);
  if (!response.ok) throw new Error(`Archive HTTP ${response.status}`);
  const data = await response.json();
  archive.push(...data.items);
  if (!data.hasMore) break;
  offset = data.nextOffset;
}

const groups = new Map();
for (const report of archive) {
  let host;
  try { host = new URL(report.url).hostname.replace(/^www\./, ''); }
  catch { continue; }
  if (!groups.has(host)) groups.set(host, []);
  if (!groups.get(host).some(item => item.url === report.url)) groups.get(host).push(report);
}

console.log(JSON.stringify({ sampledArchiveRows: archive.length,
  hosts: [...groups].map(([host, reports]) => ({ host, count: reports.length })) }));

const selected = [...groups]
  .filter(([host]) => !['news.google.com', 'bing.com'].includes(host))
  .flatMap(([, reports]) => reports.slice(0, 2));

async function probe(report) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let status = null, contentType = '', html = '', error = '';
  try {
    const response = await fetch(report.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'ThaiCheckNews/0.5 (+public news aggregation)' }
    });
    status = response.status;
    contentType = response.headers.get('content-type') || '';
    html = (await response.text()).slice(0, 2_000_000);
  } catch (cause) { error = String(cause); }
  finally { clearTimeout(timer); }
  const extracted = html ? extractArticle(html, report) : { excerpt: '' };
  const longParagraphs = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .filter(match => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length > 80).length;
  return {
    host: new URL(report.url).hostname,
    url: report.url,
    status, contentType, htmlLength: html.length,
    articleTag: /<article\b/i.test(html),
    structuredArticleBody: /"articleBody"\s*:/.test(html),
    longParagraphs,
    excerptLength: extracted.excerpt.length,
    excerptSample: extracted.excerpt.slice(0, 100),
    error
  };
}

const probes = await Promise.all(selected.map(probe));
for (const probeResult of probes) console.log(JSON.stringify(probeResult));
