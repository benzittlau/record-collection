"""Alternate vinyl artwork leads via public Discogs metadata linked by MusicBrainz.
Only proposes image candidates; all acquired images require visual front/back QA.
"""
from pathlib import Path
from PIL import Image
import json,runpy,urllib.request,urllib.parse,unicodedata,re,time,io,sys
ROOT=Path(__file__).resolve().parents[2];R=ROOT/'site/research';A=ROOT/'site/dist/assets/covers'
mb=runpy.run_path(str(R/'deep-left-musicbrainz.py'))['get_json']
dg=runpy.run_path(str(R/'deep-middle-discogs.py'))['get_json']
E=R/'deep-left-discogs-evidence.json';P=R/'deep-left-discogs-proposals.json'
cache=json.loads(E.read_text()) if E.exists() else {};reports=json.loads(P.read_text()) if P.exists() else {}
def norm(v):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower())
def save():E.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n');P.write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
def fetch(url):
 if cache.get(url,{}).get('ok'):return cache[url]['data']
 try:data=(dg if 'api.discogs.com' in url else mb)(url);cache[url]={'ok':True,'data':data,'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())};return data
 except Exception as e:cache[url]={'ok':False,'error':str(e),'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())};return None
def download(url,rid,reid,index):
 out=A/f'{rid}-discogs-{reid}-{index:02d}.jpg'
 if out.exists():
  with Image.open(out) as im:return {'path':'/assets/covers/'+out.name,'sourceUrl':url,'localSize':list(im.size)}
 for retry in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'FamilyRecordCollectionResearch/2.0','Accept':'image/*'})
   with urllib.request.urlopen(req,timeout=25) as response:raw=response.read()
   im=Image.open(io.BytesIO(raw));im.load();original=list(im.size)
   if min(im.size)<180:return None
   im=im.convert('RGB');im.thumbnail((1600,1600));im.save(out,quality=94)
   with Image.open(out) as check:check.verify()
   return {'path':'/assets/covers/'+out.name,'sourceUrl':url,'originalSize':original,'localSize':list(im.size)}
  except Exception as e:
   if retry==2:return {'error':str(e),'sourceUrl':url}
   time.sleep([2,5][retry])
rows=json.loads((R/'left.json').read_text());caa=json.loads((R/'deep-left-art-proposals.json').read_text());mbcache=json.loads((R/'deep-left-api-cache.json').read_text())
for row in rows:
 rid=row['id'];scan=caa.get(rid,{})
 if not scan.get('complete'):continue
 if row['title'] in ['Unknown title','Unidentified sleeve']:continue
 if 'back' in scan.get('artwork',{}):continue
 if reports.get(rid,{}).get('complete'):continue
 report={'id':rid,'artist':row['artist'],'title':row['title'],'attempts':[],'candidates':[],'complete':False}
 rg=scan.get('releaseGroup')
 # Re-check exact groups against album type/original year; single/live title collisions
 # must never masquerade as the pictured original album.
 groups=[]
 q='releasegroup:"'+row['title'].replace('"','')+'" AND artist:"'+row['artist'].replace('"','')+'"'
 query_url='https://musicbrainz.org/ws/2/release-group?'+urllib.parse.urlencode({'query':q,'limit':20,'fmt':'json'})
 known=mbcache.get(query_url,{}).get('data') or fetch(query_url)
 if known:groups=[g for g in known.get('release-groups',[]) if norm(g.get('title'))==norm(row['title'])]
 if groups:
  groups.sort(key=lambda g:100*(g.get('primary-type')=='Album')+100*(str(g.get('first-release-date','')).startswith(str(row.get('year'))) and bool(row.get('year')))-60*('Live' in g.get('secondary-types',[]))+min(g.get('count',0),30),reverse=True);rg=groups[0]['id']
 if not rg:
  report.update(complete=True,reason='No verified release group; exact catalogue/artist alternate research still required.');reports[rid]=report;save();continue
 report['releaseGroup']=rg
 url='https://musicbrainz.org/ws/2/release-group/'+rg+'?inc=url-rels&fmt=json';meta=fetch(url);report['attempts'].append(url)
 relations=meta.get('relations',[]) if meta else []
 urls=[r.get('url',{}).get('resource','') for r in relations if 'discogs.com/' in r.get('url',{}).get('resource','')]
 release_ids=[];master_ids=[]
 for url in urls:
  m=re.search(r'/master/(?:view/)?(\d+)',url)
  if m:master_ids.append(m.group(1))
  m=re.search(r'/release/(?:view/)?(\d+)',url)
  if m:release_ids.append(m.group(1))
 for master in master_ids[:1]:
  master_url='https://api.discogs.com/masters/'+master;md=fetch(master_url);report['attempts'].append(master_url)
  if md:report['master']={k:md.get(k) for k in ['id','title','year','artists','main_release','uri']}
  versions=[]
  # Original editions first. Paging every LP lead in a moderate-size master is
  # reasonable; very large masters cap at300 entries before alternate-country search.
  for page in range(1,4):
   u=f'https://api.discogs.com/masters/{master}/versions?per_page=100&page={page}&sort=released&sort_order=asc';d=fetch(u);report['attempts'].append(u)
   if not d:break
   versions+=d.get('versions',[])
   if page>=d.get('pagination',{}).get('pages',1):break
  vinyl=[v for v in versions if 'LP' in v.get('format','') or 'Vinyl' in v.get('format','')]
  spine=norm(row['spineText']);yr=str(row.get('year') or '')
  vinyl.sort(key=lambda v:100*(len(norm(v.get('catno')))>4 and norm(v.get('catno')) in spine)+35*(v.get('country')=='Canada')+15*(str(v.get('released','')).startswith(yr) and bool(yr))+5*(v.get('country') in ['US','UK']),reverse=True)
  report['vinylVersions']=[{k:v.get(k) for k in ['id','title','format','country','catno','label','released']} for v in vinyl]
  release_ids += [str(v['id']) for v in vinyl[:4]]
  if not release_ids and md and md.get('main_release'):release_ids.append(str(md['main_release']))
 # Try a few genuinely LP editions; do not substitute trays/compact discs.
 for reid in list(dict.fromkeys(release_ids))[:4]:
  u='https://api.discogs.com/releases/'+reid;d=fetch(u);report['attempts'].append(u)
  if not d:continue
  if not any(f.get('name')=='Vinyl' for f in d.get('formats',[])):continue
  candidate={'releaseId':int(reid),'releaseUrl':d.get('uri') or 'https://www.discogs.com/release/'+reid,'title':d.get('title'),'artist':' / '.join(a.get('name','') for a in d.get('artists',[])),'country':d.get('country'),'year':d.get('year'),'formats':d.get('formats'),'labels':d.get('labels'),'notes':d.get('notes',''),'images':[]}
  for i,im in enumerate(d.get('images',[])[:6],1):
   value=download(im.get('uri') or im.get('uri150'),rid,reid,i)
   if value and 'error' not in value:candidate['images'].append({**value,'discogsType':im.get('type'),'index':i})
  if candidate['images']:
   report['candidates'].append(candidate)
   if len(candidate['images'])>=2:break
 report['complete']=True;report['reason']='LP image candidates need visual face/album QA.' if report['candidates'] else 'No usable scans found through linked Discogs LP releases after catalogue/version search.';reports[rid]=report;save();print('DISCOGS',rid,sum(len(v['images']) for v in report['candidates']),'scans',flush=True)
print('DISCOGS PASS COMPLETE',len(reports),'records',flush=True)
