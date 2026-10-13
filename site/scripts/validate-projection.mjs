import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fitHomography,projectPoint,cssProjection} from '../dist/photo-projection.js';
const rectangle=[[0,0],[300,0],[300,200],[0,200]];
const known=[1.3,.2,14,-.15,1.7,29,.0005,.0008,1];
const target=rectangle.map(p=>projectPoint(known,p));
const fitted=fitHomography(rectangle,target);
for(const p of [[0,0],[150,100],[91,147],[300,200]]){const actual=projectPoint(fitted,p),expected=projectPoint(known,p);assert(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-8);}
assert.throws(()=>fitHomography([[0,0],[0,0],[0,0],[0,0]],rectangle));
const config=JSON.parse(await readFile(new URL('../dist/box-photos.json',import.meta.url),'utf8'));
for(const [id,photo] of Object.entries(config.boxes)){
  await access(new URL(`../dist/${photo.path}`,import.meta.url));
  const h=fitHomography(photo.sourceQuad,photo.targetQuad);
  for(let i=0;i<4;i++){const p=projectPoint(h,photo.sourceQuad[i]),q=photo.targetQuad[i];assert(Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6,`Corner error for ${id}`);}
  const values=cssProjection(h,.7).slice(9,-1).split(',').map(Number);
  assert.equal(values.length,16);assert(values.every(Number.isFinite));
  // Validate the CSS column ordering separately from the homography evaluator.
  for(const p of photo.sourceQuad){const [x,y]=p,w=values[3]*x+values[7]*y+values[15];const actual=[(values[0]*x+values[4]*y+values[12])/w,(values[1]*x+values[5]*y+values[13])/w];const expected=projectPoint(h,p).map(v=>v*.7);assert(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-6);}
}
console.log('Validated original-photo projection for all five box faces, interior points, and CSS matrix ordering.');
