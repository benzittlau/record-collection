"""Build the capture-only streaming proposal from reviewed public primary metadata.
No canonical or served files are read for mutation. Safe to rerun.
"""
import json, pathlib, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
RESEARCH=ROOT/'site/research'
E=pathlib.Path(__file__).resolve().parent
INTAKE=json.loads((RESEARCH/'capture-intake-middle-2026-10-14.json').read_text())
PAIRS={x['proposedRecordId']:x for x in INTAKE['pairs']}
ART=json.loads((RESEARCH/'capture-intake-artwork-middle-2026-10-14.json').read_text())
ART_ROWS={x['recordId']:x for x in ART['records']}
OUT=RESEARCH/'capture-intake-spotify-middle-2026-10-14.json'

def rel(p): return str(p.relative_to(ROOT))
def evidence(url,description,path=None):
 d={'url':url,'description':description}
 if path:d['localPath']=str(path)
 return d

def base(rid):
 p=PAIRS[rid]
 return {'id':rid,'recordId':rid,'title':p['identity']['title'],'artist':p['identity']['artist'],
         'physicalIdentityEvidence':{'proposal':rel(RESEARCH/'capture-intake-middle-2026-10-14.json'),
          'frontFilename':p['frontFilename'],'backFilename':p['backFilename'],
          'catalogue':p['identity'].get('catalogue'),'visibleEvidence':p['visibleEvidence']},
         'canonicalEditsApplied':False}

def matched(rid,aid,note,comparison,extra=()):
 d=json.loads((E/(aid+'.json')).read_text())
 ent=d['publicInitialState']['entities']['items']['spotify:album:'+aid]
 assert ent['id']==aid and d['embedEntity']['uri']=='spotify:album:'+aid
 tracks=d['embedEntity']['trackList']
 p=base(rid)
 p.update({'status':'matched','spotifyId':aid,'url':d['albumUrl'],'spotifyUrl':d['albumUrl'],
  'spotifyTitle':d['title'],
  'spotifyArtists':[x['profile']['name'] for x in ent['artists']['items']],
  'spotifyDate':next((x.get('datePublished') for x in d['jsonLd'] if x.get('datePublished')),None),
  'spotifyTrackCount':len(tracks),'spotifyTrackTitles':[x['title'] for x in tracks],
  'editionNote':note,'verification':comparison,
  'evidence':[evidence(d['albumUrl'],'Official Spotify album page, public initialState and album JSON-LD; title, date, artists and complete ordered track list saved without runtime tokens.',rel(E/(aid+'.json'))),*extra],
  'queries':[f"site:open.spotify.com/album {p['artist']} {p['title']}",f"{p['artist']} {p['title']} Spotify original album programme"],
  'rejectedCandidates':[]})
 markets=ent.get('availableMarkets',[])
 if isinstance(markets,dict):markets=markets.get('items',[])
 p['availableInCanada']=('CA' in markets) if markets else None
 p['availabilityNote']='Public album/embed metadata is playable, but the fetched market list is empty; regional availability requires independent browser verification.' if not markets else 'Explicit Spotify market list checked.'
 if rid in ART_ROWS:p['evidence'].append(evidence(ART_ROWS[rid]['back']['releaseUrl'],'Reviewed LP outer back and release track list support the photographed original programme.',rel(RESEARCH/'capture-intake-artwork-middle-2026-10-14.json')))
 return p

rows=[]
rows.append(matched('upper-middle-22','0bRlXo4f7P0gF30G3RACTN',
 'Original 1975 album programme; digital mastering may differ from the family Columbia LP.',
 'All eleven original songs match the photographed PC33394 rear in side order, from When the Party’s Over through Lover’s Lullaby. Official album artist is Janis Ian.'))
rows.append(matched('upper-middle-38','3bVgOet9qc7a3cpzrqGS0t',
 'Digital edition of the original thirteen-track stereo album; mastering differs from the Reprise LP.',
 'All thirteen original tracks appear in order, EXP through Bold as Love. Same Jimi Hendrix Experience album as the photographed Reprise6281 sleeve. The later 66-track sessions package is unnecessary.'))
