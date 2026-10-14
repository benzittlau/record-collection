import json,urllib.request,urllib.parse,time,runpy,re,hashlib,os,io,sys
from pathlib import Path
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'site/research';CACHE=BASE/'deep-right-api-cache';CACHE.mkdir(exist_ok=True)
mb_get=runpy.run_path(str(BASE/'deep-left-musicbrainz.py'))['get_json']
rows=json.loads((BASE/'right.json').read_text());UA='FamilyRecordCollectionResearch/2.0 (album/LP provenance audit; personal archive)'
wanted=set(sys.argv[1:]);rows=[r for r in rows if not wanted or r['id'] in wanted];log=[r for r in json.loads((BASE/'deep-right-release-scan.json').read_text()) if wanted and r['id'] not in wanted] if (BASE/'deep-right-release-scan.json').exists() else []
def api(url,mb=False):
 key=hashlib.sha256(url.encode()).hexdigest();p=CACHE/(key+'.json')
 if p.exists():return json.loads(p.read_text())
 for n in range(4):
  try:
   if mb:data=mb_get(url,headers={'User-Agent':UA,'Accept':'application/json'},timeout=30,attempts=4)
   else:
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'});data=json.load(urllib.request.urlopen(req,timeout=35));time.sleep(.2)
   p.write_text(json.dumps(data));(CACHE/(key+'.url')).write_text(url);return data
  except urllib.error.HTTPError as e:
   if e.code==404:data={'notFound':True,'url':url};p.write_text(json.dumps(data));(CACHE/(key+'.url')).write_text(url);return data
   if e.code in [429,500,502,503,504] and n<3:time.sleep([2,5,15][n]);continue
   raise
  except Exception:
   if n<3:time.sleep([2,5,10][n]);continue
   raise

def mb_search(kind,q,limit=100):return api('https://musicbrainz.org/ws/2/'+kind+'/?'+urllib.parse.urlencode({'query':q,'fmt':'json','limit':limit}),True)
def mb_release(rid):return api('https://musicbrainz.org/ws/2/release/'+rid+'?inc=media+labels+url-rels+release-groups&fmt=json',True)
CAT={3:['CTX 6031/32'],5:['CTI 6006'],6:['ECM 1064/65'],7:['ECM-2-1086'],8:['ECM 1014 ST'],10:['ASD-9301'],12:['KG 33236'],13:['CS 8192'],15:['P-24055'],16:['92 37741'],17:['DS 2234'],18:['6386'],20:['HS 2295'],21:['BS 2734'],22:['SD 7244'],23:['SD 18103'],24:['PZ 34033'],26:['92 57961'],27:['6E-141'],29:['SP-3621'],31:['SP-4361'],32:['7ES-1117'],33:['FE 39304'],34:['K 53088'],35:['7E-2008'],36:['SMAS-11419'],37:[],38:['CHS 41461'],39:['9022-1104'],40:[],41:['SS 2561'],42:['FC 36058'],43:['QSR 6076'],44:['QSR 6058'],45:['XSR 6095'],46:['92 56511'],47:['92 55121'],48:['C 30767'],49:['92 53051'],50:['SP-4560'],53:['ECM 3-1035/37 ST'],54:['P-24002']}
# Supplemental catalog numbers read on the same photo; questionable spelling retained for audit.
ARTIST={'The Dave Brubeck Quartet':'Dave Brubeck','Frank Zappa / Captain Beefheart / The Mothers':'Frank Zappa','Neil Young & Crazy Horse':'Neil Young','Chick Corea and Return to Forever':'Chick Corea','Claude Bolling & Jean-Pierre Rampal':'Claude Bolling','Johnny Winter & Edgar Winter':'Johnny Winter','Stevie Ray Vaughan and Double Trouble':'Stevie Ray Vaughan'}
def norm(s):return re.sub(r'[^a-z0-9]','',s.lower())
def summarize(r):
 return {'id':r['id'],'title':r.get('title'),'date':r.get('date'),'country':r.get('country'),'formats':[m.get('format') for m in r.get('media',[])],'catalogNumbers':[x.get('catalog-number') for x in r.get('label-info',[])],'labels':[(x.get('label') or {}).get('name') for x in r.get('label-info',[])],'coverArt':r.get('cover-art-archive',{}),'relations':[x.get('url',{}).get('resource') for x in r.get('relations',[]) if x.get('url')],'releaseGroup':r.get('release-group',{}).get('id')}
