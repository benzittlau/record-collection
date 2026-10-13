from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
p=Path('site/research/crops');p.mkdir(exist_ok=True)
for box in ['lower-middle','upper-middle']:
 im=ImageOps.exif_transpose(Image.open(f'site/dist/assets/boxes/{box}.jpg')).convert('RGB')
 # y bands in source pixels; crop solely for analysis.
 for n,(xl,xr) in enumerate([(500,1500),(1450,2450),(2400,3400)] if box=='lower-middle' else [(550,1400),(1350,1900),(1880,2510),(2460,3070)]):
  yl,yr=(500,3024) if box=='lower-middle' else (430,2790)
  ci=im.crop((xl,yl,xr,yr)).rotate(90,expand=True)
  d=ImageDraw.Draw(ci)
  for x in range(((xl+19)//20)*20,xr,20):
   v=xr-x;d.line((0,v,ci.width,v),fill='#777',width=1);d.text((5,v+1),str(x),fill='#00f9ff');d.text((ci.width-42,v+1),str(x),fill='#00f9ff')
  for y in [700,1500,2400,2650,2850]:
   u=y-yl
   if 0<=u<ci.width:d.line((u,0,u,ci.height),fill='#00eaff',width=2);d.text((u+2,5),'y'+str(y),fill='#00f9ff')
  ci.save(p/f'trace-{box}-{n}.jpg')