rows.append(matched('upper-middle-47','5z090LQztiqh13wYspQvKQ',
 'Original 1968 sixteen-track album programme in a digital edition; mastering and cover variant can differ.',
 'Complete original double-LP programme, …And the Gods Made Love through Voodoo Child (Slight Return), with Jimi Hendrix credits. This independently refetched ID is already verified for the same album elsewhere in the collection.'))
rows.append(matched('upper-middle-68','5LGiNCGWsy2X59KZQ3S6kH',
 'Original 1973 ten-track album programme; digital mastering may differ from the Atlantic SD7270 LP.',
 'All ten photographed songs/groups match, including Skylark, Drinkin’ Again, Surabaya Johnny, the Uptown medley and Higher and Higher. Parent independently discovered this album through an official track page.',
 [evidence('https://open.spotify.com/track/2YxyYVDwRxGnjkQx1YbEvu','Official track discovery exposes this exact Bette Midler album URI.',rel(RESEARCH/'capture-intake-spotify-root-2026-10-14.json'))]))
rows.append(matched('lower-middle-04b','2DxA1kE23NCa5wakaEkUr0',
 'Remastered digital reissue of Julian Bream’s Vienna 1956 Bach recording. The same complete LP programme is reordered and divided into nine movement tracks.',
 'All six printed LP groups are present: BWV999; BWV997 Prelude/Fugue; BWV996 Sarabande/Bourrée; BWV1004 Chaconne; and the complete BWV998 Prelude/Fugue/Allegro. Every digital movement credits Julian Bream and Vienna1956. This is the standalone Bach LP, distinct from the later Bach/Villa-Lobos compilation.',
 [evidence('https://www.julianbreamguitar.com/a-bach-recital-for-the-guitar.html','Artist discography identifies the 1956 Westminster recording, its programme/timings and Westminster Gold WGM8113 reissue.'),
  evidence('https://classical.music.apple.com/gb/album/1676072477','Licensed primary metadata corroborates Bream, Vienna1956 and the same nine movements.')]))
rows.append(matched('lower-middle-11','5xwmncr9AWNZxMJ93r8d7q',
 'Expanded remastered reissue: the original ten-track 1973 album comes first, followed by six bonus tracks.',
 'The original ten songs run in LP order from Ain’t Got No Home through A Change Is Gonna Come; tracks11–16 are explicitly outtakes/bonus material. The photographed Jook Joint/Blackie’s Poolhall panels are the outer wraparound artwork for Moondog Matinee.'))
rows.append(matched('lower-middle-25','0ETFjACtuP2ADo6LFhL6HN',
 '2009 remaster of the original 1969 album, with all seventeen tracks including Her Majesty.',
 'Complete original Abbey Road sequence in LP order. The newly photographed SO383 is a separate physical copy from lower-middle20, which already uses this independently verified streaming ID.'))
rows.append(matched('lower-middle-32','0a8eh00YLK6LCNGhinsWeI',
 'Digital edition of the original 1971 twelve-track album; mastering may differ from the Atlantic LP.',
 'All twelve original songs match in order, Change Partners through Bluebird Revisited. This is Stephen Stills2, not the 1970 first self-titled album.'))
rows[-1]['rejectedCandidates']=[{'spotifyId':'2nkFniR6DseqFJLhxXV01T','url':'https://open.spotify.com/album/2nkFniR6DseqFJLhxXV01T','reason':'1970 first self-titled album, ten different tracks; the family front explicitly says2.','evidenceFile':rel(E/'2nkFniR6DseqFJLhxXV01T.json')}]
rows.append(matched('lower-middle-66','64R7b6bou3ZyIsgvDztif2',
 '2023 deluxe reissue: the eight original 1980 master takes are followed by five alternate takes.',
 'First eight tracks exactly match the photographed Quintet’80 programme, Dawgma through Thailand. The artist’s Acoustic Disc publisher explicitly says this reissue contains all original master takes plus five previously unissued alternates and names the original quintet.',
 [evidence('https://acousticdisc.com/product/david-grisman-quintet-80-deluxe-hi-def-master-download/','Artist-owned publisher confirms original master takes, original 1980 album and five added alternate takes.')]))
