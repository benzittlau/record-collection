"""Targeted LP alternatives after visual face QA; public metadata, shared API limits."""
from pathlib import Path
import runpy,json,urllib.request,urllib.parse,re,io,time
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2];R=ROOT/'site/research';A=ROOT/'site/dist/assets/covers'
mb=runpy.run_path(str(R/'deep-left-musicbrainz.py'))['get_json'];dg=runpy.run_path(str(R/'deep-middle-discogs.py'))['get_json']
E=R/'deep-left-extra-evidence.json';cache=json.loads(E.read_text()) if E.exists() else {}
P=R/'deep-left-extra-art.json';props=json.loads(P.read_text()) if P.exists() else {}
rows={r['id']:r for r in json.loads((R/'left.json').read_text())};caa=json.loads((R/'deep-left-art-proposals.json').read_text());old=json.loads((R/'deep-left-discogs-proposals.json').read_text())
def save():E.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n');P.write_text(json.dumps(props,ensure_ascii=False,indent=2)+'\n')
def fetch(u):
 if cache.get(u,{}).get('ok'):return cache[u]['data']
 try:
  d=(dg if 'api.discogs.com' in u else mb)(u);cache[u]={'ok':True,'data':d,'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())};save();return d
 except Exception as e:cache[u]={'ok':False,'error':str(e)};save();return None
def download(u,id,name):
 p=A/f'{id}-{name}.jpg'
 if not p.exists():
  raw=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'FamilyRecordCollectionResearch/2.0'}),timeout=25).read();im=Image.open(io.BytesIO(raw));im.load();sz=list(im.size);im=im.convert('RGB');im.thumbnail((1600,1600));im.save(p,quality=94)
 else:
  with Image.open(p) as im:sz=list(im.size)
 with Image.open(p) as im:im.verify()
 return {'path':'/assets/covers/'+p.name,'sourceUrl':u,'localSize':sz}
def candidate(id,release):
 u=f'https://api.discogs.com/releases/{release}';d=fetch(u)
 if not d or not any(f.get('name')=='Vinyl' for f in d.get('formats',[])):return None
 c={'releaseId':release,'releaseUrl':d.get('uri'),'title':d['title'],'artist':' / '.join(a['name'] for a in d['artists']),'country':d.get('country'),'year':d.get('year'),'formats':d.get('formats'),'labels':d.get('labels'),'images':[]}
 for i,v in enumerate(d.get('images',[])[:8],1):
  try:c['images'].append({**download(v['uri'],id,f'extra-discogs-{release}-{i:02d}'),'index':i})
  except Exception as e:c['images'].append({'index':i,'sourceUrl':v.get('uri'),'error':str(e)})
 props.setdefault(id,{'attempts':[],'candidates':[]})['candidates'].append(c);save();print(id,release,len(c['images']),flush=True);return c
def master_candidates(id,master):
 d=fetch(f'https://api.discogs.com/masters/{master}/versions?per_page=100&sort=released&sort_order=asc');vs=[v for v in d.get('versions',[]) if 'LP' in v.get('format','')] if d else []
 props.setdefault(id,{'attempts':[],'candidates':[]})['versions']=vs;save()
 vs.sort(key=lambda v:30*(v.get('country')=='Canada')+10*(v.get('country') in ['US','UK']),reverse=True)
 for v in vs[:3]:
  c=candidate(id,v['id'])
  if c and len([i for i in c['images'] if i.get('path')])>=3:break
if __name__=='__main__':
 for id,reids in [('upper-left-09',[1549003,707004]),('upper-left-34',[809605,4887643])]:
  for reid in reids:
   if any(c['releaseId']==reid for c in props.get(id,{}).get('candidates',[])):continue
   c=candidate(id,reid)
   if c and len([i for i in c['images'] if i.get('path')])>=3:break
 # CAA's US Before the Flood has a CD rear mistakenly attached; use original UK LP.
 id='lower-left-44';reid='d4cf0b92-f3c1-3dee-94c7-eda4475ba1ee';u='https://coverartarchive.org/release/'+reid;d=fetch(u)
 if d:
  arr=[]
  for i,v in enumerate(d.get('images',[]),1):
   if not any(t in v.get('types',[]) for t in ['Front','Back','Medium']):continue
   try:arr.append({**download(v.get('thumbnails',{}).get('1200') or v['image'],id,'extra-caa-'+str(i)), 'index':i,'types':v.get('types'),'comment':v.get('comment')})
   except Exception as e:arr.append({'index':i,'error':str(e),'types':v.get('types')})
  props[id]={'attempts':[u],'caaRelease':caa[id]['vinylReleases'][1],'caaImages':arr};save();print(id,'CAA',len(arr),flush=True)
 # Scans supplied by owner Manuel Garcia Jara, clearly captioned Canadian C31104 LP.
 id='lower-left-48';arr=[]
 for face,file in [('front','BrombergCanFront.jpg'),('back','BrombergCanBack.jpg'),('label','BrombergCanSide1.jpg')]:
  u='https://www.searchingforagem.com/1970s/1970s_Pictures/'+file
  try:arr.append({**download(u,id,'owner-'+face),'face':face})
  except Exception as e:arr.append({'sourceUrl':u,'face':face,'error':str(e)})
 props[id]={'attempts':['https://thefm.club/searchingforagem/1970s/1972.htm','https://www.searchingforagem.com/1970s/1972.htm'],'edition':{'country':'Canada','date':'1972-02-16','catalogNumbers':['C31104'],'media':'Vinyl LP','source':'Scans by Manuel Garcia Jara on Searching for a Gem'},'ownerImages':arr};save();print(id,'owner',len(arr),flush=True)
 # Known CD metadata points to the same album's master, then only LP versions allowed.
 d=fetch('https://api.discogs.com/releases/16791984')
 if d and d.get('master_id'):master_candidates('upper-left-03',d['master_id'])
