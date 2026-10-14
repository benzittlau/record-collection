"""Printable guide derived from the frozen capture manifest, never a separate sequence.
Original photo pixels are EXIF-transposed for coordinate alignment. Vector outlines and
numbered leader tags are drawn above them; source images remain unchanged.
"""
from pathlib import Path
from io import BytesIO
import json, shutil
from PIL import Image,ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor,Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT=Path(__file__).resolve().parents[2]
DIST=ROOT/'site/dist';OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
plan=json.loads((DIST/'capture-manifest.json').read_text())
PATH=OUT/'record-collection-capture-map.pdf'
W,H=612,792
INK=HexColor('#20372e');MUTED=HexColor('#63706a');PAPER=HexColor('#f7f6ef');TAG=HexColor('#ffe599');LINE=HexColor('#d4dad3')
c=canvas.Canvas(str(PATH),pagesize=(W,H))
c.setTitle('Record collection photo capture map')
c.setAuthor('Dad’s record room')
page=0

def text(x,y,value,size=10,color=INK,font='Helvetica'):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,str(value))

def wrap(value,width,size=10,font='Helvetica'):
 words=str(value).split();lines=[];line=''
 for word in words:
  test=(line+' '+word).strip()
  if stringWidth(test,font,size)>width and line:lines.append(line);line=word
  else:line=test
 if line:lines.append(line)
 return lines

def paragraph(x,y,value,width,size=10,leading=15,color=INK):
 for line in wrap(value,width,size):text(x,y,line,size,color);y-=leading
 return y

def start(title,subtitle=''):
 global page
 page+=1;c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
 text(36,756,'DAD’S RECORD ROOM  /  PHOTO CAPTURE GUIDE',9,MUTED)
 text(36,714,title,26,INK,'Times-Roman')
 if subtitle:paragraph(36,689,subtitle,W-72,10,14,MUTED)

def finish():
 c.setStrokeColor(LINE);c.line(36,43,W-36,43)
 text(36,27,'Front / back / put it back / next sleeve',8,MUTED)
 c.drawRightString(W-36,27,f'{plan["version"]}  |  {page}')
 c.showPage()

images={}
def source(box):
 if box['id'] not in images:
  im=ImageOps.exif_transpose(Image.open(DIST/box['photo'])).convert('RGB')
  images[box['id']]=im
 return images[box['id']]

def map_photo(box,pairs,x,y,width,height,full=False):
 im=source(box);points=[v for p in pairs for o in p['outlines'] for v in o['polygon']]
 if full or not points:b=[0,0,im.width,im.height]
 else:
  b=[max(0,min(v[0] for v in points)-130),max(0,min(v[1] for v in points)-100),min(im.width,max(v[0] for v in points)+130),min(im.height,max(v[1] for v in points)+180)]
 crop=im.crop(tuple(map(int,b)));scale=min(width/crop.width,height/crop.height)
 rw,rh=crop.width*scale,crop.height*scale;ox=x+(width-rw)/2;oy=y+(height-rh)/2
 crop.thumbnail((1800,1800));data=BytesIO();crop.save(data,format='JPEG',quality=92)
 c.drawImage(ImageReader(BytesIO(data.getvalue())),ox,oy,rw,rh)
 def xy(v):return ox+(v[0]-b[0])*scale,oy+rh-(v[1]-b[1])*scale
 c.saveState();clip=c.beginPath();clip.rect(ox,oy,rw,rh);c.clipPath(clip,stroke=0,fill=0)
 for p in pairs:
  for o in p['outlines']:
   path=c.beginPath();xx,yy=xy(o['polygon'][0]);path.moveTo(xx,yy)
   for v in o['polygon'][1:]:xx,yy=xy(v);path.lineTo(xx,yy)
   path.close();c.saveState();c.setFillColor(Color(1,.84,.36,alpha=.28));c.setStrokeColor(TAG);c.setLineWidth(.9);c.drawPath(path,fill=1,stroke=1);c.restoreState()
 c.restoreState()
 # Evenly spaced tags preserve left-to-right order and avoid collisions on narrow sleeves.
 tagw=23
 for i,p in enumerate(pairs):
  a=p['outlines'][0]['anchor'];ax,ay=xy(a);tx=x+(i+.5)*width/len(pairs);ty=oy-20
  c.setStrokeColor(INK);c.setLineWidth(.45);c.line(ax,max(oy,ay),tx,ty+14)
  c.setFillColor(TAG);c.setStrokeColor(INK);c.roundRect(tx-tagw/2,ty,tagw,14,2,fill=1,stroke=1)
  c.setFillColor(INK);c.setFont('Helvetica-Bold',8);c.drawCentredString(tx,ty+4,str(p['position']))

