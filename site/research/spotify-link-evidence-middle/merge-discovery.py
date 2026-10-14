from pathlib import Path
import json,re,unicodedata
ROOT=Path(__file__).resolve().parents[3];E=Path(__file__).resolve().parent;rows=[r for r in json.loads((ROOT/'site/research/middle.json').read_text()) if r['confidence']=='confirmed' and not r.get('spotifyId') and r.get('kind')!='book'];p=E/'candidates.json';mapping=json.loads(p.read_text())
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
for r in rows:
 m=mapping.setdefault(r['id'],{'candidates':[],'queries':[]})
 f=E/(r['id']+'-mb.json')
 if f.exists():
  d=json.loads(f.read_text());m['queries']=list(dict.fromkeys(m.get('queries',[])+[x['url'] for x in d.get('searches',[])]));m['mbEvidenceFile']=str(f.relative_to(ROOT))
  for x in d.get('candidates',[]):
   if x['spotifyId'] not in m['candidates']:m['candidates'].append(x['spotifyId'])
# Spotify's public album pages disclose additional albums by the same artist.
def albums(obj):
 if isinstance(obj,dict):
  if obj.get('name') and (obj.get('__typename')=='Album' or str(obj.get('uri','')).startswith('spotify:album:')):
   sid=obj.get('id') or str(obj.get('uri','')).split(':')[-1]
   if len(sid)==22:yield {**obj,'id':sid}
  for x in obj.values():yield from albums(x)
 elif isinstance(obj,list):
  for x in obj:yield from albums(x)
for f in E.glob('*.json'):
 try:d=json.loads(f.read_text())
 except:continue
 if not isinstance(d,dict) or not d.get('embedEntity'):continue
 artist=norm(d['embedEntity'].get('subtitle',''))
 for r in rows:
  if not artist or not (artist in norm(r['artist']) or norm(r['artist']) in artist):continue
  for a in albums(d.get('publicInitialState',{})):
   wanted=norm(r['title']);name=norm(a['name'])
   if wanted==name or len(wanted)>4 and name.startswith(wanted):
    m=mapping[r['id']];sid=a['id']
    if len(sid)==22 and sid not in m['candidates']:m['candidates'].append(sid);m.setdefault('discoveryEvidence',[]).append({'sourceFile':str(f.relative_to(ROOT)),'albumName':a['name'],'id':sid});print('RELATED',r['id'],sid,a['name'])
p.write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
