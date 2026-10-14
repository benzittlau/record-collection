"""Seal the staged left-box Spotify audit from saved public-page evidence.

No canonical catalogue, artwork, mask, application, or merge file is written.
Rerunning is idempotent: selection IDs are frozen in the existing audit.
"""
from pathlib import Path
import json, re, hashlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
AUDIT = HERE.parent / 'spotify-link-audit-left.json'
d = json.loads(AUDIT.read_text())
eligible = json.loads((HERE / 'eligible.json').read_text())

FINAL_SEARCHES = [
 {'rowIds':['upper-left-51','lower-left-29','upper-left-53','lower-left-36'],
  'queries':[
   {'q':'site:open.spotify.com/album "Queen" "Jazz" "2011"'},
   {'q':'site:open.spotify.com/album "Caravan" "Cunning Stunts"'},
   {'q':'site:open.spotify.com/album "Graham Parker" "Up Escalator"'},
   {'q':'site:open.spotify.com/album "Rodney Dangerfield" "No Respect"'}],
  'resultUrls':['https://open.spotify.com/embed/album/7nYftNpa1Bnq12jdIwfI5x','https://open.spotify.com/album/4mbkkOGZS6inHP2di2jaqS','https://open.spotify.com/track/1KtyO0S2K91XeQauf0rxWZ','https://open.spotify.com/track/1OQvfPCelhK9esGPexCdeD','https://open.spotify.com/track/6s3lVNHlJWyZ2EeY4Gs4wl']},
 {'rowIds':['lower-left-29','lower-left-36','lower-left-44','upper-left-51'],
  'queries':[
   {'q':'site:open.spotify.com/album "Cunning Stunts" "2014" "Caravan"'},
   {'q':'site:open.spotify.com/album "Rodney Dangerfield" "No Respect" album'},
   {'q':'site:open.spotify.com/album "Bob Dylan" "Before The Flood" "1974"'},
   {'q':'site:open.spotify.com/album "Queen" "Jazz" "13"'}],
  'resultUrls':['https://open.spotify.com/album/2Oo8yc2V4nJNP2Dhh9jMTl','https://open.spotify.com/album/4x2uIowAS86Dtkx3zqz17V','https://open.spotify.com/album/2h2Z8tLHC46ymGNXgfo6Fa','https://open.spotify.com/artist/4y9clGQlMhZyKADUMq7PA2']},
 {'rowIds':['upper-left-52','lower-left-17','lower-left-17','lower-left-24'],
  'queries':[
   {'q':'site:open.spotify.com/album ("Payolas" OR "Payola$") "No Stranger"'},
   {'q':'site:open.spotify.com/album "Switched On Bach II" Carlos'},
   {'q':'site:open.spotify.com/album "Walter Carlos" "Bach"'},
   {'q':'site:open.spotify.com/album "The Doors" ("Thirteen" OR "13 (")'}],
  'resultUrls':['https://open.spotify.com/album/2b18Z6WF5nT8oFjhZ6lkUC','https://open.spotify.com/embed/album/1jWmEhn3ggaL6isoyLfwBn','https://open.spotify.com/embed/album/437coS14MKFBIjXNj3bRAC','https://open.spotify.com/album/4YBBkcBOQi0kPcC89c3gof','https://open.spotify.com/album/6L7S7OhaXdnqksET67m0gJ'],
  'outcome':'No candidate for the original Payola$ or Wendy Carlos albums; Doors hits refer to the 1967 debut, other compilations, or concert programmes.'}
]
(HERE / 'searches-final.json').write_text(json.dumps(FINAL_SEARCHES, ensure_ascii=False, indent=2)+'\n')

