// Owns one mounted Spotify player and its expanded/minimized controls. Browsing
// changes may move the iframe-free widget, but never Spotify's document.
export function createTurntable({ document, window }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $("listen-dialog");
  const widget = $("turntable-widget");
  const supportsPopover = typeof widget.showPopover === "function";
  const widgetIsOpen = () => supportsPopover && widget.matches(":popover-open");
  let currentRecord = null;
  let embedController = null;
  let playerGeneration = 0;
  let apiLoading = null;
  let iframeApi = null;
  let playback = {
    ready: false,
    isPaused: true,
    isBuffering: false,
    position: 0,
    duration: 0,
  };
  let openDialogs = [];
  let returnFocus = null;
  let tracksPlayback = false;

  function loadSpotifyApi() {
    if (iframeApi) return Promise.resolve(iframeApi);
    if (apiLoading) return apiLoading;
    apiLoading = new Promise((resolve) => {
      const script = document.createElement("script");
      const fail = () => {
        script.remove();
        resolve(null);
      };
      const timer = window.setTimeout(fail, 12000);
      window.onSpotifyIframeApiReady = (api) => {
        window.clearTimeout(timer);
        iframeApi = api;
        resolve(api);
      };
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timer);
        fail();
      };
      document.head.append(script);
    }).then((api) => {
      if (!api) apiLoading = null;
      return api;
    });
    return apiLoading;
  }

  function timestamp(ms) {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function playbackStatus() {
    if (!playback.ready) return "Loading Spotify…";
    if (!tracksPlayback) return "Use Spotify controls";
    if (playback.isBuffering) return "Buffering…";
    if (!playback.isPaused) return `Playing · ${timestamp(playback.position)}`;
    if (playback.position) return `Paused · ${timestamp(playback.position)}`;
    return "Ready to play";
  }

  function renderPlayback() {
    const playing =
      playback.ready && !playback.isPaused && !playback.isBuffering;
    dialog.classList.toggle("is-playing", playing);
    widget.classList.toggle("is-playing", playing);
    const status = playbackStatus();
    $("mini-player-status").textContent = status;
    $("spotify-player-status").textContent = playback.ready ? "" : status;
    $("spotify-player-status").hidden = playback.ready;
    const canPause = !!embedController && playback.ready && !playback.isPaused;
    const button = $("mini-player-pause");
    button.textContent = canPause ? "Ⅱ" : "▶";
    const label = canPause
      ? "Pause playback"
      : "Open Spotify playback controls";
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function syncWidget() {
    openDialogs = openDialogs.filter(
      (candidate) => candidate.isConnected && candidate.open,
    );
    const show = !!currentRecord && !dialog.open;
    if (!show) {
      if (widgetIsOpen()) widget.hidePopover();
      widget.hidden = true;
      return;
    }
    // Only this iframe-free control surface moves. Spotify's document never moves
    // or reloads when minimizing, reopening, or changing the collection view.
    const host = openDialogs.at(-1) || document.body;
    if (widget.parentElement !== host) {
      if (widgetIsOpen()) widget.hidePopover();
      host.append(widget);
    }
    widget.hidden = false;
    if (supportsPopover && !widgetIsOpen()) widget.showPopover();
  }

  new window.MutationObserver((changes) => {
    for (const { target } of changes) {
      if (target.tagName !== "DIALOG") continue;
      openDialogs = openDialogs.filter((candidate) => candidate !== target);
      if (target.open) openDialogs.push(target);
    }
    syncWidget();
  }).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });

  function setRecordDetails(record) {
    $("playing-title").textContent = record.title;
    $("playing-artist").textContent = record.artist;
    $("mini-player-title").textContent = record.title;
    $("mini-player-artist").textContent = record.artist;
    for (const id of ["playing-cover", "mini-player-cover"]) {
      const image = $(id);
      image.hidden = !record.cover;
      if (record.cover) image.src = record.cover;
      else image.removeAttribute("src");
    }
    $("expand-turntable").setAttribute(
      "aria-label",
      `Expand turntable: ${record.title} by ${record.artist}`,
    );
    const album = `https://open.spotify.com/album/${record.spotifyId}`;
    $("spotify-open").href = album;
  }

  function destroyPlayer() {
    playerGeneration++;
    embedController?.destroy();
    embedController = null;
    $("spotify-player").replaceChildren();
  }

  async function createPlayer() {
    destroyPlayer();
    const ticket = playerGeneration,
      selected = currentRecord;
    tracksPlayback = false;
    playback = {
      ready: false,
      isPaused: true,
      isBuffering: false,
      position: 0,
      duration: 0,
    };
    renderPlayback();
    return createEmbeddedPlayer(ticket, selected);
  }

  async function createEmbeddedPlayer(ticket, selected) {
    tracksPlayback = false;
    const mount = document.createElement("div");
    $("spotify-player").append(mount);
    const api = await loadSpotifyApi();
    if (ticket !== playerGeneration || !currentRecord) return;
    const fallback = () => {
      const frame = document.createElement("iframe");
      frame.src = `https://open.spotify.com/embed/album/${selected.spotifyId}?utm_source=generator&theme=0`;
      frame.title = `Spotify player for ${selected.title} by ${selected.artist}`;
      frame.allow =
        "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.addEventListener("load", () => {
        if (ticket !== playerGeneration) return;
        playback.ready = true;
        renderPlayback();
      });
      mount.replaceWith(frame);
    };
    if (!api) {
      fallback();
      return;
    }
    try {
      api.createController(
        mount,
        {
          url: `https://open.spotify.com/album/${selected.spotifyId}?theme=0`,
          width: "100%",
          height: 352,
        },
        (embed) => {
          if (ticket !== playerGeneration) {
            embed.destroy();
            return;
          }
          embedController = embed;
          tracksPlayback = true;
          const frame = $("spotify-player").querySelector("iframe");
          if (frame)
            frame.title = `Spotify player for ${selected.title} by ${selected.artist}`;
          embed.addListener("ready", () => {
            if (ticket !== playerGeneration) return;
            playback.ready = true;
            renderPlayback();
          });
          embed.addListener("playback_update", (event) => {
            if (ticket !== playerGeneration) return;
            const data = event.data || {};
            playback = {
              ready: true,
              isPaused: !!data.isPaused,
              isBuffering: !!data.isBuffering,
              position: Number(data.position) || 0,
              duration: Number(data.duration) || 0,
            };
            renderPlayback();
          });
          embed.addListener("playback_started", () => {
            if (ticket !== playerGeneration) return;
            playback.ready = true;
            playback.isPaused = false;
            renderPlayback();
          });
        },
      );
    } catch {
      fallback();
    }
  }

  function expandPlayer() {
    if (!currentRecord || dialog.open) return;
    returnFocus = document.activeElement;
    if (widgetIsOpen()) widget.hidePopover();
    widget.hidden = true;
    dialog.showModal();
  }

  function minimizePlayer() {
    if (dialog.open) dialog.close();
  }

  function stopPlayer() {
    const focusWasPlayer =
      widget.contains(document.activeElement) ||
      dialog.contains(document.activeElement);
    currentRecord = null;
    destroyPlayer();
    playback = {
      ready: false,
      isPaused: true,
      isBuffering: false,
      position: 0,
      duration: 0,
    };
    renderPlayback();
    if (dialog.open) dialog.close();
    syncWidget();
    if (focusWasPlayer) {
      const host = openDialogs.at(-1);
      (host?.querySelector("button") || $("all-button")).focus({
        preventScroll: true,
      });
    }
  }

  function open(record) {
    if (
      record.confidence !== "confirmed" ||
      !record.spotifyId ||
      !/^[A-Za-z0-9]{22}$/.test(record.spotifyId)
    )
      return;
    const sameAlbum = currentRecord?.spotifyId === record.spotifyId;
    currentRecord = record;
    setRecordDetails(record);
    expandPlayer();
    if (!sameAlbum) createPlayer();
  }

  async function restore(records) {
    // Finish in-flight authorizations from the earlier player, but always return
    // to Spotify's own widget. An app connection never replaces its controls.
    const params = new window.URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) return;
    const { spotifySession } = await import("./spotify-session.js");
    await spotifySession.ready;
    const id = spotifySession.consumeReturnRecordId();
    const selected = records.find((item) => item.id === id);
    if (selected) open(selected);
  }

  $("close-listen").onclick = minimizePlayer;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    minimizePlayer();
  });
  dialog.addEventListener("close", () => {
    syncWidget();
    if (currentRecord && returnFocus?.isConnected)
      returnFocus.focus({ preventScroll: true });
  });
  $("expand-turntable").onclick = expandPlayer;
  $("mini-player-pause").onclick = () => {
    if (embedController && playback.ready && !playback.isPaused)
      embedController.pause();
    else expandPlayer(); // Start/resume with Spotify's own controls and account context.
  };
  $("stop-listen").onclick = stopPlayer;
  $("stop-turntable").onclick = stopPlayer;
  $("spotify-refresh").onclick = () => {
    if (currentRecord) createPlayer();
  };
  widget.addEventListener("click", (event) => event.stopPropagation());

  return { open, restore };
}
