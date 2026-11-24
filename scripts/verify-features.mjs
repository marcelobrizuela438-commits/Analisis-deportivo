import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
const database = new DatabaseSync(':memory:');
database.exec(readFileSync('drizzle/0001_picks.sql','utf8'));
const env = {
 DB: {
  prepare(sql) {
   return {
    bind(...args) {
     const statement = database.prepare(sql);
     return {
      async all() { return {results:statement.all(...args)}; },
      async first() { return statement.get(...args); },
      async run() { return {meta:{changes:Number(statement.run(...args).changes)}}; }
     };
    }
   };
  }
 }
};
const origin='https://example.test';
function request(user,method='GET',data){return new Request(origin+'/api/picks',{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined})}
const pick={id:crypto.randomUUID(),title:'Prueba',kind:'parley',date:'2026-11-10',stakeCents:1000,odds:3.5,status:'pendiente',selections:['Primera selección','Segunda selección'],notes:''};
assert.equal((await worker.fetch(request(null),env)).status,401);
assert.equal((await worker.fetch(request('alice','POST',pick),env)).status,200);
assert.equal((await worker.fetch(request('alice','POST',pick),env)).status,200);
assert.equal((await(await worker.fetch(request('alice'),env)).json()).items.length,1);
assert.equal((await(await worker.fetch(request('bob'),env)).json()).items.length,0);
assert.equal((await worker.fetch(request('bob','PUT',{...pick,revision:1,status:'acertado'}),env)).status,409);
assert.equal((await worker.fetch(request('alice','PUT',{...pick,revision:1,status:'acertado'}),env)).status,200);
assert.equal((await worker.fetch(request('alice','PUT',{...pick,revision:1,status:'errado'}),env)).status,409);
assert.equal((await worker.fetch(request('alice','POST',{...pick,id:crypto.randomUUID(),stakeCents:-1}),env)).status,400);
const html=await(await worker.fetch(new Request(origin),env)).text();
for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(script[1]);
console.log('Agenda passed authentication, isolation, retry, concurrency, validation and client syntax checks.');
for(const path of ['/api/news?league=esp.1','/api/match?league=eng.1&id=401879233']){
 const response=await worker.fetch(new Request(origin+path),env);const data=await response.json();assert.equal(response.status,200);
 if(data.articles)console.log('Spanish news:',data.articles.slice(0,2).map(a=>a.title));
 if(path.startsWith('/api/match'))assert.ok(data.countAnalysis?.length===3);
 if(data.countAnalysis){console.log('Sources:',data.sources);for(const group of data.countAnalysis){assert.equal(group.unavailable,undefined);for(const row of group.rows){assert.ok(row.over>=0&&row.over<=1);assert.ok(row.n>0);assert.ok(row.brier>=0&&row.brier<=1);}console.log(group.title,group.total,group.weights,group.rows[0]);}}
}
