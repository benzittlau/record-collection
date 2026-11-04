import { readFile, writeFile, access } from "node:fs/promises";
import { buildSite } from "./build.mjs";
const parts = await Promise.all(
  ["left", "middle", "right"].map(async (shard) =>
    JSON.parse(
      await readFile(
        new URL(`../research/${shard}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ),
);
const order = [
  "upper-left",
  "lower-left",
  "upper-middle",
  "lower-middle",
  "right",
];
const records = parts
  .flat()
  .sort(
    (a, b) =>
      order.indexOf(a.box) - order.indexOf(b.box) || a.position - b.position,
  );
for (const record of records) {
  record.cover = record.cover ?? record.coverPath ?? null;
  if (record.cover?.startsWith("/assets/"))
    record.cover = record.cover.slice(1);
  if (record.backPath?.startsWith("/assets/"))
    record.backPath = record.backPath.slice(1);
  record.back =
    record.back ??
    record.backPath ??
    record.backCover ??
    (record.backUrl?.startsWith("/assets/") ? record.backUrl.slice(1) : null);
  if (record.back?.startsWith("/assets/")) record.back = record.back.slice(1);
  record.label = record.label ?? record.labelPath ?? null;
  if (record.label?.startsWith("/assets/"))
    record.label = record.label.slice(1);
  if (record.cover) {
    try {
      await access(new URL(`../public/${record.cover}`, import.meta.url));
    } catch {
      record.cover = null;
    }
  }
  if (record.back) {
    try {
      await access(new URL(`../public/${record.back}`, import.meta.url));
    } catch {
      record.back = null;
    }
  }
  if (record.label) {
    try {
      await access(new URL(`../public/${record.label}`, import.meta.url));
    } catch {
      record.label = null;
    }
  }
  record.photo = `assets/${record.photo?.split("/").at(-1)}`;
}
// Stable source IDs include photographed fold aliases. Count each physical
// item once, while retaining those source rows for old links and the guide.
const physical = records.filter((record) => !record.mergedInto);
const meta = {
  recordCount: physical.length,
  sourcePositionCount: records.length,
  mergedAliasCount: records.length - physical.length,
  confirmed: physical.filter((record) => record.confidence === "confirmed")
    .length,
  probable: physical.filter((record) => record.confidence === "probable")
    .length,
  unknown: physical.filter((record) => record.confidence === "unknown").length,
  artwork: physical.filter((record) => record.cover).length,
  spotify: physical.filter((record) => record.spotifyId).length,
  note: "Source positions retain stable IDs, including documented folded sleeve edges. Covers may show other pressings; illustrated vinyl is not a photograph of the original disc.",
};
const serialized = JSON.stringify({ meta, records }, null, 2) + "\n";
await writeFile(new URL("../public/catalog.json", import.meta.url), serialized);
await buildSite();
console.log(meta);
