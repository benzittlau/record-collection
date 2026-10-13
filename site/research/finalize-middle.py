import json,urllib.request,concurrent.futures
from pathlib import Path
p=Path('site/research/middle.json');r=json.loads(p.read_text());by={x['id']:x for x in r}
fix={'upper-middle-37':('80df0f1b-4ce7-348a-aa1b-0d31ebff111a',1973),'upper-middle-53':('38ebbc75-c6e0-3576-bd42-802b2e4850c6',1975),'lower-middle-19':('bb13cb45-254c-3a61-89a5-15d22a97e6d6',1980),'lower-middle-22':('8c2a0eae-1359-3577-9127-e3d862acc2a2',1975)}
for id,(mb,yr) in fix.items():
 x=by[id];old=x.get('mbid');x['sources']=[s for s in x['sources'] if old not in s];x['mbid']=mb;x['year']=yr;x['sources'].append('https://musicbrainz.org/release-group/'+mb)
 # Young Americans already has exact Spotify album artwork; others require replacement.
 if id!='lower-middle-22':x['cover']=None;x['coverUrl']=None
 x['backUrl']=None;x.pop('backSourceUrl',None)
by['lower-middle-47']['cover']=None;by['lower-middle-47']['coverUrl']=None;by['lower-middle-47']['backUrl']=None;by['lower-middle-47']['year']=None;by['lower-middle-47']['notes']+=' Archive cover is titled Poco; artwork withheld pending confirmation of the original Polka Dot Pony LP.'
by['lower-middle-50']['year']=None
# These records are album-level catalogue matches; exact LP pressing remains unverified.
extras=[('upper-middle-02','release','45a06229-ebcb-4c81-9c50-64cec2c1d8d4'),('lower-middle-58','release','be4af83f-41f9-4eb5-8125-04aa74bf2f7d'),('lower-middle-63','release','b966b0ad-31b0-4144-92f2-f7e7aa110546')]
tasks=[(id,'release-group',mb) for id,(mb,yr) in fix.items() if id!='lower-middle-22']+extras
# Retry each primary Archive front only once on a transient failure; do not block delivery.
def art(task):
 id,kind,mb=task;x=by[id]
 try:
  meta=json.load(urllib.request.urlopen('https://coverartarchive.org/'+kind+'/'+mb,timeout=12))
  fr=next((v for v in meta.get('images',[]) if v.get('front')),None)
  if fr:
   src=fr.get('thumbnails',{}).get('500') or fr['image'];out=Path('site/dist/assets/covers')/(id+'.jpg');out.write_bytes(urllib.request.urlopen(src,timeout=12).read());x['coverUrl']=src;x['cover']='/assets/covers/'+out.name;x['sources'].append('https://coverartarchive.org/'+kind+'/'+mb);print('FIXED ART',id,flush=True)
 except Exception as e:print('NO ART',id,str(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(art,tasks))
# Never use a single release year when the photographed spine says album.
for x in r:
 if x['year'] and not (1900<=x['year']<=2026):x['year']=None
 x['sources']=list(dict.fromkeys(x['sources']))
 x.pop('mbid',None)
p.write_text(json.dumps(r,ensure_ascii=False,indent=2))
print('FINAL',len(r),'covers',sum(bool(x['cover']) for x in r),'backs',sum(bool(x['backUrl']) for x in r),'spotify',sum(bool(x['spotifyId']) for x in r),flush=True)
