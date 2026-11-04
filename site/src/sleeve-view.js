import { boxes } from "./boxes.js";
import {
  mountCover,
  artworkPath,
  artworkNote,
  backPlaceholder,
  sleeveNumber,
  escapeHtml,
} from "./artwork.js";
const spotifyIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M5 8c5-1.6 10-1.3 14 1M6 12c4-1.2 8-1 12 .8M7 16c3-.7 6-.5 9 .6" fill="none" stroke="#d8e0cb" stroke-width="1.6" stroke-linecap="round"/></svg>';
const turntableIcon =
  '<svg class="turntable-button-icon" viewBox="0 0 48 32" aria-hidden="true"><rect x="1" y="1" width="46" height="30" rx="2" fill="#999e8e" stroke="#777e6e"/><circle cx="17" cy="16" r="12.5" fill="#171b16"/><g fill="none" stroke="#434b3d" stroke-width=".7"><circle cx="17" cy="16" r="10.5"/><circle cx="17" cy="16" r="8.5"/><circle cx="17" cy="16" r="6.5"/></g><circle cx="17" cy="16" r="4" fill="#e6c993"/><circle cx="17" cy="16" r=".9" fill="#202420"/><path d="M40 6 33 23" fill="none" stroke="#dce1d2" stroke-width="2.2" stroke-linecap="round"/><path d="m33 22-1.5 4" stroke="#333a2d" stroke-width="3"/><circle cx="40" cy="6" r="2" fill="#6e7864"/></svg>';

