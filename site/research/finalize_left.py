import json,pathlib,urllib.request,concurrent.futures,re,html
P=pathlib.Path('site/research/left.json'); rows=json.loads(P.read_text()); byid={r['id']:r for r in rows}
manual=[('upper-left-44','apple',1699704883),('upper-left-49','deezer',303233),('lower-left-38','deezer',904956322),('lower-left-43','deezer',112952)]
a=json.load(open('site/research/left_apple_candidates.json'));d=json.load(open('site/research/left_deezer_candidates.json'))
for id,src,albumid in manual:
 r=byid[id];cs=a[id] if src=='apple' else d[id];c=next(x for x in cs if x.get('collectionId',x.get('id'))==albumid)
 if src=='apple':url=c['artworkUrl100'].replace('100x100bb','600x600bb');source=c['collectionViewUrl'].split('?')[0]
 else:url=c['cover_xl'];source=c['link']
 with urllib.request.urlopen(url,timeout=30) as f:pathlib.Path('site/dist/assets/covers/'+id+'.jpg').write_bytes(f.read())
 r.update(coverUrl=url,coverPath='/assets/covers/'+id+'.jpg',artworkEdition='Digital reissue artwork from '+('Apple Music' if src=='apple' else 'Deezer')+'; exact photographed vinyl pressing not verified.')
 r['sources'].append(source)
# IDs discovered in indexed Spotify album pages, album embeds, or public Spotify artist/track HTML.
links={
'upper-left-01':'4g2GOO8aoyi8f4ujUA6kxo',
'upper-left-02':'5cmrQ4KaJf8WR4NlxP2lDV',
'upper-left-04':'1mfJkWGwzdCc5Vo6lZBFwu',
'upper-left-08':'3gUlFM3azK6ZIkKz1zK7Nj',
'upper-left-10':'388aQc05TOaKfMB57vhx2C',
'upper-left-11':'3JXODSjT9mUz2lIb4YIErw',
'upper-left-15':'0D2pPaS3KrCjpuUxQb1O9Q',
'upper-left-22':'59RclwjkzMJTJZNxrfGdLC',
'upper-left-23':'4LH4d3cOWNNsVw41Gqt2kv',
'upper-left-24':'0bCAjiUamIFqKJsekOYuRw',
'upper-left-37':'0PMasrHdpaoIRuHuhHp72O',
'upper-left-38':'05RPG1hN35ucYL4BqEBZdn',
'upper-left-42':'5ycnwHGkzOlTuMOI3Zh4iO',
'upper-left-45':'2tSRe2rkdJvZWMOIZpu6lk',
'upper-left-47':'1hOK2ey9W76x9GnftSRgrw',
'upper-left-57':'1fW0Oyx3p2kVzo2INfW7Lb',
'upper-left-58':'1s9pyp2esxBxLKEjEeSc5N',
'lower-left-04':'0o1uFxZ1VTviqvNaYkTJek',
'lower-left-08':'3H0cWLh4X4x5TB8TTkE3LE',
'lower-left-09':'063f8Ej8rLVTz9KkjQKEMa',
'lower-left-15':'6Tba8p2rh6AZg3OklUSwca',
'lower-left-22':'3Iz3o8owPasr8PKUSZPqD5',
'lower-left-25':'2xQBCPq2gQ7l8thLUUZSKu',
'lower-left-27':'6b6FYoisWvkLKxF2JDjm1j',
'lower-left-32':'4KT6G8fj8EEIfsyr75hbgc',
'lower-left-39':'1T8usYsiGEMPMQOLFgJEbE',
'lower-left-40':'0yzwKBSBgSgb9UUcP6QVGK',
'lower-left-42':'7jvcSnCnugLcisBCNBm60s',
'lower-left-52':'4MYtX4Kta7FL4NVUE0FYws',
'lower-left-59':'3xqIkWyfqpcIpLgjeFITW8',
'lower-left-63':'577aDq5TbAZrrIxvFUW6Re'}
def verify(pair):
 id,albumid=pair;url='https://open.spotify.com/album/'+albumid
 try:
  s=urllib.request.urlopen(url,timeout=30).read().decode()
  title=html.unescape(re.search(r'<title>(.*?)</title>',s)[1]);img=re.search(r'<meta property="og:image" content="([^"]+)"',s)
  return id,dict(albumId=albumid,url=url,pageTitle=title,coverUrl=img[1] if img else None)
 except Exception as e:return id,dict(albumId=albumid,url=url,error=str(e))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:evidence=dict(ex.map(verify,links.items()))
pathlib.Path('site/research/left_spotify_evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
for id,ev in evidence.items():
 print(id,ev.get('pageTitle',ev.get('error')),flush=True)
 if 'pageTitle' not in ev:continue
 r=byid[id];r['spotifyId']=ev['albumId'];r['sources'].append(ev['url']);r['spotifyEdition']='Verified digital album; mastering/bonus tracks may differ from the photographed vinyl.'
 if not r.get('coverPath') and ev.get('coverUrl'):
  with urllib.request.urlopen(ev['coverUrl'],timeout=30) as f:pathlib.Path('site/dist/assets/covers/'+id+'.jpg').write_bytes(f.read())
  r.update(coverUrl=ev['coverUrl'],coverPath='/assets/covers/'+id+'.jpg',artworkEdition='Spotify digital artwork; exact photographed vinyl pressing not verified.')
# Additional catalogue evidence used for worn spines.
more={
'upper-left-10':['https://www.ponty.com/content/recordings/vh2u-bwaam4af-4i/imaginary-voyage/'],
'upper-left-21':['https://www.onamrecords.com/artists/sad-cafe/discography/united-states/a-m-records/sp-4779/facades'],
'upper-left-22':['https://musicbrainz.org/release-group/b2d10ce6-bf86-3091-8c71-3e8330f4b748'],
'lower-left-42':['https://musicbrainz.org/release-group/b02f651e-32a1-30ae-bc23-070b59170278']}
for id,urls in more.items():byid[id]['sources'].extend(urls)
P.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('FINAL',len(rows),'artwork',sum(bool(r['coverPath']) for r in rows),'spotify',sum(bool(r['spotifyId']) for r in rows))
