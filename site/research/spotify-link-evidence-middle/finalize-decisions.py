"""Record reviewed decisions in the isolated candidate state, not the catalogue."""
from pathlib import Path
import json

E = Path(__file__).resolve().parent
ROOT = E.parents[2]
path = E / 'candidates.json'
mapping = json.loads(path.read_text())

notes = {
    'upper-middle-02': 'Digital edition of the original nine-track album.',
    'upper-middle-04': '2002 remaster of the original three-record album, with four bonus tracks.',
    'upper-middle-14': 'Original 1980 album with four bonus tracks.',
    'upper-middle-16': 'Expanded edition: the original nine songs plus an extended mix, These Dangerous Machines and a live Sins of Children.',
    'upper-middle-19': '2006 Wounded Bird reissue with the original nine tracks.',
    'upper-middle-29': 'Digital edition with all eight original Contribution tracks.',
    'upper-middle-30': 'Original ten-track Ringo album, with three bonus tracks.',
    'upper-middle-41': '2002 remaster of the seven-track 1975 Hammersmith live album.',
    'upper-middle-53': '2010 deluxe edition includes the original 1975 stereo mixes, the 2010 remix and bonus material.',
    'upper-middle-54': 'Original ten-track compilation; She’s Gone uses a 2013 remaster of the full-length album version.',
    'upper-middle-55': 'Digital edition of the original ten-track Island album.',
    'upper-middle-61': 'Digital edition of the original eight-track 1977 album.',
    'lower-middle-03': 'Original 1972 film soundtrack with Joel Grey, Liza Minnelli and Ralph Burns; all twelve original tracks.',
    'lower-middle-05': '1993 Great Ballets reissue: the first fifteen tracks contain Haitink and the London Philharmonic’s complete Firebird recording. Other ballet recordings follow.',
    'lower-middle-06': '2011 reissue of Ozawa and the Boston Symphony’s original DG recordings. The full LP programme is present, with Pavane, Une barque sur l’océan and Menuet antique added.',
    'lower-middle-08': 'Digital reissue of Previn and the London Symphony’s 1979 Images and Prélude recordings; Nocturnes is an added coupling.',
    'lower-middle-14': 'Digital edition of the original eight-track 1973 album.',
    'lower-middle-36': 'Complete 1973 Previn/London Symphony ballet recording, including the movements selected for the photographed abridged LP.',
    'lower-middle-38': '1994 Decca coupling: the first six tracks contain the original 1978 Los Angeles/Mehta Symphony No. 3 recording. Symphony No. 1 follows.',
    'lower-middle-39': '1985 CD/digital reissue of Schwalbé and Karajan’s original Four Seasons recording, with Albinoni and Corelli works added.',
    'lower-middle-40': '2007 DG Originals reissue of Karajan and Berlin’s early 1963/64 Rite of Spring recording, with the 1966 Bartók concerto added.',
    'lower-middle-43': '2001 Westminster/DG reissue of Scherchen’s 1959 Vienna Messiah recording, with the original soloists and chorus.',
    'lower-middle-50': 'The original twelve-song Merry Christmas programme is digitally titled White Christmas. Spotify’s displayed date differs from the photographed pressing.',
    'lower-middle-51': 'Sony reissue of Kipnis’s original Bach harpsichord and clavichord album, reordered across twenty-five digital tracks.',
    'lower-middle-54': 'Warner/Parlophone edition of the original 1958 Menuhin/Amadeus/Merrett performance, remastered in 1989.',
    'lower-middle-55': 'Digitally titled 1234 LIVE!, with the original fifteen-song 1982 live programme.',
    'lower-middle-58': 'Expanded, reordered reissue with extra Christmas tracks and a radio edit of Feliz Navidad.',
    'lower-middle-65': 'Smithsonian Folkways digital edition of the original 1977 album, with nineteen tracks.',
    'lower-middle-67': '2010 digital edition of Rampal and Laskine’s original eleven-song Sakura/Japanese Melodies programme.',
}

