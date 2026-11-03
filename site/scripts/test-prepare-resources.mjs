import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {prepareResources} from './prepare-resources.mjs';

const runtimeFiles = ['app.js','turntable.js','spotify-session.js','spotify-player.js',
  'photo-projection.js','spine-masks.js','catalog.json','box-photos.json','spine-masks.json',
  'styles.css','index.html','capture.js','capture.css','capture.html','capture-manifest.json','capture-map.pdf'];
const frozenFiles = ['capture-plans/7ac3efbb41aa.json','capture-sequence.json'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0,12);

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(),'record-resources-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const distDirectory = pathToFileURL(join(directory,'dist')+'/');
  await mkdir(distDirectory);
  for(const name of runtimeFiles)await cp(new URL(`../dist/${name}`,import.meta.url),new URL(name,distDirectory));
  await mkdir(join(directory,'research','capture-plans'),{recursive:true});
  for(const name of frozenFiles)await cp(new URL(`../research/${name}`,import.meta.url),join(directory,'research',name));
  const read = name => readFile(new URL(name,distDirectory));
  const write = (name,source) => writeFile(new URL(name,distDirectory),source);
  const snapshot = async () => new Map(await Promise.all(runtimeFiles.map(async name=>[name,await read(name)])));
  return {directory,distDirectory,read,write,snapshot};
}

// Inspect browser references independently of the preparation graph. Every local
// script, style, JSON request, and PDF link must identify the bytes it will load.
async function verifyBrowserReferences(f) {
  for(const file of runtimeFiles.filter(name=>/\.(js|html)$/.test(name))) {
    const source = (await f.read(file)).toString();
    for(const match of source.matchAll(/["'](?:\.\/)?([a-z][a-z-]*\.(?:js|css|json|pdf))(?:\?v=([^"']+))?["']/g)) {
      assert.equal(match[2],hash(await f.read(match[1])),`${file} must load current ${match[1]}`);
    }
  }
}

test('changed resource bytes propagate through every browser parent in one operation',async t=>{
  const cases = [
    ['catalog.json',['app.js','index.html']],
    ['spine-masks.json',['app.js','index.html']],
    ['box-photos.json',['app.js','index.html']],
    ['spotify-session.js',['turntable.js','app.js','index.html']],
    ['turntable.js',['app.js','index.html']],
    ['photo-projection.js',['spine-masks.js','app.js','index.html','capture.js','capture.html']],
    ['spine-masks.js',['app.js','index.html','capture.js','capture.html']],
    ['app.js',['index.html']],
    ['styles.css',['index.html']],
    ['capture.js',['capture.html']],
    ['capture.css',['capture.html']],
    ['capture-manifest.json',['capture.js','capture.html']],
    ['capture-map.pdf',['capture.html']]
  ];
  for(const [file,parents] of cases)await t.test(file,async t=>{
    const f = await fixture(t);
    await prepareResources(f);
    const before = await f.snapshot();
    // Whitespace changes bytes without changing JSON or JavaScript semantics.
    await f.write(file,Buffer.concat([before.get(file),Buffer.from('\n')]));
    const stale = await f.snapshot();
    await assert.rejects(prepareResources({...f,check:true}),/Stale resource references.*prepare:resources/);
    assert.deepEqual(await f.snapshot(),stale,'checking must not repair files');
    await prepareResources(f);
    for(const parent of parents)assert.notDeepEqual(await f.read(parent),before.get(parent),`${file} must invalidate ${parent}`);
    await verifyBrowserReferences(f);
    await prepareResources({...f,check:true});
  });
});

