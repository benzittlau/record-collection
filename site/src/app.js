import { createCatalog, parseRoute } from "./catalog.js";
import { createRecordRoom } from "./record-room.js";
import { createCollectionGallery } from "./collection-gallery.js";
import { createTurntable } from "./turntable.js";
import { boxes } from "./boxes.js";

const element = (id) => document.getElementById(id);

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function showCatalogSummary(records) {
  const identified = records.filter(
    (record) => record.confidence === "confirmed",
  ).length;
  const unknown = records.filter(
    (record) => record.confidence === "unknown",
  ).length;
  const linked = records.filter((record) => record.spotifyId).length;
  element("record-total").textContent =
    `${records.length} catalogued sleeves & books`;
  element("identified-total").textContent =
    `Five boxes · ${identified} identified`;
  element("about-stats").innerHTML =
    `<span>${identified} identified</span><span>${unknown} awaiting a closer look</span>`;
  element("about-stats").title =
    `${linked} verified Spotify album links. Positions are reconstructed from visible spines; very thin worn sleeves may need confirmation.`;
}

function showLoadError() {
  const banner = document.createElement("div");
  banner.className = "load-error";
  banner.innerHTML =
    "The collection could not load. <button>Try again</button>";
  banner.querySelector("button").onclick = () => location.reload();
  element("room").append(banner);
}

function bindDialogs() {
  element("about-button").onclick = () => element("about-dialog").showModal();
  element("close-about").onclick = () => element("about-dialog").close();
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        dialog.close();
    });
  }
}

async function start() {
  bindDialogs();
  const turntable = createTurntable({ document, window });
  const photosReady = loadJson("box-photos.json").catch(() => null);
  const masksReady = loadJson("spine-masks.json").catch(() => null);
  let catalog;
  try {
    catalog = createCatalog(await loadJson("catalog.json"));
  } catch {
    showLoadError();
    return;
  }

  showCatalogSummary(catalog.records);
  const room = createRecordRoom({
    document,
    window,
    catalog,
    onListen: turntable.open,
    photosReady,
    masksReady,
  });
  createCollectionGallery({ document, catalog, onSelect: room.open });
  const route = parseRoute(location.hash);
  if (route?.recordId) {
    const record = catalog.find(route.recordId);
    if (record && !record.mergedInto) room.open(record.box, record.id);
  } else if (route?.box && boxes[route.box]) {
    room.open(route.box);
  }
  turntable.restore(catalog.records);
}

start();
