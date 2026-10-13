import json,urllib.request,urllib.parse,time
from pathlib import Path
lookup={'lower-middle-04':'MAB 752','lower-middle-07':'4054','lower-middle-08':'DS 37674','lower-middle-35':'WGS 8196','lower-middle-36':'S 37020','lower-middle-37':'WGS 8203','lower-middle-38':'CSA 2249','lower-middle-43':'WGS 8163','lower-middle-45':'SQN 7765','lower-middle-51':'M 30241','lower-middle-52':'HM 52','lower-middle-54':'S 37277','lower-middle-58':'XMS 5823','lower-middle-63':'BSK 3212','upper-middle-02':'PS 669'}
results=[]
for id,cat in lookup.items():
 url='https://musicbrainz.org/ws/2/release?'+urllib.parse.urlencode({'query':'catno:"'+cat+'"','fmt':'json','limit':8})
 try:
  d=json.load(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FamilyRecordCollection/1.0 (personal album identification)'}),timeout=15))
  results.append({'id':id,'catalogue':cat,'url':url,'data':d})
  opts=[(x.get('id'),x.get('title'),x.get('date'),','.join(v.get('name','') for v in x.get('artist-credit',[]) if isinstance(v,dict)),x.get('label-info')) for x in d.get('releases',[])]
  print(id,cat,json.dumps(opts,ensure_ascii=False),flush=True)
 except Exception as e:print('ERROR',id,str(e),flush=True)
 time.sleep(1.1)
Path('site/research/middle-classical-evidence.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
