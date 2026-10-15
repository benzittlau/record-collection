from pathlib import Path
import runpy,json,urllib.parse,urllib.request,time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
old=runpy.run_path(str(HERE.parent/'spotify-link-evidence-left/audit-spotify.py'))
CACHE=HERE/'spotify';CACHE.mkdir(exist_ok=True)
old['fetch'].__globals__['CACHE']=CACHE
fetch_spotify=old['fetch']
mb=runpy.run_path(str(HERE.parent/'deep-left-musicbrainz.py'))['get_json']
discogs=runpy.run_path(str(HERE.parent/'deep-middle-discogs.py'))['get_json']
def cached_json(url,provider='mb'):
 cache=HERE/'metadata';cache.mkdir(exist_ok=True);import hashlib
 p=cache/(provider+'-'+hashlib.sha256(url.encode()).hexdigest()[:16]+'.json')
 if p.exists():return json.loads(p.read_text())
 try:
  d=(mb if provider=='mb' else discogs)(url);v={'url':url,'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'data':d}
 except Exception as e:v={'url':url,'error':str(e),'data':None}
 p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');return v
if __name__=='__main__':
 p=json.loads((HERE.parent/'capture-intake-left-2026-10-14.json').read_text());rows=[r for r in p['pairs'] if r['proposalType'] in ['new_identity','identity_correction']]
 results=[]
 for r in rows:
  a=r['identity']['artist'];t=r['identity']['title'];q=f'release:"{t}" AND artist:"{a.split(",")[0]}" AND format:vinyl'
  u='https://musicbrainz.org/ws/2/release/?'+urllib.parse.urlencode({'query':q,'fmt':'json','limit':30});d=cached_json(u)
  results.append({'id':r['proposedRecordIds'][0],'title':t,'artist':a,'query':q,'request':d});(HERE/'musicbrainz-release-searches.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(r['proposedRecordIds'][0],len((d['data']or{}).get('releases',[])),d.get('error',''),flush=True)