NOTES = {
 'upper-left-03':'Same ten-track 1973 Siegel-Schwall Band programme; digital rights notice is 2022.',
 'upper-left-05':'Same sixteen-track 1972 Steve Miller Band Anthology programme. Spotify displays the digital issue date 1991; the physical album remains dated 1972.',
 'upper-left-09':'Same eight-track 1975 Pointer Sisters Steppin’ programme.',
 'upper-left-12':'2018 remaster of the original twelve-track Pretenders debut.',
 'upper-left-13':'Same eleven-track 1975 Pure Prairie League album; Spotify displays a 1993 digital issue date.',
 'upper-left-14':'Same 1975 Initiation programme; the LP’s long A Treatise on Cosmic Fire side is divided into four digital tracks. Spotify’s generic first suite title represents the 4:21 introductory section, followed by the three named sections. Ten digital tracks do not imply a different album.',
 'upper-left-17':'Same eight-track 1974 Poco Seven programme, verified via the album page and the parent-album URI on a Spotify song page.',
 'upper-left-19':'This is the 1972 Graham Nash/David Crosby album, credited to Crosby & Nash on the family spine and Graham Nash & David Crosby on Spotify; eleven-track programme matches.',
 'upper-left-25':'Remastered original US December’s Children (And Everybody’s) twelve-track programme.',
 'upper-left-26':'50th Anniversary remaster with the ten original Beggars Banquet tracks.',
 'upper-left-27':'The four-track 1974 Utopia debut. The opening LP track Utopia is titled Utopia Theme on this digital edition; Freak Parade, Freedom Fighters, and The Ikon confirm the original recording programme.',
 'upper-left-28':'2019/50th Anniversary remaster, nine original Let It Bleed tracks.',
 'upper-left-29':'50th Anniversary Special Edition contains the original ten-track Their Satanic Majesties Request programme twice: stereo tracks 1–10, then mono tracks 11–20. This is an expanded digital edition of the same 1967 album.',
 'upper-left-30':'Spotify calls the 1973 reunion album The Byrds. Full Circle, Sweet Mary, Changing Heart and the eleven-track programme identify Byrds (1973), rather than a similarly named hits compilation.',
 'upper-left-31':'Original 1977 Love You Live double-album programme. The digital release uses eighteen tracks and incorporates stage introduction/medley indexing; it is the original live album, not a later concert recording.',
 'upper-left-33':'Same eleven-track 1975 Linda Ronstadt Prisoner in Disguise programme.',
 'upper-left-34':'Ten original Stop All That Jazz tracks followed by two additional digital tracks; same Leon Russell 1974 album.',
 'upper-left-35':'2015 remaster of the full seventeen-track 1974 Todd programme. Automated title comparison misses Number 1 versus No. 1 Lowest Common Denominator; manual review confirms that track.',
 'upper-left-39':'Same nine-track 1972 David Bromberg Demon in Disguise programme.',
 'upper-left-41':'Expanded sixteen-track digital issue of Graham Parker’s 1982 Another Grey Area; original album programme is retained with additional tracks.',
 'upper-left-43':'All eleven original Pastiche tracks are present, followed by the additional Single Girl.',
 'upper-left-44':'The original seven-track 1973 Over-Nite Sensation programme appears under Frank Zappa on Spotify; the family LP is credited to The Mothers of Invention.',
 'upper-left-46':'Spotify spells the title Floating Worlds (plural), while the LP is Floating World. Jade Warrior, 1974, and the ten-track programme beginning Clouds, Mountain of Fruit and Flowers, and Waterfall identify the same album.',
 'upper-left-48':'Fragile (Super Deluxe) has forty-six tracks. Its first nine are the complete original 1971 album; the remaining tracks are alternate mixes, performances, and extras. Public HTML exposes thirty track rows, with totalCount forty-six.',
 'upper-left-49':'The expanded eighteen-track digital version of the 1988 OMD compilation retains all fourteen songs on family LP VL 2454, with four additional tracks and a changed running order. It is the same compilation expanded for digital release.',
 'upper-left-51':'2011 remaster of Jazz, retaining all thirteen original tracks in order, followed by two 1991 bonus remixes. This variant has all fifteen tracks publicly marked playable in the CA page session; the older thirteen-track candidate had Leaving Home Ain’t Easy blocked.',
 'upper-left-53':'The original ten-track 1980 Up Escalator album under Graham Parker & The Rumour. Preferred over the twelve-track Lemon edition because this primary Spotify page lists Canada and all original tracks are marked playable.',
 'upper-left-55':'Same ten-track 1973 Pointer Sisters debut.',
 'upper-left-59':'Expanded digital edition of the ten-track 1981 Somewhere in England album, with two additional tracks.',
 'upper-left-60':'2009 remaster of the eleven-track US Magical Mystery Tour LP programme. This corresponds to the full family LP, rather than the shorter UK double-EP programme.',
 'lower-left-02':'Same 1973 Deodato 2 album: the six original LP tracks followed by Venus and Do It Again as extra digital tracks.',
 'lower-left-05':'Same eleven-track 1969 Dan Hicks & His Hot Licks Original Recordings album.',
 'lower-left-10':'Same nine-track 1972 Emerson, Lake & Palmer Trilogy programme.',
 'lower-left-11':'2013 remaster of the original eleven-track Eagles Desperado album.',
 'lower-left-14':'The original ten-track 1974 461 Ocean Boulevard programme, selected over longer deluxe editions.',
 'lower-left-19':'Same eleven-track 1968 John Hartford album; Gentle on My Mind and Other Originals By John Hartford is the full original title.',
 'lower-left-20':'Spotify omits the title’s hyphen, Freeze Frame; the nine-track 1981 J. Geils Band programme matches Freeze-Frame.',
 'lower-left-26':'Standalone eight-track 1976 Animal Notes album by Crack the Sky, preferred over the Animal Notes / Safety in Numbers two-album issue.',
 'lower-left-28':'The eleven-track 1975 Fleetwood Mac self-titled album, not the band’s different 1968 self-titled debut.',
 'lower-left-29':'Expanded 1975 Cunning Stunts programme: seven original album tracks including the complete eighteen-minute Dabsong Conshirtoe suite, then three bonus tracks. The original Discogs LP comparison omitted the indexed suite because it was stored as a heading; it was checked manually. Several original tracks are publicly marked unavailable in the CA page session; no fully playable same-album edition was verified.',
 'lower-left-30':'Same ten-track 1978 Grateful Dead Shakedown Street programme.',
 'lower-left-31':'Same ten-track 1980 Emotional Rescue programme.',
 'lower-left-34':'Same nine-track 1981 Dangerous Acquaintances programme. For Beauty’s Sake versus For Beautie’s Sake is a spelling variation in the LP metadata, not a recording mismatch.',
 'lower-left-35':'Same twelve-track 1977 John Denver’s Greatest Hits, Volume 2 compilation; other John Denver best-of compilations were not substituted.',
 'lower-left-36':'The 1980 No Respect comedy LP, represented by its two long side recordings No Respect and Son Of No Respect. The first side is publicly marked unavailable in the CA page session; the second is playable. This is not the 1970 I Don’t Get No Respect album/single or a later best-of collection.',
 'lower-left-37':'Same nine-track 1983 Bruce Cockburn The Trouble with Normal programme.',
 'lower-left-38':'Plays On is shown as The Climax Blues Band Plays On, with the band’s early Climax Chicago Blues Band credit. Flight, Hey Baby, Cubano Chant and the nine-track 1969 programme match the original LP.',
 'lower-left-43':'Original 1976 Inner Worlds album. Spotify’s main album artist is John McLaughlin, while its track credits also name Mahavishnu Orchestra. The programme begins All In the Family, Miles Out, In My Life, and Gita and ends Inner Worlds Part I/Part II.',
 'lower-left-44':'Current Sony digital edition of the original twenty-one-track 1974 Bob Dylan/The Band Before the Flood live album. The (Live) title suffix and venue/date suffixes describe the original performances, rather than a different concert album. All twenty-one tracks are publicly marked playable and the album lists Canada.',
 'lower-left-46':'Same nine-track 1975 André Gagnon Neiges programme. Spotify identifies the original album date 1975-10-22; digital rights/mastering may differ from the family pressing.',
 'lower-left-49':'Humans (Deluxe Edition) retains the ten original 1980 Bruce Cockburn tracks and appends a live Grim Travellers; Spotify displays the 2002 digital issue date.',
 'lower-left-51':'Same ten-track 1973 Pat Garrett & Billy the Kid soundtrack; Spotify expands the title with Soundtrack From The Motion Picture.',
 'lower-left-54':'Same 1970 Eric Burdon and War double album. The fifteen digital tracks combine the Paint It Black medley into one track. War’s official album page embeds the corresponding Spotify album programme; this Canada-listed album URI is a regional edition of that programme.',
 'lower-left-55':'Same seven-track 1969 Neil Young & Crazy Horse Everybody Knows This Is Nowhere album; Spotify’s main credit is Neil Young.',
 'lower-left-56':'Same ten-track 1972 Edgar Winter Group They Only Come Out at Night programme.',
 'lower-left-58':'Same nine-track 1979 Slow Train Coming programme.',
 'lower-left-60':'Same twenty-four-track 1970 Self Portrait programme; the original live Isle of Wight tracks remain part of this original album. Quinn the Eskimo/The Mighty Quinn title order explains the one automatic text-comparison miss.',
 'lower-left-62':'Same eleven-track 1974 Planet Waves album.',
 'lower-left-64':'Same ten-track 1969 Nashville Skyline album.',
 'lower-left-65':'Same nine-track 1985 Bryan Ferry Boys and Girls programme.',
 'lower-left-66':'Same eight-track 1983 Marianne Faithfull A Child’s Adventure programme.',
}