checks = {
    'lower-middle-05': 'Philips LP 6500483 and the publisher’s reissue identify Haitink/London Philharmonic, the complete 1910 score and the original 1973 recording. The first fifteen Spotify tracks match that work and performance.',
    'lower-middle-06': 'Publisher session metadata identifies Boléro as 22 April 1974, Symphony Hall, Boston, with ISRC DEF057401790 and duration 901 seconds. Original LP personnel and the full Rapsodie espagnole/La Valse programme match. The LP’s shorter printed Boléro timing is a timing discrepancy, not a different session.',
    'lower-middle-08': 'Publisher-supplied description identifies the EMI 1979 first digital recording by Previn and the London Symphony. All Images sections and Prélude from Angel DS37674 are present; the different Jansons/Haitink Concertgebouw album is excluded.',
    'lower-middle-36': 'The original Angel S37020 release is an abridged selection of Previn’s 1973 London Symphony ballet recording. The Warner digital album contains the complete recording and all selected LP movements.',
    'lower-middle-38': 'The Decca booklet identifies Symphony No. 3 as recorded at Royce Hall, Los Angeles, 27–31 March 1978, with Mehta, Forrester, California Boys Choir and Los Angeles Master Chorale. Those performers and all six movements occupy the first six Spotify tracks.',
    'lower-middle-39': 'The official DG Four Seasons page directly links this Spotify album. Its first twelve tracks credit Michel Schwalbé, Karajan and the Berliner Philharmoniker, matching the original LP; the later CD adds Albinoni and Corelli.',
    'lower-middle-40': 'The official DG page directly links this Spotify album. Publisher track metadata dates the Rite of Spring session to 19 October 1963, with first release in 1964, matching SLPM138920 and excluding Karajan’s 1977 remake.',
    'lower-middle-43': 'DG publisher data identifies the 1959 Vienna recording and matches all Spotify track durations. Alarie, Merriman, Simoneau, Standen, Scherchen, Vienna State Opera Orchestra and Wiener Akademie Kammerchor match WGS8163-3; the 1953 London recording is excluded.',
    'lower-middle-51': 'All original harpsichord/clavichord programme groups are present. Sony copyright identifies the original 1966 recording; Igor Kipnis is credited throughout. Digital order differs from the LP.',
    'lower-middle-54': 'All five Trout movements credit Hephzibah Menuhin, the Amadeus Quartet and James Edward Merrett. Copyright specifies the 1958 recording and 1989 remaster; the Curzon/Amadeus alternative is excluded.',
    'lower-middle-55': 'Official artist store confirms that 1234 LIVE! is the live album title alias. Spotify has the original fifteen-song programme and Sharon, Lois & Bram/Mammoth Band performance.',
    'lower-middle-67': 'All eleven original Japanese Melodies titles are present and credit Jean-Pierre Rampal and Lily Laskine. The later Ensemble Lunaire version is a different performance and is excluded.',
    'upper-middle-41': 'Seven original Hammersmith live tracks match the LP rear programme, from Fanfare to Framed. The Alex Harvey credits and 2002 remaster agree; Jeff Beck’s unrelated Live+ is excluded.',
    'upper-middle-29': 'All eight original tracks match Shawn Phillips’s artist-published Contribution track sheet and the original LP programme.',
    'lower-middle-14': 'Original eight-track LP order matches the Sony Spotify album: God Gave Rock and Roll to You through Rosie.',
    'lower-middle-50': 'All twelve original MCA15024/Decca programme tracks are present in the LP side order, including original Bing Crosby backing performers. The public Canada observation shows all twelve tracks playable.',
    'lower-middle-58': 'The original twelve-song programme is represented, including the medley, Winter Fairy-Tale and I’ll Be Home for Christmas. Original Mary’s Boy Child remains; an additional 2007 version is separately listed. Feliz Navidad is explicitly a radio edit. The full native artist discography and Canada page identify this nineteen-track variant.',
}

for rid, entry in mapping.items():
    if rid.startswith('_'):
        continue
    if entry.get('accepted') and entry.get('note', '').startswith('Verified digital edition'):
        entry['note'] = ('Digital reissue of the original album; mastering, release date '
                         'or regional packaging may differ from the photographed LP.')
    if rid in notes:
        entry['note'] = notes[rid]
    if rid in checks:
        entry['checks'] = checks[rid]
    entry['searched'] = True

for rid, sid in [('lower-middle-14', '3tOAEWaHp09NFvTt97Uch9'),
                 ('lower-middle-50', '42KK3F8HTm1dyv5iFsCXdw'),
                 ('lower-middle-58', '6YvpWNisHeDQPsoqeyckYg')]:
    entry = mapping[rid]
    assert (E / (sid + '.json')).exists(), sid
    entry['accepted'] = sid
    entry.pop('reason', None)

