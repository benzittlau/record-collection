import json,time,urllib.request,urllib.parse,urllib.error,runpy,re,io,sys
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
BASE=Path(__file__).resolve().parent; ROOT=BASE.parents[1]; EVID=BASE/'deep-right-candidates';EVID.mkdir(exist_ok=True)
UA='FamilyRecordCollection/2.0 (personal LP sleeve research)'
discogs_get=runpy.run_path(str(BASE/'deep-middle-discogs.py'))['get_json']
scans=json.loads((BASE/'deep-right-release-scan.json').read_text());out=[]
def fetch(url,path,kind='json'):
 if path.exists():return json.loads(path.read_text()) if kind=='json' else Image.open(path).size
 for n in range(4):
  try:
   req=urllib.request.Request(url.replace('http://','https://'),headers={'User-Agent':UA,'Accept':'application/json' if kind=='json' else 'image/*'})
   if kind=='json' and 'api.discogs.com/' in url:
    d=discogs_get(url,headers={'User-Agent':UA});path.write_text(json.dumps(d));return d
   with urllib.request.urlopen(req,timeout=35) as f:b=f.read()
   if kind=='json':d=json.loads(b);path.write_text(json.dumps(d));time.sleep(1.3);return d
   im=ImageOps.exif_transpose(Image.open(io.BytesIO(b))).convert('RGB');im.save(path,quality=94);time.sleep(.2);return im.size
  except urllib.error.HTTPError as e:
   if e.code in (404,403,401):raise
   if n==3:raise
   time.sleep([2,5,12][n])
  except Exception:
   if n==3:raise
   time.sleep([2,5,12][n])

for id,rid in [('right-10','11670698'),('right-12','371466'),('right-20','944143'),('right-36','8894211'),('right-37','1731747')]:
 e={'id':id,'candidates':[],'errors':[]}
 try:
  d=fetch('https://api.discogs.com/releases/'+rid,EVID/f'{id}-discogs-{rid}.json')
  e['discogsMetadata']={k:d.get(k) for k in ['id','title','artists','year','country','formats','labels','notes','uri','master_id','tracklist']}
  if not any(f['name']=='Vinyl' and 'LP' in f.get('descriptions',[]) for f in d.get('formats',[])):raise ValueError('Not vinyl LP')
  for k,x in enumerate(d.get('images',[])[:14]):
   p=EVID/f'{id}-discogs-{rid}-{k}.jpg';size=fetch(x['uri'],p,'image');e['candidates'].append({'path':str(p.relative_to(ROOT)),'face':'front' if x.get('type')=='primary' else 'unclassified','source':'Discogs','imageUrl':x['uri'],'releaseId':rid,'releaseUrl':d.get('uri'),'size':size})
 except Exception as ex:e['errors'].append(str(ex))
 out.append(e);(BASE/'deep-right-preferred-acquired.json').write_text(json.dumps(out,indent=2));print(id,len(e['candidates']),e['errors'],flush=True)
