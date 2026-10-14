from pathlib import Path
import json,re,unicodedata
ROOT=Path(__file__).resolve().parents[3];E=Path(__file__).resolve().parent;rows={r['id']:r for r in json.loads((ROOT/'site/research/middle.json').read_text())};p=E/'candidates.json';mapping=json.loads(p.read_text())
manualExclude={'lower-middle-02','lower-middle-03','lower-middle-05','lower-middle-06','lower-middle-07','lower-middle-08','lower-middle-15','lower-middle-35','lower-middle-36','lower-middle-37','lower-middle-38','lower-middle-39','lower-middle-40','lower-middle-41','lower-middle-43','lower-middle-45','lower-middle-49','lower-middle-50','lower-middle-51','lower-middle-52','lower-middle-54','lower-middle-67'}
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode()).replace('and','')
for id,m in mapping.items():
 if id not in rows or id in manualExclude or m.get('accepted'):continue
 r=rows[id];wanted=norm(r['title']);artist=norm(r['artist']);valid=[]
 for sid in m.get('candidates',[]):
  f=E/(sid+'.json')
  if not f.exists():continue
  d=json.loads(f.read_text());name=norm(d.get('title') or '');got=norm(d.get('embedEntity',{}).get('subtitle',''))
  bad=any(x in name for x in ['volumetwo','voliii','volii','vol2','vol3']) or d.get('trackCount',0)<3
  sameArtist=got and (got in artist or artist in got)
  sameTitle=name==wanted or len(wanted)>4 and name.startswith(wanted)
  if sameArtist and sameTitle and not bad:valid.append((0 if name==wanted else 1,d.get('trackCount',999),sid,d))
 if valid:
  valid.sort(key=lambda x:x[:2]);_,_,sid,d=valid[0];m['accepted']=sid;m['note']='Verified digital edition of the same original album and artist. '+('Spotify title identifies a remaster/expanded/deluxe edition; bonus tracks and mastering differ from the photographed LP.' if re.search(r'remaster|expanded|deluxe|bonus',d['title'],re.I) or d.get('trackCount',0)>20 else 'Digital mastering, release date or territorial edition may differ from the physical LP.');m['checks']='Primary Spotify album/embed title and credited artist match; reviewed track list represents the original core album, with documented digital edition differences.';print('MATCH',id,d['title'],d['embedEntity'].get('subtitle'),d['trackCount'])
p.write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
