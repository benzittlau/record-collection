from PIL import Image,ImageOps,ImageDraw
import json,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'site/research/deep-middle-crops';out.mkdir(exist_ok=True)
records=json.load(open(ROOT/'site/research/middle.json'));masks=json.load(open(ROOT/'site/research/spine-masks-middle.json'))['boxes']
ims={b:np.asarray(ImageOps.exif_transpose(Image.open(ROOT/f'site/dist/assets/boxes/{b}.jpg')).convert('RGB')) for b in masks}
for r in records:
 if r['confidence']=='confirmed' and not (r['box']=='lower-middle' and (r['position']<=10 or r['position']>=35)):continue
 q=next(x['polygon'] for x in masks[r['box']]['records'] if x['id']==r['id']);yl=max(0,int(min(q[0][1],q[1][1]))-12);yr=min(3024,int(max(q[3][1],q[4][1]))+10)
 im=ims[r['box']];w=120;strip=np.empty((yr-yl,w,3),dtype=np.uint8)
 def side(points,y):
  pts=sorted(points,key=lambda p:p[1]);return np.interp(y,[p[1] for p in pts],[p[0] for p in pts])
 for n,y in enumerate(range(yl,yr)):
  cx=(side([q[0],q[5],q[4]],y)+side([q[1],q[2],q[3]],y))/2;x=max(0,min(4032-w,int(cx-w/2)));strip[n]=im[y,x:x+w]
 z=Image.fromarray(strip).rotate(90,expand=True);d=ImageDraw.Draw(z);d.text((5,4),r['id'],fill='cyan',stroke_width=1,stroke_fill='black');z.save(out/(r['id']+'.jpg'))
 for i in range(3):
  lo=i*z.width//3;hi=(i+1)*z.width//3;z.crop((lo,0,hi,z.height)).resize(((hi-lo)*2,z.height*2)).save(out/(r['id']+f'-part{i}.jpg'))
print('Spine analysis crops generated')
