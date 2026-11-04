import assert from "node:assert/strict";
import test from "node:test";
import { createTurntable } from "../src/turntable.js";

const album = {
  id: "first",
  title: "First Album",
  artist: "Artist",
  cover: "first.jpg",
  confidence: "confirmed",
  spotifyId: "A".repeat(22),
};
const nextAlbum = {
  ...album,
  id: "next",
  title: "Next Album",
  spotifyId: "B".repeat(22),
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture({ popover = true } = {}) {
  const elements = new Map(),
    timers = new Map(),
    requests = [],
    controllers = [];
  let observe = () => {},
    timerId = 0;
  function element(tag = "div") {
    const listeners = new Map(),
      classes = new Set();
    const node = {
      tagName: tag.toUpperCase(),
      children: [],
      parentElement: null,
      open: false,
      hidden: false,
      isConnected: true,
      attributes: {},
      classes,
      classList: {
        toggle(name, enabled) {
          if (enabled) classes.add(name);
          else classes.delete(name);
        },
      },
      append(child) {
        child.remove();
        child.parentElement = this;
        this.children.push(child);
      },
      remove() {
        if (this.parentElement) {
          const siblings = this.parentElement.children;
          siblings.splice(siblings.indexOf(this), 1);
          this.parentElement = null;
        }
      },
      replaceChildren(...children) {
        for (const child of [...this.children]) child.remove();
        for (const child of children) this.append(child);
      },
      replaceWith(replacement) {
        const parent = this.parentElement;
        const index = parent.children.indexOf(this);
        this.remove();
        replacement.remove();
        replacement.parentElement = parent;
        parent.children.splice(index, 0, replacement);
      },
      contains(target) {
        return (
          this === target ||
          this.children.some((child) => child.contains(target))
        );
      },
      querySelector(selector) {
        return (
          this.children.find(
            (child) => child.tagName.toLowerCase() === selector,
          ) ||
          this.children
            .map((child) => child.querySelector(selector))
            .find(Boolean) ||
          null
        );
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      removeAttribute(name) {
        delete this[name];
        delete this.attributes[name];
      },
      addEventListener(name, handler) {
        listeners.set(name, handler);
      },
      emit(name, event = {}) {
        listeners.get(name)?.(event);
      },
      focus() {
        document.activeElement = this;
      },
      showModal() {
        this.open = true;
        observe([{ target: this }]);
      },
      close() {
        this.open = false;
        observe([{ target: this }]);
        this.emit("close");
      },
      matches() {
        return !!this.popoverOpen;
      },
    };
    return node;
  }
  const body = element("body"),
    head = element("head");
  const document = {
    body,
    head,
    activeElement: body,
    createElement: element,
    getElementById(id) {
      if (!elements.has(id)) {
        const node = element(id.endsWith("-dialog") ? "dialog" : "div");
        elements.set(id, node);
        body.append(node);
      }
      return elements.get(id);
    },
  };
  const get = (id) => document.getElementById(id);
  if (popover) {
    get("turntable-widget").showPopover = function () {
      this.popoverOpen = true;
    };
    get("turntable-widget").hidePopover = function () {
      this.popoverOpen = false;
    };
  }
  const window = {
    location: { search: "" },
    URLSearchParams,
    MutationObserver: class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
    },
    setTimeout(callback, delay) {
      assert.equal(delay, 12000);
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const api = {
    createController(mount, options, complete) {
      const frame = element("iframe");
      frame.src = options.url;
      mount.replaceWith(frame);
      const events = new Map();
      const controller = {
        destroyed: 0,
        paused: 0,
        addListener(name, callback) {
          events.set(name, callback);
        },
        destroy() {
          this.destroyed++;
          frame.remove();
        },
        pause() {
          this.paused++;
        },
        emit(name, data) {
          events.get(name)?.({ data });
        },
      };
      requests.push({
        options,
        controller,
        complete: () => {
          controllers.push(controller);
          complete(controller);
        },
      });
    },
  };
  const turntable = createTurntable({ document, window });
  return {
    turntable,
    document,
    window,
    get,
    api,
    requests,
    controllers,
    timers,
    openDialog(id) {
      get(id).showModal();
    },
    timeout() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

test("unverified and invalid albums do not open a dialog or load Spotify", () => {
  const f = fixture();
  for (const record of [
    { ...album, confidence: "probable" },
    { ...album, spotifyId: "" },
    { ...album, spotifyId: "bad" },
  ])
    f.turntable.open(record);
  assert.equal(f.get("listen-dialog").open, false);
  assert.equal(f.document.head.children.length, 0);
});

test("minimizing, browsing, expanding and reopening the same album preserve the mounted player", async () => {
  const f = fixture();
  f.turntable.open(album);
  assert.equal(f.get("listen-dialog").open, true);
  f.window.onSpotifyIframeApiReady(f.api);
  await flush();
  f.requests[0].complete();
  const controller = f.controllers[0],
    frame = f.get("spotify-player").querySelector("iframe");
  controller.emit("ready");
  assert.equal(f.get("mini-player-status").textContent, "Ready to play");
  controller.emit("playback_update", {
    isPaused: false,
    isBuffering: false,
    position: 65000,
    duration: 180000,
  });
  assert.equal(f.get("mini-player-status").textContent, "Playing · 1:05");
  f.get("close-listen").onclick();
  assert.equal(f.get("turntable-widget").hidden, false);
  f.openDialog("box-dialog");
  assert.equal(f.get("turntable-widget").parentElement, f.get("box-dialog"));
  assert.equal(f.get("spotify-player").querySelector("iframe"), frame);
  f.get("mini-player-pause").onclick();
  assert.equal(controller.paused, 1);
  f.get("expand-turntable").onclick();
  assert.equal(f.get("listen-dialog").open, true);
  f.turntable.open({ ...album, title: "Updated sleeve title" });
  assert.equal(f.get("playing-title").textContent, "Updated sleeve title");
  assert.equal(f.requests.length, 1);
  assert.equal(controller.destroyed, 0);
  assert.equal(f.get("spotify-player").querySelector("iframe"), frame);
  f.get("stop-listen").onclick();
  assert.equal(controller.destroyed, 1);
  assert.equal(f.get("spotify-player").children.length, 0);
  assert.equal(f.get("turntable-widget").hidden, true);
});

test("stopping while the iframe API loads prevents stale creation", async () => {
  const f = fixture();
  f.turntable.open(album);
  f.get("stop-listen").onclick();
  f.window.onSpotifyIframeApiReady(f.api);
  await flush();
  assert.equal(f.requests.length, 0);
  assert.equal(f.get("spotify-player").children.length, 0);
  assert.equal(f.get("listen-dialog").open, false);
});

test("a late controller callback cannot replace the newer album or update its playback state", async () => {
  const f = fixture();
  f.turntable.open(album);
  f.window.onSpotifyIframeApiReady(f.api);
  await flush();
  const stale = f.requests[0];
  f.turntable.open(nextAlbum);
  await flush();
  f.requests[1].complete();
  stale.complete();
  assert.equal(stale.controller.destroyed, 1);
  assert.equal(f.get("playing-title").textContent, nextAlbum.title);
  assert.equal(
    f.get("spotify-player").querySelector("iframe").src,
    `https://open.spotify.com/album/${nextAlbum.spotifyId}?theme=0`,
  );
  const current = f.requests[1].controller;
  current.emit("ready");
  assert.equal(f.get("mini-player-status").textContent, "Ready to play");
  f.get("stop-turntable").onclick();
  current.emit("playback_started");
  assert.equal(f.get("mini-player-status").textContent, "Loading Spotify…");
});

test("API timeout falls back to an iframe and an explicit refresh retries the API", async () => {
  const f = fixture({ popover: false });
  f.turntable.open(album);
  f.timeout();
  await flush();
  const fallback = f.get("spotify-player").querySelector("iframe");
  assert.match(fallback.src, /embed\/album/);
  assert.match(fallback.allow, /autoplay/);
  assert.match(fallback.allow, /encrypted-media/);
  fallback.emit("load");
  assert.equal(f.get("mini-player-status").textContent, "Use Spotify controls");
  f.get("close-listen").onclick();
  assert.equal(f.get("turntable-widget").hidden, false);
  f.get("spotify-refresh").onclick();
  assert.equal(fallback.parentElement, null);
  assert.equal(
    f.document.head.children.length,
    1,
    "refresh requests a new API script after timeout",
  );
  f.window.onSpotifyIframeApiReady(f.api);
  await flush();
  assert.equal(f.requests.length, 1);
  f.requests[0].complete();
  assert.equal(
    f.get("spotify-player").querySelector("iframe").src,
    `https://open.spotify.com/album/${album.spotifyId}?theme=0`,
  );
});

test("ordinary restore does not load legacy authorization or a player", async () => {
  const f = fixture();
  await f.turntable.restore([album]);
  assert.equal(f.document.head.children.length, 0);
  assert.equal(f.get("listen-dialog").open, false);
});
