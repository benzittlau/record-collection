import urllib.request, urllib.parse, json, re, time, unicodedata, concurrent.futures
from pathlib import Path
p=Path('site/research/middle.json'); rows=json.loads(p.read_text())
def norm(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
 s=re.sub(r'\([^)]*\)|\[[^]]*\]','',s)
 s=s.replace('&','and')
 s=re.sub(r'[^a-z0-9]','',s)
 return s
aliases={'Martha and the Muffins / M+M':['Martha and the Muffins','Martha And The Muffins'],'J.S.D. Band':['JSD Band'],'Nitty Gritty Dirt Band':['The Nitty Gritty Dirt Band'],'The Sensational Alex Harvey Band':['Sensational Alex Harvey Band','The Sensational Alex Harvey Band'],'Daryl Hall & John Oates':['Daryl Hall and John Oates','Hall and Oates'],'Original Soundtrack':['Liza Minnelli','Various Artists'],'Stephen Stills / Manassas':['Manassas'],'Bim':['Roy Forbes','Bim']}
def get(row):
 if row['confidence']=='unknown' or row['artist']=='Unknown':return None
 try:
  query=row['artist']+' '+row['title']
  if row['artist']=='Original Soundtrack':query=row['title']
  url='https://itunes.apple.com/search?'+urllib.parse.urlencode({'term':query,'entity':'album','limit':20,'country':'US'})
  data=json.load(urllib.request.urlopen(url,timeout=20))
  opts=[]
  titles=[row['title']]
  if row['title']=='The Beatles (The White Album)': titles=['The Beatles','The Beatles (The White Album)']
  if row['title']=='Scary Monsters':titles=['Scary Monsters','Scary Monsters (And Super Creeps)']
  if row['title']=='Low':titles=['Low']
  if row['title']=='Stop Making Sense':titles=['Stop Making Sense']
  if row['title']=='Trance and Dance':titles=['Trance and Dance']
  an=[norm(a) for a in aliases.get(row['artist'],[row['artist']])]
  tn=[norm(t) for t in titles]
  for v in data.get('results',[]):
   title=v.get('collectionName','');artist=v.get('artistName','')
   exact=norm(title) in tn and norm(artist) in an
   opts.append({'collectionName':title,'artistName':artist,'url':v.get('collectionViewUrl'),'artwork':v.get('artworkUrl100'),'year':v.get('releaseDate','')[:4],'exact':exact})
  return {'id':row['id'],'search':url,'options':opts}
 except Exception as e:return {'id':row['id'],'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 res=list(pool.map(get,rows))
Path('site/research/middle-artwork-proposals.json').write_text(json.dumps([x for x in res if x],ensure_ascii=False,indent=2))
byid={x['id']:x for x in res if x}
matched=0
for row in rows:
 result=byid.get(row['id'],{})
 opts=result.get('options',[])
 hit=next((x for x in opts if x['exact']),None)
 if not hit:continue
 # The artwork identifies the album, not this physical pressing.
 src=hit['artwork']
 if not src:continue
 src=re.sub(r'/\d+x\d+bb\.', '/600x600bb.',src)
 try:
  out=Path('site/dist/assets/covers')/(row['id']+'.jpg')
  out.write_bytes(urllib.request.urlopen(src,timeout=20).read())
  row['coverUrl']=src;row['cover']='/assets/covers/'+out.name
  row['sources']=list(dict.fromkeys(row['sources']+[hit['url']]))
  row['notes']+=' Front artwork is an album-level digital reference; photographed vinyl pressing artwork has not been verified.'
  matched+=1
 except Exception as e:print('ART ERROR',row['id'],str(e),flush=True)
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('DOWNLOADED',matched,flush=True)
print('UNMATCHED',[(x['id'],x['artist'],x['title']) for x in rows if x['confidence']!='unknown' and x['cover'] is None],flush=True)
