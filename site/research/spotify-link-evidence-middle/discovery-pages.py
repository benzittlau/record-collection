from pathlib import Path
import json,urllib.request,base64,re,time,unicodedata
ROOT=Path(__file__).resolve().parents[3];E=Path(__file__).resolve().parent;rows=[r for r in json.loads((ROOT/'site/research/middle.json').read_text()) if r['confidence']=='confirmed' and not r.get('spotifyId') and r.get('kind')!='book'];mapping=json.loads((E/'candidates.json').read_text())
pages={'martha':'https://open.spotify.com/artist/5nWbdgU2jcFSbrPV7EAoLK','artie':'https://open.spotify.com/artist/1FHsJPrgmngvUwRjI09SQM','manhattan':'https://open.spotify.com/artist/2dogRElUKV20C2khRHqjRc','hot-tuna':'https://open.spotify.com/artist/5tOrTQaBRD5yPHqbEwsRn7'}
if (E/'extra-discovery-pages.json').exists():pages.update(json.loads((E/'extra-discovery-pages.json').read_text()))
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
def albums(obj):
 if isinstance(obj,dict):
  if obj.get('name') and (obj.get('__typename')=='Album' or str(obj.get('uri','')).startswith('spotify:album:')):
   sid=obj.get('id') or str(obj.get('uri','')).split(':')[-1]
   if len(sid)==22:yield {**obj,'id':sid}
  for x in obj.values():yield from albums(x)
 elif isinstance(obj,list):
  for x in obj:yield from albums(x)
for key,url in pages.items():
 p=E/('discovery-'+key+'.json')
 try:
  if p.exists():d=json.loads(p.read_text())
  else:
   text=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read().decode();m=re.search(r'<script[^>]*id="initialState"[^>]*>(.*?)</script>',text);state=json.loads(base64.b64decode(m.group(1))) if m else {};d={'url':url,'pageTitle':re.search(r'<title[^>]*>(.*?)</title>',text).group(1),'albums':list(albums(state))};p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
  for r in rows:
   wanted=norm(r['title'])
   for album in d.get('albums',[]):
    name=norm(album['name'])
    if wanted==name or len(wanted)>5 and name.startswith(wanted):
     sid=album['id'];m=mapping.setdefault(r['id'],{'candidates':[],'queries':[]})
     if len(sid)==22 and sid not in m['candidates']:m['candidates'].append(sid);m.setdefault('discoveryEvidence',[]).append({'sourceFile':str(p.relative_to(ROOT)),'url':url,'name':album['name']});print(r['id'],sid,album['name'],flush=True)
 except Exception as err:print(key,'ERROR',str(err),flush=True)
 time.sleep(.5)
(E/'candidates.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
