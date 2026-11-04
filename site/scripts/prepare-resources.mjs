import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The two pages have a small, fixed resource graph. Children precede parents:
// a parent's fingerprint must include its rewritten dependency URLs.
const resources = [
  { file: 'spine-masks.js', dependencies: ['photo-projection.js'] },
  {
    file: 'turntable.js',
    dependencies: ['spotify-session.js'],
    optionalDependencies: ['spotify-player.js']
  },
  {
    file: 'app.js',
    dependencies: [
      'photo-projection.js', 'spine-masks.js', 'turntable.js', 'box-browsing.js',
      'catalog.json', 'box-photos.json', 'spine-masks.json'
    ]
  },
  { file: 'capture.js', dependencies: ['spine-masks.js', 'capture-manifest.json'] },
  { file: 'index.html', dependencies: ['app.js', 'styles.css'] },
  { file: 'capture.html', dependencies: ['capture.js', 'capture.css', 'capture-map.pdf'] }
];
const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);

function resourceReferencePattern(filename) {
  const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match a quoted local URL, retaining its quote and optional ./ prefix.
  return new RegExp(`(["'])(\\./)?${escapedFilename}(?:\\?v=[^"'\\s]*)?(?=\\1)`, 'g');
}

// Only references are rewritten. Catalogs, masks, the capture manifest, PDF,
// archived capture plans, and the research ledger are never regenerated here.
export async function prepareResources({
  distDirectory = new URL('../dist/', import.meta.url),
  check = false
} = {}) {
  const stagedSources = new Map();

  async function readPreparedBytes(file) {
    // A dependency may already contain rewritten URLs. Hash its staged source
    // when present; unchanged dependencies still have their final bytes on disk.
    if (stagedSources.has(file)) {
      return Buffer.from(stagedSources.get(file));
    }
    return readFile(new URL(file, distDirectory));
  }

  for (const { file, dependencies, optionalDependencies = [] } of resources) {
    const originalSource = await readFile(new URL(file, distDirectory), 'utf8');
    let preparedSource = originalSource;

    for (const dependency of [...dependencies, ...optionalDependencies]) {
      const pattern = resourceReferencePattern(dependency);
      if (!pattern.test(preparedSource)) {
        if (optionalDependencies.includes(dependency)) continue;
        throw new Error(`Missing resource reference: ${file} → ${dependency}`);
      }

      const dependencyFingerprint = fingerprint(await readPreparedBytes(dependency));
      preparedSource = preparedSource.replace(pattern, (_, quote, prefix = '') =>
        `${quote}${prefix}${dependency}?v=${dependencyFingerprint}`
      );
    }

    if (preparedSource !== originalSource) {
      stagedSources.set(file, preparedSource);
    }
  }

  // Validate the entire graph before writing anything, including in check mode.
  const changedFiles = [...stagedSources.keys()];
  if (check && changedFiles.length) {
    throw new Error(`Stale resource references in ${changedFiles.join(', ')}. Run npm run prepare:resources.`);
  }

  if (!check) {
    for (const [file, source] of stagedSources) {
      await writeFile(new URL(file, distDirectory), source);
    }
  }
  return changedFiles;
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  const changedFiles = await prepareResources({ check: process.argv.includes('--check') });
  console.log(changedFiles.length
    ? `Refreshed resource references in ${changedFiles.join(', ')}.`
    : 'Resource references are current.');
}
