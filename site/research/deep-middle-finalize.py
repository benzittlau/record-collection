"""Apply manually face-reviewed LP artwork decisions and finalize all138 audit outcomes."""
from pathlib import Path
import json,re,collections
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];E=ROOT/'site/research/deep-middle-evidence';P=ROOT/'site/research/middle.json';AP=ROOT/'site/research/deep-middle-audit.json'
rows=json.loads(P.read_text());oldAudit=json.loads(AP.read_text());baseline={r['id']:r for r in oldAudit['records']};chosen=collections.defaultdict(list)
# Exact visual classifications; secondary images often include gatefold interiors/labels.
manual={
'upper-middle-30':(36636136,{'front':0,'back':3}),'upper-middle-01':(1386759,{'back':1}),'upper-middle-04':(8398653,{'back':2}),'upper-middle-09':(2350959,{'back':1}),'upper-middle-13':(761878,{'back':1}),'upper-middle-16':(125810,{'back':1}),'upper-middle-24':(843432,{'back':1}),'upper-middle-27':(1706811,{'back':1}),'upper-middle-29':(2951430,{'back':1}),'upper-middle-42':(2198750,{'back':1}),'upper-middle-43':(7469976,{'back':1}),'upper-middle-48':(1123236,{'back':1}),'upper-middle-50':(2142189,{'back':1}),'upper-middle-54':(1669315,{'back':1}),'upper-middle-61':(734865,{'back':1}),'upper-middle-66':(519991,{'back':1}),
'lower-middle-13':(1428098,{'back':2}),'lower-middle-16':(1840188,{'back':1}),'lower-middle-31':(1936232,{'front':0,'back':3}),'lower-middle-33':(5291554,{'back':1}),'lower-middle-62':(2233591,{'back':3}),'lower-middle-68':(1393317,{'back':1}),
'lower-middle-02':(15649806,{'front':0,'back':1}),'lower-middle-03':(24444749,{'front':0,'back':1}),'lower-middle-04':(1845467,{'front':0,'back':1}),'lower-middle-05':(13382055,{'back':1}),'lower-middle-07':(34229644,{'front':1,'back':2}),'lower-middle-08':(5625197,{'front':0,'back':1}),'lower-middle-09':(26272115,{'front':0,'back':1}),'lower-middle-12':(4197228,{'back':1}),'lower-middle-15':(1868141,{'front':0,'back':1}),'lower-middle-26':(28810294,{'front':0,'back':3}),'lower-middle-28':(1820351,{'back':1}),'lower-middle-36':(3529776,{'front':0,'back':1}),'lower-middle-37':(11056658,{'front':0,'back':1}),'lower-middle-38':(26053534,{'back':1}),'lower-middle-43':(5987501,{'front':1}),'lower-middle-39':(3155778,{'front':0,'back':1}),'lower-middle-40':(1208326,{'front':0,'back':1}),'lower-middle-41':(3738227,{'front':0,'back':1}),'lower-middle-42':(6398551,{'front':0,'back':1}),'lower-middle-45':(5305193,{'front':0,'back':1}),'lower-middle-49':(3069104,{'front':0,'back':1}),'lower-middle-47':(2547761,{'front':0,'back':1}),'lower-middle-51':(38511918,{'front':0,'back':1}),'lower-middle-52':(14170693,{'front':0,'back':1}),'lower-middle-54':(12893159,{'front':0,'back':1}),'lower-middle-55':(24835322,{'front':0,'back':1}),'lower-middle-65':(1660005,{'front':0,'back':1}),'lower-middle-67':(1675471,{'front':0,'back':1}),
'upper-middle-34':(4569722,{'back':1}),'upper-middle-55':(8957113,{'back':1}),'upper-middle-58':(6773347,{'front':0,'back':1})}
# Gather all manually reviewed candidate records.
allCandidates=collections.defaultdict(list)
for f in E.glob('*-candidates.json'):
 d=json.loads(f.read_text())
 if isinstance(d,list):
  id=f.name.split('-candidates')[0]
  for x in d:allCandidates[id].append(x)
 else:
  for x in d.get('candidates',[]):
   x.setdefault('releaseUrl',x.get('release',{}).get('url') or 'https://www.discogs.com/release/'+str(x.get('release',{}).get('id','')))
   allCandidates[d['id']].append(x)
