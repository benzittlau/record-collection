"""Resumable public MusicBrainz/CAA vinyl artwork enumeration; proposes, never edits catalog.
Shared MusicBrainz lock enforces global cadence across cooperating researchers.
Every response and attempted URL is archived; failed requests retry/back off.
"""
from pathlib import Path
from PIL import Image
import json,urllib.request,urllib.parse,time,re,unicodedata,fcntl,io,sys

ROOT=Path(__file__).resolve().parents[2]
RESEARCH=ROOT/'site/research';ASSETS=ROOT/'site/dist/assets/covers'
CACHE_PATH=RESEARCH/'deep-left-api-cache.json'
PROPOSALS_PATH=RESEARCH/'deep-left-art-proposals.json'
CACHE=json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
PROPOSALS=json.loads(PROPOSALS_PATH.read_text()) if PROPOSALS_PATH.exists() else {}
HEADERS={'User-Agent':'FamilyRecordCollectionResearch/1.0 (personal family LP archive; https://musicbrainz.org)','Accept':'application/json'}
LOCK=Path('/tmp/record-collection-musicbrainz-rate.lock');CLOCK=Path('/tmp/record-collection-musicbrainz-rate.json')
last_caa=0
def save():
 CACHE_PATH.write_text(json.dumps(CACHE,ensure_ascii=False,indent=2)+'\n')
 PROPOSALS_PATH.write_text(json.dumps(PROPOSALS,ensure_ascii=False,indent=2)+'\n')