// Renders the selected sleeve; createBoxBrowsing remains the owner of selection.
export function createSleeveView({
  document,
  browsing,
  openTurntable,
  shouldIgnoreJacketClick = () => false,
}) {
  const $ = (id) => document.getElementById(id);
  let currentView = "front";
  function renderRecord() {
    const list = browsing.records,
      record = list[browsing.index];
    if (!record) return;
    renderArtwork(record);
    renderMetadata(record, list);
    renderListening(record);
    renderNeighbors(list);
    $("record-info")?.scrollTo?.(0, 0);
    $("view-note").textContent = artworkNote(record);
    $("announcement").textContent =
      `${browsing.index + 1} of ${list.length}. ${record.title} by ${record.artist}`;
    document.querySelector(".identification").open = false;
  }
  function renderArtwork(record) {
    currentView = "front";
    $("jacket").classList.remove("is-back");
    $("jacket-front").setAttribute("aria-hidden", "false");
    $("jacket-back").setAttribute("aria-hidden", "true");
    $("record-view").classList.remove("show-vinyl");
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === "front");
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.view === "front"),
      );
    });
    mountCover($("jacket-front"), record);
    if (artworkPath(record, "back"))
      mountCover($("jacket-back"), record, "back");
    else $("jacket-back").innerHTML = backPlaceholder();
    $("vinyl-label-image").src = record.label || record.cover || "";
    $("vinyl-label-image").style.display =
      record.label || record.cover ? "block" : "none";
    $("vinyl-label-image").style.opacity = record.label ? "1" : "";
    $("vinyl-label-image").parentElement.style.border = record.label
      ? "1px solid #25231e"
      : "";
    $("vinyl-label-title").textContent = record.label ? "" : record.title;
    $("vinyl-button").hidden = record.kind === "book";
    $("jacket").setAttribute("aria-label", `Turn over ${record.title}`);
  }

  function renderMetadata(record, list) {
    $("record-location").textContent =
      `Box ${boxes[browsing.box].number} · ${record.kind === "book" ? "Art book" : "Sleeve"} ${sleeveNumber(record)}${record.compartment ? ` · Section ${record.compartment}` : ""}`;
    $("album-position").textContent = `${browsing.index + 1} / ${list.length}`;
    $("album-position").title =
      `${browsing.index + 1} of ${list.length} in this box`;
    document.querySelector(".sleeve-stage").dataset.view = "front";
    $("record-title").textContent = record.title;
    $("record-artist").textContent = record.artist;
    $("record-tags").innerHTML = [
      record.year,
      record.kind === "book" ? "Art book" : "Vinyl",
      record.confidence === "unknown"
        ? "Unidentified"
        : record.confidence === "probable"
          ? "Likely identification"
          : null,
    ]
      .filter(Boolean)
      .map((t) => `<span>${escapeHtml(t)}</span>`)
      .join("");
    $("record-evidence").textContent = record.familyCapture
      ? "Identified from the front and back of the family sleeve."
      : record.confidence === "confirmed"
        ? "Identified from the photographed spine."
        : record.confidence === "probable"
          ? "A likely match from the visible spine. A closer photograph will help confirm it."
          : "The spine is too worn to identify yet. Its place in the collection is preserved.";
    $("record-notes").textContent = [
      record.spineText ? `Spine: “${record.spineText}”.` : null,
      record.notes,
      record.artworkEdition ||
        record.coverNotes ||
        (record.cover
          ? "Cover art represents the album; the exact pressing is unverified."
          : null),
      record.backArtworkEdition ||
        record.backEdition ||
        record.backNotes ||
        (record.back
          ? "The sourced back cover may be from a different pressing."
          : null),
      record.label
        ? record.labelEdition ||
          "The pictured label is sourced from a documented LP edition; the family disc and its condition have not been photographed."
        : null,
      record.spotifyId && record.spotifyEdition
        ? `Spotify edition: ${record.spotifyEdition}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    const sourceLinks = (record.sources ?? [])
      .map((s) => (typeof s === "string" ? s : s.url))
      .filter((s) => /^https?:\/\//.test(s ?? ""));
    $("record-sources").innerHTML = sourceLinks
      .slice(0, 6)
      .map(
        (url, i) =>
          `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceName(url, i))} ↗</a>`,
      )
      .join("");
  }

  function renderListening(record) {
    const search = `https://open.spotify.com/search/${encodeURIComponent(`${record.artist} ${record.title}`)}`;
    if (record.kind === "book") {
      $("listen-actions").innerHTML =
        '<p class="record-evidence">An art book, tucked in with the records.</p>';
    } else if (
      record.spotifyId &&
      /^[A-Za-z0-9]{22}$/.test(record.spotifyId) &&
      record.confidence === "confirmed"
    ) {
      $("listen-actions").innerHTML =
        `<button class="spotify-button turntable-button" id="listen-album" aria-haspopup="dialog" aria-controls="listen-dialog">${turntableIcon} Put on the turntable</button><a class="spotify-link" href="https://open.spotify.com/album/${record.spotifyId}" target="_blank" rel="noopener noreferrer">Open the verified album ↗</a>${record.spotifyAvailabilityNote ? `<p class="spotify-link">${escapeHtml(record.spotifyAvailabilityNote)}</p>` : ""}`;
      $("listen-album").onclick = () => openTurntable(record);
    } else if (record.confidence !== "unknown") {
      $("listen-actions").innerHTML =
        `<a class="spotify-button" href="${search}" target="_blank" rel="noopener noreferrer">${spotifyIcon} Find on Spotify ↗</a><p class="spotify-link">Search only · an exact album link hasn’t been verified.</p>`;
    } else {
      $("listen-actions").innerHTML =
        '<p class="record-evidence">Listening will be available once this record is identified.</p>';
    }
  }

  function renderNeighbors(list) {
    for (const [dir, el] of [
      [-1, $("previous-sleeve")],
      [1, $("next-sleeve")],
    ]) {
      const neighbor = list[browsing.index + dir];
      el.hidden = !neighbor;
      if (neighbor) mountCover(el, neighbor, "front", true);
    }
    for (const [dir, id, label] of [
      [-1, "album-prev", "Previous"],
      [1, "album-next", "Next"],
    ]) {
      const button = $(id),
        neighbor = list[browsing.index + dir],
        art = button.querySelector(".nav-cover");
      button.disabled = !neighbor;
      button.setAttribute(
        "aria-label",
        neighbor
          ? `${label} record: ${neighbor.title} by ${neighbor.artist}`
          : `${label} record`,
      );
      button.title = neighbor ? `${neighbor.artist} — ${neighbor.title}` : "";
      button.querySelector(".nav-title").textContent = neighbor
        ? neighbor.title
        : dir < 0
          ? "Start of box"
          : "End of box";
      if (neighbor) mountCover(art, neighbor, "front", true);
      else art.replaceChildren();
    }
  }

  function sourceName(url, i) {
    try {
      const host = new URL(url).hostname;
      return host.includes("musicbrainz")
        ? "Album details"
        : host.includes("coverartarchive")
          ? "Cover archive"
          : host.includes("spotify")
            ? "Spotify album"
            : host.includes("discogs")
              ? "Release details"
              : `Source ${i + 1}`;
    } catch {
      return "Source";
    }
  }
  function changeView(view) {
    const record = browsing.records[browsing.index];
    currentView = view;
    document.querySelector(".sleeve-stage").dataset.view = view;
    $("jacket-front").setAttribute("aria-hidden", String(view === "back"));
    $("jacket-back").setAttribute("aria-hidden", String(view !== "back"));
    $("jacket").classList.toggle("is-back", view === "back");
    $("record-view").classList.toggle("show-vinyl", view === "vinyl");
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    $("view-note").textContent =
      view === "vinyl"
        ? record.label
          ? "Illustrated vinyl · sourced LP label, exact pressing may differ"
          : "Illustrated vinyl · original disc label hasn’t been photographed"
        : artworkNote(record, view === "back" ? "back" : "front");
  }
  document
    .querySelectorAll("[data-view]")
    .forEach(
      (button) => (button.onclick = () => changeView(button.dataset.view)),
    );
  $("jacket").onclick = () => {
    if (shouldIgnoreJacketClick()) return;
    changeView(currentView === "back" ? "front" : "back");
  };

  return { renderRecord, changeView };
}