# Isolate the album face in source scans that include neighboring shelf records.
# The unmodified downloaded archive scan remains beside each derived crop.
for x in allCandidates['lower-middle-07']:
 if str(x['release']['id'])!='34229644' or x.get('imageIndex') not in [1,2] or not x.get('local'):continue
 rect=(63,0,519,450) if x['imageIndex']==1 else (59,0,513,449)
 original=x['local'];dst=original.replace('.jpg','-face.jpg');src=Image.open(ROOT/'site/dist'/original.lstrip('/'));src.crop(rect).save(ROOT/'site/dist'/dst.lstrip('/'),quality=95)
 x['uncroppedLocal']=original;x['sourceCrop']={'coordinateSpace':'downloaded-image-pixels','rect':list(rect),'originalSize':list(src.size),'purpose':'Exclude neighboring LP spines; retain only the photographed album face.'};x['local']=dst
# Catalogue updates not inferred from image search alone.
for r in rows:
 if r['id']=='lower-middle-04':r['confidence']='probable'
 # Withhold uncertain trumpet performers, even though a plausible Turnabout LP exists.
 if r['id']=='lower-middle-53':r['cover']=None;r['coverUrl']=None;r['backUrl']=None;r.pop('backSourceUrl',None)
 # Remove inappropriate CD backs before selecting actual LP alternatives.
 lp=E/(r['id']+'-lp.json')
 if lp.exists():
  d=json.loads(lp.read_text());b=d.get('existingBack')
  if b and not any('Vinyl' in m.get('format','') for m in b.get('media',[])):r['backUrl']=None;r.pop('backSourceUrl',None)
 for x in allCandidates[r['id']]:
  face=x.get('face')
  if not face or not x.get('local'):continue
  if r['id'] in ['upper-middle-66','lower-middle-13']:continue
  if not any('Vinyl' in f for f in x['release'].get('formats',[])):continue
  chosen[r['id']].append(x)
 if r['id'] in manual:
  rid,faces=manual[r['id']]
  for face,n in faces.items():
   matches=[x for x in allCandidates[r['id']] if str(x['release']['id'])==str(rid) and x.get('imageIndex')==n and x.get('local')]
   if not matches:print('MISSING CHOICE',r['id'],rid,n,face);continue
   x=matches[0].copy();x['face']=face;chosen[r['id']]=[i for i in chosen[r['id']] if i['face']!=face]+[x]
 for x in chosen[r['id']]:
  path=ROOT/'site/dist'/x['local'].lstrip('/');Image.open(path).verify();rel=x['release'];face=x['face'];url=rel.get('url') or x.get('releaseUrl') or 'https://www.discogs.com/release/'+str(rel['id'])
  if face=='front':r['cover']=x['local'];r['coverUrl']=x['sourceUrl']
  else:r['backUrl']=x['local'];r['backSourceUrl']=x['sourceUrl']
  r['sources']=list(dict.fromkeys(r.get('sources',[])+[url]));edition={'face':face,'sourceUrl':x['sourceUrl'],'local':x['local'],'releaseUrl':url,'catalogues':rel.get('labels',[]),'country':rel.get('country'),'releaseDate':rel.get('date') or rel.get('year'),'media':rel.get('formats'),'relationshipToPhotograph':'Catalogue-matching or representative LP edition; exact physical pressing and wear are unverified.','faceReview':'Front/rear sleeve face verified visually; labels, CD trays and interiors excluded.'}
  editions=r.setdefault('artworkEditions',[]);r['artworkEditions']=[i for i in editions if i.get('face')!=face]+[edition]
  x['review']='accepted_'+face
  if x.get('sourceCrop'):r['artworkEditions'][-1]['sourceCrop']=x['sourceCrop'];r['artworkEditions'][-1]['uncroppedLocal']=x['uncroppedLocal']
 if chosen[r['id']] and 'LP artwork' not in r['notes']:r['notes']+=' LP artwork is a catalogue-matching or representative edition reference; the photographed physical pressing and wear remain unverified.'
