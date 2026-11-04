import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildSite } from "./build.mjs";

const hash = (bytes) =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 12);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "record-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = (name) => pathToFileURL(join(root, name) + "/");
  const options = {
    sourceDirectory: directory("src"),
    publicDirectory: directory("public"),
    outputDirectory: directory("dist"),
  };
  await Promise.all([
    mkdir(options.sourceDirectory),
    mkdir(options.publicDirectory),
  ]);
  const write = (folder, file, source) =>
    writeFile(new URL(file, options[folder + "Directory"]), source);
  const read = (file) => readFile(new URL(file, options.outputDirectory));
  return { root, options, write, read };
}

test("a clean build discovers nested imports, dynamic imports, fetches, styles and PDF links", async (t) => {
  const f = await fixture(t);
  await f.write(
    "source",
    "index.html",
    '<script type="module" src="app.js"></script><link href="styles.css"><a href="guide.pdf">Guide</a>',
  );
  await f.write(
    "source",
    "app.js",
    "import {value} from './model.js'; fetch('catalog.json'); import('./optional.js');",
  );
  await f.write("source", "model.js", "export {value} from './leaf.js';");
  await f.write("source", "leaf.js", "export const value = 1;");
  await f.write("source", "optional.js", "export const optional = true;");
  await f.write("source", "styles.css", "body {}");
  await f.write("public", "catalog.json", '{"records":[]}');
  await f.write("public", "guide.pdf", "pdf bytes");
  await buildSite(f.options);
  const originalSource = await readFile(
    new URL("app.js", f.options.sourceDirectory),
    "utf8",
  );
  assert(
    !originalSource.includes("?v="),
    "source stays free of generated fingerprints",
  );
  for (const parent of ["index.html", "app.js", "model.js"]) {
    const source = (await f.read(parent)).toString();
    for (const match of source.matchAll(
      /["'](?:\.\/)?([a-z-]+\.(?:js|css|json|pdf))\?v=([a-f0-9]+)["']/g,
    ))
      assert.equal(
        match[2],
        hash(await f.read(match[1])),
        `${parent} → ${match[1]}`,
      );
  }
  const before = await f.read("index.html");
  await f.write("source", "leaf.js", "export const value = 2;");
  await buildSite(f.options);
  assert.notDeepEqual(
    await f.read("index.html"),
    before,
    "nested edits invalidate the page in one build",
  );
  assert.equal(
    await readFile(new URL("app.js", f.options.sourceDirectory), "utf8"),
    originalSource,
  );
  const rebuilt = await f.read("index.html");
  await buildSite(f.options);
  assert.deepEqual(
    await f.read("index.html"),
    rebuilt,
    "identical inputs produce identical output",
  );
});

test("obsolete generated files disappear while public files and subdirectories are copied intact", async (t) => {
  const f = await fixture(t);
  await f.write("source", "index.html", "<h1>Room</h1>");
  await mkdir(new URL("assets/", f.options.publicDirectory));
  await f.write("public", "assets/cover.jpg", "original photo bytes");
  await buildSite(f.options);
  await writeFile(new URL("stale.js", f.options.outputDirectory), "obsolete");
  await buildSite(f.options);
  await assert.rejects(f.read("stale.js"), { code: "ENOENT" });
  assert.equal(
    (await f.read("assets/cover.jpg")).toString(),
    "original photo bytes",
  );
});

test("missing dependencies, cycles and overlapping inputs fail before replacing output", async (t) => {
  for (const problem of ["missing", "cycle", "overlap"])
    await t.test(problem, async (t) => {
      const f = await fixture(t);
      await f.write("source", "index.html", "valid page");
      await buildSite(f.options);
      if (problem === "missing")
        await f.write("source", "app.js", "import './missing.js';");
      if (problem === "cycle") {
        await f.write("source", "app.js", "import './other.js';");
        await f.write("source", "other.js", "import './app.js';");
      }
      if (problem === "overlap")
        await f.write("public", "index.html", "ambiguous");
      await assert.rejects(
        buildSite(f.options),
        problem === "missing"
          ? /ENOENT/
          : problem === "cycle"
            ? /Circular browser dependency/
            : /overlap/,
      );
      assert.equal((await f.read("index.html")).toString(), "valid page");
    });
});

test("real source builds without modifying source, archive inputs or the frozen guide", async (t) => {
  const f = await fixture(t);
  await cp(new URL("../src/", import.meta.url), f.options.sourceDirectory, {
    recursive: true,
  });
  for (const name of await readdir(new URL("../public/", import.meta.url))) {
    if (name === "assets") continue;
    await cp(
      new URL("../public/" + name, import.meta.url),
      new URL(name, f.options.publicDirectory),
    );
  }
  async function inputs() {
    const entries = [];
    for (const directory of [
      f.options.sourceDirectory,
      f.options.publicDirectory,
    ])
      for (const file of await readdir(directory))
        entries.push([file, hash(await readFile(new URL(file, directory)))]);
    return entries;
  }
  const before = await inputs();
  await buildSite(f.options);
  assert.deepEqual(await inputs(), before);
  const frozen = await readFile(
    new URL("../research/capture-plans/7ac3efbb41aa.json", import.meta.url),
  );
  assert.deepEqual(await f.read("capture-manifest.json"), frozen);
  for (const file of (await readdir(f.options.sourceDirectory)).filter((file) =>
    /\.(js|html)$/.test(file),
  )) {
    for (const match of (await f.read(file))
      .toString()
      .matchAll(
        /["'](?:\.\/)?([a-z][a-z0-9-]*\.(?:js|css|json|pdf))\?v=([a-f0-9]+)["']/g,
      ))
      assert.equal(
        match[2],
        hash(await f.read(match[1])),
        `${file} → ${match[1]}`,
      );
  }
});

test("archive generators update public inputs and finish with a fresh build", async (t) => {
  for (const command of [
    "merge-catalog.mjs",
    "merge-spine-masks.mjs",
    "build-capture-plan.mjs",
  ])
    await t.test(command, async (t) => {
      const f = await fixture(t);
      await cp(new URL("../src/", import.meta.url), f.options.sourceDirectory, {
        recursive: true,
      });
      for (const name of await readdir(
        new URL("../public/", import.meta.url),
      )) {
        if (name === "assets") continue;
        await cp(
          new URL("../public/" + name, import.meta.url),
          new URL(name, f.options.publicDirectory),
        );
      }
      await mkdir(join(f.root, "scripts"));
      await mkdir(join(f.root, "research"));
      for (const name of [command, "build.mjs"])
        await cp(new URL(name, import.meta.url), join(f.root, "scripts", name));
      for (const shard of ["left", "middle", "right"])
        for (const name of [`${shard}.json`, `spine-masks-${shard}.json`])
          await cp(
            new URL("../research/" + name, import.meta.url),
            join(f.root, "research", name),
          );
      const photos = JSON.parse(
        await readFile(new URL("box-photos.json", f.options.publicDirectory)),
      );
      for (const photo of Object.values(photos.boxes)) {
        const target = new URL(photo.path, f.options.publicDirectory);
        await mkdir(new URL(".", target), { recursive: true });
        await writeFile(target, "fixture photograph bytes");
      }
      const result = spawnSync(
        process.execPath,
        [join(f.root, "scripts", command)],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      const app = (await f.read("app.js")).toString();
      assert(
        app.includes("?v="),
        "generator builds the browser resource chain",
      );
      if (command !== "build-capture-plan.mjs")
        assert.deepEqual(
          await f.read("capture-manifest.json"),
          await readFile(
            new URL(
              "../research/capture-plans/7ac3efbb41aa.json",
              import.meta.url,
            ),
          ),
        );
    });
});

test("output cannot replace either input directory", async (t) => {
  const fixtureFiles = await fixture(t);
  await fixtureFiles.write("source", "index.html", "source remains intact");
  for (const outputDirectory of [
    fixtureFiles.options.sourceDirectory,
    fixtureFiles.options.publicDirectory,
  ]) {
    await assert.rejects(
      buildSite({ ...fixtureFiles.options, outputDirectory }),
      /must not contain/,
    );
  }
  assert.equal(
    await readFile(
      new URL("index.html", fixtureFiles.options.sourceDirectory),
      "utf8",
    ),
    "source remains intact",
  );
});
