import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fitHomography,projectPoint} from '../dist/photo-projection.js';
import {clipToPhoto,projectSpineMasks} from '../dist/spine-masks.js';

const clipped=clipToPhoto([[-2,-3],[8,-3],[18,24],[-2,24]],16,20);
assert(clipped.length>=4);
assert(clipped.every(([x,y])=>x>=0&&x<=16&&y>=0&&y<=20));
assert(clipped.some(([x])=>x===0)&&clipped.some(([,y])=>y===20));
assert.equal(clipToPhoto([[30,30],[40,30],[40,40]],16,20).length,0);
const tilt=[[20,10],[24,9],[43,95],[35,97]],h=[1.3,.2,14,-.15,1.7,29,.0005,.0008,1];
const transformed=projectSpineMasks(h,{records:[{id:'leaning',polygon:tilt}]},100,100).get('leaning');
assert.deepEqual(transformed.polygon,tilt.map(p=>projectPoint(h,p)));
assert.deepEqual(transformed.anchor,projectPoint(h,[39,96]));
const cropped=projectSpineMasks([1,0,0,0,1,0,0,0,1],{records:[{id:'cropped',polygon:[[2,2],[8,2],[8,24],[2,24]],anchor:[5,24]}]},10,20).get('cropped');
assert.deepEqual(cropped.anchor,[5,20]);
assert.throws(()=>projectSpineMasks(h,{records:[{id:'bad',polygon:[[0,0],[NaN,1],[2,2]]}]},100,100));

const load=async name=>JSON.parse(await readFile(new URL(`../dist/${name}`,import.meta.url),'utf8'));
const [masks,photos,catalog]=await Promise.all(['spine-masks.json','box-photos.json','catalog.json'].map(load));
assert.equal(masks.coordinateSpace,'source-photo');
const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hasCrossedEdges(points){
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    if(j===i+1||(i===0&&j===points.length-1))continue;
    const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
    if(turn(a,b,c)*turn(a,b,d)<-1e-8&&turn(c,d,a)*turn(c,d,b)<-1e-8)return true;
  }
  return false;
}
assert(hasCrossedEdges([[0,0],[10,10],[0,10],[10,0]]));
let total=0;
for(const [box,photo] of Object.entries(photos.boxes)){
  const entries=masks.boxes[box]?.records;assert(entries,`Missing ${box} outlines`);
  const signature=masks.boxes[box].photo;
  const bytes=await readFile(new URL(`../dist/${photo.path}`,import.meta.url));
  assert.equal(signature.sha256,createHash('sha256').update(bytes).digest('hex'),`Spine traces need recalibration after replacing the ${box} photo`);
  assert.equal(signature.width,photo.width);assert.equal(signature.height,photo.height);
  const expected=catalog.records.filter(r=>r.box===box).map(r=>r.id);
  assert.deepEqual(entries.map(r=>r.id),expected,`Outlines must retain the catalog order in ${box}`);
  const projected=projectSpineMasks(fitHomography(photo.sourceQuad,photo.targetQuad),masks.boxes[box],photo.width,photo.height);
  assert.equal(projected.size,expected.length,`Every sleeve must remain visible in ${box}`);
  for(const entry of entries){
    const points=clipToPhoto(entry.polygon,photo.width,photo.height);
    const area=Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
    assert(area>4,`Degenerate outline: ${entry.id}`);
    assert(!hasCrossedEdges(points),`Crossed spine edges: ${entry.id}`);
    assert(projected.get(entry.id).polygon.every(p=>p.every(Number.isFinite)));
  }
  total+=entries.length;
}
// Regression: sleeve 67 is the cream Rampal/Laskine spine, not the empty
// right frame. These bounds were checked on the original 4032px photograph.
const japanese=masks.boxes['lower-middle'].records.find(r=>r.id==='lower-middle-67');
const crossings=japanese.polygon.flatMap((p,i)=>{
  const q=japanese.polygon[(i+1)%japanese.polygon.length],y=700;
  if((p[1]<=y&&q[1]>y)||(q[1]<=y&&p[1]>y))return [p[0]+(y-p[1])/(q[1]-p[1])*(q[0]-p[0])];
  return [];
});
assert(crossings.length===2&&Math.min(...crossings)>3100&&Math.max(...crossings)<3250,'Japanese Melodies must follow the photographed cream spine, away from the right frame');
for(const [id,position] of [['lower-middle-19',18],['lower-middle-20',19],['lower-middle-18',20]])assert.equal(catalog.records.find(r=>r.id===id).position,position,'The carousel must retain the photographed Bowie/Beatles order');
const chance=masks.boxes['upper-middle'].records.find(r=>r.id==='upper-middle-14');
const chanceYs=chance.polygon.map(p=>p[1]);
assert(Math.min(...chanceYs)<550&&Math.max(...chanceYs)>2680,'Box 3 Chance outline must reach the photographed sleeve cap and foot');
const prisoner=masks.boxes['upper-left'].records.find(r=>r.id==='upper-left-33');
const prisonerYs=prisoner.polygon.map(p=>p[1]);
assert(Math.min(...prisonerYs)<420&&Math.max(...prisonerYs)>2675,'Box 1 Prisoner in Disguise outline must reach the photographed sleeve cap and foot');
console.log(`Validated ${total} photograph-derived spine outlines, tilted-edge projection, and cropped-photo clipping.`);
