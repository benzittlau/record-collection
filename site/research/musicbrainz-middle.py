import json,re,unicodedata,urllib.request,urllib.parse,time,concurrent.futures
from pathlib import Path
p=Path('site/research/middle.json');rows=json.loads(p.read_text())
for row in rows:
 if row['id']=='upper-middle-09':row['title']='It Looks Like Snow'
 if row['id']=='upper-middle-58':row.update(title='Unidentified album',artist='Unknown',notes='Partial wording reads LANDSCRAPE / FROM THE EARTH / [OTHER...] on a grey spine; identity uncertain.')
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
def norm(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('&','and')
 s=re.sub(r'\([^)]*\)|\[[^]]*\]','',s)
 s=re.sub(r'[^a-z0-9]','',s)
 return s.removeprefix('the')
def api(url):return json.load(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FamilyRecordCollection/1.0 (personal album identification)'}),timeout=20))
aliases={'Martha and the Muffins / M+M':['Martha and the Muffins','M+M'],'J.S.D. Band':['JSD Band'],'Nitty Gritty Dirt Band':['Nitty Gritty Dirt Band'],'The Sensational Alex Harvey Band':['The Sensational Alex Harvey Band','The Alex Harvey Band'],'Daryl Hall & John Oates':['Daryl Hall & John Oates','Hall and Oates'],'Original Soundtrack':['Liza Minnelli','Various Artists'],'Stephen Stills / Manassas':['Manassas'],'Bim':['Roy Forbes','Bim'],'k.d. lang and the Reclines':['k.d. lang and the Reclines','k.d. lang'],'Jerry Goodman & Jan Hammer':['Jerry Goodman & Jan Hammer','Jan Hammer & Jerry Goodman']}
proposals=[]
for row in rows:
 if row['confidence']=='unknown' or row['artist']=='Unknown' or row['cover'] is not None:continue
 if row['artist'].count('/')>0 and row['artist'] not in aliases:continue
 query='releasegroup:"'+row['title'].replace('"','')+'" AND artist:"'+aliases.get(row['artist'],[row['artist']])[0]+'"'
 url='https://musicbrainz.org/ws/2/release-group?'+urllib.parse.urlencode({'query':query,'fmt':'json','limit':5})
 for attempt in range(3):
  try:
   data=api(url);break
  except Exception as e:
   data={'error':str(e)};time.sleep(1.1)
 time.sleep(1.1)
 groups=data.get('release-groups',[])
 titles=[row['title']]
 if row['id']=='lower-middle-26':titles=['The Beatles']
 hit=None
 for group in groups:
  artists=''.join(x.get('name',x.get('artist',{}).get('name',''))+x.get('joinphrase','') for x in group.get('artist-credit',[]) if isinstance(x,dict))
  artistNorm=norm(artists)
  if norm(group['title']) not in [norm(t) for t in titles]:continue
  if artistNorm not in [norm(a) for a in aliases.get(row['artist'],[row['artist']])]:continue
  hit=group;break
 proposals.append({'id':row['id'],'url':url,'data':data,'chosen':hit['id'] if hit else None})
 if hit:
  row['sources']=list(dict.fromkeys(row['sources']+['https://musicbrainz.org/release-group/'+hit['id']]))
  dt=hit.get('first-release-date','');row['year']=int(dt[:4]) if len(dt)>=4 and dt[:4].isdigit() else row['year']
  row['mbid']=hit['id']
  print('FOUND',row['id'],row['title'],hit['id'],flush=True)
 else:print('NO MB',row['id'],row['title'],data.get('error',''),flush=True)
 # Save every metadata result so the working catalogue stays usable.
 p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
Path('site/research/middle-musicbrainz-evidence.json').write_text(json.dumps(proposals,ensure_ascii=False,indent=2))
def cover(row):
 if not row.get('mbid') or row['cover']:return
 try:
  meta=api('https://coverartarchive.org/release-group/'+row['mbid'])
  front=next((x for x in meta.get('images',[]) if x.get('front')),None)
  if not front:return
  src=front.get('thumbnails',{}).get('500') or front.get('image')
  file=Path('site/dist/assets/covers')/(row['id']+'.jpg');file.write_bytes(urllib.request.urlopen(src,timeout=20).read())
  row['coverUrl']=src;row['cover']='/assets/covers/'+file.name
  row['sources'].append('https://coverartarchive.org/release-group/'+row['mbid'])
  print('ART',row['id'],flush=True)
 except Exception as e:print('ART FAIL',row['id'],str(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(cover,rows))
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('TOTAL COVERS',sum(bool(x['cover']) for x in rows),flush=True)
