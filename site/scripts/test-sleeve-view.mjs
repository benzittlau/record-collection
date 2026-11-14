import assert from "node:assert/strict";
import test from "node:test";
import { createSleeveView } from "../src/sleeve-view.js";
import { artworkNote } from "../src/artwork.js";

// Browser primitives only; selection enters through the room-facing interface,
// and face changes enter through the installed controls.
function fixture(t) {
  function element() {
    const classes = new Set();
    const attributes = new Map();
    return {
      dataset: {}, style: {}, parentElement: { style: {} },
      classList: {
        remove: (name) => classes.delete(name),
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
        contains: (name) => classes.has(name),
      },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => attributes.get(name),
      replaceChildren() {},
      querySelector: () => element(),
    };
  }
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const controls = ["front", "back", "vinyl"].map((view) => {
    const button = element();
    button.dataset.view = view;
    return button;
  });
  const document = {
    getElementById: get,
    querySelector: get,
    querySelectorAll: () => controls,
    createElement: element,
  };
  const previous = globalThis.document;
  globalThis.document = document;
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const browsing = {
    box: "upper-left", index: 0,
    records: [
      { title: "First", artist: "Artist", cover: "front.jpg", back: "back.jpg" },
      { title: "Second", artist: "Artist", kind: "book",
        artworkProvenance: { front: { source: "Family photograph" } }, cover: "book.jpg" },
    ],
  };
  let ignoreClick = false;
  const view = createSleeveView({ document, browsing, openTurntable() {},
    shouldIgnoreJacketClick: () => ignoreClick });
  return {
    get, browsing, view,
    choose: (face) => controls.find((b) => b.dataset.view === face).onclick(),
    ignore: (value) => { ignoreClick = value; },
    assertFace(face) {
      assert.equal(get(".sleeve-stage").dataset.view, face);
      assert.equal(get("jacket").classList.contains("is-back"), face === "back");
      assert.equal(get("record-view").classList.contains("show-vinyl"), face === "vinyl");
      assert.equal(get("jacket-front").getAttribute("aria-hidden"), String(face === "back"));
      assert.equal(get("jacket-back").getAttribute("aria-hidden"), String(face !== "back"));
      for (const button of controls) {
        assert.equal(button.classList.contains("active"), button.dataset.view === face);
        assert.equal(button.getAttribute("aria-pressed"), String(button.dataset.view === face));
      }
    },
  };
}

test("selecting another sleeve resets all face presentation and uses its artwork note", (t) => {
  const f = fixture(t);
  assert.deepEqual(Object.keys(f.view), ["renderRecord"]);
  f.view.renderRecord();
  f.assertFace("front");
  for (const face of ["back", "vinyl"]) {
    f.browsing.index = 0;
    f.view.renderRecord();
    f.choose(face);
    f.assertFace(face);
    f.browsing.index = 1;
    f.view.renderRecord();
    f.assertFace("front");
    assert.equal(f.get("view-note").textContent, artworkNote(f.browsing.records[1]));
    assert.equal(f.get("vinyl-button").hidden, true);
    assert.equal(f.get("jacket").getAttribute("aria-label"), "Turn over Second");
  }
});

test("jacket turns from vinyl to back, respects gesture suppression, and notes follow the face", (t) => {
  const f = fixture(t);
  f.view.renderRecord();
  f.choose("vinyl");
  f.assertFace("vinyl");
  f.ignore(true);
  f.get("jacket").onclick();
  f.assertFace("vinyl");
  f.ignore(false);
  f.get("jacket").onclick();
  f.assertFace("back");
  assert.equal(f.get("view-note").textContent, artworkNote(f.browsing.records[0], "back"));
  f.get("jacket").onclick();
  f.assertFace("front");
  assert.equal(f.get("view-note").textContent, artworkNote(f.browsing.records[0]));
});
