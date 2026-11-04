import assert from "node:assert/strict";
import test from "node:test";
import { createRoomCamera } from "../src/room-camera.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Only the browser surfaces used by the camera are simulated. Animation frames
// and calibration completion stay independently controllable to expose races.
function fixture() {
  const frames = [],
    timers = new Map(),
    listeners = new Map();
  let nextTimer = 0;
  const elements = new Map();
  for (const id of [
    "scene",
    "scene-plane",
    "focus-plane",
    "spine-layer",
    "focus-image",
    "box-detail-image",
    "box-dialog",
    "room",
  ]) {
    const classes = new Set();
    elements.set(id, {
      style: {},
      offsetWidth: 1000,
      offsetHeight: 600,
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      getBoundingClientRect: () => ({
        left: 20,
        top: 40,
        width: 1200,
        height: 700,
      }),
      getAttribute(name) {
        return this[name] ?? null;
      },
    });
  }
  const window = {
    innerWidth: 1280,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ transform: "matrix(1,0,0,1,0,0)" }),
    DOMMatrixReadOnly: class {
      a = 1;
      e = 0;
      f = 0;
    },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout(callback) {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  const calibration = deferred(),
    masks = deferred(),
    builds = [];
  const browsing = { box: "upper-left", records: [{ id: "a" }] };
  const camera = createRoomCamera({
    document: { getElementById: (id) => elements.get(id) },
    window,
    browsing,
    buildSpines: (records, face, traced) =>
      builds.push({ records, face, traced }),
    photoCalibrationReady: calibration.promise,
    spineMasksReady: masks.promise,
  });
  return {
    camera,
    browsing,
    builds,
    calibration,
    masks,
    get: (id) => elements.get(id),
    frame: () => {
      for (const callback of frames.splice(0)) callback();
    },
    timers: () => {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
    resize: () => listeners.get("resize")(),
  };
}

const quad = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];
const config = {
  roomWidth: 1659,
  roomHeight: 948,
  boxes: Object.fromEntries(
    ["upper-left", "right"].map((box) => [
      box,
      {
        sourceQuad: quad,
        targetQuad: quad,
        openingQuad: quad,
        width: 100,
        height: 100,
        path: `${box}.jpg`,
      },
    ]),
  ),
};
const maskConfig = {
  boxes: Object.fromEntries(
    ["upper-left", "right"].map((box) => [
      box,
      {
        records: [{ id: box, polygon: quad }],
      },
    ]),
  ),
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
function resolvePhotos(f) {
  f.calibration.resolve(config);
  f.masks.resolve(maskConfig);
}

// A close can arrive in the same event-loop turn as opening, before either the
// first animation frame or optional photo metadata has completed.
test("closing before animation and calibration finish leaves the room visible", async () => {
  const f = fixture();
  f.camera.initialize();
  const roomTransform = f.get("scene-plane").style.transform;
  f.camera.focus(f.browsing.box, f.browsing.records);
  f.camera.leave();
  resolvePhotos(f);
  f.frame();
  await flush();
  f.timers();
  assert.equal(f.get("scene-plane").style.transform, roomTransform);
  assert.equal(f.get("scene-plane").classList.contains("camera-zoomed"), false);
  assert.equal(f.get("room").classList.contains("at-box"), false);
  assert.equal(f.get("scene").classList.contains("camera-active"), false);
  assert.equal(f.get("box-detail-image").src, undefined);
  assert.equal(f.builds.filter((build) => build.traced).length, 0);
});

test("switching boxes while calibration loads projects only the latest box", async () => {
  const f = fixture();
  f.camera.focus("upper-left", f.browsing.records);
  const latestRecords = [{ id: "b" }];
  f.browsing.box = "right";
  f.browsing.records = latestRecords;
  f.camera.focus("right", latestRecords);
  resolvePhotos(f);
  await flush();
  f.frame();
  assert.equal(f.get("box-detail-image").src, "right.jpg");
  const calibratedBuilds = f.builds.filter((build) => build.traced);
  assert.equal(calibratedBuilds.length, 1);
  assert.equal(calibratedBuilds[0].records, latestRecords);
  assert.deepEqual([...calibratedBuilds[0].traced.keys()], ["right"]);
  assert.equal(
    f.get("focus-plane").style.transform,
    f.get("spine-layer").style.transform,
  );
});

test("old image callbacks cannot reveal an old photo or hide a newer loaded photo", async () => {
  const f = fixture();
  resolvePhotos(f);
  f.camera.focus("upper-left", f.browsing.records, true);
  await flush();
  const photo = f.get("box-detail-image");
  const oldLoad = photo.onload,
    oldError = photo.onerror;
  f.browsing.box = "right";
  f.camera.focus("right", [{ id: "b" }], true);
  oldLoad();
  assert.equal(photo.classList.contains("source-ready"), false);
  await flush();
  photo.onload();
  assert.equal(photo.classList.contains("source-ready"), true);
  oldError();
  assert.equal(photo.classList.contains("source-ready"), true);
  f.camera.leave();
  photo.classList.remove("source-ready");
  photo.onload();
  assert.equal(photo.classList.contains("source-ready"), false);
});

test("resize uses the current box records and reopening cancels room cleanup", async () => {
  const f = fixture();
  resolvePhotos(f);
  f.camera.focus("upper-left", f.browsing.records, true);
  f.camera.leave();
  f.browsing.box = "right";
  f.browsing.records = [{ id: "current" }];
  f.get("box-dialog").open = true;
  f.camera.focus("right", f.browsing.records, true);
  f.timers();
  assert.equal(f.get("scene").classList.contains("camera-active"), true);
  const updatedRecords = [{ id: "updated" }];
  f.browsing.records = updatedRecords;
  f.resize();
  f.timers();
  await flush();
  assert.equal(f.builds.at(-1).records, updatedRecords);
  assert.equal(f.get("box-detail-image").src, "right.jpg");
});
