import { readFile, writeFile, access } from 'node:fs/promises';
const parts = await Promise.all(['left','middle','right'].map(async p=>JSON.parse(await readFile(new URL(`../research/${p}.json`,import.meta.url),'utf8'))));
const order=['upper-left','lower-left','upper-middle','lower-middle','right'];
const records=parts.flat().sort((a,b)=>order.indexOf(a.box)-order.indexOf(b.box)||a.position-b.position);
for(const r of records){
  r.cover=r.cover??r.coverPath??null;
  if(r.cover?.startsWith('/assets/'))r.cover=r.cover.slice(1);
  if(r.backPath?.startsWith('/assets/'))r.backPath=r.backPath.slice(1);
  r.back=r.back??r.backPath??r.backCover??(r.backUrl?.startsWith('/assets/')?r.backUrl.slice(1):null);
  if(r.back?.startsWith('/assets/'))r.back=r.back.slice(1);
  if(r.cover){try{await access(new URL(`../dist/${r.cover}`,import.meta.url));}catch{r.cover=null;}}
  if(r.back){try{await access(new URL(`../dist/${r.back}`,import.meta.url));}catch{r.back=null;}}
  r.photo=`assets/${r.photo?.split('/').at(-1)}`;
}
const meta={recordCount:records.length,confirmed:records.filter(r=>r.confidence==='confirmed').length,probable:records.filter(r=>r.confidence==='probable').length,unknown:records.filter(r=>r.confidence==='unknown').length,artwork:records.filter(r=>r.cover).length,spotify:records.filter(r=>r.spotifyId).length,note:'Spine positions are reconstructed estimates. Covers may show other pressings; illustrated vinyl is not a photograph of the original disc.'};
await writeFile(new URL('../dist/catalog.json',import.meta.url),JSON.stringify({meta,records},null,2)+'\n');
console.log(meta);