rows.append(matched('lower-middle-69','3bouQtY9H1DP39yxqHuFf8',
 '2003 expanded remaster: the original nine-track Organisation album is followed by six bonus tracks.',
 'First nine tracks run in the exact photographed VL2206 order from Enola Gay through Stanlow. The bonus Annex and early Factory recordings follow the original programme; Spotify’s package type does not change the studio-album identity.',
 [evidence('https://omd.uk.com/pages/horizon-omd-discography','Official artist discography corroborates Organisation as the 1980 album.')]))

def unresolved(rid,reason,queries,ev,rejections):
 p=base(rid);p.update({'status':'unresolved','spotifyId':None,'url':None,'spotifyUrl':None,
 'spotifyTitle':None,'spotifyArtists':[],'spotifyDate':None,'spotifyTrackCount':None,
 'reason':reason,'editionNote':None,'queries':queries,'evidence':ev,'rejectedCandidates':rejections})
 rows.append(p)

unresolved('upper-middle-23',
 'No complete original seven-track Islands in Space album was verified. The exact artist/title Spotify result is a one-track 2013 single, not the 1981 LP; 10,001Dreams is a different Lightdreams album.',
 ['site:open.spotify.com/album Lightdreams Islands in Space','Lightdreams Paul Marcano Islands in Space Spotify full album','Lightdreams 32ItyhGiJL5XvXM3y8A2Pq album'],
 [evidence('https://open.spotify.com/album/3Nz3bDbv492sS7S0KAZMJi','Official metadata confirms just one title track.',rel(E/'3Nz3bDbv492sS7S0KAZMJi.json')),
  evidence('https://paulmarcanoandlightdreams.bandcamp.com/album/islands-in-space','Artist’s complete seven-track album provides a programme reference and optional non-Spotify fallback.'),
  evidence('https://islandsinspace.com/','Artist’s primary album site.')],
 [{'spotifyId':'3Nz3bDbv492sS7S0KAZMJi','url':'https://open.spotify.com/album/3Nz3bDbv492sS7S0KAZMJi','reason':'Only one song, Islands in Space; six required LP songs absent.'},
  {'spotifyId':'7CsO67rW42hh1mgeKufrJe','url':'https://open.spotify.com/album/7CsO67rW42hh1mgeKufrJe','reason':'10,001Dreams is a different album, not the captured Islands in Space programme.'}])
unresolved('upper-middle-39',
 'No complete self-titled 1976 Chrysalis CHR1106 album was verified. Parent checked the artist’s full native Canadian Spotify discography (28 releases); the available Chrysalis anthologies are partial programmes and include live versions.',
 ['site:open.spotify.com/album Leo Kottke 1976 CHR1106','Leo Kottke Buckaroo White Ape Hayseed Suede Spotify','Leo Kottke full native discography all28 albums'],
 [evidence('https://open.spotify.com/artist/6cjuHeJM6CHRUhIhApwFwx/discography/all','Parent inspected the complete native artist discography.',rel(RESEARCH/'capture-intake-spotify-root-2026-10-14.json'))],
 [{'spotifyId':'5YYv5MWJ2mq7Om5VrYAYlB','url':'https://open.spotify.com/album/5YYv5MWJ2mq7Om5VrYAYlB','reason':'Instrumentals: Best of Chrysalis is a partial anthology including live versions, not the complete eleven-song CHR1106 album.'},
  {'spotifyId':'7591I8OHs7ap9qUk5gPV2f','url':'https://open.spotify.com/album/7591I8OHs7ap9qUk5gPV2f','reason':'1971–1976 Did You Hear Me? is a multi-album compilation, not the original captured album.'}])
unresolved('lower-middle-44',
 'No full twelve-part The Mouse Factory Presents Mickey and His Friends Disneyland1342 programme was verified. Minnie’s Yoo Hoo appears in Disney Classics, but that anthology omits the rest of this LP programme.',
 ['site:open.spotify.com/album The Mouse Factory Mickey and His Friends','Disneyland1342 Mouse Factory Spotify','site:open.spotify.com Mouse Factory Minnie Yoo Hoo'],
 [evidence('https://open.spotify.com/album/6b4nBlM4ofUKA0mcb1b9oF','Official Disney Classics metadata lists95 tracks and only the isolated Mouse Factory theme from this programme.',rel(E/'6b4nBlM4ofUKA0mcb1b9oF.json'))],
 [{'spotifyId':'6b4nBlM4ofUKA0mcb1b9oF','url':'https://open.spotify.com/album/6b4nBlM4ofUKA0mcb1b9oF','reason':'Unrelated95-track Disney anthology; not the complete Disneyland1342 album.'}])
