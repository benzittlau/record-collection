import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteDirectory = new URL("../", import.meta.url);
const fingerprint = (bytes) =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 12);

// Browser modules and pages use literal local URLs. Discover those references
// instead of maintaining a second dependency graph beside the imports.
const references =
  /(["'])(\.\/)?([a-z][a-z0-9-]*\.(?:js|css|json|pdf))(?:\?v=[^"'\s]*)?\1/g;

export async function buildSite({
  sourceDirectory = new URL("src/", siteDirectory),
  publicDirectory = new URL("public/", siteDirectory),
  outputDirectory = new URL("dist/", siteDirectory),
} = {}) {
  const outputPath = resolve(fileURLToPath(outputDirectory));
  for (const input of [sourceDirectory, publicDirectory]) {
    const distance = relative(outputPath, fileURLToPath(input));
    if (
      distance === "" ||
      (!distance.startsWith("..") && !distance.startsWith("/"))
    ) {
      throw new Error("Build output must not contain source or public inputs.");
    }
  }
  const sources = await readdir(sourceDirectory);
  const publicFiles = await readdir(publicDirectory);
  for (const file of sources) {
    if (publicFiles.includes(file))
      throw new Error(`Source and public files overlap: ${file}`);
  }

  const prepared = new Map();
  const visiting = new Set();
  async function prepare(file) {
    if (prepared.has(file)) return prepared.get(file);
    if (visiting.has(file))
      throw new Error(
        `Circular browser dependency: ${[...visiting, file].join(" → ")}`,
      );
    visiting.add(file);
    let bytes = await readFile(
      new URL(file, sources.includes(file) ? sourceDirectory : publicDirectory),
    );
    if (/\.(js|html)$/.test(file)) {
      let source = bytes.toString();
      // Keep replacement sequential: each parent hashes its final children.
      for (const match of [...source.matchAll(references)]) {
        const [, quote, prefix = "", dependency] = match;
        const hash = fingerprint(await prepare(dependency));
        source = source.replace(
          match[0],
          `${quote}${prefix}${dependency}?v=${hash}${quote}`,
        );
      }
      bytes = Buffer.from(source);
    }
    visiting.delete(file);
    prepared.set(file, bytes);
    return bytes;
  }
  for (const file of sources) await prepare(file);

  // Only generated output is replaced. Validate the full graph first, then
  // stage beside the output so a missing dependency cannot damage a good build.
  await mkdir(dirname(outputPath), { recursive: true });
  const staging = await mkdtemp(`${outputPath}.build-`);
  try {
    await cp(publicDirectory, staging, { recursive: true });
    for (const [file, bytes] of prepared)
      await writeFile(resolve(staging, file), bytes);
    await rm(outputDirectory, { recursive: true, force: true });
    await rename(staging, outputPath);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await buildSite();
  console.log("Built dist/ from src/ and public/.");
}