def vinyl(r):return any('vinyl' in (m.get('format') or '').lower() for m in r.get('media',[]))
for r in rows:
 pos=r['position'];entry={'id':r['id'],'title':r['title'],'artist':r['artist'],'observedCatalogNumbers':CAT.get(pos,[]),'existingBack':r.get('back'),'searches':[],'releases':[],'errors':[]}
 if r.get('kind')=='book' or r['confidence']=='unknown':log.append(entry);continue
 group={'right-14':'bd0ad2df-0cb0-33e5-8619-fcee0dc0502a','right-25':'9584e28b-66a7-3846-8d52-b3008a283539'}.get(r['id'],r.get('musicbrainzGroup'));allrel=[]
 try:
  if r.get('backUrl'):
   match=re.search(r'/release/([a-f0-9-]{36})/',r['backUrl'])
   if match:
    x=mb_release(match[1]);entry['existingBackMetadata']=summarize(x);allrel.append(x)
  for cat in CAT.get(pos,[])[:1]:
   q='catno:"'+cat+'" AND artist:"'+ARTIST.get(r['artist'],r['artist'])+'"';found=mb_search('release',q);entry['searches'].append({'query':q,'total':found.get('count'),'url':'https://musicbrainz.org/search?'+urllib.parse.urlencode({'query':q,'type':'release','method':'advanced'})})
   for x in found.get('releases',[]):
    # Search results contain media/labels but are not authoritative for CAA images.
    if x.get('release-group',{}).get('id') and not group:group=x['release-group']['id']
    if vinyl(x):allrel.append(x)
  if not group:
   q='releasegroup:"'+r['title']+'" AND artist:"'+ARTIST.get(r['artist'],r['artist'])+'"';found=mb_search('release-group',q);entry['searches'].append({'query':q,'total':found.get('count')});groups=found.get('release-groups',[]);sel=next(iter(sorted([x for x in groups if norm(x.get('title',''))==norm(r['title'])],key=lambda x:x.get('first-release-date','9999'))),None)
   if sel:group=sel['id']
   else:entry['groupCandidates']=groups
  if group:
   entry['releaseGroup']=group
   for offset in range(0,300,100):
    url='https://musicbrainz.org/ws/2/release?'+urllib.parse.urlencode({'release-group':group,'inc':'media+labels+url-rels','fmt':'json','limit':100,'offset':offset});found=api(url,True);entry['searches'].append({'url':url,'total':found.get('release-count'),'offset':offset});allrel.extend(found.get('releases',[]))
    if offset+100>=found.get('release-count',0):break
  unique={x['id']:x for x in allrel}
  # Search hits need a release lookup; browse includes complete CAA/media flags.
  for rid,x in list(unique.items()):
   if vinyl(x) and 'cover-art-archive' not in x:unique[rid]=mb_release(rid)
  lp=[x for x in unique.values() if vinyl(x)]
  def score(x):
   cats=[norm(y.get('catalog-number') or '') for y in x.get('label-info',[])];wanted=[norm(c) for c in CAT.get(pos,[])];match=any(c==w or c in w or w in c for c in cats for w in wanted if c and w)
   ca=x.get('cover-art-archive',{});return (100*match+30*ca.get('back',False)+15*ca.get('front',False)+5*(x.get('country')=='CA')+3*(x.get('country')=='US')+2*(x.get('date','9999')<'1990'))
  lp.sort(key=score,reverse=True)
  entry['releases']=[summarize(x) for x in lp];entry['allReleaseCount']=len(unique)
  entry['caaCandidates']=[]
  for x in lp[:12]:
   if x.get('cover-art-archive',{}).get('count',0)==0:continue
   u='https://coverartarchive.org/release/'+x['id'];art=api(u);entry['caaCandidates'].append({'release':summarize(x),'caaUrl':u,'art':art})
   if any(i.get('back') for i in art.get('images',[])) and len(entry['caaCandidates'])>=3:break
 except Exception as e:entry['errors'].append(str(e));print('ERROR',r['id'],e,flush=True)
 log.append(entry);(BASE/'deep-right-release-scan.json').write_text(json.dumps(sorted(log,key=lambda x:x['id']),indent=2));print(r['id'],'vinyl',len(entry['releases']),'CAA',len(entry.get('caaCandidates',[])),'backs',sum(any(i.get('back') for i in c['art'].get('images',[])) for c in entry.get('caaCandidates',[])),flush=True)
(BASE/'deep-right-release-scan.json').write_text(json.dumps(sorted(log,key=lambda x:x['id']),indent=2));print('COMPLETE',len(log),flush=True)
