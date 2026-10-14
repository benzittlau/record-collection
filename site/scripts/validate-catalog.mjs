import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const data=JSON.parse(await readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));const seen=new Set();
for(const r of data.records){assert(!seen.has(r.id),`Duplicate ${r.id}`);seen.add(r.id);assert(r.title&&r.artist&&r.box&&r.position,`Incomplete ${r.id}`);assert(['confirmed','probable','unknown'].includes(r.confidence));if(r.spotifyId){assert(/^[a-zA-Z0-9]{22}$/.test(r.spotifyId));assert.equal(r.confidence,'confirmed',`Unconfirmed Spotify ${r.id}`);assert(r.sources.some(s=>(typeof s==='string'?s:s.url)?.includes(r.spotifyId)),`Unsourced Spotify ${r.id}`);}for(const path of [r.cover,r.back,r.label].filter(Boolean)){assert(!path.startsWith('/')&&!path.includes('..'));await access(new URL(`../dist/${path}`,import.meta.url));}}
for(const box of ['upper-left','lower-left','upper-middle','lower-middle','right']){const list=data.records.filter(r=>r.box===box);assert(list.length>0);list.forEach((r,i)=>assert.equal(r.position,i+1,`Position gap in ${box}`));}
const bytes=await readFile(new URL('../dist/catalog.json',import.meta.url));
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
assert(app.includes(`catalog.json?v=${createHash('sha256').update(bytes).digest('hex').slice(0,12)}`),'The app must request the current researched catalog');
console.log(`Validated ${data.records.length} ordered items, local artwork files, and sourced Spotify IDs.`);
