import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const audits=[];
for(const name of ['left','middle','right']){
  const data=JSON.parse(await readFile(new URL(`../research/deep-${name}-audit.json`,import.meta.url),'utf8'));
  const rows=Array.isArray(data)?data:data.records;
  assert.equal(rows.length,{left:126,middle:138,right:54}[name],`Incomplete ${name} audit`);
  for(const row of rows){assert(row.id&&row.status,`Missing audit outcome in ${name}`);assert(!/pending|staged|proposed/i.test(row.status),`Unfinished research ${row.id}`);assert(Array.isArray(row.neededFaces),`Missing capture decision ${row.id}`);assert(row.neededFaces.every(face=>['front','back'].includes(face)),`Unexpected capture face ${row.id}`);audits.push(row);}
}
assert.equal(new Set(audits.map(r=>r.id)).size,catalog.records.length,'Duplicate or missing audit IDs');
for(const r of catalog.records){
  const audit=audits.find(a=>a.id===r.id);assert(audit,`No audit ${r.id}`);assert.equal(audit.position,r.position,`Stale physical order ${r.id}`);
  assert.equal(audit.title,r.title,`Stale researched title ${r.id}`);assert.equal(audit.confidence,r.confidence,`Stale confidence ${r.id}`);
  if(r.confidence!=='confirmed'||!r.cover||!r.back)assert(audit.neededFaces.length,`Capture gap omitted ${r.id}`);
}
console.log(`Validated ${audits.length} final research outcomes, physical order, identities and remaining capture needs.`);