# Use verified LP fronts from paired Discogs scans rather than retained CD/deluxe packaging.
for r in rows:
 if r['confidence']!='confirmed' or r['id'] in ['lower-middle-37','lower-middle-07','lower-middle-05','lower-middle-40','lower-middle-35','lower-middle-43']:continue
 candidates=[x for x in allCandidates[r['id']] if x.get('local') and x.get('imageIndex')==0 and x['release'].get('formats') and any(m.get('name')=='Vinyl' and 'LP' in m.get('descriptions',[]) for m in x['release']['formats'])]
 # Prefer the same release as selected rear and then a Canadian LP.
 rears=[str(x['release']['id']) for x in chosen[r['id']] if x.get('face')=='back']
 candidates.sort(key=lambda x:(0 if str(x['release']['id']) in rears else 1,0 if x['release'].get('country')=='Canada' else 1))
 if candidates:
  x=candidates[0].copy();x['face']='front';chosen[r['id']]=[i for i in chosen[r['id']] if i['face']!='front']+[x];r['cover']=x['local'];r['coverUrl']=x['sourceUrl'];r['sources']=list(dict.fromkeys(r['sources']+[x['releaseUrl']]));r['artworkEditions']=[i for i in r.get('artworkEditions',[]) if i.get('face')!='front']+[{'face':'front','local':x['local'],'sourceUrl':x['sourceUrl'],'releaseUrl':x['releaseUrl'],'country':x['release'].get('country'),'media':x['release'].get('formats'),'relationshipToPhotograph':'Face-verified representative LP front; exact physical pressing remains unverified.'}]
# Retain the sharper collector-owned WGS8196 LP front rather than the225px Discogs thumbnail.
r=next(x for x in rows if x['id']=='lower-middle-35');r['cover']='/assets/covers/lower-middle-35.jpg';r['coverUrl']='https://westminstergold.kimba.biz/WGS-8196a.jpg';r['artworkEditions']=[i for i in r.get('artworkEditions',[]) if i.get('face')!='front']+[{'face':'front','local':r['cover'],'sourceUrl':r['coverUrl'],'releaseUrl':'https://www.discogs.com/release/6297034','catalogues':[{'catno':'WGS8196'}],'country':'US','media':['Vinyl LP'],'relationshipToPhotograph':'Collector-owned WGS8196 LP jacket scan; identity corroborated by the documented Westminster Gold LP release. Sharper700px source retained.'}]
chosen[r['id']]=[i for i in chosen[r['id']] if i['face']!='front']
# Firebird: Dutch6500483 front, Japanese20PC1011 outer rear, same Haitink/LPO recording.
r=next(x for x in rows if x['id']=='lower-middle-05')
x=next(i for i in allCandidates[r['id']] if str(i['release']['id'])=='15298616' and i.get('imageIndex')==0).copy();x['face']='front';chosen[r['id']]=[i for i in chosen[r['id']] if i['face']!='front']+[x];r['cover']=x['local'];r['coverUrl']=x['sourceUrl'];r['sources']=list(dict.fromkeys(r['sources']+[x['releaseUrl']]));r['artworkEditions']=[i for i in r.get('artworkEditions',[]) if i.get('face')!='front']+[{'face':'front','local':x['local'],'sourceUrl':x['sourceUrl'],'releaseUrl':x['releaseUrl'],'country':'Netherlands','media':x['release'].get('formats'),'relationshipToPhotograph':'Dutch6500483 front; Japanese20PC1011 rear is a representative LP edition of the same Haitink/London Philharmonic complete Firebird recording.'}]
# Upright S36339 front from an alternate LP edition, retaining matching-performer rear.
r=next(x for x in rows if x['id']=='lower-middle-37')
x=next(i for i in allCandidates[r['id']] if str(i['release']['id'])=='8977212' and i.get('imageIndex')==0).copy();x['face']='front';chosen[r['id']]=[i for i in chosen[r['id']] if i['face']!='front']+[x];r['cover']=x['local'];r['coverUrl']=x['sourceUrl'];r['sources']=list(dict.fromkeys(r['sources']+[x['releaseUrl']]));r['artist']='Michel Debost / Moscow Chamber Orchestra / Rudolf Barshai';r['artworkEditions']=[i for i in r['artworkEditions'] if i.get('face')!='front']+[{'face':'front','local':x['local'],'sourceUrl':x['sourceUrl'],'releaseUrl':x['releaseUrl'],'country':x['release'].get('country'),'media':x['release'].get('formats'),'relationshipToPhotograph':'Upright representative LP cover for the same Debost/Moscow/Barshai recording and S36339 catalogue.'}]
# A misuploaded SPA189 label is a different Gregorian compilation; withhold it.
r=next(x for x in rows if x['id']=='lower-middle-07')
for key in ['label','labelUrl','labelNotes']:r.pop(key,None)
if r.get('artworkProvenance'):r['artworkProvenance'].pop('label',None)
# Sourced vinyl label references are optional enrichment, not a new capture request.
# Only actual circular label photographs verified from the candidate sheets.
labelChoices={
'upper-middle-30':(3337601,2),'upper-middle-04':(8398653,3),'upper-middle-58':(6773347,2),'upper-middle-61':(734865,2),'upper-middle-66':(519991,2),
'lower-middle-05':(15298616,1),'lower-middle-26':(12658011,2),'lower-middle-37':(11056658,2),'lower-middle-38':(8722196,1),'lower-middle-43':(5987501,2),'lower-middle-49':(3069104,2),'lower-middle-55':(24835322,2),'lower-middle-67':(1675471,2)}

