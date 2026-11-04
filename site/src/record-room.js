import { createBoxBrowsing } from "./box-browsing.js";
import { createSleeveView } from "./sleeve-view.js";
import { createRoomView } from "./room-view.js";

// Selection, rendering and camera timing are private collaborators. Callers
// open a physical box or sleeve; they never coordinate the scene themselves.
export function createRecordRoom({
  document,
  window,
  catalog,
  onListen,
  photosReady,
  masksReady,
}) {
  const browsing = createBoxBrowsing({
    document,
    window,
    renderRecord: () => sleeve.renderRecord(),
    renderPreview: (record, anchor) => view.renderPreview(record, anchor),
    positionPreview: () => view.positionPreview(),
    onOpen: (box, records) => view.open(box, records),
    onClose: () => view.close(),
  });
  const view = createRoomView({
    document,
    window,
    browsing,
    catalog,
    onSelectBox: open,
    photoCalibrationReady: photosReady,
    spineMasksReady: masksReady,
  });
  const sleeve = createSleeveView({
    document,
    browsing,
    openTurntable: onListen,
    shouldIgnoreJacketClick: view.shouldIgnoreJacketClick,
  });

  function open(box, recordId) {
    browsing.open(
      box,
      catalog.forBox(box),
      recordId ? catalog.resolveId(recordId) : null,
    );
  }

  return { open };
}
