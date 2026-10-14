import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [photos,catalog,...sources]=await Promise.all([
  '../dist/box-photos.json','../dist/catalog.json',
  '../research/spine-masks-left.json','../research/spine-masks-middle.json','../research/spine-masks-right.json'
].map(read));
const result={version:1,coordinateSpace:'source-photo',boxes:{}};
for(const source of sources){
  assert.equal(source.coordinateSpace,'source-photo');
  for(const [id,box] of Object.entries(source.boxes)){
    assert(!result.boxes[id],`Duplicate box: ${id}`);
    const calibration=photos.boxes[id];assert(calibration,`Unknown box: ${id}`);
    const byId=new Map(box.records.map(record=>[record.id,record]));
    assert.equal(byId.size,box.records.length,`Duplicate spine IDs in ${id}`);
    const ordered=catalog.records.filter(record=>record.box===id).map(record=>{const outline=byId.get(record.id);assert(outline,`Missing outline: ${record.id}`);return outline;});
    assert.equal(ordered.length,byId.size,`Unexpected outline in ${id}`);
    const bytes=await readFile(new URL(`../dist/${calibration.path}`,import.meta.url));
    result.boxes[id]={...box,photo:{path:calibration.path,width:calibration.width,height:calibration.height,sha256:createHash('sha256').update(bytes).digest('hex')},records:ordered};
  }
}
assert.equal(Object.keys(result.boxes).length,5);
const maskSource=JSON.stringify(result,null,2)+'\n';
await writeFile(new URL('../dist/spine-masks.json',import.meta.url),maskSource);
// Each trace revision must get fresh resource URLs, including in preview
// browsers that retain an earlier response despite fetch's no-store option.
const fingerprint=source=>createHash('sha256').update(source).digest('hex').slice(0,12);
const appUrl=new URL('../dist/app.js',import.meta.url),indexUrl=new URL('../dist/index.html',import.meta.url);
const appSource=await readFile(appUrl,'utf8');
assert(/spine-masks\.json\?v=[^'"]+/.test(appSource),'Missing versioned mask request');
const playerSource=await readFile(new URL('../dist/turntable.js',import.meta.url),'utf8');
assert(/turntable\.js\?v=[^'"]+/.test(appSource),'Missing versioned player module');
const nextApp=appSource.replace(/spine-masks\.json\?v=[^'"]+/,`spine-masks.json?v=${fingerprint(maskSource)}`)
  .replace(/turntable\.js\?v=[^'"]+/,`turntable.js?v=${fingerprint(playerSource)}`);
if(nextApp!==appSource)await writeFile(appUrl,nextApp);
const indexSource=await readFile(indexUrl,'utf8');
assert(/src="app\.js\?v=[^"]+"/.test(indexSource),'Missing versioned application script');
const nextIndex=indexSource.replace(/src="app\.js\?v=[^"]+"/,`src="app.js?v=${fingerprint(nextApp)}"`);
if(nextIndex!==indexSource)await writeFile(indexUrl,nextIndex);
console.log('Merged the five photographic spine maps and refreshed their content-based cache keys.');
