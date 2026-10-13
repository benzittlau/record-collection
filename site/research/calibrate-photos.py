from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
quads={
'IMG_3569.jpg':{'front':[(373,120),(3390,203),(3150,2730),(716,2940)],'inner':[(436,179),(3337,258),(3100,2684),(755,2894)]},
'IMG_3571.jpg':{'front':[(374,79),(3903,150),(3260,2760),(884,2740)],'inner':[(435,153),(3820,208),(3210,2710),(915,2700)]},
'IMG_3570.jpg':{'front':[(421,144),(3213,343),(3076,2757),(631,2846)],'inner':[(475,206),(3152,404),(3020,2700),(673,2786)]},
'IMG_3572.jpg':{'front':[(420,279),(3523,337),(3194,2788),(833,2891)],'inner':[(476,339),(3464,398),(3145,2732),(872,2839)]},
'IMG_3573.jpg':{'front':[(296,184),(3661,271),(3058,2769),(771,2742)],'inner':[(364,255),(3590,331),(3008,2721),(807,2702)]}}
for f,qs in quads.items():
 im=ImageOps.exif_transpose(Image.open('reference/'+f)).convert('RGB');im.thumbnail((1008,756));d=ImageDraw.Draw(im)
 for i in range(0,4032,200):
  x=i/4;d.line((x,0,x,756),fill='#777',width=1);d.text((x+2,2),str(i),fill='#00e8ff')
 for i in range(0,3024,200):
  y=i/4;d.line((0,y,1008,y),fill='#777',width=1);d.text((2,y+2),str(i),fill='#00e8ff')
 for k,c in [('front','#ff2244'),('inner','#33ff33')]:
  q=[(x/4,y/4) for x,y in qs[k]];d.line(q+[q[0]],fill=c,width=3)
  for j,pt in enumerate(q):d.ellipse((pt[0]-4,pt[1]-4,pt[0]+4,pt[1]+4),fill=c);d.text((pt[0]+5,pt[1]),str(j),fill=c)
 im.save('site/research/crops/calibration-'+f)