reasons = {
    'upper-middle-36': 'No full Landscapes album was verified after Valdy album/track searches, MusicBrainz release-link checks and the public artist discography. Live albums and the Best of Valdy compilation are different programmes.',
    'upper-middle-51': 'No complete Kitsch album was verified after album, track, artist and MusicBrainz searches. The native full Randy Pie discography showed the 1973 self-titled album; Highway Driver is a different programme.',
    'lower-middle-02': 'No complete original Ormandy/Philadelphia three-ballet programme was verified. Spotify’s Ormandy anthology contains only selected Nutcracker and Sleeping Beauty material and omits Swan Lake; the Sleeping Beauty/Respighi album is a different coupling. Other ballet albums have different conductors or recordings.',
    'lower-middle-09': 'No original Kid Stuff KSS5050 Birthday Party album was verified after title, label and Care Bears artist searches. Modern Care Bears music and a Surprise Birthday Party track belong to a different programme.',
    'lower-middle-15': 'No full original fourteen-track Ralph Burns/Ben Vereen All That Jazz film soundtrack was verified after album, performer and song searches and Ralph Burns’s native full discography. An unofficial Spotify playlist substitutes other performances and is rejected.',
    'lower-middle-23': 'No full original Bim Kid Full of Dreams album was verified after album and track searches, MusicBrainz release checks and the Roy Forbes artist catalogue. Later Roy Forbes albums are different programmes; the modern BIM artist page is unrelated.',
    'lower-middle-27': 'No original 1979 Baldry’s Out! studio album was verified after album, track, artist and release-link searches. On Stage Tonight: Baldry’s Out is a later live performance, not this LP.',
    'lower-middle-35': 'No Spotify album matching the WGS8196 Grujon/Mony/Alister trio and Bax/Lavry/Voss/Ma’Ayani programme was verified after performer and catalogue searches. Other flute/viola/harp trios have different performers.',
    'lower-middle-47': 'Poco is a documented retitle of The Polka Dot Pony, but current Spotify editions have substantially longer versions of Cat Came Back, Piggyback Ride and Julie Gerond. The original recording relationship is unconfirmed; identical song titles and order do not prove identical performances.',
    'lower-middle-52': 'The candidate Bach harpsichord-concerto album omits BWV1065’s third movement and substitutes Fauré’s Violin Sonata No. 1, first movement, with Akira Eguchi. It is not the complete HM52/53SD programme. No complete alternative with the original Janigro/Heiller/Pischner/Rapf performances was verified.',
}
for rid, reason in reasons.items():
    mapping[rid]['reason'] = reason
    mapping[rid].pop('accepted', None)
    mapping[rid].pop('note', None)

assistance = json.loads((E / 'right-classical-assistance.json').read_text())
for row in assistance['records']:
    rid = row['id']
    if row['status'] != 'unresolved':
        continue
    entry = mapping[rid]
    entry['reason'] = row['reason']
    if rid == 'lower-middle-47':
        entry['reason'] = ('Poco is a documented retitle of The Polka Dot Pony, but current '
            'Spotify editions have substantially longer versions of three songs: Cat Came Back '
            '(3:34 versus 2:52), Piggyback Ride (1:13 versus 0:59) and Julie Gerond (8:18 versus '
            '7:40). Their relationship to the original performances remains unconfirmed. '
            'No closer complete edition was verified.')
    if rid == 'lower-middle-49':
        entry['reason'] = ('No full ST3922 Dal McKennon/Marni Nixon Disneyland Storyteller '
            'album was verified. The official 2004 Storyteller single uses Karen Dotrice '
            'narration and a different programme. The Julie Andrews/Dick Van Dyke soundtrack '
            'and Legacy releases also do not match the LP cast.')
    entry.pop('accepted', None)
    entry.pop('note', None)
    entry['queries'] = list(dict.fromkeys(entry.get('queries', []) + row.get('queries', [])))
    entry['assistanceEvidence'] = str((E / 'right-classical-assistance.json').relative_to(ROOT))
    entry['rejections'] = [
        {'spotifyId': candidate.get('candidate', candidate).get('spotifyId'),
         'reason': candidate.get('rejection'),
         'evidenceFile': candidate.get('candidate', candidate).get('evidenceFile')}
        for candidate in row.get('candidates', []) if candidate.get('rejection')]

