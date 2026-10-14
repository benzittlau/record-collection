"""Stage LP-only artwork candidates for visual review, without mutating catalog."""
from pathlib import Path
import json,urllib.request,time,concurrent.futures
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];E=ROOT/'site/research/deep-middle-evidence';A=ROOT/'site/dist/assets/covers'
rows={r['id']:r for r in json.loads((ROOT/'site/research/middle.json').read_text())}
def download(f):
 d=json.loads(f.read_text());r=rows[d['id']];out=[]
 for face in ['front','back']:
  selected=None
  for rel in d['releases']:
   if not any('Vinyl' in m for m in rel.get('formats',[])):continue
   ims=[im for im in rel.get('images',[]) if im.get(face)]
   if not ims:continue
   for im in ims:
    src=im.get('thumbnails',{}).get('1200') or im.get('thumbnails',{}).get('500') or im['image']
    path=A/(r['id']+'-deep-'+face+'.jpg')
    if not path.exists():
     for attempt in range(3):
      try:
       b=urllib.request.urlopen(urllib.request.Request(src,headers={'User-Agent':'FamilyRecordCollectionResearch/1.0'}),timeout=25).read();path.write_bytes(b);Image.open(path).verify();break
      except Exception as err:
       path.unlink(missing_ok=True)
       if attempt==2:print('FAIL',r['id'],face,str(err),flush=True)
       else:time.sleep([1,3,8][attempt])
    if path.exists():
     selected={'face':face,'local':'/assets/covers/'+path.name,'sourceUrl':src,'archiveImageUrl':im['image'],'release':{k:rel[k] for k in ['id','url','title','artistCredit','country','date','formats','labels']},'review':'pending'};break
   if selected:break
  if selected:out.append(selected)
 p=E/(r['id']+'-candidates.json');p.write_text(json.dumps(out,ensure_ascii=False,indent=2));return len(out)
files=list(E.glob('*-lp.json'))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:counts=list(pool.map(download,files))
print('CANDIDATE IMAGES',sum(counts),'RECORDS',sum(x>0 for x in counts))
