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
await writeFile(new URL('../dist/spine-masks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log('Merged the five photographic spine maps in their original catalog order.');
