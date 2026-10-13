import json, urllib.request,urllib.parse, pathlib,unicodedata,re,time,concurrent.futures
P=pathlib.Path('site/research/left.json'); rows=json.loads(P.read_text()); candidates={}
def norm(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
 s=re.sub(r'\([^)]*\)|\[[^]]*\]','',s)
 return re.sub('[^a-z0-9]','',s.replace('the ','').replace('volume','vol'))
def get(r):
 if r['confidence']=='unknown':return r['id'],[]
 url='https://itunes.apple.com/search?'+urllib.parse.urlencode({'term':r['artist']+' '+r['title'],'entity':'album','limit':20,'country':'US'})
 try:
  with urllib.request.urlopen(url,timeout=30) as f:res=json.load(f)['results']
  time.sleep(.35)
  return r['id'],res
 except Exception as e:return r['id'],{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for id,results in ex.map(get,rows):candidates[id]=results
pathlib.Path('site/research/left_apple_candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2))
accepted=[];unmatched=[]
for r in rows:
 if r['confidence']=='unknown': continue
 cn=candidates[r['id']]; choices=[]
 if isinstance(cn,list):
  for c in cn:
   rt,ct=norm(r['title']),norm(c.get('collectionName',''))
   ra,ca=norm(r['artist']),norm(c.get('artistName',''))
   artist_ok=ra==ca or ra in ca or ca in ra or (ra=='shakti' and 'shakti' in ca) or (ra=='thejimihedrixexperience' and ca=='jimihendrix')
   artist_ok=artist_ok or (ra=='jimihendrixexperience' and ca=='jimihendrix') or (ra=='mothersofinvention' and ca=='frankzappa') or (ra=='electriclightorchestra' and ca=='electriclightorchestra') or (ra=='bri aneno')
   title_ok=rt==ct
   if artist_ok and title_ok:
    choices.append(c)
  if choices:
   c=choices[0];r['coverUrl']=c['artworkUrl100'].replace('100x100bb','600x600bb');r['coverPath']='/assets/covers/'+r['id']+'.jpg'
   r['sources'].append(c['collectionViewUrl'].split('?')[0]);r['artworkEdition']='Apple Music digital artwork; exact photographed vinyl pressing not verified.'
   r['digitalReleaseDate']=c.get('releaseDate');r['digitalCopyright']=c.get('copyright')
   accepted.append((r,c))
  else:unmatched.append(r)
 else:unmatched.append(r)
def download(pair):
 r,c=pair
 try:
  with urllib.request.urlopen(r['coverUrl'],timeout=30) as f:data=f.read()
  pathlib.Path('site/dist'+r['coverPath']).write_bytes(data)
  return r['id'],'ok'
 except Exception as e:r['coverPath']=None;return r['id'],str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
 result=list(ex.map(download,accepted))
P.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('ARTWORK ACCEPTED',len(accepted),'downloads',sum(x[1]=='ok' for x in result))
for r in unmatched:
 print(r['id'],r['artist'],'—',r['title'])
 for c in (candidates[r['id']] if isinstance(candidates[r['id']],list) else [] )[:3]: print('  ',c['artistName'],'—',c['collectionName'], c['collectionId'])
