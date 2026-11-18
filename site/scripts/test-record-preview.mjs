import assert from "node:assert/strict";
import test from "node:test";
import { createRecordPreview } from "../src/record-preview.js";

function fixture() {
  function element() {
    const classes = new Set();
    return {
      style: {}, innerHTML: "", offsetWidth: 220, offsetHeight: 295,
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
    };
  }
  const card = element(), art = element(), caption = element(), dialog = element();
  card.querySelector = (selector) => selector === ".preview-art" ? art : caption;
  let slot = null, transition;
  const spines = {
    querySelector: () => slot && { getBoundingClientRect: () => slot },
    addEventListener: (_, callback) => { transition = callback; },
  };
  const elements = { "record-preview": card, "box-dialog": dialog, "spine-layer": spines };
  const window = { innerWidth: 1280, innerHeight: 900 };
  const preview = createRecordPreview({ document: { getElementById: (id) => elements[id] }, window });
  const record = { title: "A <sleeve>", artist: "A & B", positionLabel: "04b", confidence: "unknown" };
  return { preview, card, art, caption, dialog, window, record,
    setSlot: (value) => { slot = value; },
    transition: (propertyName) => transition({ propertyName }),
  };
}

test("show and hide own content and visibility; hidden placement ignores late events", () => {
  const f = fixture();
  f.preview.show(f.record, {});
  assert.match(f.caption.innerHTML, /Sleeve 04b · Unidentified/);
  assert.match(f.caption.innerHTML, /A &lt;sleeve&gt;/);
  assert.match(f.caption.innerHTML, /A &amp; B/);
  assert.match(f.art.innerHTML, /Unidentified sleeve/);
  assert.equal(f.card.classList.contains("visible"), true);
  assert.equal(f.dialog.classList.contains("has-preview"), true);
  f.preview.hide();
  const placement = { ...f.card.style };
  f.window.innerWidth = 390;
  f.preview.reposition();
  f.transition("transform");
  assert.deepEqual(f.card.style, placement);
  assert.equal(f.card.classList.contains("visible"), false);
  assert.equal(f.dialog.classList.contains("has-preview"), false);
});

test("visible preview follows marker rebuilds and desktop/mobile/desktop resizing", () => {
  const f = fixture();
  f.preview.show(f.record, { event: { clientX: 700, clientY: 400 } });
  assert.equal(f.card.style.left, "726px");
  f.setSlot({ left: 750, right: 770, top: 350, bottom: 370 });
  f.preview.reposition();
  assert.equal(f.card.style.left, "516px", "avoid the rebuilt number marker");
  f.window.innerWidth = 390;
  f.preview.reposition();
  assert.equal(f.card.style.left, "50%");
  assert.equal(f.card.style.bottom, "132px");
  assert.equal(f.card.style.transform, "translateX(-50%)");
  f.window.innerWidth = 1280;
  f.transition("transform");
  assert.equal(f.card.style.left, "516px");
  assert.equal(f.card.style.bottom, "auto");
  assert.equal(f.card.style.transform, "none");
  f.preview.hide();
  f.setSlot(null);
  f.preview.show(f.record, {});
  assert.ok(Math.abs(parseFloat(f.card.style.left) - 729.6) < 0.001, "new show replaces the old pointer anchor");
});
