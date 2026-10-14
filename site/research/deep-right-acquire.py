import json,time,urllib.request,urllib.parse,urllib.error,runpy,re,io,sys
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
BASE=Path(__file__).resolve().parent; ROOT=BASE.parents[1]; EVID=BASE/'deep-right-candidates';EVID.mkdir(exist_ok=True)
UA='FamilyRecordCollection/2.0 (personal LP sleeve research)'
scans=json.loads((BASE/'deep-right-release-scan.json').read_text());out=[]
def fetch(url,path,kind='json'):
 if path.exists():return json.loads(path.read_text()) if kind=='json' else Image.open(path).size
 for n in range(4):
  try:
   req=urllib.request.Request(url.replace('http://','https://'),headers={'User-Agent':UA,'Accept':'application/json' if kind=='json' else 'image/*'})
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
for s in scans:
 entry={'id':s['id'],'candidates':[],'errors':[]}
 try:
  # Download paired LP CAA candidates. A tagged Back remains subject to visual review.
  cc=[c for c in s.get('caaCandidates',[]) if any(x.get('back') for x in c['art'].get('images',[]))]
  if not cc:cc=s.get('caaCandidates',[])[:1]
  for j,c in enumerate(cc):
   for k,x in enumerate(c['art'].get('images',[])):
    if not(x.get('front') or x.get('back')):continue
    face='front' if x.get('front') else 'back';p=EVID/f"{s['id']}-caa{j}-{face}-{k}.jpg";url=x.get('thumbnails',{}).get('1200') or x.get('image');size=fetch(url,p,'image')
    entry['candidates'].append({'path':str(p.relative_to(ROOT)),'face':face,'source':'Cover Art Archive','imageUrl':url,'release':c['release'],'size':size,'types':x.get('types'),'comment':x.get('comment'),'caaImageId':x.get('id')})
  # Discogs: prioritize catalogue-number LP; when no CAA Back available.
  if not any(x['face']=='back' for x in entry['candidates']):
   releases=s.get('releases',[])
   chosen=next((x for x in releases if any('discogs.com/release/' in u for u in x.get('relations',[]))),None)
   if chosen:
    url=next(u for u in chosen['relations'] if 'discogs.com/release/' in u);rid=re.search('/release/(\d+)',url)[1]
    d=fetch('https://api.discogs.com/releases/'+rid,EVID/f"{s['id']}-discogs-{rid}.json")
    entry['discogsMetadata']={'id':d['id'],'title':d['title'],'artists':d.get('artists'),'year':d.get('year'),'country':d.get('country'),'formats':d.get('formats'),'labels':d.get('labels'),'notes':d.get('notes'),'uri':d.get('uri')}
    if not any(f['name']=='Vinyl' and 'LP' in f.get('descriptions',[]) for f in d.get('formats',[])):raise ValueError('Discogs release is not LP')
    for k,x in enumerate(d.get('images',[])[:14]):
     p=EVID/f"{s['id']}-discogs-{rid}-{k}.jpg";size=fetch(x['uri'],p,'image')
     entry['candidates'].append({'path':str(p.relative_to(ROOT)),'face':'front' if x.get('type')=='primary' else 'unclassified','source':'Discogs','imageUrl':x['uri'],'releaseId':rid,'releaseUrl':d.get('uri'),'size':size})
 except Exception as e:entry['errors'].append(str(e));print('ERROR',s['id'],e,flush=True)
 out.append(entry);(BASE/'deep-right-acquired.json').write_text(json.dumps(out,indent=2));print(s['id'],len(entry['candidates']),'images',flush=True)
print('COMPLETE',len(out),flush=True)
