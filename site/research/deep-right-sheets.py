from pathlib import Path
import json,sys
from PIL import Image,ImageDraw
base=Path(__file__).resolve().parent;root=base.parents[1]; files=['deep-right-acquired.json','deep-right-extra-acquired.json','deep-right-preferred-acquired.json']
items=[]
for f in files:
 if (base/f).exists():items+=json.load(open(base/f))
imgs=[(e['id'],c) for e in items for c in e['candidates']]
for j in range(0,len(imgs),20):
 page=Image.new('RGB',(1600,1600),'#dddddd');d=ImageDraw.Draw(page)
 for k,(id,c) in enumerate(imgs[j:j+20]):
  p=root/c['path'];im=Image.open(p);size=im.size;im.thumbnail((310,300));x=k%5*320;y=k//5*400;page.paste(im,(x+(320-im.width)//2,y));d.text((x+4,y+305),id+' '+p.name.replace(id+'-',''),fill='black');d.text((x+4,y+323),str(size)+' '+c.get('face',''),fill='black');rel=c.get('release') or next((e.get('discogsMetadata',{}) for e in items if e['id']==id and e.get('discogsMetadata')),{});d.text((x+4,y+341),str(rel.get('date') or rel.get('year') or '')+' '+str(rel.get('country') or ''),fill='black');d.text((x+4,y+359),' / '.join(rel.get('catalogNumbers') or [v.get('catno','') for v in rel.get('labels',[])])[:47],fill='black')
 page.save(base/f'deep-right-candidates-sheet-{j//20}.jpg')
print('images',len(imgs),'pages',(len(imgs)+19)//20)
