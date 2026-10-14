import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const plan=await read('../dist/capture-manifest.json');
const catalog=await read('../dist/catalog.json');
const masks=await read('../dist/spine-masks.json');
const ledger=await read('../research/capture-sequence.json');
const script=await readFile(new URL('../dist/capture.js',import.meta.url),'utf8');
const css=await readFile(new URL('../dist/capture.css',import.meta.url));
const html=await readFile(new URL('../dist/capture.html',import.meta.url),'utf8');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,12);
assert(script.includes(`capture-manifest.json?v=${plan.version}`),'The guide must load the current saved sequence');
assert(html.includes(`capture.js?v=${hash(script)}`),'The guide must request its current script');
assert(html.includes(`capture.css?v=${hash(css)}`),'The guide must request its current styles');
const map=new Map(catalog.records.map(r=>[r.id,r]));
const seen=new Set();
assert.equal(plan.recipe,'front-back');assert.equal(plan.pairCount,plan.pairs.length);assert.equal(plan.shotCount,plan.pairCount*2);assert.equal(plan.shots.length,plan.shotCount);
assert.equal(plan.version,createHash('sha256').update(JSON.stringify({pairs:plan.pairs,shots:plan.shots})).digest('hex').slice(0,12));
assert.equal(ledger.version,plan.version);assert.deepEqual(ledger.shots,plan.shots);
for(const [i,pair] of plan.pairs.entries()){
  const r=map.get(pair.recordId);assert(r,`Unknown capture ID ${pair.recordId}`);assert.equal(pair.pair,i+1);assert.equal(pair.frontShot,i*2+1);assert.equal(pair.backShot,i*2+2);assert.equal(pair.box,r.box);assert.equal(pair.position,r.position);
  for(const id of pair.recordIds){assert(!seen.has(id),`Duplicate capture ID ${id}`);seen.add(id);assert(map.get(id)?.box===pair.box);const outline=masks.boxes[pair.box].records.find(x=>x.id===id);assert.deepEqual(pair.outlines.find(x=>x.id===id),outline,`Stale mask ${id}`);}
  assert.equal(plan.shots[i*2].face,'front');assert.equal(plan.shots[i*2+1].face,'back');assert.equal(plan.shots[i*2].recordId,pair.recordId);assert.equal(plan.shots[i*2+1].recordId,pair.recordId);
}
for(const box of plan.boxes){await access(new URL(`../dist/${box.photo}`,import.meta.url));const pairs=plan.pairs.filter(p=>p.box===box.id);assert.equal(box.pairCount,pairs.length);for(let i=1;i<pairs.length;i++)assert(pairs[i].position>pairs[i-1].position,`Capture order ${box.id}`);}
console.log(`Validated capture sequence ${plan.version}, paired faces, stable IDs, source masks, and original box order.`);