start('Photograph the remaining sleeves',f'Up to {plan["pairCount"]} items, {plan["shotCount"]} planned photos. Take the front, then the back of each requested sleeve.')
room=Image.open(DIST/'assets/room-wide.jpg').convert('RGB');rw=540;rh=room.height/room.width*rw;ry=340
c.drawImage(ImageReader(room),36,ry,rw,rh)
for n,px,py in [(1,410,423),(2,397,694),(3,790,376),(4,797,595),(5,1120,672)]:
 xx=36+px/1659*rw;yy=ry+rh-py/948*rh;c.setFillColor(TAG);c.setStrokeColor(INK);c.circle(xx,yy,12,fill=1,stroke=1);c.setFont('Helvetica-Bold',12);c.setFillColor(INK);c.drawCentredString(xx,yy-4,str(n))
y=310
for box in plan['boxes']:
 text(36,y,f'Box {box["number"]} - {box["name"]}',11,INK,'Helvetica-Bold')
 text(305,y,f'{box["pairCount"]} sleeves',10)
 text(410,y,f'Photos {box["firstShot"]}-{box["lastShot"]}' if box['pairCount'] else 'No photos needed',10)
 y-=24
y=paragraph(36,y-12,'Send the original camera files together. Keep the original filenames. No captions, renaming or folders are required. The saved sequence and cover contents will identify each photo.',540,11,16)
y=paragraph(36,y-10,'Work left to right inside each section. Include all four corners and sharp catalogue text. Photograph the closed outer cover; discs and gatefold interiors are not needed in this pass.',540,10,15,MUTED)
paragraph(36,y-8,'An asterisk marks a possible folded edge. Skip that pair if it is part of a neighboring jacket already photographed. Use printed titles and physical order where outlines overlap. Guide numbers need not match camera filenames.',540,9,13,MUTED)
finish()

for box in plan['boxes']:
 allpairs=[p for p in plan['pairs'] if p['box']==box['id']]
 if not allpairs:continue
 sections=sorted(set(p['compartment'] for p in allpairs))
 for section in sections:
  pairs=[p for p in allpairs if p['compartment']==section]
  # One compartment map per page with a readable, matching camera list alongside.
  # Continue the list on a second page when necessary rather than shrink its type.
  chunks=[];chunk=[];used=0
  for p in pairs:
   height=len(wrap(p['title'],228,10))*13+11+len(wrap(p['artist'],228,8))*11+9+(12 if p.get('optional') else 0)
   if chunk and (used+height>520 or len(chunk)>=10):chunks.append(chunk);chunk=[];used=0
   chunk.append(p);used+=height
  if chunk:chunks.append(chunk)
  for chunk_no,chunk in enumerate(chunks):
   title=f'Box {box["number"]} - {box["name"]}'
   subtitle=f'Section {section}. Sleeve tags match the numbered list. Photos {chunk[0]["frontShot"]}-{chunk[-1]["backShot"]}.'
   if len(chunks)>1:subtitle+=f' List {chunk_no+1} of {len(chunks)}.'
   start(title,subtitle)
   map_photo(box,chunk,36,133,254,530)
   y=650
   text(310,y,'SLEEVE / CAMERA PHOTOS',9,MUTED,'Helvetica-Bold');y-=23
   for p in chunk:
    text(310,y,str(p['position'])+('*' if p.get('optional') else ''),10,INK,'Helvetica-Bold')
    lines=wrap(p['title'],228,10)
    for line in lines:text(339,y,line,10);y-=13
    text(339,y,f'Photos {p["frontShot"]} / {p["backShot"]} - front / back',8,MUTED);y-=11
    artistlines=wrap(p['artist'],228,8)
    for line in artistlines:text(339,y,line,8,MUTED);y-=11
    if p.get('optional'):text(339,y,'Only if a separate physical jacket',8,MUTED);y-=12
    y-=9
   paragraph(36,84,'Left to right. Return each sleeve to its original position. * Skip if part of the neighboring jacket.',540,9,12,MUTED)
   if any(p.get('instruction') for p in chunk):paragraph(36,66,'Some outlines here may overlap. Use actual jacket titles and avoid photographing the same sleeve twice.',540,8,11,MUTED)
   finish()

c.save();shutil.copyfile(PATH,DIST/'capture-map.pdf')
print(f'{PATH}: {page} pages, {plan["pairCount"]} sleeves, {plan["shotCount"]} photos')