UNRESOLVED = {
 'upper-left-52':{
  'artist':'4BYJjT7sfnTdGzNrjL31D7',
  'reason':'No exact Spotify album URI for the original 1982 No Stranger to Danger was verified after exact-title, Payolas/Payola$ spelling, song/artist leads, and the public artist discography. The surfaced Best Of The Payolas and Between A Rock & A Hyde Place are different compilations/albums and were not substituted. This establishes an unresolved link, not a claim of worldwide Spotify absence.',
  'reject':[('0igiT9EkakWRJA7SLTeJ19','20th Century Masters / The Best Of The Payolas is a later hits compilation, not the original No Stranger to Danger programme.'),('7FyrgGNSiucyvxd9Eq0izJ','Between A Rock & A Hyde Place is a different original album.')]},
 'lower-left-17':{
  'artist':'5MmXZQUGs0eXP5PV79iKrB',
  'reason':'No exact Spotify album URI for Wendy Carlos’s original 1973 Switched-On Bach II recording was verified after exact and unhyphenated titles, Wendy/Walter Carlos credits, and the public artist discography. The public Carlos page surfaces soundtrack/other projects. Softcore Express’s Electronic Bach II is a different performer’s tribute and was rejected. No alternate Bach performance was substituted; worldwide availability remains unknown.',
  'reject':[('7wIvILO6pAlr0jl46GLXLf','Tron is a different Wendy Carlos soundtrack.'),('7sDxKqQZslSmhuRRMiJvBQ','Electronic Bach II: More Switched-On Versions is performed by Softcore Express, not Wendy Carlos.')]},
 'lower-left-24':{
  'artist':'22WZ7M8sxp5THdruNY3gXt',
  'reason':'No exact Spotify album URI for the Doors’ original 1970 compilation 13 was verified after numeric and Thirteen title searches and the public artist’s compilation/discography leads. Search results for 13 were chiefly track numbering/durations, the 1967 debut, or live albums. The Singles (2017 Remaster), The Platinum Collection and other best-of programmes differ from 13 and were not substituted. Worldwide availability remains unknown.',
  'reject':[('1jWmEhn3ggaL6isoyLfwBn','The Doors is the eleven-track 1967 debut, not the 1970 compilation 13.'),('437coS14MKFBIjXNj3bRAC','The Singles (2017 Remaster) has a different expanded singles programme.'),('6L7S7OhaXdnqksET67m0gJ','Live in Philadelphia is a live concert album; 13 is the original studio-recording compilation.')]}
}

