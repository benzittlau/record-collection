import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const folder='../research/capture-intake-2026-10-14/';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=/^[a-f0-9]{64}$/;
const localPath=path=>typeof path==='string'&&!path.startsWith('/')&&!path.split(/[\\/]/).includes('..')&&!/^[a-z]+:/i.test(path);
const url=value=>{try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
const [receipt,artwork,decisions,corrections,catalog,masks,plan]=await Promise.all([
  folder+'reconciliation.json',folder+'artwork-assets.json',folder+'spotify-decisions.json',folder+'mask-corrections.json',
  '../dist/catalog.json','../dist/spine-masks.json','../research/capture-plans/7ac3efbb41aa.json',
].map(read));
const baselineBytes=await readFile(new URL(folder+'baseline-catalog.json',import.meta.url));
const baseline=JSON.parse(baselineBytes);
const baselineHash='0dc5e9ca3f37ff329e97d84b458a48fe8d42b718fc7cc578cd5893cf05ffc1e4';
assert.equal(sha256(baselineBytes),baselineHash,'The pre-capture catalogue must remain immutable');
assert.equal(receipt.baselineSha256,baselineHash);
assert.equal(receipt.version,1);assert.equal(receipt.status,'integrated');assert.equal(receipt.batch,'2026-10-14');
assert.equal(receipt.guideVersion,'7ac3efbb41aa');assert.equal(plan.version,receipt.guideVersion);
assert.equal(receipt.originalFileCount,90);assert.equal(receipt.physicalPairs,45);
assert.equal(receipt.originalFiles.length,receipt.originalFileCount);assert.equal(receipt.pairs.length,receipt.physicalPairs);

function uniqueMap(rows,key,label){
  const map=new Map(rows.map(row=>[row[key],row]));
  assert.equal(map.size,rows.length,`Duplicate ${label}`);return map;
}
const originals=uniqueMap(receipt.originalFiles,'filename','original filename');
const pairs=uniqueMap(receipt.pairs,'id','physical capture binding');
const originalById=uniqueMap(baseline.records,'id','baseline ID');
const current=uniqueMap(catalog.records,'id','catalogue ID');
const selected=uniqueMap(artwork.records,'id','artwork selection');
const spotify=uniqueMap(decisions.records,'id','supplemental Spotify decision');
const inserted=uniqueMap(receipt.insertions,'id','inserted sleeve');
const merged=uniqueMap(receipt.merges,'id','merged edge');
assert.deepEqual([...inserted.keys()].sort(),['lower-middle-04b','right-04b']);
assert.deepEqual([...merged].map(([id,row])=>[id,row.mergedInto]).sort(),[
  ['upper-middle-08','upper-middle-07'],['upper-middle-15','upper-middle-14'],
]);
assert.equal(current.size,originalById.size+inserted.size,'Inserted sleeves must not remove original source IDs');
for(const original of baseline.records){
  const row=current.get(original.id);assert(row,`Lost original ID ${original.id}`);
  assert.equal(row.box,original.box,`Moved source box ${row.id}`);assert.equal(row.position,original.position,`Renumbered source position ${row.id}`);
  if(!pairs.has(row.id)&&!merged.has(row.id)){
    for(const key of ['title','artist','year','kind','confidence','cover','back','spotifyId'])
      assert.deepEqual(row[key],original[key],`Uncaptured ${key} changed ${row.id}`);
  }
}
for(const insertion of receipt.insertions){
  const row=current.get(insertion.id),left=current.get(insertion.afterId),right=current.get(insertion.beforeId);
  assert(row&&!originalById.has(row.id)&&pairs.has(row.id),`Undocumented inserted item ${insertion.id}`);
  assert.equal(row.position,4.5);assert.equal(row.positionLabel,'4b');assert.equal(row.box,insertion.box);
  assert.equal(row.insertAfter,left.id);assert.equal(row.insertBefore,right.id);
  assert(left.box===row.box&&right.box===row.box&&left.position<row.position&&row.position<right.position);
}
for(const row of catalog.records){
  if(!row.mergedInto)continue;
  const decision=merged.get(row.id);assert(decision,`Undocumented folded edge ${row.id}`);
  assert.equal(row.mergedInto,decision.mergedInto);assert(decision.reason&&decision.strength==='high');
  const parent=current.get(row.mergedInto);assert(parent&&!parent.mergedInto&&pairs.has(parent.id));
  assert.deepEqual(decision.photoPair,pairs.get(parent.id).filenames,`Wrong fold evidence ${row.id}`);
  assert.equal(row.cover,parent.cover);assert.equal(row.back,parent.back);
}
for(const held of receipt.heldMerges??[])assert(!current.get(held.id??held.recordId)?.mergedInto,`Unapproved fold merged ${held.id??held.recordId}`);

const cameraNumbers=[...originals.keys()].map(filename=>{
  assert(/^IMG_\d{4}\.HEIC$/.test(filename),`Unexpected original filename ${filename}`);return Number(filename.slice(4,8));
}).sort((a,b)=>a-b);
assert.equal(cameraNumbers[0],3588);assert.equal(cameraNumbers.at(-1),3679);
const missing=Array.from({length:3679-3588+1},(_,i)=>3588+i).filter(number=>!cameraNumbers.includes(number));
assert.deepEqual(missing,[3626,3627]);assert.deepEqual(receipt.missingCameraNumbers,missing,'Camera gaps must be explicitly documented');
let rawAvailable=true,originalsVerified=0;
try{await access(new URL('../../captures/2026-10-14/',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;rawAvailable=false;}
if(rawAvailable){
  const filenames=(await readdir(new URL('../../captures/2026-10-14/',import.meta.url))).filter(name=>/\.HEIC$/i.test(name));
  assert.deepEqual(filenames.sort(),[...originals.keys()].sort(),'A batch original is missing from the receipt or local archive');
}
for(const original of originals.values()){
  assert(digest.test(original.sha256)&&Number.isInteger(original.bytes)&&original.bytes>0,`Incomplete original receipt ${original.filename}`);
  assert(original.originalWidth>0&&original.originalHeight>0&&original.originalOrientation>=1&&original.originalOrientation<=8);
  if(rawAvailable){
    const bytes=await readFile(new URL(`../../captures/2026-10-14/${original.filename}`,import.meta.url));
    assert.equal(bytes.length,original.bytes,`Original size changed ${original.filename}`);
    assert.equal(sha256(bytes),original.sha256,`Original bytes changed ${original.filename}`);originalsVerified++;
  }
}
const used=new Set(),changedIdentities=[];
const titleKey=value=>String(value??'').normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase();
for(const pair of receipt.pairs){
  const row=current.get(pair.id);assert(row&&!row.mergedInto&&row.box===pair.box,`Invalid physical binding ${pair.id}`);
  assert(pair.identity.title&&pair.identity.artist&&pair.bindingConfidence&&pair.evidence&&pair.proposal,`Incomplete identification ${pair.id}`);
  assert.equal(row.confidence,'confirmed');assert(row.cover&&row.back,`Photographed item lacks a usable pair ${row.id}`);
  assert.deepEqual(pair.previous??null,originalById.get(pair.id)??null,`Changed pre-capture evidence ${pair.id}`);
  assert.deepEqual(pair.faces.map(face=>face.face),['front','back'],`Face order ${pair.id}`);
  assert.deepEqual(pair.filenames,pair.faces.map(face=>face.filename),`Face filenames disagree ${pair.id}`);
  for(const face of pair.faces){
    assert(!used.has(face.filename)&&originals.has(face.filename),`Duplicate or unknown original ${face.filename}`);used.add(face.filename);
    assert([0,90,180,270].includes(face.rotation),`Unspecified orientation ${face.filename}`);
    assert.equal(face.originalSha256,originals.get(face.filename).sha256,`Face bound to wrong original ${face.filename}`);
  }
  const capture=row.familyCapture;
  assert(capture&&capture.batch===receipt.batch&&capture.guideVersion===receipt.guideVersion,`Missing family capture provenance ${row.id}`);
  assert.equal(capture.auditFile,'research/capture-intake-2026-10-14/reconciliation.json');
  assert.equal(capture.printedTitle,pair.identity.title);assert.equal(capture.printedArtist,pair.identity.artist);
  assert.deepEqual(capture.faces,pair.faces.map(face=>({face:face.face,filename:face.filename,sha256:face.originalSha256})));
  if(!pair.previous||pair.previous.confidence!=='confirmed'){
    assert.equal(row.title,pair.identity.title);assert.equal(row.artist,pair.identity.artist);
    const identityChanged=!pair.previous||titleKey(pair.previous.title)!==titleKey(row.title)||titleKey(pair.previous.artist)!==titleKey(row.artist);
    if(identityChanged){
      if(pair.previous)changedIdentities.push(row.id);
      assert(selected.get(row.id)?.front&&selected.get(row.id)?.back,`Old artwork retained after an identity change ${row.id}`);
      assert(!row.label&&!row.labelUrl&&!row.musicbrainzGroup,`Old recording evidence retained after an identity change ${row.id}`);
      assert(spotify.has(row.id),`New identity lacks a listening decision ${row.id}`);
    }
  }else{
    assert.equal(row.title,pair.previous.title,`Confirmed display identity changed ${row.id}`);
    assert.equal(row.artist,pair.previous.artist,`Confirmed performance changed ${row.id}`);
  }
  for(const face of ['front','back']){
    const key=face==='front'?'cover':'back';
    if(!selected.get(row.id)?.[face])assert.equal(row[key],pair.previous?.[key],`Unattributed replacement ${row.id} ${face}`);
  }
}
assert.equal(used.size,originals.size,'Every original must belong to exactly one front/back pair');
assert.deepEqual(receipt.changedIdentities,changedIdentities,'Identity corrections must be recorded explicitly');

let reviewedFaces=0,familyFaces=0;
for(const selection of artwork.records){
  const pair=pairs.get(selection.id),row=current.get(selection.id);assert(pair&&row,`Artwork outside the capture intake ${selection.id}`);
  const proposals=selection.proposalFiles??[selection.proposalFile].filter(Boolean);
  assert(proposals.length,`Missing artwork proposal ${row.id}`);
  for(const proposal of proposals){assert(localPath(proposal));await access(new URL('../'+proposal,import.meta.url));}
  for(const face of ['front','back']){
    const chosen=selection[face];if(!chosen)continue;
    reviewedFaces++;
    const family=chosen.source==='Family photograph',key=face==='front'?'cover':'back';
    assert(chosen.editionNote&&chosen.visualReview&&chosen.processing,`Missing artwork review ${row.id} ${face}`);
    assert(localPath(chosen.path)&&chosen.path.startsWith('assets/covers/'),`Invalid artwork path ${row.id} ${face}`);
    assert(digest.test(chosen.sha256)&&digest.test(chosen.sourceSha256),`Missing artwork hashes ${row.id} ${face}`);
    const bytes=await readFile(new URL('../dist/'+chosen.path,import.meta.url));
    assert.equal(sha256(bytes),chosen.sha256,`Selected artwork bytes changed ${row.id} ${face}`);
    assert(![...originals.values()].some(original=>original.sha256===chosen.sha256),'Raw family originals must not be published');
    assert(chosen.dimensions?.length===2&&chosen.dimensions.every(value=>Number.isInteger(value)&&value>=250&&value<=2200),`Unusable artwork dimensions ${row.id} ${face}`);
    assert(localPath(chosen.localPath)&&chosen.localPath.startsWith('site/'),`Missing source image ${row.id} ${face}`);
    const sourceBytes=await readFile(new URL('../../'+chosen.localPath,import.meta.url));
    assert.equal(sha256(sourceBytes),chosen.sourceSha256,`Artwork source bytes changed ${row.id} ${face}`);
    const provenance=row.artworkProvenance?.[face];assert(provenance,`Missing canonical artwork provenance ${row.id} ${face}`);
    assert.equal(row[key],chosen.path);assert.equal(row[key+'Path'],chosen.path);
    assert.equal(provenance.path,chosen.path);assert.equal(provenance.localPath,chosen.path);
    assert.equal(provenance.sha256,chosen.sha256);assert.equal(provenance.sourceSha256,chosen.sourceSha256);
    assert.deepEqual(provenance.dimensions,chosen.dimensions);assert.equal(provenance.editionNote,chosen.editionNote);
    assert.equal(provenance.face,`outer ${row.kind==='book'?'book':'LP'} ${face}`);
    assert.equal(provenance.auditFile,'research/capture-intake-2026-10-14/artwork-assets.json');
    if(family){
      familyFaces++;
      assert(face==='back'&&['lower-middle-35','lower-middle-43'].includes(row.id),`Undocumented family fallback ${row.id} ${face}`);
      const captureFace=pair.faces.find(item=>item.face===face);
      assert.equal(chosen.captureFilename,captureFace.filename);assert.equal(chosen.captureOriginalSha256,captureFace.originalSha256);
      assert.equal(chosen.sourceUrl,null);assert.equal(chosen.releaseUrl,null);assert.equal(row[key+'Url'],null);
      assert.equal(row.backSourceUrl,null,'A family fallback must not retain an unrelated remote back');
      assert.equal(provenance.imageSourceType,'family-capture');assert.equal(provenance.exactFamilyPressingVerified,true);
      assert.equal(provenance.captureFilename,captureFace.filename);assert.equal(provenance.captureOriginalSha256,captureFace.originalSha256);
    }else{
      assert(url(chosen.sourceUrl)&&url(chosen.releaseUrl),`Unattributed external artwork ${row.id} ${face}`);
      assert.equal(row[key+'Url'],chosen.sourceUrl);assert.equal(provenance.sourceUrl,chosen.sourceUrl);assert.equal(provenance.releaseUrl,chosen.releaseUrl);
      assert.equal(provenance.exactFamilyPressingVerified,false,`Representative scan must not claim the family pressing ${row.id}`);
    }
    if(chosen.thumbnail){
      assert(face==='front'&&localPath(chosen.thumbnail)&&digest.test(chosen.thumbnailSha256));
      assert.equal(row.coverThumbnail,chosen.thumbnail);
      assert.equal(sha256(await readFile(new URL('../dist/'+chosen.thumbnail,import.meta.url))),chosen.thumbnailSha256);
    }
  }
}
assert.equal(familyFaces,2,'Only the two documented missing outer backs use family fallbacks');

const corrected=uniqueMap(corrections.records,'id','mask correction');
assert.equal(corrections.version,1);assert.equal(corrections.guideVersion,receipt.guideVersion);
const geometry=entry=>({outline:entry.polygon,anchor:entry.anchor});
for(const change of corrections.records){
  const row=current.get(change.id),mask=masks.boxes[change.box]?.records.find(entry=>entry.id===change.id);
  assert(row&&mask&&row.box===change.box&&change.reason,`Invalid mask correction ${change.id}`);
  assert.deepEqual(change.after,geometry(mask),`Current geometry disagrees with reviewed correction ${change.id}`);
  assert.equal(mask.captureReview,'research/capture-intake-2026-10-14/mask-corrections.json');
  if(inserted.has(change.id))assert.equal(change.before,null,`Inserted mask incorrectly claims an original source ID ${change.id}`);
  else{
    assert(originalById.has(change.id)&&change.before?.outline?.length>=4,`Missing historical outline ${change.id}`);
    const historical=plan.pairs.flatMap(pair=>pair.outlines).find(entry=>entry.id===change.id);
    if(historical)assert.deepEqual(change.before,geometry(historical),`Frozen outline changed ${change.id}`);
  }
}
for(const id of inserted.keys())assert(corrected.has(id),`Inserted item lacks a reviewed mask ${id}`);
// These newly separated sleeves must not compete for a pointer hit at a seam.
const interval=(polygon,y)=>{
  const xs=polygon.flatMap((point,i)=>{const next=polygon[(i+1)%polygon.length];
    return (point[1]<=y&&next[1]>y)||(next[1]<=y&&point[1]>y)?[point[0]+(y-point[1])/(next[1]-point[1])*(next[0]-point[0])]:[];});
  return xs.length>=2?[Math.min(...xs),Math.max(...xs)]:null;
};
for(const ids of [['lower-middle-03','lower-middle-04','lower-middle-04b','lower-middle-05','lower-middle-06','lower-middle-07'],['right-03','right-04','right-04b','right-05']]){
  for(let index=1;index<ids.length;index++){
    const left=current.get(ids[index-1]),right=current.get(ids[index]);
    const a=masks.boxes[left.box].records.find(row=>row.id===left.id).polygon,b=masks.boxes[right.box].records.find(row=>row.id===right.id).polygon;
    const first=Math.ceil(Math.max(Math.min(...a.map(point=>point[1])),Math.min(...b.map(point=>point[1])))*2)/2;
    const last=Math.min(Math.max(...a.map(point=>point[1])),Math.max(...b.map(point=>point[1])));
    for(let y=first;y<last;y+=0.5){const one=interval(a,y),two=interval(b,y);if(one&&two)assert(one[1]<=two[0]+1e-6,`Overlapping inserted sleeve seam ${left.id}/${right.id} at y=${y}`);}
  }
}
async function checkPublicDirectory(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    assert(!/\.hei[cf]$/i.test(entry.name),`Raw family photo published: ${path.pathname}`);
    if(entry.isDirectory())await checkPublicDirectory(path);
  }
}
await checkPublicDirectory(new URL('../dist/',import.meta.url));
const physical=catalog.records.filter(row=>!row.mergedInto);
assert.deepEqual(receipt.result,{sourcePositions:catalog.records.length,physicalItems:physical.length,
  confirmed:physical.filter(row=>row.confidence==='confirmed').length,probable:physical.filter(row=>row.confidence==='probable').length,
  unknown:physical.filter(row=>row.confidence==='unknown').length,spotify:physical.filter(row=>row.spotifyId).length,photographedPhysicalItems:pairs.size});
console.log(`Validated ${originals.size} originals mapped to ${pairs.size} physical pairs, ${inserted.size} inserts, ${merged.size} fold aliases, ${reviewedFaces} reviewed artwork faces, and documented mask seams (${originalsVerified} local originals rehashed${rawAvailable?'':'; private originals absent'}).`);