def fetch(url,kind='json'):
 global last_caa
 if kind=='json' and url in CACHE and CACHE[url].get('ok'):return CACHE[url]['data']
 errors=[]
 for attempt in range(4):
  lock=None
  try:
   if 'musicbrainz.org/ws/' in url:
    lock=LOCK.open('a+');fcntl.flock(lock,fcntl.LOCK_EX)
    try:stamp=json.loads(CLOCK.read_text()).get('last',0)
    except Exception:stamp=0
    time.sleep(max(0,1.1-(time.time()-stamp)));CLOCK.write_text(json.dumps({'last':time.time()}))
   else:
    time.sleep(max(0,0.65-(time.monotonic()-last_caa)));last_caa=time.monotonic()
   req=urllib.request.Request(url,headers=HEADERS)
   with urllib.request.urlopen(req,timeout=25) as response:
    raw=response.read();final=response.url
   if lock:fcntl.flock(lock,fcntl.LOCK_UN);lock.close();lock=None
   if kind=='json':
    data=json.loads(raw);CACHE[url]={'ok':True,'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'finalUrl':final,'data':data};return data
   return raw
  except Exception as e:
   if lock:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
   code=getattr(e,'code',None);errors.append({'attempt':attempt+1,'error':str(e),'status':code})
   if code in [400,404]:break
   time.sleep([1,3,8,15][attempt])
 if kind=='json':CACHE[url]={'ok':False,'errors':errors,'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 return None
def mb(entity,params):
 return fetch('https://musicbrainz.org/ws/2/'+entity+'?'+urllib.parse.urlencode({**params,'fmt':'json'}))
def norm(v):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower())
def credit(r):return ' '.join(c.get('name',c.get('artist',{}).get('name','')) for c in r.get('artist-credit',[]) if isinstance(c,dict))
def catmatch(r,row):
 spine=norm(row.get('spineText',''))
 return [x.get('catalog-number') for x in r.get('label-info',[]) if len(norm(x.get('catalog-number','')))>=5 and norm(x.get('catalog-number','')) in spine]
def score(r,row):
 cats=catmatch(r,row);yr=str(row.get('year') or '')
 return 100*bool(cats)+25*(r.get('country')=='CA')+15*(str(r.get('date','')).startswith(yr) and bool(yr))+5*(r.get('country') in ['US','GB'])+5*(r.get('status')=='Official')
def download(src,rid,face):
 out=ASSETS/(rid+'-lp-'+face+'.jpg')
 raw=fetch(src,'image')
 if not raw:return None
 try:
  im=Image.open(io.BytesIO(raw));im.load()
  if min(im.size)<180:return None
  original=im.size;im=im.convert('RGB');im.thumbnail((1600,1600));im.save(out,quality=94)
  with Image.open(out) as check:check.verify()
  return {'path':'/assets/covers/'+out.name,'sourceUrl':src,'originalSize':list(original),'localSize':list(im.size)}
 except Exception as e:return {'error':str(e),'sourceUrl':src}

rows=json.loads((RESEARCH/'left.json').read_text())
old_groups={}
for filename in ['left_musicbrainz_candidates.json','left_musicbrainz_more.json']:
 for rid,d in json.loads((RESEARCH/filename).read_text()).items():
  groups=d.get('release-groups',[])
  if groups:old_groups[rid]=groups[0]['id']
old_groups.update(json.loads((RESEARCH/'deep-left-group-overrides.json').read_text()) if (RESEARCH/'deep-left-group-overrides.json').exists() else {})
for row in rows:
 rid=row['id']
 if PROPOSALS.get(rid,{}).get('complete'):continue
 report={'id':rid,'artist':row['artist'],'title':row['title'],'confidence':row['confidence'],'spineText':row['spineText'],'attempts':[],'vinylReleases':[],'artwork':{},'complete':False}
 if row['title'] in ['Unidentified sleeve','Unknown title']:
  report.update(complete=True,reason='Unidentified album: needs source-spine reinspection and catalogue research before artwork assignment.');PROPOSALS[rid]=report;save();continue
 rg=old_groups.get(rid)
 if not rg:
  q='releasegroup:"'+row['title'].replace('"','')+'" AND artist:"'+row['artist'].replace('"','')+'"'
  response=mb('release-group',{'query':q,'limit':20});report['attempts'].append({'method':'release-group exact title+artist','query':q})
  groups=response.get('release-groups',[]) if response else []
  exact=[g for g in groups if norm(g.get('title',''))==norm(row['title']) and int(g.get('score',0))>=90]
  if exact:
   exact.sort(key=lambda g:100*(g.get('primary-type')=='Album')+100*(str(g.get('first-release-date','')).startswith(str(row.get('year'))) and bool(row.get('year')))-60*('Live' in g.get('secondary-types',[]))+min(g.get('count',0),30),reverse=True)
   rg=exact[0]['id']
  elif groups and int(groups[0].get('score',0))>=95:
   report['candidateGroup']=groups[0];report['reason']='Release-group title differs; manual confirmation required.'
 if not rg:
  report.update(complete=True);PROPOSALS[rid]=report;save();print('NO GROUP',rid,row['title'],flush=True);continue
 report['releaseGroup']=rg;report['sources']=['https://musicbrainz.org/release-group/'+rg]
 releases=[];offset=0
 while True:
  data=mb('release',{'release-group':rg,'inc':'labels+media+artist-credits','limit':100,'offset':offset})
  if not data:
   report['reason']='Release browse request failed after retries/backoff';break
  releases+=data.get('releases',[])
  if len(releases)>=data.get('release-count',0):break
  offset+=100
 report['allReleaseCount']=len(releases)
 vinyl=[r for r in releases if any(m.get('format') in ['Vinyl','12" Vinyl'] for m in r.get('media',[])) and r.get('status') not in ['Bootleg','Pseudo-Release']]
 vinyl.sort(key=lambda r:score(r,row),reverse=True)
 report['vinylReleases']=[{'id':r['id'],'title':r['title'],'artist':credit(r),'country':r.get('country'),'date':r.get('date'),'formats':[m.get('format') for m in r.get('media',[])],'labels':r.get('label-info',[]),'catalogueMatch':catmatch(r,row),'coverArt':r.get('cover-art-archive',{}),'score':score(r,row)} for r in vinyl]
 art_candidates=[r for r in vinyl if r.get('cover-art-archive',{}).get('back')]
 if not art_candidates:art_candidates=[r for r in vinyl if r.get('cover-art-archive',{}).get('front')]
 for release in art_candidates:
  url='https://coverartarchive.org/release/'+release['id'];report['attempts'].append({'method':'CAA vinyl image manifest','url':url})
  images=fetch(url)
  if not images:continue
  fronts=[im for im in images.get('images',[]) if im.get('front')]
  backs=[im for im in images.get('images',[]) if im.get('back')]
  # Scan one useful record-label image too. No CD trays/labels enter this pool.
  labels=[im for im in images.get('images',[]) if 'Medium' in im.get('types',[]) or 'Label' in im.get('types',[])]
  got={}
  for face,choices in [('front',fronts),('back',backs),('label',labels)]:
   for im in choices[:2]:
    src=im.get('thumbnails',{}).get('1200') or im.get('thumbnails',{}).get('500') or im['image']
    value=download(src.replace('http:','https:'),rid,face)
    if value and 'error' not in value:
     got[face]={**value,'types':im.get('types'),'archiveImageId':im.get('id'),'comment':im.get('comment','')};break
  if got:
   report['artwork']=got;report['artRelease']={'id':release['id'],'url':'https://musicbrainz.org/release/'+release['id'],'country':release.get('country'),'date':release.get('date'),'formats':[m.get('format') for m in release.get('media',[])],'catalogNumbers':[x.get('catalog-number') for x in release.get('label-info',[])],'catalogueMatch':catmatch(release,row),'labelNames':[(x.get('label') or {}).get('name') for x in release.get('label-info',[])]};report['sources'].append(report['artRelease']['url']);break
 report['reason']='Vinyl artwork candidates acquired; visual QA pending.' if report['artwork'] else ('No usable artwork among catalogued vinyl releases; alternate primary-source search still required.' if vinyl else 'No vinyl release catalogued in selected release group; alternate sources needed.')
 report['complete']=True;PROPOSALS[rid]=report;save();print('ART',rid,','.join(report['artwork']),len(vinyl),'LPs',report.get('artRelease',{}).get('country'),flush=True)
print('ENUMERATION COMPLETE',len(PROPOSALS),'front',sum('front' in x.get('artwork',{}) for x in PROPOSALS.values()),'back',sum('back' in x.get('artwork',{}) for x in PROPOSALS.values()),'labels',sum('label' in x.get('artwork',{}) for x in PROPOSALS.values()),flush=True)
