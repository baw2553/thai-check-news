import http from "node:http";
import worker from "./dist/server/index.js";
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

const db=new DatabaseSync(new URL('../true-news-preview.sqlite',import.meta.url));
db.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
for(const name of readdirSync(new URL('./drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM preview_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN');try{db.exec(readFileSync(new URL('./drizzle/'+name,import.meta.url),'utf8'));db.prepare('INSERT INTO preview_migrations (name) VALUES (?)').run(name);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
function statement(sql,args=[]){return {sql,args,bind(...values){return statement(sql,values);},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}
const env={DB:{prepare:statement,async batch(stmts){db.exec('BEGIN');try{const results=stmts.map(s=>db.prepare(s.sql).run(...s.args));db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const ctx={waitUntil(promise){promise.catch(e=>console.error('background_refresh',String(e)));}};

const memoryCache = new Map();
globalThis.caches = {
  default: {
    async match(request) {
      const item = memoryCache.get(request.url);
      return item ? item.clone() : undefined;
    },
    async put(request, response) {
      memoryCache.set(request.url, response.clone());
    }
  }
};

const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : body
  });
  const response = await worker.fetch(request,env,ctx);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local: http://127.0.0.1:${port}`);
});