for r in rows:
 if r['id'] not in labelChoices or r['confidence']!='confirmed':continue
 rid,n=labelChoices[r['id']];match=next((x for x in allCandidates[r['id']] if str(x['release']['id'])==str(rid) and x.get('imageIndex')==n and x.get('local')),None)
 if not match:continue
 x=match.copy();x['face']='label';r['label']=x['local'];r['labelUrl']=x['sourceUrl'];r['labelNotes']='Photographed vinyl label from the documented LP edition; this is a sourced-edition reference, not a photograph of the collection’s actual disc.';r.setdefault('artworkProvenance',{})['label']={'local':x['local'],'sourceUrl':x['sourceUrl'],'releaseUrl':x.get('releaseUrl') or x['release'].get('url'),'media':x['release'].get('formats'),'country':x['release'].get('country'),'editionNote':r['labelNotes']};chosen[r['id']].append(x)
# Physical ambiguities require a face pair without inventing an extra record.
groups=[{'ids':['lower-middle-25','lower-middle-26'],'box':'lower-middle','observedText':'SWBO101/The Beatles on cream gatefold beside a worn unprinted fold','anchor':[1726,2800],'recommendation':'Treat25 as conditional: if it is only a second fold of26, skip the extra pair; if a separate jacket, capture its front then back. Preserve IDs/counts until physical verification.'},{'ids':['upper-middle-38','upper-middle-39'],'box':'upper-middle','observedText':'Multicolor heavily rubbed sleeve beside a very thin unprinted cream strip','recommendation':'Check whether39 is a separate jacket or a fold while pulling38; only photograph separate physical jackets.'},{'ids':['upper-middle-67','upper-middle-68'],'box':'upper-middle','observedText':'Blank black seam and cream sleeve with faint WALTER fragment','recommendation':'Verify each is a separate record jacket; capture front/back for the actual jackets only.'}]
records=[]
for r in rows:
 b=baseline[r['id']];a={k:v for k,v in b.items() if k not in ['status','remainingCaptureNeeds']};lp=E/(r['id']+'-lp.json');queries=[];rels=[];rejected=[];errors=[];evidence=[{'type':'source_photo','source':r['photo'],'transcription':r['spineText'],'method':'Full-resolution EXIF-oriented photograph reread; straightened source strips for uncertain, probable and classical spines.'}]
 if lp.exists():
  d=json.loads(lp.read_text());queries+=d.get('searches',[]);rels+=d.get('releases',[])
  old=d.get('existingBack')
  if old:
   fm=[m.get('format') for m in old.get('media',[])]
   if not any('Vinyl' in str(m) for m in fm):rejected.append({'sourceUrl':b['before'].get('backSource'),'releaseUrl':'https://musicbrainz.org/release/'+old.get('id',''),'reason':'Existing back comes from CD packaging, not a vinyl LP sleeve.','media':fm})
 for suffix in ['manual','followup','discogs','storyteller','exactcode','us','upright','alternate','ringo']:
  f=E/(r['id']+'-'+suffix+'-candidates.json')
  if f.exists():
   d=json.loads(f.read_text());queries+=d.get('queries',[])
   if d.get('url'):queries.append({'url':d['url'],'query':d.get('query'),'resultCount':len(d.get('results',[]))})
   if d.get('error'):errors.append({'source':str(f.relative_to(ROOT)), 'error':d['error']})
 for s in r.get('sources',[]):evidence.append({'type':'reference','url':s})
 added=[]
 for x in chosen[r['id']]:
  rel=x['release'];url=rel.get('url') or x.get('releaseUrl') or 'https://www.discogs.com/release/'+str(rel['id']);added.append({'face':x['face'],'local':x['local'],'sourceUrl':x['sourceUrl'],'releaseUrl':url,'media':rel.get('formats'),'country':rel.get('country'),'catalogues':rel.get('labels',[]),'editionNote':'Representative or catalogue-matching vinyl LP; exact photographed pressing remains unverified.','visualReview':('accepted_vinyl_label_reference' if x['face']=='label' else 'accepted_actual_'+x['face']+'_sleeve')})
  if x.get('sourceCrop'):added[-1]['sourceCrop']=x['sourceCrop'];added[-1]['uncroppedLocal']=x['uncroppedLocal']
  evidence.append({'type':'LP_artwork','url':url,'sourceUrl':x['sourceUrl'],'media':rel.get('formats'),'face':x['face']})
 # Clear reasons for deliberately rejected tempting faces.
 legacyFrontRejections={'upper-middle-03':'Special New Edition front advertised all film songs, unlike the original LP programme; replaced with the original-programme vinyl front.','upper-middle-31':'Legacy front visibly had Compact Disc logo/catalogue393720-2; replaced with Canadian SP4831 LP front.','upper-middle-37':'Legacy front advertised30th Anniversary Deluxe Edition; replaced with period MCA2-10003 LP front.','upper-middle-50':'Legacy front had a Compact Disc logo; replaced with face-reviewed PC32450 vinyl jacket.'}
 if r['id'] in legacyFrontRejections:rejected.append({'sourceUrl':b['before'].get('frontSource'),'local':b['before'].get('front'),'reason':legacyFrontRejections[r['id']]})
 if r['id']=='upper-middle-66':rejected.append({'sourceUrl':next((x.get('sourceUrl') for x in allCandidates[r['id']] if x.get('face')=='back'),None),'reason':'CAA back is a Tom’s Diner single sleeve despite album metadata; replaced with the actual Solitude Standing LP rear.'})
 if r['id']=='lower-middle-13':rejected.append({'reason':'Wide CAA composite and wide Discogs inner gatefold are not a single rear face; selected the square rear at Discogs1428098 image2.'})
 if r['id']=='lower-middle-05':rejected.append({'sourceUrl':next((x.get('sourceUrl') for x in allCandidates[r['id']] if str(x['release']['id'])=='15298616' and x.get('imageIndex')==1),None),'reason':'Dutch6500483 image1 is a red Philips SIDE1 vinyl label with a centre hole, not an outer rear. Replaced with the actual Japanese20PC1011 rear for the same Haitink/LPO recording.'})
 if r['id']=='upper-middle-30':rejected.append({'sourceUrl':next((x.get('sourceUrl') for x in allCandidates[r['id']] if x.get('face')=='back'),None),'reason':'CAA image labeled vinyl-back has CD-style side spines EAP9037X and a BONUS TRACKS section; it is expanded CD packaging. Replaced with the original-programme SWAL3413 LP outer rear.'})
 if r['id']=='lower-middle-26':rejected.append({'reason':'Discogs images1 and2 show the gatefold interior tracklist/portraits; selected image3, the actual plain rear.'})
 if r['id']=='lower-middle-07':rejected.append({'sourceUrl':next((x.get('sourceUrl') for x in allCandidates[r['id']] if str(x['release']['id'])=='3958360' and x.get('imageIndex')==1),None),'reason':'SPA189 label says The World of Gregorian Chant, a different compilation from SPA4034 Kyriale/Prières Litaniques. Misuploaded label reference withheld after full-size visual review.'})
 if r['id']=='lower-middle-07':rejected.append({'reason':'Discogs34229644 image0 shows a neighboring unrelated LP. The actual Gregorian front/back are images1/2.'})
 if r['id']=='lower-middle-53':rejected.append({'reason':'Turnabout TV34057 artwork withheld because the spine cannot establish the performer/edition; earlier Maurice André attribution is unsupported.'})
 if r['id']=='lower-middle-37':rejected.append({'reason':'The first S36339 front scan was upside down. Replaced with an upright same-recording S36339 LP sleeve; no photo pixels modified.'})
 if r['id']=='lower-middle-40':rejected.append({'reason':'1977 Karajan recording/2530884 and related later-recording editions rejected after source code SLPM138920 reread. Same work and conductor are not enough to match recording.'})
 if r['id']=='lower-middle-35':
  queries.append({'query':'WGS8196 alternate LP-back search','url':'https://www.ebay.com/itm/370767116192','result':'Seller-owned physical LP confirms1972/WGS8196 and Grujon/Mony/Alister; gallery has1 front only. kimba WGS8196b.jpg returns404.'})
  evidence.append({'type':'seller_physical_LP','url':'https://www.ebay.com/itm/370767116192','supports':'WGS8196 identity, performers,1972; no rear image.'})
 if r['id']=='lower-middle-49':rejected.append({'reason':'French ST3922F and Necco-branded US promotional Storyteller sleeves do not match the likely Canadian English jacket; searched regular US/Canadian edition alternatives.'})
 needs=[];why=[]
 if r['confidence']!='confirmed':needs=['front','back'];why.append('Album identity or performer/edition is unresolved from the worn source spine.')
 if not r.get('cover'):needs=['front','back'];why.append('No confidently matched usable LP front scan was found after the documented searches.')
 if not r.get('backUrl'):needs=['front','back'];why.append('No usable, face-verified LP rear scan was found after alternate LP-edition searches.')
 if r['id']=='lower-middle-25':why=['Possible second fold of White Album26; a distinct physical jacket has not been established. Capture only if it is separate.'];needs=['front','back']
 if r['id']=='upper-middle-22':why.append('Faint catalogue resembles FC39298; Arnold Schwarzenegger’s Total Body Workout is a lead, not an established identity.')
 if r['id']=='upper-middle-68':why.append('WALTER fragment is insufficient to choose an artist or album; generic Walter search rejected.')
 if r['confidence']=='unknown' and not queries and r['id']!='lower-middle-25':why=['The full-resolution spine has no reliable title, artist or catalogue to search. Online identity matching is not justified; capture the actual jacket front and back.']
 reason=' '.join(why) if why else 'Photographed album identity is supported; usable front and rear sleeve references are available from verified vinyl LP editions. Exact physical pressing remains unverified.'
 a.update(title=r['title'],artist=r['artist'],confidence=r['confidence'],spineText=r['spineText'],status='capture_required' if needs else 'complete_reference_artwork',neededFaces=needs,reason=reason,queries=queries,evidence=evidence,searchedReleases=[{k:v for k,v in x.items() if k!='images'} for x in rels],imagesAdded=added,rejectedCandidates=rejected,blockedRequests=errors,remainingCaptureNeeds=[{'faces':needs,'reason':reason}] if needs else [],physicalGroup=next((g for g in groups if r['id'] in g['ids']),None),finalArtwork={'front':r.get('cover'),'frontSourceUrl':r.get('coverUrl'),'back':r.get('backUrl'),'backSourceUrl':r.get('backSourceUrl')})
 a['searchedCodes']=[{'query':q.get('query'),'url':q.get('url')} for q in queries if isinstance(q,dict) and ('catno' in str(q.get('query','')).lower() or 'catalog' in str(q.get('query','')).lower())]
 records.append(a)
