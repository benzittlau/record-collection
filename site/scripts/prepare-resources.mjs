import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// The two pages have a small, fixed resource graph. Children precede parents:
// a parent's fingerprint must include its rewritten dependency URLs.
const resources = [
  {file:'spine-masks.js', dependencies:['photo-projection.js']},
  {file:'turntable.js', dependencies:['spotify-session.js'], optional:['spotify-player.js']},
  {file:'app.js', dependencies:['photo-projection.js','spine-masks.js','turntable.js','catalog.json','box-photos.json','spine-masks.json']},
  {file:'capture.js', dependencies:['spine-masks.js','capture-manifest.json']},
  {file:'index.html', dependencies:['app.js','styles.css']},
  {file:'capture.html', dependencies:['capture.js','capture.css','capture-map.pdf']}
];
const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex').slice(0,12);

// Only references are rewritten. Catalogs, masks, the capture manifest, PDF,
// archived capture plans, and the research ledger are never regenerated here.
export async function prepareResources({distDirectory=new URL('../dist/',import.meta.url),check=false}={}) {
  const bytes = new Map(), updates = new Map();
  const read = async file => {
    if(!bytes.has(file))bytes.set(file,await readFile(new URL(file,distDirectory)));
    return bytes.get(file);
  };
  for(const {file,dependencies,optional=[]} of resources) {
    const original = (await read(file)).toString('utf8');
    let next = original;
    for(const dependency of [...dependencies,...optional]) {
      const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const pattern = new RegExp(`(["'])(\\./)?${escaped}(?:\\?v=[^"'\\s]*)?(?=\\1)`,'g');
      if(!pattern.test(next)) {
        if(optional.includes(dependency))continue;
        throw new Error(`Missing resource reference: ${file} → ${dependency}`);
      }
      const hash = fingerprint(await read(dependency));
      next = next.replace(pattern,(_,quote,prefix='')=>`${quote}${prefix}${dependency}?v=${hash}`);
    }
    if(next!==original)updates.set(file,next);
    bytes.set(file,Buffer.from(next));
  }
  // Validate the entire graph before writing anything, including in check mode.
  if(check&&updates.size)throw new Error(`Stale resource references in ${[...updates.keys()].join(', ')}. Run npm run prepare:resources.`);
  if(!check)for(const [file,source] of updates)await writeFile(new URL(file,distDirectory),source);
  return [...updates.keys()];
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const changed = await prepareResources({check:process.argv.includes('--check')});
  console.log(changed.length?`Refreshed resource references in ${changed.join(', ')}.`:'Resource references are current.');
}
