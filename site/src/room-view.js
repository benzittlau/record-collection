import { boxes } from "./boxes.js";
import { escapeHtml, sleeveNumber, mountCover } from "./artwork.js";
import { createRoomCamera } from "./room-camera.js";
import { layoutSpines } from "./spine-layout.js";

// Own the photographed room and its input affordances. Browsing owns selection;
// this view projects it onto spines, cover previews and the physical carousel.
export function createRoomView({
  document,
  window,
  browsing,
  catalog,
  onSelectBox,
  photoCalibrationReady,
  spineMasksReady,
}) {
  const $ = (id) => document.getElementById(id);
  let ignoreJacketClick = false;
  const camera = createRoomCamera({
    document,
    window,
    buildSpines,
    photoCalibrationReady,
    spineMasksReady,
  });
  camera.initialize();
  bindHotspots();
  bindGestures();
  function open(box, list) {
    const meta = boxes[box];
    $("box-number").textContent =
      `Box ${meta.number} of 5 · ${list.length} catalogued items`;
    $("box-name").textContent = meta.name;
    $("box-photo").src = `assets/${meta.photo}`;
    $("box-photo").alt = `Original photograph of ${meta.name.toLowerCase()}`;
    $("box-description").textContent = meta.description;
    $("box-tooltip").classList.remove("visible");
    camera.focus(box, list);
    buildStrip(list);
  }
  function buildStrip(list) {
    const strip = $("record-strip");
    strip.replaceChildren();
    list.forEach((record, index) => {
      const button = document.createElement("button");
      button.className = "strip-record";
      button.dataset.index = index;
      button.title = `${sleeveNumber(record)}. ${record.artist} — ${record.title}`;
      button.setAttribute(
        "aria-label",
        `Sleeve ${sleeveNumber(record)}. ${record.artist}, ${record.title}`,
      );
      mountCover(button, record, "front", true, true);
      button.addEventListener("mouseenter", () =>
        previewSpine(record, { element: button }),
      );
      button.addEventListener("mouseleave", browsing.hidePreview);
      button.addEventListener("focus", () =>
        previewSpine(record, { element: button }),
      );
      button.addEventListener("blur", browsing.hidePreview);
      const number = document.createElement("small");
      number.textContent = sleeveNumber(record);
      button.append(number);
      button.onclick = () => {
        if (strip.dataset.dragged === "true") return;
        browsing.pull(index);
      };
      strip.append(button);
    });
    window.requestAnimationFrame(browsing.refresh);
  }
  function bindHotspots() {
    for (const hotspot of document.querySelectorAll(".box-hotspot")) {
      hotspot.addEventListener("click", () => onSelectBox(hotspot.dataset.box));
      hotspot.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectBox(hotspot.dataset.box);
        }
      });
      const tooltip = () => {
        const meta = boxes[hotspot.dataset.box],
          count = catalog.forBox(hotspot.dataset.box).length;
        $("box-tooltip").innerHTML =
          `<strong>${escapeHtml(meta.name)}</strong><span>${count ? `${count} catalogued items · ` : ""}Click to browse</span>`;
        $("box-tooltip").classList.add("visible");
      };
      hotspot.addEventListener("mouseenter", tooltip);
      hotspot.addEventListener("focus", () => {
        tooltip();
        const bounds = hotspot.getBoundingClientRect();
        $("box-tooltip").style.left =
          `${Math.min(bounds.right, window.innerWidth - 220)}px`;
        $("box-tooltip").style.top = `${Math.max(100, bounds.top)}px`;
      });
      hotspot.addEventListener("mousemove", (event) => {
        $("box-tooltip").style.left =
          `${Math.min(event.clientX + 20, window.innerWidth - 220)}px`;
        $("box-tooltip").style.top =
          `${Math.max(90, Math.min(event.clientY - 70, window.innerHeight - 100))}px`;
      });
      hotspot.addEventListener("mouseleave", () =>
        $("box-tooltip").classList.remove("visible"),
      );
      hotspot.addEventListener("blur", () =>
        $("box-tooltip").classList.remove("visible"),
      );
    }
  }
  function showOriginalPhoto() {
    const meta = boxes[browsing.box];
    const dialog = document.createElement("dialog");
    dialog.className = "photo-dialog";
    dialog.setAttribute(
      "aria-label",
      "Original photograph of the selected box",
    );
    dialog.innerHTML = `<button class="icon-button" aria-label="Close photograph">✕</button><img src="assets/boxes/${browsing.box}.jpg" alt="Original photograph of ${escapeHtml(meta.name.toLowerCase())}"><p>${escapeHtml(meta.name)} · original family photograph. Positions reconstructed from the visible spines.</p>`;
    document.body.append(dialog);
    dialog.querySelector("button").onclick = () => dialog.close();
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
  }
  $("source-photo-button").onclick = showOriginalPhoto;
  $("record-photo").onclick = showOriginalPhoto;
  function bindGestures() {
    // Swipe the large sleeve; native touch scrolling remains available on the strip.
    let swipeStart = null;
    $("record-view").addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch")
        swipeStart = { x: event.clientX, y: event.clientY };
    });
    $("record-view").addEventListener("pointerup", (event) => {
      if (!swipeStart) return;
      const horizontalDistance = event.clientX - swipeStart.x,
        verticalDistance = event.clientY - swipeStart.y;
      swipeStart = null;
      if (
        Math.abs(horizontalDistance) > 45 &&
        Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.4
      ) {
        ignoreJacketClick = true;
        browsing.move(horizontalDistance < 0 ? 1 : -1);
        window.setTimeout(() => (ignoreJacketClick = false), 350);
      }
    });
    $("record-view").addEventListener(
      "pointercancel",
      () => (swipeStart = null),
    );
    let drag = null;
    const strip = $("record-strip");
    strip.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") return;
      drag = { x: event.clientX, scroll: strip.scrollLeft };
      strip.dataset.dragged = "false";
    });
    window.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const horizontalDistance = event.clientX - drag.x;
      if (Math.abs(horizontalDistance) > 7) {
        strip.dataset.dragged = "true";
        strip.scrollLeft = drag.scroll - horizontalDistance;
      }
    });
    window.addEventListener("pointerup", () => {
      if (drag) {
        drag = null;
        window.setTimeout(() => (strip.dataset.dragged = "false"), 0);
      }
    });
  }

  function previewSpine(record, anchor = {}) {
    browsing.preview(
      browsing.records.findIndex((item) => item.id === record.id),
      anchor,
    );
  }

  function buildSpines(records, face, traced = new Map()) {
    const layer = $("spine-layer");
    layer.replaceChildren();
    const layout = layoutSpines(records, face, traced, catalog.foldedPositions);
    layout.forEach(({ record, polygons, anchor, source }, index) => {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        polygons
          .map(
            (polygon) =>
              `M${polygon.map((point) => point.join(",")).join(" L")} Z`,
          )
          .join(" "),
      );
      path.setAttribute("class", "spine-hit");
      path.dataset.index = index;
      path.dataset.recordId = record.id;
      path.dataset.maskSource = source;
      path.dataset.slotAnchor = anchor.join(",");
      path.setAttribute("role", "button");
      path.setAttribute(
        "aria-label",
        `Pull out ${record.title} by ${record.artist}`,
      );
      path.addEventListener("mouseenter", (event) =>
        previewSpine(record, { event }),
      );
      path.addEventListener("mouseleave", browsing.hidePreview);
      path.addEventListener("focus", () => previewSpine(record));
      path.addEventListener("blur", browsing.hidePreview);
      path.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          browsing.pull(index);
        }
      });
      path.addEventListener("click", (event) => {
        event.stopPropagation();
        browsing.pull(index);
      });
      layer.append(path);
    });
    browsing.refresh();
  }

  return {
    open,
    close: camera.leave,
    shouldIgnoreJacketClick: () => ignoreJacketClick,
  };
}
