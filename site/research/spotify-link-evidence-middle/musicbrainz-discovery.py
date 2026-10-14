from pathlib import Path
import json,re,runpy,urllib.parse
ROOT=Path(__file__).resolve().parents[3];E=Path(__file__).resolve().parent;OLD=ROOT/'site/research/deep-middle-evidence';get=runpy.run_path(str(ROOT/'site/research/deep-left-musicbrainz.py'))['get_json'];rows=[r for r in json.loads((ROOT/'site/research/middle.json').read_text()) if r['confidence']=='confirmed' and not r.get('spotifyId') and r.get('kind')!='book']
for r in rows:
 path=E/(r['id']+'-mb.json')
 if path.exists():continue
 gids=[m.group(1) for s in r.get('sources',[]) if (m:=re.search(r'release-group/([0-9a-f-]{36})',s))]
 if not gids and (OLD/(r['id']+'-search-v2.json')).exists():
  old=json.loads((OLD/(r['id']+'-search-v2.json')).read_text());gids=list(dict.fromkeys(x['release-group']['id'] for x in old.get('releases',[]) if x.get('release-group')))[:1]
 out={'id':r['id'],'groups':gids,'searches':[],'candidates':[]}
 for gid in gids[:1]:
  u='https://musicbrainz.org/ws/2/release?'+urllib.parse.urlencode({'release-group':gid,'inc':'url-rels+artist-credits','limit':100,'fmt':'json'})
  try:
   data=get(u);out['searches'].append({'url':u,'releaseCount':data.get('release-count')})
   for rel in data.get('releases',[]):
    for link in rel.get('relations',[]):
     src=link.get('url',{}).get('resource','');m=re.search(r'open.spotify.com/(?:intl-[^/]+/)?album/([A-Za-z0-9]{22})',src)
     if m:out['candidates'].append({'spotifyId':m.group(1),'spotifyUrl':src,'musicbrainzReleaseId':rel['id'],'musicbrainzTitle':rel.get('title'),'musicbrainzArtists':rel.get('artist-credit'),'musicbrainzDate':rel.get('date')})
  except Exception as err:out['error']=str(err)
 path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(r['id'],len(gids),[(x['spotifyId'],x['musicbrainzTitle']) for x in out['candidates']],flush=True)