test('preparation preserves source data, the frozen guide, and the capture ledger; reruns do not write',async t=>{
  const f = await fixture(t);
  const protectedFiles = ['capture-manifest.json','capture-map.pdf','catalog.json','box-photos.json','spine-masks.json'];
  const originals = new Map(await Promise.all(protectedFiles.map(async file=>[file,await f.read(file)])));
  const frozen = await Promise.all(frozenFiles.map(file=>readFile(join(f.directory,'research',file))));
  await prepareResources(f);
  for(const [file,bytes] of originals)assert.deepEqual(await f.read(file),bytes);
  for(const [index,file] of frozenFiles.entries())assert.deepEqual(await readFile(join(f.directory,'research',file)),frozen[index]);
  const before = await f.snapshot();
  const mtimes = await Promise.all(runtimeFiles.map(file=>stat(new URL(file,f.distDirectory),{bigint:true}).then(s=>s.mtimeNs)));
  assert.deepEqual(await prepareResources(f),[]);
  assert.deepEqual(await f.snapshot(),before);
  assert.deepEqual(await Promise.all(runtimeFiles.map(file=>stat(new URL(file,f.distDirectory),{bigint:true}).then(s=>s.mtimeNs))),mtimes);
  await verifyBrowserReferences(f);
});

test('missing required references and missing dependencies fail before any prepared file is written',async t=>{
  for(const failure of ['reference','file'])await t.test(failure,async t=>{
    const f = await fixture(t);
    if(failure==='reference')await f.write('app.js',(await f.read('app.js')).toString().replace(/import .*turntable\.js[^\n]*\n/,''));
    else await rm(new URL('styles.css',f.distDirectory));
    const files = await readdir(f.distDirectory);
    const before = await Promise.all(files.map(name=>f.read(name)));
    await assert.rejects(prepareResources(f),failure==='reference'?/Missing resource reference: app.js → turntable.js/:/ENOENT/);
    assert.deepEqual(await Promise.all(files.map(name=>f.read(name))),before);
  });
});

test('optional legacy playback is refreshed when referenced and not required otherwise',async t=>{
  const f = await fixture(t);
  await f.write('turntable.js',(await f.read('turntable.js')).toString()+"\nimport './spotify-player.js';\n");
  await prepareResources(f);
  await verifyBrowserReferences(f);
  await f.write('spotify-player.js',Buffer.concat([await f.read('spotify-player.js'),Buffer.from('\n')]));
  await prepareResources(f);
  await verifyBrowserReferences(f);
  await f.write('turntable.js',(await f.read('turntable.js')).toString().replace(/\nimport '\.\/spotify-player\.js[^\n]*\n/,''));
  await rm(new URL('spotify-player.js',f.distDirectory));
  await prepareResources(f);
});

test('catalog, mask, and capture generation each finish their resource chain automatically',async t=>{
  for(const command of ['merge-catalog.mjs','merge-spine-masks.mjs','build-capture-plan.mjs'])await t.test(command,async t=>{
    const f = await fixture(t);
    await mkdir(join(f.directory,'scripts'));
    for(const script of [command,'prepare-resources.mjs'])await cp(new URL(script,import.meta.url),join(f.directory,'scripts',script));
    for(const shard of ['left','middle','right'])for(const name of [`${shard}.json`,`spine-masks-${shard}.json`])
      await cp(new URL(`../research/${name}`,import.meta.url),join(f.directory,'research',name));
    if(command==='merge-spine-masks.mjs') {
      const photos = JSON.parse(await f.read('box-photos.json'));
      for(const photo of Object.values(photos.boxes)) {
        const target = new URL(photo.path,f.distDirectory);
        await mkdir(new URL('.',target),{recursive:true});
        await writeFile(target,'fixture photograph bytes');
      }
    }
    if(command==='merge-catalog.mjs') {
      const path = join(f.directory,'research','left.json');
      const rows = JSON.parse(await readFile(path));
      rows[0].notes += ' Updated catalog evidence.';
      await writeFile(path,JSON.stringify(rows));
    }
    // Ensure each caller also handles an unrelated code/style edit.
    await f.write('styles.css',Buffer.concat([await f.read('styles.css'),Buffer.from('\n')]));
    const result = spawnSync(process.execPath,[join(f.directory,'scripts',command)],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    await verifyBrowserReferences(f);
    await prepareResources({...f,check:true});
    if(command!=='build-capture-plan.mjs')assert.deepEqual(await f.read('capture-manifest.json'),await readFile(join(f.directory,'research',frozenFiles[0])));
  });
});
