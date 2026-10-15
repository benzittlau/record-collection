import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const plan=await read('../dist/capture-manifest.json');
const catalog=await read('../dist/catalog.json');
const masks=await read('../dist/spine-masks.json');
const ledger=await read('../research/capture-sequence.json');
const frozenBytes=await readFile(new URL('../research/capture-plans/7ac3efbb41aa.json',import.meta.url));
assert.equal(createHash('sha256').update(frozenBytes).digest('hex'),'e7977234e258b3742fecb8d0bc20997c351edeb7ce79e8d3359f22543cf39b45','The guide used for the family capture must remain byte-identical');
assert.deepEqual(plan,JSON.parse(frozenBytes),'The published guide must retain the frozen capture sequence');
let corrections=[];
try{corrections=(await read('../research/capture-intake-2026-10-14/mask-corrections.json')).records;}
catch(error){if(error.code!=='ENOENT')throw error;}
const corrected=new Map(corrections.map(row=>[row.id,row]));
assert.equal(corrected.size,corrections.length,'Duplicate historical mask correction');
const geometry=outline=>({outline:outline.polygon,anchor:outline.anchor});
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
  for(const id of pair.recordIds){
    assert(!seen.has(id),`Duplicate capture ID ${id}`);seen.add(id);assert(map.get(id)?.box===pair.box);
    const current=masks.boxes[pair.box].records.find(x=>x.id===id),historical=pair.outlines.find(x=>x.id===id);
    assert(current&&historical,`Missing source outline ${id}`);
    if(corrected.has(id)){
      const change=corrected.get(id);
      assert.equal(change.box,pair.box,`Wrong correction box ${id}`);
      assert.deepEqual(change.before,geometry(historical),`Correction must identify the frozen outline ${id}`);
      assert.deepEqual(change.after,geometry(current),`Correction must identify the current outline ${id}`);
      assert(change.reason,`Undocumented historical mask correction ${id}`);
    }else assert.deepEqual(geometry(historical),geometry(current),`Undocumented mask change ${id}`);
  }
  assert.equal(plan.shots[i*2].face,'front');assert.equal(plan.shots[i*2+1].face,'back');assert.equal(plan.shots[i*2].recordId,pair.recordId);assert.equal(plan.shots[i*2+1].recordId,pair.recordId);
}
for(const box of plan.boxes){await access(new URL(`../dist/${box.photo}`,import.meta.url));const pairs=plan.pairs.filter(p=>p.box===box.id);assert.equal(box.pairCount,pairs.length);for(let i=1;i<pairs.length;i++)assert(pairs[i].position>pairs[i-1].position,`Capture order ${box.id}`);}
console.log(`Validated capture sequence ${plan.version}, paired faces, stable IDs, source masks, and original box order.`);
