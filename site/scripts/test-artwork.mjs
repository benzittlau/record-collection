import assert from "node:assert/strict";
import test from "node:test";
import {
  artworkNote,
  artworkPath,
  backPlaceholder,
  escapeHtml,
  isFamilyArtwork,
  mountCover,
  placeholder,
  sleeveNumber,
} from "../src/artwork.js";

const record = {
  title: "A <rare> album",
  artist: "Artist & Friends",
  confidence: "confirmed",
  cover: "covers/front.jpg",
  back: "covers/back.jpg",
  coverThumbnail: "covers/thumb.webp",
};

// Only browser primitives are faked: the real module decides paths, loading,
// failure recovery, accessibility text, and whether to replace the image.
function fixture(t) {
  const originalDocument = globalThis.document;
  const images = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "img");
      const image = {};
      images.push(image);
      return image;
    },
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const classes = new Set(["cover-missing"]);
  let children = [],
    html = "";
  const container = {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    replaceChildren(...next) {
      children = next;
      html = "";
    },
    set innerHTML(value) {
      html = value;
      children = [];
    },
    get innerHTML() {
      return html;
    },
  };
  return {
    container,
    images,
    classes,
    get children() {
      return children;
    },
  };
}

test("small front cover recovers from thumbnail failure before using a placeholder", (t) => {
  const f = fixture(t);
  mountCover(f.container, record, "front", true);
  const image = f.images[0];
  assert.equal(image.src, record.coverThumbnail);
  assert.equal(image.alt, "Artist & Friends — A <rare> album, front cover");
  assert.equal(f.classes.has("cover-missing"), false);
  assert.deepEqual(f.children, [image]);

  image.onerror();
  assert.equal(image.src, record.cover);
  assert.deepEqual(
    f.children,
    [image],
    "first failure keeps the mounted image",
  );
  assert.equal(f.classes.has("cover-missing"), false);

  image.onerror();
  assert.deepEqual(f.children, []);
  assert.equal(f.container.innerHTML, placeholder(record, true));
  assert.equal(f.classes.has("cover-missing"), true);

  mountCover(f.container, { ...record, coverThumbnail: null });
  assert.equal(f.images[1].src, record.cover);
  assert.equal(
    f.classes.has("cover-missing"),
    false,
    "a new mount clears old failure styling",
  );
});

test("back cover failure uses the distinct back placeholder without a front thumbnail retry", (t) => {
  const f = fixture(t);
  mountCover(f.container, record, "back", true);
  const image = f.images[0];
  assert.equal(image.src, record.back);
  assert.equal(image.alt, "A <rare> album, sourced back cover");
  image.onerror();
  assert.equal(f.container.innerHTML, backPlaceholder());
  assert.equal(f.classes.has("cover-missing"), true);
  assert.deepEqual(f.children, []);
});

test("full front failure uses escaped artwork placeholder and unknown sleeves keep honest labels", (t) => {
  const f = fixture(t);
  mountCover(f.container, record);
  assert.equal(
    f.images[0].src,
    record.cover,
    "full view does not request a thumbnail",
  );
  f.images[0].onerror();
  assert.equal(f.container.innerHTML, placeholder(record));
  assert.match(f.container.innerHTML, /A &lt;rare&gt; album/);
  assert.match(f.container.innerHTML, /Artist &amp; Friends/);
  assert.match(
    placeholder({ ...record, confidence: "unknown" }),
    /Waiting to be rediscovered/,
  );
  assert.match(
    placeholder({ ...record, confidence: "unknown" }, true),
    /Unidentified sleeve/,
  );
});

test("loading is eager by default and lazy only when the caller opts in", (t) => {
  const f = fixture(t);
  mountCover(f.container, record);
  mountCover(f.container, record, "front", true, true);
  assert.deepEqual(
    f.images.map((image) => image.loading),
    ["eager", "lazy"],
  );
  assert.deepEqual(
    f.images.map((image) => image.decoding),
    ["async", "async"],
  );
});

test("absent artwork creates no image or unnecessary request", (t) => {
  const f = fixture(t);
  const missing = { ...record, cover: null };
  mountCover(f.container, missing);
  assert.equal(f.images.length, 0);
  assert.equal(f.container.innerHTML, placeholder(missing));
});

test("artwork paths prefer local backs and upgrade remote HTTP fallback paths", () => {
  assert.equal(artworkPath(record), record.cover);
  assert.equal(
    artworkPath(
      { ...record, backUrl: "https://archive.example/back.jpg" },
      "back",
    ),
    record.back,
  );
  assert.equal(
    artworkPath({ backUrl: "http://archive.example/back.jpg" }, "back"),
    "https://archive.example/back.jpg",
  );
  assert.equal(
    artworkPath({ backUrl: "https://archive.example/back.jpg" }, "back"),
    "https://archive.example/back.jpg",
  );
  assert.equal(artworkPath({}, "back"), undefined);
});

test("provenance notes distinguish missing, sourced, and original family artwork per side", () => {
  assert.equal(artworkNote({}), "A placeholder until the cover is found");
  assert.equal(
    artworkNote({}, "back"),
    "The original back cover is still to come",
  );
  assert.equal(
    artworkNote(record),
    "Album artwork · original sleeve edition may differ",
  );
  assert.equal(
    artworkNote(record, "back"),
    "Sourced back artwork · exact pressing may differ",
  );
  const family = {
    ...record,
    artworkProvenance: { front: { source: "Family photograph" } },
  };
  assert.equal(isFamilyArtwork(family, "front"), true);
  assert.equal(isFamilyArtwork(family, "back"), false);
  assert.equal(
    artworkNote(family),
    "The family copy · front of the original sleeve",
  );
  assert.equal(artworkNote(family, "back"), artworkNote(record, "back"));
  family.artworkProvenance.back = { source: "Family photograph" };
  assert.equal(
    artworkNote(family, "back"),
    "The family copy · back of the original sleeve",
  );
});

test("display helpers preserve physical sleeve labels and escape untrusted text", () => {
  assert.equal(sleeveNumber({ position: 4, positionLabel: "4b" }), "4b");
  assert.equal(sleeveNumber({ position: 4 }), 4);
  assert.equal(
    escapeHtml(`<script a="x">&'</script>`),
    "&lt;script a=&quot;x&quot;&gt;&amp;&#39;&lt;/script&gt;",
  );
  assert.equal(escapeHtml(null), "");
});
