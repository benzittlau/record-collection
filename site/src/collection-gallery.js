import { boxes } from "./boxes.js";
import { escapeHtml, sleeveNumber, mountCover } from "./artwork.js";

// Owns the searchable gallery. Selecting a result delegates navigation back to
// the room, so this view never maintains a second selected-record state.
export function createCollectionGallery({ document, catalog, onSelect }) {
  const element = (id) => document.getElementById(id);
  const dialog = element("library-dialog");
  const searchInput = element("search-input");
  const boxFilter = element("box-filter");
  const grid = element("library-grid");

  function open(focusSearch = false) {
    if (!dialog.open) dialog.showModal();
    render();
    if (focusSearch) searchInput.focus();
  }

  function locationLabel(record) {
    if (record.kind === "book") return "Art book";
    if (record.confidence === "unknown") return "Unidentified sleeve";
    if (record.confidence === "probable") return "Likely match";
    return `Sleeve ${sleeveNumber(record)}`;
  }

  function createRecordButton(record) {
    const button = document.createElement("button");
    button.className = "library-record";
    const cover = document.createElement("div");
    mountCover(cover, record, "front", true, true);
    button.append(cover);
    button.insertAdjacentHTML(
      "beforeend",
      `<strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.artist)}</small><span class="small-label">Box ${boxes[record.box].number} · ${locationLabel(record)}</span>`,
    );
    button.onclick = () => {
      dialog.close();
      onSelect(record.box, record.id);
    };
    return button;
  }

  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const results = catalog.search(query, boxFilter.value);
    element("search-results").textContent =
      `${results.length} ${results.length === 1 ? "item" : "items"}${query ? " found" : ""} · kept in the order of the boxes`;
    grid.replaceChildren();
    if (!results.length) {
      grid.innerHTML =
        '<p class="empty-results">No records found.<br>Try a different title, artist, or box.</p>';
      return;
    }
    for (const record of results) grid.append(createRecordButton(record));
  }

  element("find-button").onclick = () => open(true);
  element("all-button").onclick = () => open();
  element("box-search").onclick = () => open(true);
  element("close-library").onclick = () => dialog.close();
  searchInput.addEventListener("input", render);
  boxFilter.onchange = render;

  return { open };
}
