import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../src/catalog.js";
import { createCollectionGallery } from "../src/collection-gallery.js";

function fixture() {
  let document;
  class Element {
    children = [];
    innerHTML = "";
    value = "";
    open = false;
    modalOpens = 0;
    listeners = new Map();
    classList = { remove() {} };

    append(child) {
      this.children.push(child);
    }
    replaceChildren(...children) {
      this.children = children;
      this.innerHTML = "";
    }
    insertAdjacentHTML(position, html) {
      assert.equal(position, "beforeend");
      this.innerHTML += html;
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    focus() {
      document.activeElement = this;
    }
    showModal() {
      this.open = true;
      this.modalOpens++;
    }
    close() {
      this.open = false;
    }
  }

  const ids = [
    "library-dialog",
    "search-input",
    "box-filter",
    "library-grid",
    "search-results",
    "find-button",
    "all-button",
    "box-search",
    "close-library",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements["box-filter"].value = "all";
  document = {
    activeElement: null,
    getElementById: (id) => elements[id],
    createElement: () => new Element(),
  };
  const catalog = createCatalog([
    {
      id: "first",
      box: "upper-left",
      position: 1,
      title: "First <Album>",
      artist: "Artist & Friends",
      confidence: "confirmed",
    },
    {
      id: "unknown",
      box: "upper-left",
      position: 2,
      title: "Unidentified sleeve",
      confidence: "unknown",
    },
    {
      id: "probable",
      box: "right",
      position: 1,
      title: "Likely Album",
      artist: "Artist & Friends",
      confidence: "probable",
    },
    {
      id: "book",
      box: "right",
      position: 2,
      title: "Art Book",
      artist: "Illustrator",
      kind: "book",
    },
    { id: "fold", box: "upper-left", position: 3, mergedInto: "first" },
  ]);
  const selections = [];
  const gallery = createCollectionGallery({
    document,
    catalog,
    onSelect(box, id) {
      assert.equal(
        elements["library-dialog"].open,
        false,
        "close the gallery before navigating",
      );
      selections.push({ box, id });
    },
  });
  return { gallery, elements, document, selections };
}

test("opening renders physical items in catalog order with escaped metadata and location labels", () => {
  const { gallery, elements } = fixture();
  gallery.open();
  assert.equal(elements["library-dialog"].open, true);
  assert.equal(
    elements["search-results"].textContent,
    "4 items · kept in the order of the boxes",
  );
  const cards = elements["library-grid"].children;
  assert.equal(
    cards.length,
    4,
    "folded source positions are not extra results",
  );
  assert.match(cards[0].innerHTML, /First &lt;Album&gt;/);
  assert.match(cards[0].innerHTML, /Artist &amp; Friends/);
  assert.match(cards[0].innerHTML, /Box 1 · Sleeve 1/);
  assert.match(cards[1].innerHTML, /Unidentified sleeve/);
  assert.match(cards[2].innerHTML, /Box 5 · Likely match/);
  assert.match(cards[3].innerHTML, /Box 5 · Art book/);
});

test("search and box filtering compose and clearing a query restores the filtered list", () => {
  const { gallery, elements } = fixture();
  gallery.open();
  const search = elements["search-input"],
    filter = elements["box-filter"];
  search.value = "  ARTIST & FRIENDS  ";
  search.listeners.get("input")();
  assert.equal(elements["library-grid"].children.length, 2);
  filter.value = "right";
  filter.onchange();
  assert.equal(elements["library-grid"].children.length, 1);
  assert.equal(
    elements["search-results"].textContent,
    "1 item found · kept in the order of the boxes",
  );
  search.value = "";
  search.listeners.get("input")();
  assert.equal(elements["library-grid"].children.length, 2);
});

test("empty results remove old cards and offer a useful recovery message", () => {
  const { gallery, elements } = fixture();
  gallery.open();
  elements["search-input"].value = "no such album";
  elements["search-input"].listeners.get("input")();
  assert.equal(elements["library-grid"].children.length, 0);
  assert.match(
    elements["library-grid"].innerHTML,
    /Try a different title, artist, or box/,
  );
  assert.equal(
    elements["search-results"].textContent,
    "0 items found · kept in the order of the boxes",
  );
});

test("search entry points focus the search field and reopening retains the query without a second modal", () => {
  const { elements, document } = fixture();
  elements["find-button"].onclick();
  assert.equal(document.activeElement, elements["search-input"]);
  elements["search-input"].value = "First";
  elements["box-search"].onclick();
  assert.equal(elements["library-dialog"].modalOpens, 1);
  assert.equal(elements["library-grid"].children.length, 1);
  elements["close-library"].onclick();
  elements["all-button"].onclick();
  assert.equal(elements["library-dialog"].modalOpens, 2);
  assert.equal(elements["search-input"].value, "First");
});

test("selecting a filtered result closes the gallery then delegates its stable identity", () => {
  const { gallery, elements, selections } = fixture();
  elements["box-filter"].value = "right";
  gallery.open();
  elements["library-grid"].children[1].onclick();
  assert.deepEqual(selections, [{ box: "right", id: "book" }]);
});