unresolved('lower-middle-53',
 'The photographed TV34057S mixed-player five-concerto programme was not verified on one digital album. Correct original Zickler/Thal/Kehr performances occur on Virtuoso Trumpet Vol.2, while Tarr/Faerber and Schneidewind/Pasch material is split across other volumes. Same-title recordings by other soloists were excluded.',
 ['site:open.spotify.com/album Italian Baroque Trumpet Concerti TV34057S','Heinz Zickler Herbert Thal Edward Tarr Faerber Manfredini Spotify','Virtuoso Trumpet Vol1 Vol2 TV34057S original programme'],
 [evidence('https://open.spotify.com/album/5wPE2AknDzCfkWe6VxCxjo','Official Vol.2 metadata has the required Zickler/Thal Vivaldi and Zickler Torelli but omits the complete Tarr/Faerber mixed-player LP programme.',rel(E/'5wPE2AknDzCfkWe6VxCxjo.json')),
  evidence('https://www.naxos.com/CatalogueDetail/?id=VOX-NX-2558','Primary Vox/Naxos publisher corroborates performers and Vivaldi/Torelli in Virtuoso Trumpet Vol.2.'),
  evidence('https://open.spotify.com/track/70EqP61shr18WgL6wqApOo','Original Tarr/Faerber Albinoni movement is on Virtuoso Trumpet Vol.1, a different expanded programme.')],
 [{'spotifyId':'5wPE2AknDzCfkWe6VxCxjo','url':'https://open.spotify.com/album/5wPE2AknDzCfkWe6VxCxjo','reason':'Correct partial original performances, but lacks all three other mixed-player concertos from the captured LP.'},
  {'spotifyId':'54EO25mXn0M36A4C1cCy88','url':'https://open.spotify.com/album/54EO25mXn0M36A4C1cCy88','reason':'20Basics:TheTrumpet is an anthology with only part of Manfredini and unrelated repertoire; not the complete LP.'}])
rows.sort(key=lambda x: (0 if x['id'].startswith('upper') else 1,float(x['id'].split('-')[-1].replace('04b','04.5'))))
assert len(rows)==14 and len({x['id'] for x in rows})==14
assert sum(x['status']=='matched' for x in rows)==10
obj={'version':1,'date':'2026-10-14','status':'complete',
 'scope':'Streaming proposals for the fourteen newly identified or changed Box3/Box4 albums, including the Bream insert. Canonical identity corrections must be applied before these links; no canonical edits performed.',
 'policy':'Verify album identity and full original programme. Digital remasters/expanded reissues are allowed with explicit notes. Classical performers and recording identity must match. Partial anthologies and same-title recordings by other artists are rejected.',
 'summary':{'audited':14,'matched':10,'unresolved':4},
 'relatedProposals':[rel(RESEARCH/'capture-intake-middle-2026-10-14.json'),rel(RESEARCH/'capture-intake-artwork-middle-2026-10-14.json'),rel(RESEARCH/'capture-intake-spotify-root-2026-10-14.json')],
 'metadataHandling':'Only public Spotify album/embed parsed metadata is saved; raw HTML and runtime token fields are not retained. Spotify digital dates do not replace physical LP dates.',
 'records':rows,
 'supplementalObservation':{'id':'lower-middle-04','status':'unresolved','reason':'Newly confirmed Fricsay four-work LP136226 remains unlinked. Candidate7kW7Xcvbr7WkDJkoYVlGCU has Mozart/Moldau/LesPréludes but lacks Egmont; huge Complete Recordings160-track7dvxQBrOvFiTqLFGSBZblp and Berliner Legendary181-track21uTh6XDcgR9KXpjDuCNqb are unrelated broad compilations and were not substituted.'}}
OUT.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'path':rel(OUT),'summary':obj['summary']},indent=2))