batches=[]
for name in ['searches.json','searches-second.json','searches-region.json','searches-final.json']:
 for batch in json.loads((HERE/name).read_text()):
  batches.append((name,batch))

for r in d['records']:
 # Preserve the first documented exact query and add actual saved follow-up queries.
 queries=[r['queries'][0]]
 for name,batch in batches:
  for i,rid in enumerate(batch['rowIds']):
   if rid != r['id'] or not batch.get('queries'):continue
   q=batch['queries'][i]['q']
   queries.append({'query':q,'source':'web search','domains':batch['queries'][i].get('domains'),'evidenceFile':str((HERE/name).relative_to(ROOT))})
 r['queries']=list({q['query']:q for q in queries}.values())
 if r['status']=='matched':
  e=r['verificationEvidence'][0]
  m=json.loads((ROOT/e['evidenceFile']).read_text());a=m['album']
  assert a['spotifyId']==r['spotifyId'] and a['title']==r['spotifyTitle']
  assert m['pageTitle'] and 'Spotify' in m['pageTitle'] and a['artists'] and a['tracks']
  states=[(t.get('playability') or {}).get('playable') for t in a['tracks']]
  markets=a.get('availableMarkets',{});items=markets.get('items',[]) if isinstance(markets,dict) else []
  countries=[v.get('countryCode') for v in items]
  availability={'publicPageCountry':m.get('publicPageCountry'),
   'trackRowsObserved':len(states),'albumTotalTracks':a['trackCount'],
   'playableRows':states.count(True),'unplayableRows':states.count(False),'unknownRows':states.count(None),
   'unplayableTrackTitles':[t['title'] for t in a['tracks'] if (t.get('playability') or {}).get('playable') is False],
   'canadaInExplicitMarketList':True if 'CA' in countries else False if countries else None,
   'note':'Public-page playback flags reflect this anonymous CA session at retrieval time. A missing/empty album market list does not prove unavailability. Account, subscription, region, and future rights changes can affect actual playback.'}
  e['availabilityObservation']=availability
  r['availabilityObservation']=availability
  r['editionNotes']=NOTES.get(r['id'],f"Same original {r['physicalYear']} {r['physicalArtist']} album programme; Spotify retains the original title/artist and track sequence.")+ ' Digital mastering/pressing equivalence is not asserted.'
  r['verificationStatus']='primary-album-page-and-recording-programme-verified'
  r['unresolvedReason']=None
 else:
  info=UNRESOLVED[r['id']];u='https://open.spotify.com/artist/'+info['artist'];p=HERE/'metadata'/('artist'+info['artist'].lower()+'.json');m=json.loads(p.read_text())
  r['verificationEvidence']=[{'url':u,'source':'Spotify public artist HTML / decoded initialState discography leads','pageTitle':m['pageTitle'],'evidenceFile':str(p.relative_to(ROOT)),'retrieved':m['retrieved'],'observedAlbumLeads':m['relatedAlbums'],'limitation':'Public artist pages expose a selection of releases; absence from this selection alone is not proof of global absence.'}]
  r['unresolvedReason']=info['reason'];r['verificationStatus']='reasonable-public-leads-exhausted-no-exact-id-verified'
  r['rejectedCandidates']=[{'url':'https://open.spotify.com/album/'+id,'reason':reason,'evidenceSource':'Direct public album/artist metadata or primary web result'} for id,reason in info['reject']]
  r['editionNotes']=None

