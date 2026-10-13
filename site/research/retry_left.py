import json,urllib.request,urllib.parse,time,pathlib,re,unicodedata
P=pathlib.Path('site/research/left.json');rows=json.loads(P.read_text());C=pathlib.Path('site/research/left_apple_candidates.json');candidates=json.loads(C.read_text())
def norm(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower();s=re.sub(r'\([^)]*\)|\[[^]]*\]','',s)
 return re.sub('[^a-z0-9]','',s.replace('the ','').replace('volume','vol'))
for r in rows:
 if r['confidence']=='unknown' or r.get('coverPath'):continue
 if isinstance(candidates[r['id']],list) and candidates[r['id']]:continue
 term=r['title']+' '+r['artist']
 url='https://itunes.apple.com/search?'+urllib.parse.urlencode({'term':term,'entity':'album','limit':20,'country':'CA'})
 try:
  with urllib.request.urlopen(url,timeout=20) as f:res=json.load(f)['results']
  candidates[r['id']]=res
  for c in res:
   rt,ct=norm(r['title']),norm(c['collectionName']);ra,ca=norm(r['artist']),norm(c['artistName'])
   title_ok=rt==ct or (rt=='eldorado' and ct=='eldoradoasymphonbyelectriclightorchestra') or (rt=='johndenversgreatesthitsvol2' and ct=='greatesthitsvol2')
   artist_ok=ra==ca or ra in ca or ca in ra or ('jimihendrix' in ra and 'jimihendrix' in ca) or ('captainbeefheart' in ra and 'captainbeefheart' in ca) or (ra=='ericburdonandwar' and ('war' in ca or 'ericburdon' in ca))
   if artist_ok and title_ok:
    r['coverUrl']=c['artworkUrl100'].replace('100x100bb','600x600bb');r['coverPath']='/assets/covers/'+r['id']+'.jpg'
    with urllib.request.urlopen(r['coverUrl'],timeout=20) as f:pathlib.Path('site/dist'+r['coverPath']).write_bytes(f.read())
    r['sources'].append(c['collectionViewUrl'].split('?')[0]);r['artworkEdition']='Apple Music digital artwork; exact photographed vinyl pressing not verified.'
    r['digitalReleaseDate']=c.get('releaseDate');r['digitalCopyright']=c.get('copyright')
    print('FOUND',r['id'],r['artist'],r['title'],flush=True);break
  else:print('NO MATCH',r['id'], [(x['artistName'],x['collectionName'],x['collectionId']) for x in res[:3]],flush=True)
 except Exception as e:print('ERROR',r['id'],str(e),flush=True)
 P.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');C.write_text(json.dumps(candidates,ensure_ascii=False,indent=2))
 time.sleep(3.6)
