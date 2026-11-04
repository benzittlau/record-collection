export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function sleeveNumber(record) {
  return record.positionLabel ?? record.position;
}
export function isFamilyArtwork(record, side) {
  return record.artworkProvenance?.[side]?.source === "Family photograph";
}
export function artworkNote(record, side = "front") {
  if (!artworkPath(record, side))
    return side === "back"
      ? "The original back cover is still to come"
      : "A placeholder until the cover is found";
  if (isFamilyArtwork(record, side))
    return `The family copy · ${side === "back" ? "back" : "front"} of the original sleeve`;
  return side === "back"
    ? "Sourced back artwork · exact pressing may differ"
    : "Album artwork · original sleeve edition may differ";
}
export function artworkPath(record, side = "front") {
  return side === "front"
    ? record.cover
    : record.back ||
        (record.backUrl?.startsWith("https:")
          ? record.backUrl
          : record.backUrl?.replace("http:", "https:"));
}
export function placeholder(record, small = false) {
  if (small)
    return `<span class="strip-placeholder">${escapeHtml(record.confidence === "unknown" ? "Unidentified sleeve" : record.title)}</span>`;
  return `<div class="placeholder-cover"><span class="small-label">${record.confidence === "unknown" ? "Waiting to be rediscovered" : "Artwork still to come"}</span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.artist)}<br>${record.confidence === "unknown" ? "This sleeve keeps its place in the box." : "Album identified from the spine."}</small></div>`;
}
export function mountCover(
  container,
  record,
  side = "front",
  small = false,
  lazy = false,
) {
  container.classList.remove("cover-missing");
  const path = artworkPath(record, side);
  if (!path) {
    container.innerHTML = placeholder(record, small);
    return;
  }
  const image = document.createElement("img");
  image.className = "cover-image";
  image.alt =
    side === "front"
      ? `${record.artist} — ${record.title}, front cover`
      : `${record.title}, sourced back cover`;
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.src = path;
  let usingThumbnail = small && side === "front" && !!record.coverThumbnail;
  if (usingThumbnail) image.src = record.coverThumbnail;
  image.onerror = () => {
    if (usingThumbnail) {
      usingThumbnail = false;
      image.src = path;
      return;
    }
    container.innerHTML =
      side === "back" ? backPlaceholder() : placeholder(record, small);
    container.classList.add("cover-missing");
  };
  container.replaceChildren(image);
}
export function backPlaceholder() {
  return '<div class="back-placeholder"><span class="brand-disc" aria-hidden="true"></span><p>A little more<br>to rediscover.</p><small>The back of this sleeve hasn’t been photographed yet. It’ll be here when it is.</small></div>';
}
