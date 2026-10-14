import {readFile,writeFile,readdir,mkdir,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(await readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const used=new Set();
function collect(value){
  if(typeof value==='string'&&/^\/?assets\/covers\//.test(value))used.add(value.split('/').at(-1));
  else if(value&&typeof value==='object')Object.values(value).forEach(collect);
}
collect(catalog);
const assets=new URL('../dist/assets/covers/',import.meta.url);
const archive=new URL('../research/artwork-candidates/',import.meta.url);
await mkdir(archive,{recursive:true});
const indexUrl=new URL('index.json',archive);
let index={note:'Unselected and superseded scans are retained as research evidence. Paths in earlier audit download logs can be resolved through this index.',files:{}};
try{index=JSON.parse(await readFile(indexUrl,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let moved=0;
for(const name of await readdir(assets)){
  if(used.has(name))continue;
  const source=new URL(name,assets);if(!(await stat(source)).isFile())continue;
  const bytes=await readFile(source);
  index.files[`dist/assets/covers/${name}`]={archivePath:`research/artwork-candidates/${name}`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  await rename(source,new URL(name,archive));moved++;
}
await writeFile(indexUrl,JSON.stringify(index,null,2)+'\n');
await writeFile(new URL('README.md',archive),'# Artwork research candidates\n\nThese images were downloaded during identification and artwork research, but are not the current selected cover, back or LP label in the application. They include superseded digital covers, alternate pressings, record labels, gatefold interiors and rejected CD tray scans. They remain available for audit and future research without being shipped to the website.\n\n`index.json` maps original download paths from research logs to the archived paths and records their checksums. The catalogue and its documented selected image paths determine what is shown in the app.\n');
console.log(`Archived ${moved} unselected artwork files; current referenced images remain in the published assets.`);
