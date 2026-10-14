"""Acquire alternate LP candidate scans via documented MusicBrainz URL relations."""
from pathlib import Path
import json,urllib.request,re,runpy,time,concurrent.futures
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];E=ROOT/'site/research/deep-middle-evidence';A=ROOT/'site/dist/assets/covers'
mb=runpy.run_path(str(ROOT/'site/research/deep-left-musicbrainz.py'))['get_json'];dc=runpy.run_path(str(ROOT/'site/research/deep-middle-discogs.py'))['get_json']
rows={r['id']:r for r in json.loads((ROOT/'site/research/middle.json').read_text())}
def work(f):
 d=json.loads(f.read_text());r=rows[d['id']]
 if d['id'] not in ['upper-middle-66','lower-middle-13'] and any(any(i.get('back') for i in rel['images']) for rel in d['releases']):return
 if not d['releases']:return
 result={'id':d['id'],'candidates':[],'queries':[]}
 for rel in d['releases'][:2]:
  p=E/('release-urls-'+rel['id']+'.json');u='https://musicbrainz.org/ws/2/release/'+rel['id']+'?inc=url-rels+media+labels+artist-credits&fmt=json'
  try:
   detail=json.loads(p.read_text()) if p.exists() else mb(u);p.write_text(json.dumps(detail,indent=2));result['queries'].append(u)
   urls=[a['url']['resource'] for a in detail.get('relations',[]) if 'discogs.com/release/' in a.get('url',{}).get('resource','')]
   for link in urls:
    rid=re.search(r'release/(\d+)',link).group(1);dp=E/('discogs-'+rid+'.json');du='https://api.discogs.com/releases/'+rid
    data=json.loads(dp.read_text()) if dp.exists() else dc(du);dp.write_text(json.dumps(data,indent=2));result['queries'].append(du)
    if not any(x.get('name')=='Vinyl' for x in data.get('formats',[])):continue
    for n,im in enumerate(data.get('images',[])[:4]):
     path=A/(r['id']+'-deep-discogs-'+rid+'-'+str(n)+'.jpg');src=im['uri'];error=None
     if not path.exists():
      for attempt in range(3):
       try:path.write_bytes(urllib.request.urlopen(urllib.request.Request(src,headers={'User-Agent':'FamilyRecordCollectionResearch/2.0'}),timeout=25).read());Image.open(path).verify();break
       except Exception as err:
        path.unlink(missing_ok=True);error=str(err)
        if attempt<2:time.sleep([1,3][attempt])
     result['candidates'].append({'imageIndex':n,'local':'/assets/covers/'+path.name if path.exists() else None,'sourceUrl':src,'imageType':im.get('type'),'release':{'id':rid,'url':'https://www.discogs.com/release/'+rid,'title':data.get('title'),'artists':data.get('artists'),'country':data.get('country'),'year':data.get('year'),'formats':data.get('formats'),'labels':data.get('labels')},'error':error,'review':'pending'})
  except Exception as err:result['queries'].append({'url':u,'error':str(err)})
 (E/(r['id']+'-discogs-candidates.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(r['id'],'discogs candidates',len(result['candidates']),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(work,list(E.glob('*-lp.json'))))
