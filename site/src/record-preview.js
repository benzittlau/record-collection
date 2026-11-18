import { escapeHtml, sleeveNumber, mountCover } from "./artwork.js";

// Own preview content, visibility and placement together. Browsing updates the
// spine marker first; placement avoids it without owning record selection.
export function createRecordPreview({ document, window }) {
  const $ = (id) => document.getElementById(id);
  let previewAnchor = null;
  function show(record, anchor = {}) {
    const card = $("record-preview");
    card.innerHTML =
      '<div class="preview-art"></div><div class="preview-caption"></div>';
    mountCover(card.querySelector(".preview-art"), record, "front", true);
    card.querySelector(".preview-caption").innerHTML =
      `<span class="small-label">Sleeve ${sleeveNumber(record)} · ${record.confidence === "unknown" ? "Unidentified" : "Pull out to explore"}</span><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.artist)}</span>`;
    previewAnchor = anchor;
    positionPreview();
    card.classList.add("visible");
    $("box-dialog").classList.add("has-preview");
  }
  function positionPreview() {
    if (!previewAnchor) return;
    const card = $("record-preview"),
      anchor = previewAnchor;
    const mobile = window.innerWidth <= 650;
    if (mobile) {
      card.style.left = "50%";
      card.style.top = "auto";
      card.style.bottom = "132px";
      card.style.transform = "translateX(-50%)";
    } else {
      const width = card.offsetWidth || 220,
        height = card.offsetHeight || 295;
      let x = window.innerWidth * 0.57,
        y = window.innerHeight * 0.32;
      if (anchor.event) {
        x = anchor.event.clientX + 26;
        y = anchor.event.clientY - 100;
      }
      if (anchor.element) {
        const bounds = anchor.element.getBoundingClientRect();
        x = bounds.left + bounds.width / 2 - width / 2;
        y = bounds.top - height - 16;
      }
      if (x + width > window.innerWidth - 25)
        x = (anchor.event?.clientX || window.innerWidth) - width - 28;
      x = Math.max(24, Math.min(window.innerWidth - width - 24, x));
      y = Math.max(100, Math.min(window.innerHeight - height - 140, y));
      const slot = $("spine-layer")
        .querySelector(".spine-slot-marker")
        ?.getBoundingClientRect();
      if (
        slot &&
        x < slot.right + 8 &&
        x + width > slot.left - 8 &&
        y < slot.bottom + 8 &&
        y + height > slot.top - 8
      ) {
        const left = slot.left - width - 14,
          right = slot.right + 14;
        if (left >= 24) x = left;
        else if (right + width <= window.innerWidth - 24) x = right;
        else y = Math.max(100, slot.top - height - 14);
      }
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      card.style.bottom = "auto";
      card.style.transform = "none";
    }
  }
  $("spine-layer").addEventListener("transitionend", (event) => {
    if (event.propertyName === "transform" && previewAnchor !== null)
      positionPreview();
  });

  function hide() {
    previewAnchor = null;
    $("record-preview").classList.remove("visible");
    $("box-dialog").classList.remove("has-preview");
  }

  return { show, hide, reposition: positionPreview };
}
