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
