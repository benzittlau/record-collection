import {
  fitHomography,
  cssProjection,
  sourceClip,
  projectPoint,
} from "./photo-projection.js";
import { projectSpineMasks } from "./spine-masks.js";

// Own the overview, focused photograph and spine layer as one camera. Their
// transforms must always agree, including while the source photo loads.
export function createRoomCamera({
  document,
  window,
  browsing,
  buildSpines,
  photoCalibrationReady,
  spineMasksReady,
}) {
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let cameraReturnTimer, resizeTimer;
  let photoProjectionRequest = 0;
  let cameraRevision = 0;
  const roomGeometry = {
    "upper-left": {
      polygon: "194,243 588,248 598,525 249,590 207,510",
      face: [
        [253, 281],
        [584, 270],
        [587, 510],
        [290, 571],
      ],
      center: [410, 421],
      height: 347,
    },
    "lower-left": {
      polygon: "211,590 563,528 572,747 249,845",
      face: [
        [233, 599],
        [555, 548],
        [564, 738],
        [266, 816],
      ],
      center: [391, 686],
      height: 317,
    },
    "upper-middle": {
      polygon: "618,235 921,236 915,478 657,504 621,470",
      face: [
        [662, 258],
        [909, 249],
        [899, 465],
        [671, 491],
      ],
      center: [775, 370],
      height: 269,
    },
    "lower-middle": {
      polygon: "631,493 921,468 913,667 675,713 638,690",
      face: [
        [679, 513],
        [908, 490],
        [902, 662],
        [686, 696],
      ],
      center: [778, 590],
      height: 245,
    },
    right: {
      polygon: "951,520 1020,446 1294,477 1262,814 946,747",
      face: [
        [962, 540],
        [1277, 580],
        [1244, 792],
        [958, 740],
      ],
      center: [1110, 635],
      height: 368,
    },
  };
  function getCameraBase() {
    const scene = $("scene").getBoundingClientRect(),
      scenePlane = $("scene-plane"),
      width = scenePlane.offsetWidth,
      height = scenePlane.offsetHeight;
    return {
      width,
      height,
      left: scene.left + (scene.width - width) / 2,
      top: scene.top + (scene.height - height) / 2,
      sceneLeft: scene.left,
      sceneTop: scene.top,
    };
  }
  function returnCameraToRoom(instant = false) {
    const base = getCameraBase(),
      scenePlane = $("scene-plane");
    if (instant) scenePlane.style.transition = "none";
    scenePlane.style.transform = `translate(${base.left - base.sceneLeft}px,${base.top - base.sceneTop}px) scale(1)`;
    if (instant) {
      scenePlane.offsetWidth;
      scenePlane.style.transition = "";
    }
  }
  function focusCamera(box, list, instant = false) {
    window.clearTimeout(cameraReturnTimer);
    const revision = ++cameraRevision;
    const geometry = roomGeometry[box],
      base = getCameraBase(),
      mobile = window.innerWidth <= 650;
    const targetHeight = mobile
      ? Math.min(window.innerWidth * 0.97, window.innerHeight * 0.48)
      : Math.min(window.innerHeight * 0.64, 570);
    const heightScale = targetHeight / ((geometry.height / 948) * base.height);
    const xs = geometry.polygon
      .split(" ")
      .map((point) => Number(point.split(",")[0]));
    const widthScale =
      (window.innerWidth - 44) /
      (((Math.max(...xs) - Math.min(...xs)) / 1659) * base.width);
    const scale = mobile ? Math.min(heightScale, widthScale) : heightScale;
    const tx =
      window.innerWidth * (mobile ? 0.5 : 0.44) -
      (geometry.center[0] / 1659) * base.width * scale;
    const ty =
      window.innerHeight * (mobile ? 0.38 : 0.45) -
      (geometry.center[1] / 948) * base.height * scale;
    const focusPlane = $("focus-plane"),
      spineLayer = $("spine-layer"),
      scenePlane = $("scene-plane");
    const current = new window.DOMMatrixReadOnly(
      window.getComputedStyle(scenePlane).transform,
    );
    for (const layer of [focusPlane, spineLayer]) {
      layer.style.transition = "none";
      layer.style.width = `${base.width}px`;
      layer.style.height = `${base.height}px`;
      layer.style.left = "0";
      layer.style.top = "0";
      layer.style.transformOrigin = "0 0";
      layer.style.transform = `translate(${current.e + base.sceneLeft}px,${current.f + base.sceneTop}px) scale(${current.a})`;
    }
    $("focus-image").style.clipPath = `polygon(${geometry.polygon
      .split(" ")
      .map((point) => {
        const [x, y] = point.split(",");
        return `${(x / 1659) * 100}% ${(y / 948) * 100}%`;
      })
      .join(",")})`;
    buildSpines(list, geometry.face);
    applyBoxPhoto(box, base, list, instant);
    focusPlane.offsetWidth;
    const move = () => {
      if (revision !== cameraRevision) return;
      for (const layer of [focusPlane, spineLayer]) {
        layer.style.transition = instant ? "none" : "";
        layer.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
      }
      if (instant) scenePlane.style.transition = "none";
      scenePlane.style.transform = `translate(${tx - base.sceneLeft}px,${ty - base.sceneTop}px) scale(${scale})`;
      scenePlane.classList.add("camera-zoomed");
      $("scene").classList.add("camera-active");
      $("room").classList.add("at-box");
      if (instant) {
        scenePlane.offsetWidth;
        for (const layer of [scenePlane, focusPlane, spineLayer])
          layer.style.transition = "";
      }
    };
    if (instant) move();
    else window.requestAnimationFrame(move);
  }
  async function applyBoxPhoto(box, base, list, preserve = false) {
    const request = ++photoProjectionRequest,
      photo = $("box-detail-image");
    if (!preserve) {
      photo.style.transition = "none";
      photo.classList.remove("source-ready");
      photo.offsetWidth;
      photo.style.transition = "";
    }
    const [config, masks] = await Promise.all([
      photoCalibrationReady,
      spineMasksReady,
    ]);
    if (
      request !== photoProjectionRequest ||
      browsing.box !== box ||
      !config?.boxes?.[box]
    )
      return;
    const calibration = config.boxes[box];
    try {
      const homography = fitHomography(
        calibration.sourceQuad,
        calibration.targetQuad,
      );
      photo.style.width = `${calibration.width}px`;
      photo.style.height = `${calibration.height}px`;
      photo.style.clipPath = sourceClip(
        calibration.clipPolygon || calibration.sourceQuad,
        calibration.width,
        calibration.height,
      );
      photo.style.transform = cssProjection(
        homography,
        base.width / config.roomWidth,
        base.height / config.roomHeight,
      );
      photo.onload = () => {
        if (request === photoProjectionRequest && browsing.box === box)
          photo.classList.add("source-ready");
      };
      photo.onerror = () => {
        if (request === photoProjectionRequest && browsing.box === box)
          photo.classList.remove("source-ready");
      };
      if (photo.getAttribute("src") !== calibration.path)
        photo.src = calibration.path;
      else if (photo.complete && photo.naturalWidth)
        photo.classList.add("source-ready");
      if (calibration.openingQuad) {
        const face = calibration.openingQuad.map((point) =>
          projectPoint(homography, point),
        );
        roomGeometry[box].face = face;
        const traced = projectSpineMasks(
          homography,
          masks?.boxes?.[box],
          calibration.width,
          calibration.height,
        );
        buildSpines(list, face, traced);
      }
    } catch (error) {
      console.warn("Box photograph projection could not load", error.message);
    }
  }

  function leave() {
    // A close wins over a queued animation frame or calibration response.
    cameraRevision++;
    photoProjectionRequest++;
    returnCameraToRoom();
    $("scene-plane").classList.remove("camera-zoomed");
    cameraReturnTimer = window.setTimeout(
      () => {
        if (!$("box-dialog").open) $("scene").classList.remove("camera-active");
      },
      reducedMotion ? 0 : 900,
    );
    $("room").classList.remove("at-box");
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if ($("box-dialog").open)
        focusCamera(browsing.box, browsing.records, true);
      else returnCameraToRoom(true);
    }, 100);
  });

  return {
    focus: focusCamera,
    leave,
    initialize: () => returnCameraToRoom(true),
  };
}
