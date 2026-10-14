import urllib.request, pathlib, re, base64, json, time, threading, concurrent.futures, sys, html as htm
BASE=pathlib.Path(__file__).resolve().parent
_lock=threading.Lock();_last=0

def fetch(url, stem=None):
 global _last
 stem=stem or re.search(r'/(album|track|artist)/([A-Za-z0-9]{22})',url).group(2)
 path=BASE/f'{stem}.metadata.json'
 if path.exists():
  cached=json.loads(path.read_text())
  if "albumLinks" in cached:return cached
 for attempt in range(3):
  try:
   with _lock:
    delay=1.0-(time.monotonic()-_last)
    if delay>0:time.sleep(delay)
    _last=time.monotonic()
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept-Language':'en-CA,en;q=0.9'})
   response=urllib.request.urlopen(req,timeout=30);html=response.read().decode('utf8')
   title=re.search(r'<title>(.*?)</title>',html,re.S)
   state_match=re.search(r'<script id="initialState" type="text/plain">(.*?)</script>',html,re.S)
   next_match=re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',html,re.S)
   state=json.loads(base64.b64decode(state_match.group(1))) if state_match else json.loads(next_match.group(1)) if next_match else None
   title=title.group(1) if title else None
   meta={'url':url,'resolvedUrl':response.url,'fetchedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'pageTitle':title,'initialState':state,'structuredData':[json.loads(m.group(1)) for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)],'htmlBytes':len(html.encode()),'albumLinks':[{'id':m.group(1),'label':htm.unescape(re.sub('<[^>]+>',' ',m.group(2))).strip()} for m in re.finditer(r'<a[^>]*href="(?:https://open.spotify.com)?(?:/intl-[a-z]+)?/album/([A-Za-z0-9]{22})[^"]*"[^>]*>(.*?)</a>',html,re.S)]}
   path.write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
   return meta
  except Exception as e:
   if attempt==2:raise
   time.sleep([2,5][attempt])

def summaries(meta):
 state=meta.get('initialState') or {};items=state.get('entities',{}).get('items',{})
 out=[]
 for uri,value in items.items():
  if value.get('__typename')=='Track':
   album=value.get('albumOfTrack',{});out.append({'kind':'track-album','uri':album.get('uri'),'name':album.get('name'),'date':album.get('date'),'count':album.get('tracks',{}).get('totalCount'),'artists':artists(value)})
  if value.get('__typename')=='Album':out.append({'kind':'album','uri':uri,'name':value.get('name'),'date':value.get('date'),'count':value.get('tracks',{}).get('totalCount'),'artists':artists(value)})
  if value.get('__typename')=='Artist':
   def walk(v):
    if isinstance(v,dict):
     if v.get('__typename')=='Album' and v.get('uri'):out.append({'kind':'related-album','uri':v.get('uri'),'name':v.get('name'),'date':v.get('date')})
     for x in v.values():walk(x)
    if isinstance(v,list):
     for x in v:walk(x)
   walk(value)
 return out

def artists(v):
 return [a.get('profile',{}).get('name') or a.get('name') for a in v.get('artists',{}).get('items',[])]

if __name__=='__main__':
 for url in sys.argv[1:]:
  try:print(json.dumps({'url':url,'summaries':summaries(fetch(url))},ensure_ascii=False))
  except Exception as e:print(json.dumps({'url':url,'error':str(e)}))
