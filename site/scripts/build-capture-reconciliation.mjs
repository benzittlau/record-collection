import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const directory=new URL('../research/capture-intake-2026-10-14/',import.meta.url);
await mkdir(directory,{recursive:true});
const baselineURL=new URL('baseline-catalog.json',directory);
try{await access(baselineURL);}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(baselineURL,await readFile(new URL('../dist/catalog.json',import.meta.url)));}
const baseline=JSON.parse(await readFile(baselineURL,'utf8'));
const inventory=await read('../../tmp/capture-intake-2026-10-14/inventory.json');
const inventoryByName=new Map(inventory.files.map(row=>[row.filename,row]));
const current=new Map(baseline.records.map(row=>[row.id,row]));
const [left,middle,right]=await Promise.all(['left','middle','right'].map(shard=>read(`../research/capture-intake-${shard}-2026-10-14.json`)));
const pairs=[];
for(const pair of left.pairs){
  assert.equal(pair.proposedRecordIds.length,1);
  pairs.push({id:pair.proposedRecordIds[0],box:pair.box,identity:pair.identity,
    bindingConfidence:pair.slotBindingConfidence,evidence:pair.bindingAndCorrections,
    filenames:pair.filenames,faces:pair.faces.map(face=>({face:face.face,filename:face.filename,rotation:face.clockwiseRotationAfterExif})),
    proposal:'capture-intake-left-2026-10-14.json'});
}
for(const pair of middle.pairs){
  pairs.push({id:pair.proposedRecordId,box:pair.box,identity:pair.identity,
    bindingConfidence:pair.slotBindingConfidence,evidence:pair.visibleEvidence,
    filenames:[pair.frontFilename,pair.backFilename],
    faces:Object.entries(pair.faces).map(([face,source])=>({face,filename:source.filename,rotation:source.clockwiseRotationDegrees})),
    proposal:'capture-intake-middle-2026-10-14.json'});
}
for(const pair of right.pairs){
  pairs.push({id:pair.proposedId,box:'right',identity:{title:pair.title,artist:pair.artist,year:pair.year,kind:pair.kind,catalogue:pair.physicalCatalogueNumbers},
    bindingConfidence:pair.physicalMatch.confidence,evidence:pair.physicalMatch.evidence.join(' '),
    filenames:pair.faces.map(face=>face.filename),
    faces:pair.faces.map(face=>({face:face.face,filename:face.filename,rotation:face.clockwiseRotationAfterExifNormalization})),
    proposal:'capture-intake-right-2026-10-14.json'});
}
pairs.sort((a,b)=>inventoryByName.get(a.filenames[0]).sequence-inventoryByName.get(b.filenames[0]).sequence);
const consumed=new Set();
for(const pair of pairs){
  assert.equal(pair.filenames.length,2);
  assert.deepEqual(pair.faces.map(face=>face.face),['front','back']);
  for(const face of pair.faces){
    assert(inventoryByName.has(face.filename)&&!consumed.has(face.filename),`Missing or multiply used ${face.filename}`);
    assert([0,90,180,270].includes(face.rotation));
    consumed.add(face.filename);
    face.originalSha256=inventoryByName.get(face.filename).sha256;
  }
  pair.previous=current.get(pair.id)?structuredClone(current.get(pair.id)):null;
}
assert.equal(consumed.size,inventory.files.length,'Every original must have exactly one reconciliation decision');
assert.equal(new Set(pairs.map(pair=>pair.id)).size,pairs.length,'A physical item must not be created twice from neighbor captures');
const merges=middle.merges.filter(merge=>merge.strength==='high');
const heldMerges=middle.merges.filter(merge=>merge.strength!=='high');
const insertions=[...middle.insertions.map(row=>({id:row.id,box:'lower-middle',afterId:row.afterId,beforeId:row.beforeId,position:row.sourcePosition,positionLabel:'4b'})),
  {id:'right-04b',box:'right',afterId:'right-04',beforeId:'right-05',position:4.5,positionLabel:'4b'}];
const originalFiles=inventory.files.map(({filename,sha256,bytes,originalWidth,originalHeight,originalOrientation})=>({filename,sha256,bytes,originalWidth,originalHeight,originalOrientation}));
const result={version:1,status:'reviewed-identification; artwork-selection-in-progress',batch:'2026-10-14',guideVersion:'7ac3efbb41aa',
  baselineSha256:createHash('sha256').update(await readFile(baselineURL)).digest('hex'),
  originalFileCount:originalFiles.length,physicalPairs:pairs.length,missingCameraNumbers:[3626,3627],
  imagePolicy:'Prefer clean documented scans. Family captures establish identities and editions and provide fallbacks where suitable scans are unavailable. Original files are retained outside the website.',
  originalFiles,pairs,merges,heldMerges,insertions,
  unresolvedSourceEdges:[...left.unphotographedOrUnresolved,{id:'right-30',reason:'Conditional Journey edge was not captured; no separate sleeve established.'}],
  userNotes:await readFile(new URL('../../captures/2026-10-14/INTAKE-NOTES.txt',import.meta.url),'utf8')};
await writeFile(new URL('reconciliation.json',directory),JSON.stringify(result,null,2)+'\n');
console.log(`Reconciled ${originalFiles.length} original files as ${pairs.length} physical pairs, ${insertions.length} inserted sleeves and ${merges.length} supported folded-edge aliases.`);
