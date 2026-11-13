import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCaptureMap } from "../src/capture-map.js";

const plan = JSON.parse(readFileSync(new URL("../public/capture-manifest.json", import.meta.url)));

test("all frozen pairs render bounded detail crops and full-photo maps without mutating the plan", () => {
  const before = JSON.stringify(plan);
  for (const pair of plan.pairs) {
    const box = plan.boxes.find((box) => box.id === pair.box);
    const detail = renderCaptureMap([pair], box);
    const [x, y, width, height] = detail.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
    assert.equal(width, 1300);
    assert.equal(height, 1500);
    assert.ok(x >= 0 && x + width <= box.width);
    assert.ok(y >= 0 && y + height <= box.height);
    assert.ok(!detail.includes('data-pair='));
    const whole = renderCaptureMap([pair], box, "whole");
    assert.ok(whole.includes(`viewBox="0 0 ${box.width} ${box.height}"`));
    // Every emitted outline stays inside its source photograph.
    for (const [, points] of whole.matchAll(/<polygon[^>]*points="([^"]+)"/g)) {
      for (const point of points.split(" ")) {
        const [px, py] = point.split(",").map(Number);
        assert.ok(px >= 0 && px <= box.width);
        assert.ok(py >= 0 && py <= box.height);
      }
    }
  }
  assert.equal(JSON.stringify(plan), before);
});

test("section mode owns accessible pair targets and space below the photograph for labels", () => {
  for (const box of plan.boxes) {
    const pairs = plan.pairs.filter((pair) => pair.box === box.id);
    const svg = renderCaptureMap(pairs, box, "section");
    assert.ok(svg.includes(`viewBox="0 0 ${box.width} ${box.height + 300}"`));
    assert.equal([...svg.matchAll(/role="button" tabindex="0"/g)].length, pairs.length);
    for (const pair of pairs) {
      assert.ok(svg.includes(`data-pair="${pair.pair}"`));
      assert.ok(svg.includes(`photos ${pair.frontShot} and ${pair.backShot}`));
    }
  }
});

test("map text and photograph attributes escape archive metadata", () => {
  const pair = { ...plan.pairs[0], title: '<script>"&\'' };
  const box = { ...plan.boxes[0], name: '"<&', photo: 'photo?name="<&' };
  const svg = renderCaptureMap([pair], box, "section");
  assert.ok(svg.includes('&lt;script&gt;&quot;&amp;&#39;'));
  assert.ok(svg.includes('href="photo?name=&quot;&lt;&amp;"'));
  assert.ok(!svg.includes('<script>'));
});
