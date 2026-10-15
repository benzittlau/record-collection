import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const bytes=await readFile(new URL('../dist/catalog.json',import.meta.url));
const data=JSON.parse(bytes);
const byId=new Map();
const boxes=['upper-left','lower-left','upper-middle','lower-middle','right'];
for(const r of data.records){
  assert(!byId.has(r.id),`Duplicate ${r.id}`);byId.set(r.id,r);
  assert(r.title&&r.artist&&boxes.includes(r.box)&&Number.isFinite(r.position)&&r.position>0,`Incomplete ${r.id}`);
  assert(['confirmed','probable','unknown'].includes(r.confidence),`Invalid confidence ${r.id}`);
  if(r.spotifyId){
    assert(/^[a-zA-Z0-9]{22}$/.test(r.spotifyId),`Invalid Spotify ID ${r.id}`);
    assert.equal(r.confidence,'confirmed',`Unconfirmed Spotify ${r.id}`);
    assert(r.sources.some(s=>(typeof s==='string'?s:s.url)?.includes(r.spotifyId)),`Unsourced Spotify ${r.id}`);
  }
  for(const path of [r.cover,r.back,r.label,r.coverThumbnail].filter(Boolean)){
    assert(!path.startsWith('/')&&!path.includes('..'),`Unsafe artwork path ${r.id}`);
    await access(new URL(`../dist/${path}`,import.meta.url));
  }
}
for(const r of data.records){
  if(!r.mergedInto)continue;
  const parent=byId.get(r.mergedInto);
  assert(parent&&!parent.mergedInto&&parent.id!==r.id&&parent.box===r.box,`Invalid sleeve alias ${r.id}`);
  assert.equal(r.kind,'sleeve-edge',`Alias must identify a photographed edge ${r.id}`);
  assert(!r.spotifyId,`Alias must not duplicate a physical Spotify item ${r.id}`);
  assert.equal(r.title,parent.title,`Alias title differs ${r.id}`);
}
for(const box of boxes){
  const list=data.records.filter(r=>r.box===box);
  assert(list.length>0,`Empty box ${box}`);
  assert.deepEqual(list.map(r=>r.position),[...list].sort((a,b)=>a.position-b.position).map(r=>r.position),`Source order ${box}`);
  assert.equal(new Set(list.map(r=>r.position)).size,list.length,`Duplicate source position ${box}`);
  // Inserts live between original numbered positions; they never renumber them.
  list.filter(r=>Number.isInteger(r.position)).forEach((r,i)=>assert.equal(r.position,i+1,`Position gap in ${box}`));
  for(const r of list.filter(r=>!Number.isInteger(r.position))){
    const before=byId.get(r.insertAfter),after=byId.get(r.insertBefore);
    assert(before?.box===box&&after?.box===box&&before.position<r.position&&r.position<after.position,`Unanchored inserted sleeve ${r.id}`);
    assert(r.positionLabel&&r.familyCapture,`Undocumented inserted sleeve ${r.id}`);
  }
}
const physical=data.records.filter(r=>!r.mergedInto);
for(const [key,count] of Object.entries({recordCount:physical.length,sourcePositionCount:data.records.length,mergedAliasCount:data.records.length-physical.length,
  confirmed:physical.filter(r=>r.confidence==='confirmed').length,probable:physical.filter(r=>r.confidence==='probable').length,
  unknown:physical.filter(r=>r.confidence==='unknown').length,artwork:physical.filter(r=>r.cover).length,spotify:physical.filter(r=>r.spotifyId).length})){
  // Pre-intake catalogues did not yet expose the two source-row counters.
  if(['sourcePositionCount','mergedAliasCount'].includes(key)&&data.meta[key]===undefined&&physical.length===data.records.length)continue;
  assert.equal(data.meta[key],count,`Incorrect physical catalogue count: ${key}`);
}
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
assert(app.includes(`catalog.json?v=${createHash('sha256').update(bytes).digest('hex').slice(0,12)}`),'The app must request the current researched catalog');
console.log(`Validated ${physical.length} physical items, ${data.records.length} stable source positions, local artwork, and sourced Spotify IDs.`);
