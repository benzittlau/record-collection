import json, urllib.request,urllib.parse, pathlib,unicodedata,re,time,concurrent.futures
P=pathlib.Path('site/research/left.json'); rows=json.loads(P.read_text()); candidates={}
def norm(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower();s=re.sub(r'\([^)]*\)|\[[^]]*\]','',s)
 return re.sub('[^a-z0-9]','',s.replace('the ','').replace('volume','vol').replace('and','').replace('&',''))
def get(r):
 if r['confidence']=='unknown' or r.get('coverPath'):return r['id'],[]
 url='https://api.deezer.com/search/album?'+urllib.parse.urlencode({'q':r['artist']+' '+r['title'],'limit':50})
 try:
  with urllib.request.urlopen(url,timeout=30) as f:res=json.load(f).get('data',[])
  time.sleep(.3);return r['id'],res
 except Exception as e:return r['id'],{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 for id,results in ex.map(get,rows):candidates[id]=results
pathlib.Path('site/research/left_deezer_candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2))
accepted=[];unmatched=[]
for r in rows:
 if r['confidence']=='unknown' or r.get('coverPath'):continue
 cn=candidates[r['id']]; choices=[]
 if isinstance(cn,list):
  for c in cn:
   rt,ct=norm(r['title']),norm(c.get('title',''));ra,ca=norm(r['artist']),norm(c.get('artist',{}).get('name',''))
   artist_ok=ra==ca or ra in ca or ca in ra or ('jimihendrix' in ra and 'jimihendrix' in ca) or ('captainbeefheart' in ra and 'captainbeefheart' in ca) or ('mothersofinvention' in ra and 'frankzappa' in ca) or ('neilyoung' in ra and 'neilyoung' in ca)
   title_ok=rt==ct or (rt=='ambient1musicforairports' and ct=='ambient1musicforairportsremastered2004') or (rt=='bestofomd' and ct=='bestoforchestralmanoeuvresinthedark') or (rt=='eldorado' and ct.startswith('eldorado')) or (rt=='johndenversgreatesthitsvol2' and ct=='greatesthitsvol2')
   if artist_ok and title_ok:choices.append(c)
  if choices:
   c=choices[0];r['coverUrl']=c['cover_xl'];r['coverPath']='/assets/covers/'+r['id']+'.jpg';r['sources'].append(c['link']);r['artworkEdition']='Deezer digital artwork; exact photographed vinyl pressing not verified.'; accepted.append((r,c))
  else:unmatched.append(r)
 else:unmatched.append(r)
def download(pair):
 r,c=pair
 try:
  with urllib.request.urlopen(r['coverUrl'],timeout=30) as f:data=f.read()
  pathlib.Path('site/dist'+r['coverPath']).write_bytes(data);return r['id'],'ok'
 except Exception as e:r['coverPath']=None;return r['id'],str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:result=list(ex.map(download,accepted))
P.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('ARTWORK ACCEPTED',len(accepted),'downloads',sum(x[1]=='ok' for x in result))
for r in unmatched:
 print(r['id'],r['artist'],'—',r['title'])
 for c in (candidates[r['id']] if isinstance(candidates[r['id']],list) else [] )[:3]: print('  ',c.get('artist',{}).get('name'), '—',c.get('title'),c.get('id'))
