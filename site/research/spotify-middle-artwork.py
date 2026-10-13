import json,csv,urllib.parse,urllib.request,concurrent.futures
from pathlib import Path
p=Path('site/research/middle.json');rows=json.loads(p.read_text());byid={x['id']:x for x in rows}
tsv=list(csv.reader(open('site/research/middle-spotify.tsv'),delimiter='\t'))
def work(v):
 id,sid,year,note=v;url='https://open.spotify.com/album/'+sid
 try:
  raw=json.load(urllib.request.urlopen('https://open.spotify.com/oembed?'+urllib.parse.urlencode({'url':url}),timeout=20))
  src=raw.get('thumbnail_url');out=None
  if src:
   out=Path('site/dist/assets/covers')/(id+'.jpg');out.write_bytes(urllib.request.urlopen(src,timeout=20).read())
  return id,sid,int(year),note,url,src,('/assets/covers/'+out.name if out else None),raw.get('title')
 except Exception as e:print('ERROR',id,str(e),flush=True);return id,sid,int(year),note,url,None,None,None
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 data=list(pool.map(work,tsv))
for id,sid,year,note,url,src,out,title in data:
 row=byid[id];row['spotifyId']=sid;row['year']=year;row['notes']+=(' '+note if note not in row['notes'] else '');row['sources']=list(dict.fromkeys(row['sources']+[url]))
 if out and not row['cover']:row['cover']=out;row['coverUrl']=src
 print(id,sid,title,flush=True)
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
