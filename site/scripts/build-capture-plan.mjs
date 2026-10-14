import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const catalog=await read('../dist/catalog.json');
const masks=await read('../dist/spine-masks.json');
const photos=await read('../dist/box-photos.json');
const order=['upper-left','lower-left','upper-middle','lower-middle','right'];
const names=['Upper left','Lower left','Upper middle','Lower middle','Right-hand box'];
const auditRows=[];
for(const shard of ['left','middle','right']){
  try{const audit=await read(`../research/deep-${shard}-audit.json`);auditRows.push(...(Array.isArray(audit)?audit:audit.records));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const audits=new Map(auditRows.map(r=>[r.id,r]));
let decisions={};
try{decisions=await read('../research/capture-decisions.json');}catch(error){if(error.code!=='ENOENT')throw error;}
const pairs=[];
const boxes=order.map((id,i)=>({id,number:i+1,name:names[i],photo:photos.boxes[id].path,photoSha256:masks.boxes[id].photo.sha256,width:photos.boxes[id].width,height:photos.boxes[id].height,compartments:photos.boxes[id].compartmentCount}));
for(const r of catalog.records){
  const decision=decisions[r.id]??{};
  const audit=audits.get(r.id)??{};
  if(decision.exclude)continue;
  const needs=[];
  if(r.confidence!=='confirmed')needs.push(r.confidence==='unknown'?'Identify this sleeve':'Confirm the identification');
  if(!r.cover)needs.push('Front artwork missing');
  if(!r.back)needs.push(r.kind==='book'?'Book back artwork missing':'Vinyl back artwork missing');
  if(audit.neededFaces?.length)needs.push('Confirm the physical jacket and its place in the box');
  if(decision.reason)needs.push(decision.reason);
  if(!needs.length&&!decision.include)continue;
  const researchReason=audit.reason??(Array.isArray(audit.reasons)?audit.reasons.join(' '):null);
  if(researchReason)needs.push(researchReason);
  const list=catalog.records.filter(x=>x.box===r.box);
  const index=list.findIndex(x=>x.id===r.id);
  const ids=decision.recordIds??[r.id];
  const outlines=masks.boxes[r.box].records.filter(x=>ids.includes(x.id));
  if(outlines.length!==ids.length)throw Error(`Missing capture outline for ${r.id}`);
  const pair=pairs.length+1;
  const neighbor=x=>x?{id:x.id,position:x.position,title:x.title,artist:x.artist,confidence:x.confidence}:null;
  pairs.push({pair,recordId:r.id,recordIds:ids,box:r.box,boxNumber:order.indexOf(r.box)+1,position:r.position,kind:r.kind??'record',compartment:r.compartment??1,compartmentPosition:r.compartmentPosition??r.position,title:r.title,artist:r.artist,confidence:r.confidence,spineText:r.spineText??'',cover:r.cover??null,reasons:[...new Set(needs)],researchStatus:audit.status??null,instruction:decision.instruction??audit.captureInstruction??null,optional:!!(decision.optional??audit.optional),allowDuplicateSkip:!!decision.allowDuplicateSkip,previous:neighbor(list[index-1]),next:neighbor(list[index+1]),outlines,frontShot:pair*2-1,backShot:pair*2});
}
const shots=pairs.flatMap(p=>['front','back'].map((face,i)=>({sequence:p.frontShot+i,pair:p.pair,recordId:p.recordId,recordIds:p.recordIds,box:p.box,position:p.position,face})));
const version=createHash('sha256').update(JSON.stringify({pairs,shots})).digest('hex').slice(0,12);
for(const box of boxes){const items=pairs.filter(p=>p.box===box.id);box.pairCount=items.length;box.firstShot=items[0]?.frontShot??null;box.lastShot=items.at(-1)?.backShot??null;}
const created=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Edmonton'}).format(new Date());
const manifest={version,created,recipe:'front-back',pairCount:pairs.length,optionalPairCount:pairs.filter(p=>p.optional).length,shotCount:shots.length,boxes,summary:{records:catalog.records.length,confirmed:catalog.meta.confirmed,probable:catalog.meta.probable,unknown:catalog.meta.unknown,fronts:catalog.records.filter(r=>r.cover).length,backs:catalog.records.filter(r=>r.back).length},instructions:['Work through boxes 1 to 5, left to right within each section.','Take the front, then the back of each requested sleeve. Keep all four corners and small catalogue text in focus.','Put each sleeve back in its original place before moving on.','Some thin edges may be folded parts of neighboring sleeves. Skip them if they are not physically separate jackets; never photograph the same jacket twice.','Send the original camera files together, in batches if needed. Keep their original names; no renaming, captions or folders are required.','Retakes and skipped folds are fine. Photo order and cover contents will help match them; guide numbers need not match camera filenames.'],pairs,shots};
await writeFile(new URL('../dist/capture-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('../research/capture-sequence.json',import.meta.url),JSON.stringify({version,recipe:manifest.recipe,shots},null,2)+'\n');
const scriptUrl=new URL('../dist/capture.js',import.meta.url);
let script=await readFile(scriptUrl,'utf8');
script=script.replace(/capture-manifest\.json(?:\?v=[a-f0-9]+)?/g,`capture-manifest.json?v=${version}`);
await writeFile(scriptUrl,script);
const htmlUrl=new URL('../dist/capture.html',import.meta.url);
let html=await readFile(htmlUrl,'utf8');
html=html.replace(/capture-map\.pdf(?:\?v=[a-f0-9]+)?/g,`capture-map.pdf?v=${version}`);
for(const name of ['capture.js','capture.css']){
  const content=await readFile(new URL(`../dist/${name}`,import.meta.url));
  const hash=createHash('sha256').update(content).digest('hex').slice(0,12);
  html=html.replace(new RegExp(`${name.replace('.','\\.')}(?:\\?v=[a-f0-9]+)?`,'g'),`${name}?v=${hash}`);
}
await writeFile(htmlUrl,html);
if(process.argv.includes('--freeze')){
  const archive=new URL('../research/capture-plans/',import.meta.url);
  await mkdir(archive,{recursive:true});
  await writeFile(new URL(`${version}.json`,archive),JSON.stringify(manifest,null,2)+'\n');
}
console.log(`Capture plan ${version}: ${pairs.length} sleeves, ${shots.length} photos.`);
