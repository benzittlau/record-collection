import json,urllib.request,concurrent.futures,re,base64
from pathlib import Path
p=Path('site/research/middle.json');rows=json.loads(p.read_text())
def api(url):return json.load(urllib.request.urlopen(url,timeout=15))
def work(row):
 # Upgrade Spotify fronts to the primary site's documented 640px image URL.
 if row.get('spotifyId'):
  try:
   raw=urllib.request.urlopen('https://open.spotify.com/album/'+row['spotifyId'],timeout=15).read().decode()
   m=re.search(r'<script id="initialState"[^>]*>(.*?)</script>',raw)
   if m:
    d=json.loads(base64.b64decode(m.group(1)));a=d['entities']['items']['spotify:album:'+row['spotifyId']]
    imgs=a.get('coverArt',{}).get('sources',[])
    img=max(imgs,key=lambda x:x.get('width',0)) if imgs else None
    if img and img.get('width',0)>=600:
     out=Path('site/dist/assets/covers')/(row['id']+'.jpg');out.write_bytes(urllib.request.urlopen(img['url'],timeout=15).read());row['cover']='/assets/covers/'+out.name;row['coverUrl']=img['url']
  except Exception as e:print('SPOTIFY ART FAIL',row['id'],str(e),flush=True)
 if not row.get('mbid'):return
 try:
  meta=api('https://coverartarchive.org/release-group/'+row['mbid'])
  # Retry fronts missing from a previous transient archive failure.
  if not row['cover']:
   front=next((x for x in meta.get('images',[]) if x.get('front')),None)
   if front:
    src=front.get('thumbnails',{}).get('500') or front['image'];out=Path('site/dist/assets/covers')/(row['id']+'.jpg');out.write_bytes(urllib.request.urlopen(src,timeout=15).read());row['coverUrl']=src;row['cover']='/assets/covers/'+out.name
  back=next((x for x in meta.get('images',[]) if x.get('back')),None)
  if back:
   src=back.get('thumbnails',{}).get('500') or back['image'];out=Path('site/dist/assets/covers')/(row['id']+'-back.jpg');out.write_bytes(urllib.request.urlopen(src,timeout=15).read())
   row['backUrl']='/assets/covers/'+out.name;row['backSourceUrl']=src
   row['sources']=list(dict.fromkeys(row['sources']+[meta.get('release') or 'https://coverartarchive.org/release-group/'+row['mbid']]))
   row['notes']+=' Back artwork is an archive edition reference; this physical pressing has not been verified.'
   print('BACK',row['id'],flush=True)
 except Exception as e:print('ARCHIVE FAIL',row['id'],str(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(work,rows))
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('FINAL COVERS',sum(bool(x['cover']) for x in rows),'BACKS',sum(bool(x['backUrl']) for x in rows),'SPOTIFY',sum(bool(x['spotifyId']) for x in rows),flush=True)
