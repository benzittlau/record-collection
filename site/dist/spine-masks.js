import {projectPoint} from './photo-projection.js';

// The original photo and the hit outlines share the same projective transform.
// Clipping keeps outlines off the unphotographed corner of the lower-middle box.
export function clipToPhoto(polygon,width,height){
  let points=polygon.map(p=>[...p]);
  for(const [axis,edge,sign] of [[0,0,1],[0,width,-1],[1,0,1],[1,height,-1]]){
    const input=points;points=[];
    for(let i=0;i<input.length;i++){
      const a=input[i],b=input[(i+1)%input.length];
      const aInside=sign*(a[axis]-edge)>=0,bInside=sign*(b[axis]-edge)>=0;
      if(aInside)points.push(a);
      if(aInside!==bInside){
        const t=(edge-a[axis])/(b[axis]-a[axis]);
        const intersection=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
        intersection[axis]=edge;points.push(intersection);
      }
    }
  }
  return points;
}

export function projectSpineMasks(h,masks,width,height){
  const result=new Map();
  for(const record of masks?.records??[]){
    if(typeof record.id!=='string'||result.has(record.id))throw new Error('Spine mask IDs must be unique');
    if(!Array.isArray(record.polygon)||record.polygon.length<3||record.polygon.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new Error(`Invalid spine outline: ${record.id}`);
    const source=clipToPhoto(record.polygon,width,height);
    if(source.length<3)continue;
    // Traces can have extra vertices along bent edges. Anchor the number beneath
    // the photographed sleeve's bottom edge, rather than assuming four corners.
    const bottom=[...source].sort((a,b)=>b[1]-a[1]).slice(0,2);
    if(record.anchor&&(!Array.isArray(record.anchor)||record.anchor.length!==2||!record.anchor.every(Number.isFinite)))throw new Error(`Invalid spine anchor: ${record.id}`);
    const visibleAnchor=record.anchor&&record.anchor[0]>=0&&record.anchor[0]<=width&&record.anchor[1]>=0&&record.anchor[1]<=height;
    const anchor=visibleAnchor?record.anchor:[(bottom[0][0]+bottom[1][0])/2,(bottom[0][1]+bottom[1][1])/2];
    result.set(record.id,{polygon:source.map(p=>projectPoint(h,p)),anchor:projectPoint(h,anchor)});
  }
  return result;
}