assert len(rows)==138 and len({r['id'] for r in rows})==138
for r in rows:assert r['position']==baseline[r['id']]['position'] and r['box']==baseline[r['id']]['box']
P.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
summary={'total':138,'fronts':sum(bool(r.get('cover')) for r in rows),'backs':sum(bool(r.get('backUrl')) for r in rows),'confidence':dict(collections.Counter(r['confidence'] for r in rows)),'captureRecords':sum(bool(a['neededFaces']) for a in records),'capturePhotos':sum(len(a['neededFaces']) for a in records),'newFronts':sum(bool(r.get('cover')) and not baseline[r['id']]['before'].get('front') for r in rows),'newBacks':sum(bool(r.get('backUrl')) and not baseline[r['id']]['before'].get('back') for r in rows),'labelPhotographs':sum(bool(r.get('label')) for r in rows),'status':'complete_deep_pass','limitations':'Reference LP images preserve album/performer evidence but cannot reproduce the exact wear or establish matrix/pressing details. Unreadable identities remain placeholders. Conditional gatefold groups retain stable IDs until physical inspection.'}
AP.write_text(json.dumps({'version':2,'records':records,'physicalGroups':groups,'summary':summary,**({'qualityReview':oldAudit['qualityReview']} if oldAudit.get('qualityReview') else {})},ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,indent=2))
