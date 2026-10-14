"""Cache a globally throttled MusicBrainz vinyl/CAA audit. Does not edit catalog."""
from pathlib import Path
import json,re,urllib.parse,urllib.request,runpy,time,concurrent.futures
ROOT=Path(__file__).resolve().parents[2]
ROWS=json.loads((ROOT/'site/research/middle.json').read_text())
E=ROOT/'site/research/deep-middle-evidence';E.mkdir(exist_ok=True)
mb_get=runpy.run_path(str(ROOT/'site/research/deep-left-musicbrainz.py'))['get_json']
HEAD={'User-Agent':'FamilyRecordCollectionResearch/1.0 (personal LP archive; https://musicbrainz.org)','Accept':'application/json'}
def cached(url,key,mb=False):
 p=E/(key+'.json')
 if p.exists():return json.loads(p.read_text())
 for i in range(3):
  try:
   if mb:d=mb_get(url)
   else:
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEAD),timeout=22) as f:d=json.load(f)
   p.write_text(json.dumps(d,ensure_ascii=False,indent=2));return d
  except Exception as err:
   if getattr(err,'code',None)==404:return {'images':[],'error':'404','url':url}
   if i==2:return {'error':str(err),'url':url}
   time.sleep([1,3,8][i])
def scan(r):
 out={'id':r['id'],'identity':r['title'],'searches':[],'releases':[],'existingBack':None}
 if r.get('backSourceUrl'):
  m=re.search(r'/release/([a-f0-9-]{36})/',r['backSourceUrl'])
  if m:
   u='https://musicbrainz.org/ws/2/release/'+m[1]+'?inc=media+labels+artist-credits&fmt=json'
   out['existingBack']=cached(u,'release-'+m[1],True)
 groups=[re.search(r'release-group/([a-f0-9-]{36})',s).group(1) for s in r.get('sources',[]) if re.search(r'release-group/([a-f0-9-]{36})',s)]
 groups=list(dict.fromkeys(groups))
 if not groups:
  if r['confidence']=='unknown':
   (E/(r['id']+'-lp.json')).write_text(json.dumps(out,indent=2));return
  title=r['title'].replace('"','');artist=r['artist'].split(' / ')[0].replace('"','')
  q='release:"'+title+'" AND artist:"'+artist+'"'
 else:q='rgid:'+groups[0]
 u='https://musicbrainz.org/ws/2/release/?query='+urllib.parse.quote(q)+'&limit=100&fmt=json';out['searches'].append({'query':q,'url':u})
 d=cached(u,r['id']+'-search-v2',True);releases=[x for x in d.get('releases',[]) if any('Vinyl' in m.get('format','') for m in x.get('media',[]))]
 def rank(x):
  c=0
  if x.get('country')=='CA':c+=10
  codes=[str(t.get('catalog-number','')).replace(' ','').replace('-','') for t in x.get('label-info',[])]
  text=re.sub('[^A-Z0-9]','',r['spineText'].upper())
  if any(len(t)>=4 and t in text for t in codes):c+=30
  c+=float(x.get('score',100))/100
  if x.get('cover-art-archive',{}).get('back'):c+=3
  return -c
 releases=sorted(releases,key=rank)
 # Look beyond preferred digital release: up to 5 different LP editions, more for gaps.
 limit=7 if not r.get('cover') else 5
 good=0
 for rel in releases[:limit]:
  rid=rel['id'];formats=[x.get('format','') for x in rel.get('media',[])]
  if not formats or not any('Vinyl' in x for x in formats):
   detail=cached('https://musicbrainz.org/ws/2/release/'+rid+'?inc=media+labels+artist-credits&fmt=json','release-'+rid,True)
   formats=[x.get('format','') for x in detail.get('media',[])];rel=detail
  meta=cached('https://coverartarchive.org/release/'+rid,'caa-'+rid)
  out['releases'].append({'id':rid,'url':'https://musicbrainz.org/release/'+rid,'title':rel.get('title'),'artistCredit':rel.get('artist-credit'),'country':rel.get('country'),'date':rel.get('date'),'formats':formats,'labels':rel.get('label-info',[]),'images':meta.get('images',[]),'error':meta.get('error')})
  if any(im.get('back') for im in meta.get('images',[])) and any('Vinyl' in x for x in formats):good+=1
  if good>=2:break
 (E/(r['id']+'-lp.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2))
 print(r['id'],len(releases),'LP releases',len(out['releases']),'checked',good,'backs',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(scan,ROWS))
