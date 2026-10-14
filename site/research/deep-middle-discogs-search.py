"""Catalogue/performer searches for missing fronts and uncertain identities; LP candidates only."""
from pathlib import Path
import json,urllib.parse,runpy,urllib.request,time,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];E=ROOT/'site/research/deep-middle-evidence';A=ROOT/'site/dist/assets/covers'
get=runpy.run_path(str(ROOT/'site/research/deep-middle-discogs.py'))['get_json']
queries={
'lower-middle-02':{'release_title':'Tchaikovsky Ballet Album','artist':'Ormandy'},'lower-middle-03':{'catno':'MAB752','release_title':'Cabaret'},'lower-middle-04':{'catno':'136226','artist':'Fricsay'},'lower-middle-05':{'release_title':'Firebird','artist':'Haitink'},'lower-middle-07':{'q':'Kyriale Prières Liturgiques Anciennes'},'lower-middle-08':{'catno':'DS37674'},'lower-middle-09':{'release_title':'Care Bears Birthday Party'},'lower-middle-15':{'catno':'NBLP7198'},'lower-middle-26':{'catno':'SWBO101','artist':'Beatles'},'lower-middle-28':{'release_title':'Briefcase Full Of Blues','artist':'Blues Brothers'},'lower-middle-35':{'catno':'WGS8196'},'lower-middle-36':{'catno':'S37020'},'lower-middle-37':{'artist':'Michel Debost','release_title':'Mozart Flute'},'lower-middle-38':{'catno':'CSA2249'},'lower-middle-39':{'q':'Schwalbe Karajan Quattro Stagioni'},'lower-middle-40':{'q':'Karajan Sacre Printemps'},'lower-middle-41':{'q':'Charles Benbow Chartres'},'lower-middle-42':{'q':'Up With People 76 77'},'lower-middle-45':{'catno':'SQN7765'},'lower-middle-47':{'artist':'Fred Penner','release_title':'Polka Dot Pony'},'lower-middle-49':{'catno':'3922','release_title':'Mary Poppins'},'lower-middle-51':{'catno':'M30231','artist':'Kipnis'},'lower-middle-52':{'catno':'HM52/53SD'},'lower-middle-53':{'catno':'TV34057'},'lower-middle-54':{'catno':'S35777'},'lower-middle-55':{'artist':'Sharon Lois Bram','release_title':'One Two Three Four Live'},'lower-middle-65':{'artist':'Kevin Roth','release_title':'Mountain Dulcimer Instrumental'},'lower-middle-66':{'catno':'RSA4099'},'lower-middle-67':{'catno':'M34568'},'upper-middle-22':{'catno':'FC39298'},'upper-middle-58':{'artist':'Landscape','release_title':'Tea Rooms Mars'},'upper-middle-68':{'q':'Walter'}
}
if len(sys.argv)>1:queries={k:v for k,v in queries.items() if k in sys.argv[1:]}
for id,q in queries.items():
 params={'type':'release','format':'Vinyl','per_page':30,**q};u='https://api.discogs.com/database/search?'+urllib.parse.urlencode(params);p=E/(id+'-discogs-search.json');out={'id':id,'query':params,'url':u,'results':[],'candidates':[]}
 try:
  d=json.loads(p.read_text()) if p.exists() else get(u);p.write_text(json.dumps(d,indent=2));out['results']=d.get('results',[])
  print(id,[(x['id'],x['title'],x.get('catno'),x.get('country')) for x in out['results']][:8],flush=True)
  # Search does not establish photographed identity: stage up to2 candidates for human review.
  if id in ['lower-middle-66','upper-middle-22','upper-middle-68']:limit=0
  else:limit=2
  results=sorted(out['results'],key=lambda x:0 if x.get('country')=='Canada' else 1)
  for match in results[:limit]:
   rid=str(match['id']);dp=E/('discogs-'+rid+'.json');data=json.loads(dp.read_text()) if dp.exists() else get('https://api.discogs.com/releases/'+rid);dp.write_text(json.dumps(data,indent=2))
   if not any(x.get('name')=='Vinyl' and 'LP' in x.get('descriptions',[]) for x in data.get('formats',[])):continue
   for n,im in enumerate(data.get('images',[])[:4]):
    path=A/(id+'-deep-discogs-'+rid+'-'+str(n)+'.jpg');src=im['uri'];error=None
    if not path.exists():
     for attempt in range(3):
      try:path.write_bytes(urllib.request.urlopen(urllib.request.Request(src,headers={'User-Agent':'FamilyRecordCollectionResearch/2.0'}),timeout=25).read());Image.open(path).verify();break
      except Exception as err:
       path.unlink(missing_ok=True);error=str(err)
       if attempt<2:time.sleep([1,3][attempt])
    out['candidates'].append({'imageIndex':n,'local':'/assets/covers/'+path.name if path.exists() else None,'sourceUrl':src,'release':{k:data.get(k) for k in ['id','title','artists','country','year','formats','labels','notes']},'releaseUrl':'https://www.discogs.com/release/'+rid,'error':error,'review':'pending'})
 except Exception as err:out['error']=str(err);print('ERROR',id,err,flush=True)
 (E/(id+'-manual-candidates.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2))
