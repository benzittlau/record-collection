from pathlib import Path
import json,re,urllib.request,time,concurrent.futures,html,sys
E=Path(__file__).resolve().parent
mapping=json.loads((E/'candidates.json').read_text())
def get_album(item):
 rid,sid=item;path=E/(sid+'.json')
 if path.exists():return json.loads(path.read_text())
 out={'id':sid,'albumUrl':'https://open.spotify.com/album/'+sid,'embedUrl':'https://open.spotify.com/embed/album/'+sid,'fetchedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 try:
  request=urllib.request.Request(out['embedUrl'],headers={'User-Agent':'Mozilla/5.0 FamilyRecordCollectionResearch/2.0'})
  data=urllib.request.urlopen(request,timeout=25).read().decode();m=re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',data)
  entity=json.loads(m.group(1))['props']['pageProps']['state']['data']['entity'];out['embedEntity']=entity;out['title']=entity.get('title') or entity.get('name');out['artists']=list(dict.fromkeys([entity.get('subtitle','')]+[x.get('subtitle','') for x in entity.get('trackList',[])]));out['trackCount']=len(entity.get('trackList',[]));out['releaseDate']=entity.get('releaseDate');out['pageTitle']=re.search(r'<title[^>]*>(.*?)</title>',data).group(1)
 except Exception as err:out['error']=str(err)
 # Preserve public page initialState and JSON-LD if available, excluding public session tokens.
 try:
  u=urllib.request.Request(out['albumUrl'],headers={'User-Agent':'Mozilla/5.0'})
  data=urllib.request.urlopen(u,timeout=25).read().decode();title=re.search(r'<title[^>]*>(.*?)</title>',data);out['pageTitle']=html.unescape(title.group(1)) if title else out.get('pageTitle');out['jsonLd']=[]
  for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',data):
   try:out['jsonLd'].append(json.loads(m.group(1)))
   except Exception:pass
  m=re.search(r'<script[^>]*id="initialState"[^>]*>(.*?)</script>',data)
  if m:
   import base64
   try:out['publicInitialState']=json.loads(base64.b64decode(m.group(1)))
   except Exception:out['initialStateDecodeError']=True
  def scrub(x):
   if isinstance(x,dict):return {k:('[redacted session metadata]' if any(t in k.lower() for t in ['token','secret']) else scrub(v)) for k,v in x.items()}
   if isinstance(x,list):return [scrub(v) for v in x]
   return x
  out=scrub(out)
 except Exception as err:out['albumPageError']=str(err)
 path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(rid,sid,out.get('title'),out.get('trackCount'),out.get('error',''),flush=True);return out
work=[(rid,sid) for rid,v in mapping.items() for sid in v.get('candidates',[])]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(get_album,work))
