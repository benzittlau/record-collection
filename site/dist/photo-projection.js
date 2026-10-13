// Project original photographic pixels onto the room's planar box faces.
// CSS matrix3d preserves the full-resolution image until the browser samples it.
export function fitHomography(source, destination) {
  if(source.length!==4||destination.length!==4)throw new Error('Four corners are required');
  const matrix=[];
  for(let i=0;i<4;i++){
    const [x,y]=source[i],[u,v]=destination[i];
    matrix.push([x,y,1,0,0,0,-u*x,-u*y,u]);
    matrix.push([0,0,0,x,y,1,-v*x,-v*y,v]);
  }
  for(let col=0;col<8;col++){
    let pivot=col;
    for(let row=col+1;row<8;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
    if(Math.abs(matrix[pivot][col])<1e-10)throw new Error('The photo corners are degenerate');
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
    const divisor=matrix[col][col];
    for(let j=col;j<=8;j++)matrix[col][j]/=divisor;
    for(let row=0;row<8;row++){
      if(row===col)continue;
      const factor=matrix[row][col];
      for(let j=col;j<=8;j++)matrix[row][j]-=factor*matrix[col][j];
    }
  }
  return [...matrix.map(row=>row[8]),1];
}
export function projectPoint(h,[x,y]){
  const w=h[6]*x+h[7]*y+h[8];
  if(Math.abs(w)<1e-10)throw new Error('Point is on the projection horizon');
  return [(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];
}
export function cssProjection(h,scaleX=1,scaleY=scaleX){
  // CSS consumes column-major 4x4 matrices; the projective denominator is w.
  const m=[h[0]*scaleX,h[3]*scaleY,0,h[6],h[1]*scaleX,h[4]*scaleY,0,h[7],0,0,1,0,h[2]*scaleX,h[5]*scaleY,0,h[8]];
  return `matrix3d(${m.map(v=>Number(v.toPrecision(14))).join(',')})`;
}
export function sourceClip(quad,width,height){return `polygon(${quad.map(([x,y])=>`${x/width*100}% ${y/height*100}%`).join(',')})`;}
