import urllib.request,re,json,base64,unicodedata,concurrent.futures
from pathlib import Path
rows=json.load(open('site/research/middle.json'))
def norm(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('&','and')
 s=re.sub(r'\([^)]*\)|\[[^]]*\]','',s);s=re.sub(r'[^a-z0-9]','',s);return s.removeprefix('the')
seeds=[x for x in rows if x['spotifyId']]
seeds += [{'artist':'Dave Mason','spotifyId':'6Cs3GnzIMVOKXWBbGXQY9f'},{'artist':'John Denver','spotifyId':'0T1OPbbHzWErKBMdZrbhCQ'},{'artist':'Raffi','spotifyId':'77i45qo8Ob4gzFvynj5pnG'},{'artist':'Sting','spotifyId':'4ecNI9MO1rG2p5Q9xUxQ4X'},{'artist':'Cyndi Lauper','spotifyId':'1FvdZ1oizXwF9bxogujoF0'}]
seen=set();seeds=[x for x in seeds if not (x['artist'] in seen or seen.add(x['artist']))]
def read(seed):
 url='https://open.spotify.com/album/'+seed['spotifyId']
 try:
  raw=urllib.request.urlopen(url,timeout=20).read().decode();d=json.loads(base64.b64decode(re.search(r'<script id="initialState"[^>]*>(.*?)</script>',raw).group(1)))
  main=d['entities']['items']['spotify:album:'+seed['spotifyId']]
  arts=[x.get('profile',{}).get('name','') for x in main.get('artists',{}).get('items',[])]
  albums=[main]
  for item in main.get('moreAlbumsByArtist',{}).get('items',[]):
   albums+=item.get('discography',{}).get('popularReleasesAlbums',{}).get('items',[])
  return {'seed':seed,'source':url,'artists':arts,'albums':albums}
 except Exception as e:return {'seed':seed,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:data=list(pool.map(read,seeds))
Path('site/research/middle-spotify-discovery.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
new=[]
for entry in data:
 artist=entry['seed']['artist']
 for row in rows:
  if row['artist']!=artist or row['spotifyId'] or row['confidence']=='unknown':continue
  title=row['title'];tn=norm(title)
  if row['id']=='lower-middle-26':tn='beatles'
  match=next((x for x in entry.get('albums',[]) if norm(x.get('name',''))==tn),None)
  if match:
   sid=match['id'];year=match.get('date',{}).get('year') or ''
   note='Verified Spotify digital edition '+match['name']+'; physical pressing unverified.'
   new.append([row['id'],sid,str(year),note]);print(new[-1],flush=True)
with open('site/research/middle-spotify-discovered.tsv','w') as f:
 for x in new:f.write('\t'.join(x)+'\n')