additional = {
    'upper-middle-29': [('artist_programme', 'https://www.shawnphillips.com/discography/tracks_contribution.pdf', None)],
    'lower-middle-06': [('publisher_session_extract', 'https://www.deutschegrammophon.com/en/catalogue/products/ravel-bolero-ozawa-2950', 'right-classical-publisher-extracts.json')],
    'lower-middle-38': [('publisher_recording_booklet', 'https://d24ku69pnn7av2.cloudfront.net/decca-classics-booklets/2020/485_0374_ZM_LAPO_DigitalBkt.pdf', 'right-mehta-decca-booklet-extract.json')],
    'lower-middle-40': [('publisher_session_extract', 'https://www.deutschegrammophon.com/en/catalogue/products/stravinsky-sacre-bartok-karajan-7497', 'right-classical-publisher-extracts.json')],
    'lower-middle-43': [('publisher_session_extract', 'https://www.deutschegrammophon.com/en/catalogue/products/handel-messiah-scherchen-8711', 'right-handel-messiah-scherchen-8711-publisher-extract.json')],
    'lower-middle-54': [('primary_spotify_performer_and_copyright_extract', 'https://open.spotify.com/album/6bxIPfZ1TzyAfHdAbYrCZ8', 'right-6bxIPfZ1TzyAfHdAbYrCZ8.metadata.json')],
    'lower-middle-58': [('licensed_digital_edition', 'https://music.apple.com/us/album/christmas-with-boney-m/267121982', None)],
}
for rid, evidence in additional.items():
    mapping[rid]['additionalEvidence'] = [
        dict(type=kind, url=url, **({'evidenceFile': str((E / file).relative_to(ROOT))}
                                  if file else {})) for kind, url, file in evidence]

native = ROOT / 'site/research/spotify-link-native-review.json'
native_data = json.loads(native.read_text())
for row in native_data['accepted']:
    if row['id'] in mapping:
        mapping[row['id']].setdefault('additionalEvidence', []).append({
            'type': 'independent_native_and_programme_review',
            'url': 'https://open.spotify.com/album/' + row['spotifyId'],
            'evidenceFile': str(native.relative_to(ROOT))})
for row in native_data['rejected']:
    if row['id'] in mapping:
        mapping[row['id']].setdefault('rejections', []).append({
            'spotifyId': row['spotifyId'], 'reason': row['reason'],
            'evidenceFile': str(native.relative_to(ROOT))})
for row in native_data['negativeNativeChecks']:
    if row['id'] in mapping:
        mapping[row['id']].setdefault('additionalEvidence', []).append({
            'type': 'independent_native_full_discography_negative_check',
            'url': row.get('artistUrl'), 'checks': row['reason'],
            'evidenceFile': str(native.relative_to(ROOT))})

mapping['lower-middle-42']['accepted'] = '4t3PUwxLa6eg6K8nYinvXc'
mapping['lower-middle-42']['note'] = ('Digital package uses the original 1975–76 title. '
    'The photographed 1976–77 jacket is a renamed reissue of the same catalogue 1120 album; '
    'all twelve songs retain their original order. The digital theme song runs longer '
    'than the original label timing (3:51 versus 3:23).')
mapping['lower-middle-42']['checks'] = ('The LP rear has catalogue 1120 and Copyright 1975. '
    'The original 75/76 and renamed 76/77 releases share the same catalogue, master and twelve-song '
    'programme. Spotify’s own-label digital album contains that complete programme in the same order. '
    'The original side-two label prints 3:23 for the theme, versus 3:51 digitally, '
    'so this verifies the album/reissue relation rather than an identical edit of that track.')
mapping['lower-middle-42']['additionalEvidence'] = [
    {'type': 'original_LP_programme_and_reissue',
     'url': 'https://www.discogs.com/release/789557',
     'evidenceFile': str((E/'lower-middle-42-discogs-release-789557.json').relative_to(ROOT))},
    {'type': 'original_label_timing', 'url': 'https://www.discogs.com/release/789557',
     'evidenceFile': str((E/'lower-middle-42-789557-5.jpg').relative_to(ROOT))},
    {'type': 'renamed_LP_edition', 'url': 'https://www.discogs.com/release/6398551',
     'evidenceFile': 'site/research/deep-middle-evidence/discogs-6398551.json'},
    {'type': 'licensed_digital_edition',
     'url': 'https://music.apple.com/us/album/the-show-album-1975-1976/295023218'}]
mapping['lower-middle-42'].pop('reason', None)

mapping['lower-middle-52'].setdefault('rejections', []).append({
    'spotifyId': '42EkLNPS9SD2BvJrfv9bgY',
    'reason': reasons['lower-middle-52'],
    'evidenceFile': str((E / '42EkLNPS9SD2BvJrfv9bgY.json').relative_to(ROOT))})
for entry in mapping.values():
    for key in ('additionalEvidence', 'rejections'):
        if key in entry:
            unique = {json.dumps(item, sort_keys=True): item for item in entry[key]}
            entry[key] = list(unique.values())
path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + '\n')
print('Decisions saved; accepted', sum(bool(v.get('accepted')) for v in mapping.values()))
