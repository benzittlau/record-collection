from pathlib import Path
import json,urllib.parse,runpy,urllib.request,time
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];E=ROOT/'site/research/deep-middle-evidence';A=ROOT/'site/dist/assets/covers';get=runpy.run_path(str(ROOT/'site/research/deep-middle-discogs.py'))['get_json']
queries={'upper-middle-30':{'catno':'SWAL3413','artist':'Ringo Starr'}}
for id,q in queries.items():
 params={'type':'release','format':'Vinyl','per_page':40,**q};u='https://api.discogs.com/database/search?'+urllib.parse.urlencode(params);p=E/(id+'-ringo-search.json');out={'id':id,'query':params,'url':u,'results':[],'candidates':[]}
 try:
  d=json.loads(p.read_text()) if p.exists() else get(u);p.write_text(json.dumps(d,indent=2));out['results']=d.get('results',[]);print(id,[(x['id'],x['title'],x.get('catno')) for x in out['results']][:5],flush=True)
  for match in sorted(out['results'],key=lambda x:0 if x.get('country')=='Canada' else 1)[:2]:
   rid=str(match['id']);dp=E/('discogs-'+rid+'.json');data=json.loads(dp.read_text()) if dp.exists() else get('https://api.discogs.com/releases/'+rid);dp.write_text(json.dumps(data,indent=2))
   if not any(x.get('name')=='Vinyl' and 'LP' in x.get('descriptions',[]) for x in data.get('formats',[])):continue
   for n,im in enumerate(data.get('images',[])[:4]):
    path=A/(id+'-deep-discogs-'+rid+'-'+str(n)+'.jpg');src=im['uri'];error=None
    if not path.exists():
     for attempt in range(3):
      try:path.write_bytes(urllib.request.urlopen(urllib.request.Request(src,headers={'User-Agent':'FamilyRecordCollectionResearch/2.0'}),timeout=25).read());Image.open(path).verify();break
      except Exception as err:path.unlink(missing_ok=True);error=str(err);time.sleep([1,3,8][attempt])
    out['candidates'].append({'imageIndex':n,'local':'/assets/covers/'+path.name if path.exists() else None,'sourceUrl':src,'release':{k:data.get(k) for k in ['id','title','artists','country','year','formats','labels','notes']},'releaseUrl':'https://www.discogs.com/release/'+rid,'error':error,'review':'pending'})
 except Exception as err:out['error']=str(err)
 (E/(id+'-ringo-candidates.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2))
