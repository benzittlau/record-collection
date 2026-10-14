"""Apply visually reviewed LP faces and emit the final 126-record audit.

Candidate metadata remains in deep-left-* evidence files. This script does not
edit masks, the merged catalogue, or the application. All scans are references;
matching a spine catalogue number never proves the family's exact pressing.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, collections, re

ROOT = Path(__file__).resolve().parents[2]
R = ROOT / 'site/research'
D = ROOT / 'site/dist'
read = lambda name: json.loads((R / name).read_text())
rows = read('left.json')
baseline = {r['id']: r for r in read('deep-left-baseline.json')}
caa = read('deep-left-art-proposals.json')
discogs = read('deep-left-discogs-proposals.json')
extra = read('deep-left-extra-art.json')
groups = read('deep-left-physical-groups.json')
selections = {}

def image_path(local):
    served = D / local.lstrip('/')
    return served if served.exists() else R / 'artwork-candidates' / Path(local).name

def face_record(image, face, edition, release_url, review, crop=None):
    return {**image, 'face': face, 'releaseUrl': release_url,
            'edition': edition, 'visualReview': review,
            'editionNote': 'Representative vinyl LP edition. Album identity is supported, but the exact photographed pressing, matrix, and wear are not established.',
            **({'crop': crop} if crop else {})}

for row in rows:
    rid = row['id']; candidate = caa[rid]
    selection = {}
    if candidate.get('artRelease'):
        edition = candidate['artRelease']
        for face, image in candidate.get('artwork', {}).items():
            selection[face] = face_record(image, face, edition, edition['url'], 'accepted_actual_outer_'+face if face != 'label' else 'accepted_matching_LP_label')
    selections[rid] = selection

# Image numbers are human-reviewed positions in a release's image series, not
# inferred from Discogs' primary/secondary flags. Interiors are never rear faces.
dg_choices = {
 'upper-left-02': (None, 1, 2, 3), 'upper-left-05': (None, 1, 2, None),
 'upper-left-11': (None, 1, 2, 5), 'upper-left-14': (None, 1, 2, 3),
 'upper-left-15': (None, 1, 2, 3), 'upper-left-21': (None, 1, 2, 3),
 'upper-left-24': (None, 1, 2, 3), 'upper-left-33': (None, 1, 3, 4),
 'upper-left-35': (None, 1, 2, 3), 'upper-left-39': (None, 1, 2, 3),
 'upper-left-47': (None, 1, 4, 5), 'upper-left-49': (None, 1, 2, 3),
 'upper-left-53': (None, 1, 2, 3), 'upper-left-54': (None, 1, 2, 3),
 'lower-left-05': (None, 1, 2, 3), 'lower-left-15': (None, 1, 2, 3),
 'lower-left-20': (None, 1, 2, 3), 'lower-left-26': (4352045, 1, 5, 3),
 'lower-left-29': (None, 1, 2, 3), 'lower-left-08': (None, 1, 2, 3),
 'lower-left-19': (None, 1, 2, 3), 'lower-left-34': (8297708, 1, 2, 3),
 'lower-left-35': (None, 1, 2, 3), 'lower-left-37': (None, 1, 2, 3),
 'lower-left-51': (None, 1, 2, 3), 'lower-left-58': (None, 1, 2, 3),
 'lower-left-60': (3292109, 1, 2, 5), 'lower-left-66': (None, 1, 2, 4),
}
ex_choices = {
 'upper-left-03': (7919524, 1, 2, 3), 'upper-left-09': (1549003, 1, 2, 3),
 'upper-left-17': (8281798, 1, 2, 3), 'upper-left-27': (2268945, 1, 2, 3),
 'upper-left-34': (4887643, 1, 2, 3), 'upper-left-43': (11799266, 1, 2, 5),
 'upper-left-52': (3445092, 1, 2, 3), 'lower-left-44': (618964, 1, 4, 5),
}

def select_discogs(report, choices):
    for rid, (reid, front, back, label) in choices.items():
        candidates = report[rid]['candidates']
        c = next((v for v in candidates if v['releaseId'] == reid), candidates[0])
        edition = {k: c.get(k) for k in ['releaseId','title','artist','country','year','formats','labels']}
        selection = {}
        for face, index in [('front',front), ('back',back), ('label',label)]:
            if index is None: continue
            im = next(v for v in c['images'] if v['index'] == index and v.get('path'))
            selection[face] = face_record(im, face, edition, c['releaseUrl'], 'accepted_actual_outer_'+face if face != 'label' else 'accepted_matching_LP_label')
        selections[rid] = selection

select_discogs(discogs, dg_choices)
select_discogs(extra, ex_choices)
owner = extra['lower-left-48']
selections['lower-left-48'] = {
    v['face']: face_record(v, v['face'], owner['edition'], 'https://www.searchingforagem.com/1970s/1972.htm', 'accepted_owner_scan_Canadian_C31104_LP')
    for v in owner['ownerImages'] if v.get('path')
}

# Literal outer panels from genuine folded jacket scans; no image synthesis.
for rid, crop in [('lower-left-10',(0,0,792,804)), ('upper-left-42',(0,0,604,596))]:
    original = selections[rid]['back']
    out = '/assets/covers/'+rid+'-lp-back-panel.jpg'
    with Image.open(image_path(original['path'])) as im:
        im.crop(crop).save(D / out.lstrip('/'), quality=95)
    original['path'] = out
    original['crop'] = {'sourceLocal': '/assets/covers/'+rid+'-lp-back.jpg', 'sourceSize': original['localSize'], 'rectangle': list(crop), 'method': 'Literal outer rear panel crop of front/back/spine scan; no retouching or reconstruction.'}
    original['localSize'] = [crop[2]-crop[0], crop[3]-crop[1]]
    original['visualReview'] = 'accepted_actual_LP_outer_back_panel_from_spread'

# The archive medium photograph shows an entire disc. Keep only its actual
# printed centre label for the illustrated disc, without recoloring or synthesis.
rid = 'lower-left-32'; original = selections[rid]['label']; crop = (356,357,842,843)
out = '/assets/covers/'+rid+'-lp-label-panel.jpg'
with Image.open(image_path(original['path'])) as im:
    im.crop(crop).save(D / out.lstrip('/'), quality=95)
original['path'] = out
original['crop'] = {'sourceLocal':'/assets/covers/'+rid+'-lp-label.jpg','sourceSize':original['localSize'],'rectangle':list(crop),'method':'Literal printed centre label crop of an LP disc photograph; no retouching or reconstruction.'}
original['localSize'] = [486,486]

rejections = {
 'upper-left-02': ['Initial spine transcription KC34167 rejected; full-resolution code reads KC34162.'],
 'upper-left-19': ['Initial Crosby solo identity, artwork, and Spotify ID rejected. SD7220 and both names identify Graham Nash / David Crosby (1972); solo Crosby is SD7203.'],
 'upper-left-29': ['Initial Through the Past, Darkly identity, artwork, and Spotify ID rejected: that album is NPS3. The photographed spine reads NPS2, Their Satanic Majesties Request.'],
 'upper-left-34': ['Initial SR2110 transcription rejected; magnified original spine reads SR2108. Canadian Discogs2198152 image2 is a label, not a rear sleeve; alternate US4887643 supplies actual rear.'],
 'upper-left-37': ['Initial CAA catalogue CDN17812 is a three-track 12-inch promo, not the photographed full Born in the U.S.A. album. Replaced by the correct album LP.'],
 'upper-left-60': ['UK1967 MMT1 double7-inch EP artwork excluded as the photographed Capitol album is a 12-inch LP. Representative original US mono MAL2835 scans retained; family SMAL2835 stereo pressing unverified.'],
 'upper-left-09': ['First Canadian Discogs9891134 has front+label only, not a rear; alternate Canadian1549003 provides the exterior rear.'],
 'upper-left-33': ['Discogs image2 is the inside gatefold, not a rear; image3 is the exterior rear.'],
 'upper-left-47': ['Discogs images2/3 are inside gatefold essays; image4 is actual outer back.'],
 'lower-left-08': ['Same-title 7-inch single artwork rejected; selected full1979 Broken English LP.'],
 'lower-left-20': ['Same-title B8108 single sleeve rejected; full SOO17062 LP programme selected.'],
 'lower-left-26': ['Discogs8982727 advance promo label-only candidate not a front/back sleeve; actual Australian LS6005 LP chosen, rear image5.'],
 'lower-left-27': ['WB17468 same-title 7-inch single rejected; correct full1979 two-LP album2HS3350 selected.'],
 'lower-left-28': ['Same-title1979 Europa compilation rejected; photographed1975 MS2225 studio album selected.'],
 'lower-left-29': ['Legacy CAA Japanese1991 CD rear/tray rejected and replaced with Canadian BTM9188-5000 vinyl LP front/back.'],
 'lower-left-44': ['CAA release e3632a58 taggedVinyl has misattached CD rear with tray spine/barcode; rejected. UK original two-LP Discogs618964 image4 is actual exterior rear; images2/3 are gatefold interiors.'],
 'lower-left-48': ['Initial ST114 code reading rejected; source reads David Bromberg and C31104-like digits, consistent with self-titled LP. Release year left null because1971copyright/MB dating conflicts with documented1972 commercial release.'],
 'lower-left-52': ['Initial ST11793 code assertion rejected. Title/artist survive but code is worn/overlapped; selected representative Canadian STAO6476 LP does not prove family pressing.'],
 'lower-left-53': ['Unknown title replaced by clearly readable Third Ear Band ALCHEMY in overlapping adjacent source strip. Geometry52 currently intersects that text, so catalogue53 binding remains probable rather than silently renumbering.'],
 'lower-left-66': ['Discogs25522549 image3 is an incorrectly uploaded U2 War label (Sunday Bloody Sunday/Seconds/New Year’s Day). Rejected; image4 reads A Child’s Adventure and is the matching LP label.'],
}
uncertain = {
 'upper-left-06': 'No surviving artist/title/catalogue code on the brown edge. Could be a folded leaf of Anthology; no guessed identity assigned.',
 'upper-left-07': 'ABC RECORDS INC. / LITHO IN CANADA survives, but no album title or readable catalogue number. Label/color alone cannot select a Steely Dan or other ABC album.',
 'upper-left-20': 'No independent readable identity on the black edge following the Crosby & Nash jacket; possible folded leaf or overlapping geometry.',
 'upper-left-36': 'Worn blue strip has no reliable artist/title/catalogue digits. Neighboring Todd/Leon titles and color do not establish identity.',
 'upper-left-40': 'Overlapping crop repeats DAVID BROMBERG / DEMON IN DISGUISE; may be same jacket or split edge. Independent physical album is unproven.',
 'lower-left-07': 'Partial Van der Graaf / Charisma survives but the title/code is erased. Godbluff and other black Charisma sleeves cannot be distinguished from these pixels.',
 'lower-left-12': 'Blank dark edge between Eagles and Hendrix has no independent text; possible thick Hendrix gatefold leaf.',
 'lower-left-18': 'Handwritten cream strip is too worn to interpret reliably; no guessed handwritten title assigned.',
 'lower-left-45': '©1974 WARNER BROS. survives but is not an album identifier. May be folded rear edge of Before the Flood.',
 'lower-left-47': 'Pale edge has no independent identity; possible neighboring Bromberg leaf or source-mask overlap.',
 'lower-left-50': 'TRUE NORTH label fragment is reliable, but artist/title/code are not. No Bruce Cockburn album guessed from the label alone.',
 'lower-left-57': 'Pure Prairie League / RCA survives; album title/catalogue digits do not. Bustin’ Out, self-titled, Dance and other RCA sleeves cannot be selected honestly.',
 'lower-left-61': 'Narrow pale-yellow edge is unreadable and may be part of Self Portrait gatefold; independent sleeve needs physical confirmation.',
}
promote = {'upper-left-28','upper-left-30','upper-left-52','lower-left-05','lower-left-11','lower-left-17','lower-left-44'}
binding = {'upper-left-50'} | {f'upper-left-{i:02d}' for i in range(53,58)} | {f'lower-left-{i:02d}' for i in range(46,54)}
manual = read('deep-left-manual-mb.json')
api_cache = read('deep-left-api-cache.json')
dg_cache = read('deep-left-discogs-evidence.json')
ex_cache = read('deep-left-extra-evidence.json')
artist_leads = read('deep-left-unknown-artist-leads.json')
audit = []

for row in rows:
    rid = row['id']; old = baseline[rid]; selected = selections[rid]
    if rid in promote: row['confidence'] = 'confirmed'
    if rid == 'upper-left-02': row['spineText'] = 'KC 34162 · SHAKTI — WITH JOHN McLAUGHLIN'
    if rid == 'upper-left-34': row['spineText'] = 'STOP ALL THAT JAZZ · LEON RUSSELL · SR 2108 · SHELTER'
    if rid == 'upper-left-20': row['spineText'] = 'Worn black edge immediately after Graham Nash / David Crosby SD7220'
    if rid == 'lower-left-50': row['spineText'] = 'Worn blue-gray strip · TRUE NORTH label fragment; title/code unreadable'
    for face, path_field, url_field in [('front','coverPath','coverUrl'),('back','backPath','backUrl'),('label','label','labelUrl')]:
        im = selected.get(face)
        row[path_field] = im.get('path') if im else None
        row[url_field] = im.get('sourceUrl') if im else None
        if im:
            with Image.open(D / im['path'].lstrip('/')) as check: check.verify()
            row[face+'Edition'] = im['editionNote']
    row['artworkProvenance'] = selected
    row['artworkEdition'] = 'Visually verified vinyl LP archive scans; per-face release/media/country/catalogue provenance is recorded. Exact family pressing and wear remain unverified.' if selected else None
    row['sources'] = list(dict.fromkeys(row.get('sources',[]) + [v['releaseUrl'] for v in selected.values()]))
    if rid in rejections:
        correction = ' Deep audit: ' + ' '.join(rejections[rid])
        if correction not in row.get('notes',''): row['notes'] = row.get('notes','') + correction
    if rid in promote:
        row['notes'] = row.get('notes','').replace('Probable album identity from partial spine text/catalogue number. Needs a front-cover photo to confirm; exact pressing unverified.', 'Deep source/catalogue reread supports the album identity. Exact physical pressing remains unverified.')
    group = next((g for g in groups if rid in g['catalogueIds']), None)
    missing = [f for f in ['front','back'] if f not in selected]
    needs = bool(missing or row['confidence'] != 'confirmed' or rid in binding)
    reason = uncertain.get(rid)
    if not reason:
        if rid in binding: reason = 'Album is present in the original source, but several adjacent masks cross neighboring spine text. Physical front/back pairs are needed to establish jacket order and slot binding.'
        elif row['confidence'] == 'probable': reason = 'Album identity is supported by partial title/catalogue evidence but needs an actual front/back pair for confirmation; archive scans do not prove the physical binding/pressing.'
        elif missing: reason = 'No usable outer '+('/'.join(missing))+' scan acquired after the documented LP sources; front/back pair requested.'
        else: reason = 'Photographed album identity is supported and usable outer front/back scans are available from visually verified LP editions. Exact pressing and family wear remain unverified.'
    ca = caa[rid]; dg = discogs.get(rid,{}); ex = extra.get(rid,{})
    queries = ca.get('attempts',[]) + dg.get('attempts',[]) + ex.get('attempts',[])
    if rid in uncertain:
        crop = R / ('deep-left-spine-'+rid+'.jpg')
        queries.append({'method':'full_resolution_source_spine_reinspection','evidenceFile':str(crop.relative_to(ROOT)) if crop.exists() else 'Original EXIF-oriented source photo','outcome':uncertain[rid]})
    if rid in artist_leads:
        lead = artist_leads[rid]
        queries.append({'method':'primary_album_discography_comparison','query':lead['query'],'url':lead['url'],'cataloguedGroups':len(lead.get('data',{}).get('release-groups',[])),'outcome':'Multiple artist albums exist; no surviving title or catalogue number selects one. No candidate assigned from sleeve color alone.'})
    if rid in manual: queries.append({'manualCatalogueResearch': manual[rid]})
    searched = ca.get('vinylReleases',[]) + dg.get('vinylVersions',[]) + ex.get('versions',[])
    blocked = []
    release_ids = [r.get('id') for r in ca.get('vinylReleases',[])]
    for cache in [api_cache,dg_cache,ex_cache]:
        for url, value in cache.items():
            if value.get('ok'): continue
            if any(str(reid) in url for reid in release_ids if reid) or url in dg.get('attempts',[]) or url in ex.get('attempts',[]):
                blocked.append({'url':url,'errors':value.get('errors') or value.get('error')})
    if rid == 'upper-left-17': blocked.append({'url':'https://www.45cat.com/vinyl/album/ke32895','errors':'HTTP403 page/image requests; alternate Canadian Discogs LP supplied accepted fronts/backs instead.'})
    if rid == 'lower-left-48': blocked.append({'url':'https://thefm.club/searchingforagem/1970s/1972.htm','errors':'HTTP403 direct page request; official www.searchingforagem.com host supplied original owner scans successfully.'})
    evidence = [{'type':'source_photo','source':row['photo'],'transcription':row['spineText'],'method':'Full-resolution EXIF-oriented source reread, with straightened/cropped uncertain spines; original box pixels are unchanged.'}]
    evidence += [{'type':'reference','url':u} for u in row['sources']]
    audit.append({'id':rid,'box':row['box'],'position':row['position'],'before':old,
        'title':row['title'],'artist':row['artist'],'confidence':row['confidence'],'spineText':row['spineText'],
        'identityEvidence':evidence,'identificationOutcome':'unidentified' if row['confidence']=='unknown' else ('probable_album' if row['confidence']=='probable' else 'confirmed_album'),
        'catalogueMatch': {'photographed':row['spineText'],'acceptedReleaseCatalogue': [v.get('edition',{}) for v in selected.values()][:1], 'exactPressingVerified':False},
        'queries':queries,'searchedReleases':searched,'evidence':evidence,
        'imagesAdded':[{'face':face,'local':v['path'],'sourceUrl':v['sourceUrl'],'releaseUrl':v['releaseUrl'],'edition':v['edition'],'visualReview':v['visualReview']} for face,v in selected.items()],
        'rejectedCandidates':rejections.get(rid,[]),'blockedRequests':blocked,
        'physicalGroup':group['id'] if group else None,'finalArtwork':{face:v['path'] for face,v in selected.items()},
        'status':'needs_physical_confirmation' if needs else 'complete_reference_artwork',
        'neededFaces':['front','back'] if needs else [],'reason':reason,
        'remainingCaptureNeeds':['front','back'] if needs else [],
        'captureConditional':bool(rid in uncertain and group and 'possible' in group['confidence'])})

assert len(rows) == 126 and len({r['id'] for r in rows}) == 126
for row in rows:
    old = baseline[row['id']]
    for key in ['id','box','position','compartment','compartmentPosition','photo']:
        assert row[key] == old[key], (row['id'],key)
summary = {'total':126,'fronts':sum(bool(r.get('coverPath')) for r in rows),'backs':sum(bool(r.get('backPath')) for r in rows),
           'labels':sum(bool(r.get('label')) for r in rows),'confidence':dict(collections.Counter(r['confidence'] for r in rows)),
           'captureRecords':sum(bool(r['neededFaces']) for r in audit),'capturePhotosBeforeConditionalGrouping':sum(len(r['neededFaces']) for r in audit),
           'status':'complete_deep_pass','limitations':'Stable slots are preserved. Source spines can prove album presence but cannot establish unreadable jackets, exact pressing, or folded-leaf relationships. All 113 identified albums have representative visually verified LP outer-front/back scans; uncertain physical groups require pairs of actual jackets, not thin-edge counting.'}
(R/'left.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(R/'deep-left-art-selections.json').write_text(json.dumps(selections,ensure_ascii=False,indent=2)+'\n')
(R/'deep-left-audit.json').write_text(json.dumps({'version':1,'records':audit,'physicalGroups':groups,'summary':summary},ensure_ascii=False,indent=2)+'\n')

# Final accepted images only, arranged front/back/label for independent visual QA.
artrows = [r for r in rows if selections[r['id']]]
for start in range(0,len(artrows),6):
    out=Image.new('RGB',(950,2050),(22,22,22));draw=ImageDraw.Draw(out)
    for k,row in enumerate(artrows[start:start+6]):
        y=k*340;draw.text((10,y+5),row['id']+' | '+row['artist']+' — '+row['title'],fill='white')
        sel=selections[row['id']]
        for j,face in enumerate(['front','back','label']):
            if face not in sel:continue
            im=Image.open(D/sel[face]['path'].lstrip('/')).convert('RGB');im.thumbnail((285,285));x=15+j*315;out.paste(im,(x,y+36));draw.text((x,y+323),face,fill='white')
    out.save(R/f'deep-left-accepted-contact-{start//6+1:02d}.jpg',quality=95)
print(json.dumps(summary,indent=2))