# Add primary discovery provenance for the most easily confused credits.
for r in d['records']:
 if r['id']=='lower-left-54':r['discoveryEvidence']=[{'url':'https://war.com/album/the-black-mans-burdon/','source':'War official album page','embeddedSpotifyUrl':'https://open.spotify.com/embed/album/0ITLinOk4u5e7UQDmijbOd','note':'Official page provides the exact album programme; selected Spotify ID is the Canada-listed regional release verified independently.'}]

assert [r['id'] for r in d['records']]==[r['id'] for r in eligible]
assert len({r['id'] for r in d['records']})==76
assert all(r['status'] in ['matched','unresolved'] for r in d['records'])
for r in d['records']:
 if r['status']=='matched':
  assert re.fullmatch(r'[A-Za-z0-9]{22}',r['spotifyId'])
  assert r['spotifyUrl']=='https://open.spotify.com/album/'+r['spotifyId']
  assert r['spotifyDate'] and r['spotifyTrackCount'] and r['verificationEvidence']
 else:assert not r['spotifyId'] and r['unresolvedReason']
d['summary']={'eligible':76,'matched':73,'unresolved':3,'complete':True,
 'metadataPagesSaved':len(list((HERE/'metadata').glob('*.json'))),
 'allMatchedIdsVerifiedOnDirectPrimarySpotifyAlbumPages':True,
 'partialPublicPlaybackAlbums':[r['id'] for r in d['records'] if r.get('availabilityObservation',{}).get('unplayableRows')],
 'existingLinksAndCanonicalCataloguesModified':False,
 'scope':'All 76 confirmed non-book left-box records with no pre-existing Spotify album ID.',
 'independentReview':'catalog_right approved the staged high-risk aliases and programme equivalence, then independently approved the final Jazz / Up Escalator / Before the Flood variants. No recording/programme substitution found.'}
AUDIT.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(d['summary'],indent=2))
print('SHA256',hashlib.sha256(AUDIT.read_bytes()).hexdigest())
