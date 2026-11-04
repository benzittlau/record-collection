import assert from "node:assert/strict";
import test from "node:test";
import { layoutSpines } from "../src/spine-layout.js";

const face = [
  [0, 0],
  [1000, 100],
  [900, 600],
  [100, 500],
];
const width = (slot) => slot.polygons[0][1][0] - slot.polygons[0][0][0];
const record = (id, position, fields = {}) => ({
  id,
  position,
  compartmentCount: 1,
  ...fields,
});
const closeTo = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `${actual} should equal ${expected}`,
  );

test("estimated sleeves follow the perspective face and preserve physical order", () => {
  const records = [record("first", 1), record("second", 2)];
  const before = structuredClone(records);
  const slots = layoutSpines(records, face);
  assert.deepEqual(
    slots.map((slot) => slot.record.id),
    ["first", "second"],
  );
  assert.deepEqual(
    slots.map((slot) => slot.source),
    ["estimated", "estimated"],
  );
  const first = slots[0].polygons[0],
    second = slots[1].polygons[0];
  assert.deepEqual(first[1], second[0]);
  assert.deepEqual(first[2], second[3]);
  // Top and bottom edges have different slopes in the photographed box.
  closeTo(first[0][1], first[0][0] / 10);
  closeTo(first[3][1], 500 + (first[3][0] - 100) / 8);
  closeTo(slots[0].anchor[0], (first[2][0] + first[3][0]) / 2);
  closeTo(slots[0].anchor[1], (first[2][1] + first[3][1]) / 2);
  assert.deepEqual(records, before, "layout never changes catalog positions");
});

test("books and explicitly wide sleeves retain their relative widths", () => {
  const slots = layoutSpines(
    [
      record("ordinary", 1),
      record("book", 2, { kind: "book" }),
      record("double", 3, { spineWidth: 2 }),
    ],
    face,
  );
  closeTo(width(slots[1]), width(slots[0]) * 4);
  closeTo(width(slots[2]), width(slots[0]) * 2);
});

test("explicit compartments keep divider gaps and weight sleeves locally", () => {
  const slots = layoutSpines(
    [
      record("left", 1, { compartmentCount: 2, compartment: 1 }),
      record("right-wide", 2, {
        compartmentCount: 2,
        compartment: 2,
        spineWidth: 2,
      }),
      record("right-thin", 3, { compartmentCount: 2, compartment: 2 }),
    ],
    face,
  );
  assert.ok(slots[0].polygons[0][1][0] < slots[1].polygons[0][0][0]);
  closeTo(width(slots[1]), 2 * width(slots[2]));
  closeTo(width(slots[0]), width(slots[1]) + width(slots[2]));
});

test("photographed polygons, anchors and folded edges override estimates without extra records", () => {
  const polygon = [
    [2, 3],
    [7, 4],
    [8, 20],
    [6, 22],
    [3, 21],
  ];
  const fold = [
    [9, 3],
    [10, 3],
    [11, 22],
    [9, 20],
  ];
  const anchor = [5, 23];
  const traced = new Map([
    ["album", { polygon, anchor }],
    ["fold", { polygon: fold }],
  ]);
  const records = [record("album", 1), record("untraced", 2)];
  const slots = layoutSpines(records, face, traced, (id) =>
    id === "album" ? [{ id: "fold" }, { id: "missing-fold" }] : [],
  );
  assert.equal(slots.length, 2);
  assert.equal(slots[0].source, "photo");
  assert.equal(slots[0].polygons[0], polygon);
  assert.equal(slots[0].polygons[1], fold);
  assert.equal(slots[0].anchor, anchor);
  assert.equal(slots[1].source, "estimated");
  assert.equal(slots[1].polygons.length, 1);
});

test("empty boxes produce no hit regions", () => {
  assert.deepEqual(layoutSpines([], face), []);
});
