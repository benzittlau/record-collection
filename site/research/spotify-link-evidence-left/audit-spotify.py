"""Read primary public Spotify metadata without authentication or API tokens.
Only the staged Spotify audit and its evidence directory are written. Canonical
catalogues, existing links, source photos, and cover artwork remain untouched.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
import json,re,base64,html,time,unicodedata,sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
AUDIT=HERE.parent/'spotify-link-audit-left.json'
ELIGIBLE=json.loads((HERE/'eligible.json').read_text())
ROWS=json.loads((HERE.parent/'left.json').read_text())
SEARCHES=json.loads((HERE/'searches.json').read_text())
SEARCHES+=json.loads((HERE/'searches-second.json').read_text()) if (HERE/'searches-second.json').exists() else []
CACHE=HERE/'metadata'
CACHE.mkdir(exist_ok=True)

def norm(v):
 return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower())
def json_state(h):
 m=re.search(r'<script id="initialState"[^>]*>(.*?)</script>',h,re.S)
 return json.loads(base64.b64decode(m.group(1))) if m else {}
def albums_in(obj):
 if isinstance(obj,dict):
  if str(obj.get('uri','')).startswith('spotify:album:') and obj.get('name'):
   yield {**{k:obj.get(k) for k in ['name','date','type','uri']},'id':obj.get('id') or obj['uri'].split(':')[-1]}
  for v in obj.values():yield from albums_in(v)
 elif isinstance(obj,list):
  for v in obj:yield from albums_in(v)
def artists_in(obj):
 if isinstance(obj,dict):
  if str(obj.get('uri','')).startswith('spotify:artist:'):yield obj['uri'].split(':')[-1]
  for v in obj.values():yield from artists_in(v)
 elif isinstance(obj,list):
  for v in obj:yield from artists_in(v)
def fetch(url,force=False):
 key=norm(url.replace('https://open.spotify.com/',''))
 p=CACHE/(key+'.json')
 if p.exists() and not force:
  cached=json.loads(p.read_text())
  if cached.get('parserVersion')==3 or '/album/' in url:return cached
 report={'url':url,'retrieved':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 for attempt in range(3):
  try:
   with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Accept-Language':'en-CA,en;q=0.9'}),timeout=25) as response:h=response.read().decode();report['finalUrl']=response.url
   titles=re.findall(r'<title>(.*?)</title>',h,re.S);report['pageTitle']=html.unescape(titles[0]) if titles else None
   schemas=[]
   for s in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',h,re.S):
    try:schemas.append(json.loads(s))
    except Exception:pass
   state=json_state(h);items=state.get('entities',{}).get('items',{});album_id=re.search(r'/album/([A-Za-z0-9]{22})',url)
   if album_id:
    e=items.get('spotify:album:'+album_id.group(1),{})
    schema=next((s for s in schemas if isinstance(s,dict) and s.get('@type')=='MusicAlbum'),{})
    tracks=e.get('tracksV2',{});clean=[]
    for v in tracks.get('items',[]):
     t=v.get('track',v)
     clean.append({'title':t.get('name'),'uri':t.get('uri'),'durationMs':t.get('duration',{}).get('totalMilliseconds'),'artists':[a.get('profile',{}).get('name') for a in t.get('artists',{}).get('items',[])],'playability':t.get('playability')})
    report['album']={'spotifyId':album_id.group(1),'title':e.get('name') or schema.get('name'),'artists':[a.get('profile',{}).get('name') for a in e.get('artists',{}).get('items',[])],'date':schema.get('datePublished') or e.get('date'),'trackCount':tracks.get('totalCount'),'type':e.get('type'),'copyright':e.get('copyright',{}).get('items',[]),'tracks':clean,'availableMarkets':e.get('availableMarkets',[]),'coverSources':e.get('coverArt',{}).get('sources',[])}
   report['relatedAlbums']=list({a['id']:a for a in albums_in(items)}.values())
   report['publicPageCountry']=state.get('session',{}).get('country')
   report['artistUrls']=list(dict.fromkeys('https://open.spotify.com/artist/'+u for u in artists_in(items)))
   report['parserVersion']=3
   report['ok']=bool(report.get('pageTitle'))
   break
  except Exception as error:
   report['error']=str(error);report['ok']=False
   if getattr(error,'code',None) in [400,404]:break
   time.sleep([1,3,6][attempt])
 report['evidenceFile']=str(p.relative_to(ROOT))
 p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 return report

def core_title(title):
 title=str(title or '')
 title=re.sub(r'\((?:[^)]*(?:remaster|deluxe|expanded|anniversary|edition|bonus)[^)]*)\)','',title,flags=re.I)
 title=re.sub(r'\[(?:[^\]]*(?:remaster|deluxe|expanded|anniversary|edition|bonus)[^\]]*)\]','',title,flags=re.I)
 return norm(title)
def title_matches(target,title):
 wanted=core_title(target);actual=core_title(title)
 if wanted==actual:return True
 aliases={
  'upper-left-19':['Graham Nash & David Crosby'],
  'lower-left-51':['Pat Garrett & Billy The Kid (Soundtrack From The Motion Picture)'],
  'lower-left-35':["John Denver's Greatest Hits, Vol. 2","Greatest Hits, Vol. 2","Greatest Hits Volume 2"],
  'upper-left-49':['The Best Of Orchestral Manoeuvres In The Dark','The Best Of OMD'],
  'lower-left-54':["The Black Man's Burdon"],
  'upper-left-25':["Decembers Children (and Everbody's)- Non E.U.","December's Children (And Everybody's) - Non E.U."],
  'upper-left-30':['The Byrds'],
  'upper-left-46':['Floating Worlds'],
  'lower-left-38':['The Climax Blues Band Plays On'],
  'lower-left-44':['Before The Flood (Live)'],
 }
 for row in ELIGIBLE:
  if row['title']==target and row['id'] in aliases:return actual in [core_title(v) for v in aliases[row['id']]]
 return False
def artist_matches(row,artists):
 wanted=norm(row['artist']);have=[norm(v) for v in artists if v]
 if wanted in have:return True
 if wanted.startswith('the') and wanted[3:] in have:return True
 if any(v.startswith('the') and v[3:]==wanted for v in have):return True
 substitutions={'upper-left-44':['Frank Zappa','The Mothers Of Invention'], 'upper-left-27':['Todd Rundgren','Utopia','Todd Rundgren’s Utopia'], 'upper-left-53':['Graham Parker & The Rumour'], 'lower-left-43':['John McLaughlin','Mahavishnu Orchestra'], 'lower-left-55':['Neil Young','Crazy Horse'], 'lower-left-56':['Edgar Winter','The Edgar Winter Group'], 'lower-left-44':['Bob Dylan','The Band'], 'lower-left-54':['Eric Burdon','War'], 'lower-left-23':['Captain Beefheart & His Magic Band'], 'lower-left-02':['Eumir Deodato'],'lower-left-38':['Climax Chicago Blues Band','The Climax Chicago Blues Band']}
 return any(norm(v) in have for v in substitutions.get(row['id'],[]))

def original_programme(row):
 full=next(r for r in ROWS if r['id']==row['id']);face=full.get('artworkProvenance',{}).get('front',{});e=face.get('edition',{});rid=e.get('releaseId')
 if not rid:return None
 for file in ['deep-left-discogs-evidence.json','deep-left-extra-evidence.json']:
  cache=json.loads((HERE.parent/file).read_text());v=cache.get('https://api.discogs.com/releases/'+str(rid),{}).get('data',{})
  if v.get('tracklist'):return {'releaseUrl':face.get('releaseUrl'),'tracks':[t.get('title') for t in v['tracklist'] if t.get('type_')=='track']}
 return None

def update_audit(reports,extra_queries=None):
 previous=json.loads(AUDIT.read_text()) if AUDIT.exists() else {}
 records=[]
 for row in ELIGIBLE:
  candidates=[]
  for r in reports:
   album=r.get('album',{})
   if not album.get('title') or not title_matches(row['title'],album['title']):continue
   if not artist_matches(row,album.get('artists',[])):continue
   if 'live' in album['title'].lower() and 'live' not in row['title'].lower() and row['id']!='lower-left-44':continue
   candidates.append(r)
  # Shortest programme usually avoids unrelated deluxe appendices; first core
  # release date preferred, but digital reissue dates never override family year.
  def region_rank(candidate):
   markets=candidate['album'].get('availableMarkets',{})
   items=markets.get('items',[]) if isinstance(markets,dict) else []
   states=[(t.get('playability') or {}).get('playable') for t in candidate['album'].get('tracks',[])]
   blocked_fraction=states.count(False)/len(states) if states else 1
   return (blocked_fraction,0 if any(m.get('countryCode')=='CA' for m in items) else 1,0 if items else 1,candidate['album'].get('trackCount') or 999,candidate['url'])
  candidates.sort(key=region_rank)
  source=original_programme(row)
  matched=None;rejected=[]
  for candidate in candidates:
   a=candidate['album'];tracks=[t.get('title') for t in a.get('tracks',[]) if t.get('title')]
   comparison=None
   if source:
    spotify_norm=[norm(re.sub(r'\s*[-–]\s*(?:\d{4}\s*)?(?:remaster.*|mono.*|stereo.*|bonus.*)$','',t,flags=re.I)) for t in tracks]
    original_norm=[norm(t) for t in source['tracks']]
    if row['id']=='upper-left-27': original_norm=['utopiatheme' if t=='utopia' else t for t in original_norm]
    overlap=sum(any(o==s or len(o)>6 and (o in s or s in o) for s in spotify_norm) for o in original_norm if o)
    comparison={'source':source['releaseUrl'],'originalTrackCount':len(source['tracks']),'originalTracks':source['tracks'],'matchingOriginalTracks':overlap,'method':'Original LP programme compared with primary Spotify track names, ignoring explicit remaster suffixes.'}
    if len(original_norm)>3 and overlap<min(4,len(original_norm)):
     rejected.append({'url':candidate['url'],'reason':'Album title/artist candidate but original LP core programme is not sufficiently represented.','programmeComparison':comparison});continue
   matched=(candidate,comparison);break
  qs=[{'query':f'site:open.spotify.com/album "{row["artist"]}" "{row["title"].replace(chr(39), "")}"','source':'web search'}]
  qs+=extra_queries.get(row['id'],[]) if extra_queries else []
  item={'id':row['id'],'physicalTitle':row['title'],'physicalArtist':row['artist'],'physicalYear':row['year'],'status':'matched' if matched else 'unresolved','spotifyId':None,'spotifyUrl':None,'spotifyTitle':None,'spotifyArtists':[],'spotifyDate':None,'spotifyTrackCount':None,'queries':qs,'rejectedCandidates':rejected,'verificationEvidence':[],'editionNotes':None,'unresolvedReason':None}
  if matched:
   candidate,comparison=matched;a=candidate['album']
   item.update(spotifyId=a['spotifyId'],spotifyUrl='https://open.spotify.com/album/'+a['spotifyId'],spotifyTitle=a['title'],spotifyArtists=a['artists'],spotifyDate=a['date'],spotifyTrackCount=a['trackCount'],editionNotes='Verified digital edition of the same original album. Mastering, bonus tracks, artwork, release-date display and regional availability may differ from the family vinyl; exact pressing is not asserted.')
   item['verificationEvidence']=[{'url':candidate['url'],'embedUrl':'https://open.spotify.com/embed/album/'+a['spotifyId'],'source':'Spotify public album HTML / decoded initialState and MusicAlbum JSON-LD','pageTitle':candidate['pageTitle'],'evidenceFile':candidate['evidenceFile'],'retrieved':candidate['retrieved'],'tracks':a['tracks'],'programmeComparison':comparison,'copyright':a.get('copyright')}]
  else:item['unresolvedReason']='No verified same-album Spotify candidate after current public album searches and primary metadata checks; further alternate-title/artist/track leads are being checked.'
  records.append(item)
 summary={'eligible':len(ELIGIBLE),'matched':sum(r['status']=='matched' for r in records),'unresolved':sum(r['status']=='unresolved' for r in records),'complete':False}
 AUDIT.write_text(json.dumps({'version':1,'records':records,'summary':summary},ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary),flush=True)

if __name__=='__main__':
 seed_urls=set()
 for batch in SEARCHES:
  for v in batch['headers']:
   url=v['url'];m=re.search(r'/(?:embed/)?(?:album|artist|track)/([A-Za-z0-9]{22})',url)
   if m:seed_urls.add('https://open.spotify.com/'+('album' if '/album/' in url else 'artist' if '/artist/' in url else 'track')+'/'+m.group(1))
   else:
    m=re.search(r'album%3A([A-Za-z0-9]{22})',url)
    if m:seed_urls.add('https://open.spotify.com/album/'+m.group(1))
 # Directly verified discovery from first search batch.
 seed_urls.update('https://open.spotify.com/album/'+id for id in ['44jYRMyw4XlsW7D6cxGdzk','7bMQJ1y3LGoj3vbID2JwCP','1WwjsPMcZJUY2WMaFKX6Nq'])
 reports=[json.loads(p.read_text()) for p in CACHE.glob('*.json') if '/album/' in json.loads(p.read_text()).get('url','')]
 with ThreadPoolExecutor(max_workers=3) as pool:
  for report in pool.map(fetch,sorted(seed_urls)):
   reports.append(report)
   if len(reports)%20==0:update_audit(reports)
 update_audit(reports)
 # Related releases from Spotify's own pages are discovery leads only. Each is
 # independently fetched and verified before it can enter the matched audit.
 visited={r['url'] for r in reports};related={}
 for report in reports:
  for a in report.get('relatedAlbums',[]):
   if any(title_matches(r['title'],a['name']) for r in ELIGIBLE):related[a['id']]=a
 urls=['https://open.spotify.com/album/'+id for id in related if 'https://open.spotify.com/album/'+id not in visited]
 with ThreadPoolExecutor(max_workers=3) as pool:
  for report in pool.map(fetch,sorted(urls)):
   reports.append(report)
   if len(reports)%20==0:update_audit(reports)
 update_audit(reports)
 print('PRIMARY METADATA PASS COMPLETE',len(reports),'pages',flush=True)
