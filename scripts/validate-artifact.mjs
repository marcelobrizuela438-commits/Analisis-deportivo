import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {distribution,analyze} from '../worker/model.js';
for(const [x,y,r] of [[1.5,1.2,-.1],[.1,4,.1],[2,2,0]]){const d=distribution(x,y,r);assert.ok(d.every(v=>v.p>=0&&v.p<=1));assert.ok(Math.abs(d.reduce((s,v)=>s+v.p,0)-1)<1e-9);}
assert.equal(analyze([],{date:'2026-01-01',teams:[{id:'a'},{id:'b'}]}).unavailable,true);
const r=await worker.fetch(new Request('https://local/'),{});assert.equal(r.status,200);const text=await r.text();assert.ok(text.includes('Jubilacion'));assert.ok(text.includes('prefers-reduced-motion'));new Function(text.match(/<script>([\s\S]*?)<\/script>/)[1]);
assert.equal((await worker.fetch(new Request('https://local/api/match?id=oops&league=eng.1'),{})).status,400);
console.log('Worker, client syntax, probability normalization and invalid-input checks passed');
