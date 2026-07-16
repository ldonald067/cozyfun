import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  assertDistExists,
  clickSelector as click,
  connectToFirstPage,
  evaluate,
  setRange,
  setText,
  sleep,
  startBrowser,
  startStaticServer,
  statusText,
  waitForStatus,
  waitUntil
} from "./browser-qa-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");

const checks = [];
const protocolErrors = [];

async function main() {
  await assertDistExists(distDir, "Build the app before running browser smoke checks: npm run build");

  const staticServer = await startStaticServer(distDir);
  const browser = await startBrowser({
    profilePrefix: "cozy-browser-",
    downloadPrefix: "cozy-downloads-",
    extraArgs: ["--autoplay-policy=no-user-gesture-required"]
  });

  try {
    const cdp = await connectToFirstPage(browser.debugPort);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      protocolErrors.push(exceptionDetails?.text ?? "Runtime exception");
    });
    cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
      if (type === "error") protocolErrors.push(args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    });
    cdp.on("Log.entryAdded", ({ entry }) => {
      if (entry.level === "error") protocolErrors.push(entry.text);
    });

    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      window.__smokeErrors = [];
      window.addEventListener("error", (event) => {
        window.__smokeErrors.push(event.message || "window error");
      });
      window.addEventListener("unhandledrejection", (event) => {
        window.__smokeErrors.push(String(event.reason || "unhandled rejection"));
      });
      const originalError = console.error;
      console.error = (...args) => {
        window.__smokeErrors.push(args.map(String).join(" "));
        originalError.apply(console, args);
      };
      window.__cozyAudioProbe = { fetches: [], longBuffers: [], sources: [] };
      window.__cozyNativeAmbienceProbe = { starts: [] };
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input?.url ?? "";
        const path = new URL(url, window.location.href).pathname;
        if (path.startsWith("/audio/")) window.__cozyAudioProbe.fetches.push(path);
        return originalFetch(input, init);
      };
      const installAudioProbe = () => {
        const baseProto = window.BaseAudioContext?.prototype;
        if (!baseProto || baseProto.__cozyProbeInstalled) return;
        baseProto.__cozyProbeInstalled = true;

        const originalCreateBuffer = baseProto.createBuffer;
        baseProto.createBuffer = function createBuffer(numberOfChannels, length, sampleRate) {
          const buffer = originalCreateBuffer.call(this, numberOfChannels, length, sampleRate);
          if (buffer.duration >= 80) {
            window.__cozyAudioProbe.longBuffers.push({
              duration: buffer.duration,
              numberOfChannels: buffer.numberOfChannels,
              sampleRate: buffer.sampleRate
            });
          }
          return buffer;
        };

        const originalCreateBufferSource = baseProto.createBufferSource;
        baseProto.createBufferSource = function createBufferSource() {
          const source = originalCreateBufferSource.call(this);
          const record = { started: false, loop: false, duration: 0, startTime: 0 };
          window.__cozyAudioProbe.sources.push(record);
          const originalStart = source.start.bind(source);
          source.start = (...args) => {
            record.started = true;
            record.loop = Boolean(source.loop);
            record.duration = source.buffer?.duration ?? 0;
            record.startTime = args[0] ?? 0;
            return originalStart(...args);
          };
          return source;
        };
      };
      installAudioProbe();
      localStorage.setItem("cozy-pixel-sandbox:audio:v2", JSON.stringify({
        enabled: true,
        muted: false,
        mood: "rain",
        provider: "generated",
        volumes: { master: 0.68, ambience: 0.72 }
      }));
      window.__cozyYouTubeMockMode = "ready";
      window.YT = {
        Player: function Player(element, options) {
          const iframe = document.createElement("iframe");
          const start = options.playerVars?.start ? "?start=" + options.playerVars.start : "";
          iframe.src = options.videoId
            ? "https://www.youtube.com/embed/" + options.videoId + start
            : "https://www.youtube.com/embed/videoseries?list=" + options.playerVars.list;
          iframe.title = "Mock YouTube player";
          element.replaceChildren(iframe);
          setTimeout(() => {
            if (window.__cozyYouTubeMockMode === "blocked") options.events.onError({ data: 150 });
            else options.events.onReady({});
          }, 30);
          this.destroy = () => element.replaceChildren();
        }
      };
    `
    });

    const appUrl = `http://127.0.0.1:${staticServer.port}/`;
    await cdp.send("Page.navigate", { url: appUrl });
    await waitUntil(
      () => evaluate(cdp, `document.readyState === "complete" && Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
      "app shell to load"
    );
    await waitUntil(async () => (await statusText(cdp)).includes("online"), "engine to come online");

  await check("app loads the sandbox shell", async () => {
    const state = await evaluate(cdp, `(() => ({
      title: document.title,
      materials: document.querySelectorAll(".material-button").length,
      materialLabels: Array.from(document.querySelectorAll(".material-button")).map((button) => button.textContent.trim()),
      audioInfos: document.querySelectorAll(".audio-info").length,
      audioMoods: document.querySelectorAll(".audio-mood-control button").length,
      audioProviders: document.querySelectorAll(".audio-source-control button").length,
      providerLabels: Array.from(document.querySelectorAll(".audio-source-control button")).map((button) => button.textContent.trim()),
      nativeProviderActive: document.querySelector('[data-testid="audio-provider-native"]')?.classList.contains("active") ?? false,
      storedAudioProvider: JSON.parse(localStorage.getItem("cozy-pixel-sandbox:audio:v2") || "{}").provider,
      shareActions: document.querySelectorAll(".share-actions button").length,
      sceneEnvironments: document.querySelectorAll('[data-testid^="scene-environment-"]').length,
      roomImage: getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--room-image"),
      status: document.querySelector('[data-testid="status-message"]')?.textContent ?? ""
    }))()`);
    assert(state.title === "Cozy Pixel Sandbox", "unexpected page title");
    assert(state.materials === 17, `expected exactly 17 selectable material buttons, found ${state.materials}: ${state.materialLabels.join(", ")}`);
    for (const generatedOnly of ["Flower", "Smoke", "Steam"]) {
      assert(!state.materialLabels.includes(generatedOnly), `generated-only ${generatedOnly} should not be selectable`);
    }
    assert(state.audioInfos === 2, `expected two audio info icons, found ${state.audioInfos}`);
    assert(state.audioMoods === 3, `expected three audio mood buttons, found ${state.audioMoods}`);
    assert(state.audioProviders === 2, `expected two sound source buttons, found ${state.audioProviders}`);
    assert(state.providerLabels.join("|") === "Native|Desk Radio", `unexpected sound providers: ${state.providerLabels.join(", ")}`);
    assert(state.nativeProviderActive, "legacy generated audio provider did not normalize to native");
    assert(state.storedAudioProvider === "native", `legacy generated audio provider was not migrated in prefs: ${state.storedAudioProvider}`);
    assert(state.shareActions === 5, `expected five share actions, found ${state.shareActions}`);
    assert(state.sceneEnvironments === 6, `expected six room buttons, found ${state.sceneEnvironments}`);
    assert(state.roomImage.includes("rain-desk.jpg"), `default room image was not applied: ${state.roomImage}`);
    assert(state.status.includes("online"), `engine did not report online: ${state.status}`);
  });

  await check("painting changes the canvas", async () => {
    const before = await canvasSignature(cdp);
    await click(cdp, '[data-testid="sandbox-tray"]', { xRatio: 0.5, yRatio: 0.32 });
    await sleep(260);
    const after = await canvasSignature(cdp);
    assert(before !== after, "canvas signature did not change after painting");
  });

  await check("native ambience recordings are served and decodable", async () => {
    const assets = await evaluate(
      cdp,
      `(async () => {
        const checks = [
          { url: "/audio/cat-purr.mp3", minBytes: 1000000 },
          { url: "/audio/rain.mp3", minBytes: 1000000 },
          { url: "/audio/fire-crackle.wav", minBytes: 1000000 }
        ];
        return Promise.all(checks.map(async (asset) => {
          const response = await fetch(asset.url, { cache: "no-store" });
          const bytes = await response.arrayBuffer();
          let duration = 0;
          let decodeError = "";
          try {
            const context = new OfflineAudioContext(1, 1, 44100);
            const decoded = await context.decodeAudioData(bytes.slice(0));
            duration = decoded.duration;
          } catch (error) {
            decodeError = String(error);
          }
          return {
            url: asset.url,
            ok: response.ok,
            status: response.status,
            bytes: bytes.byteLength,
            minBytes: asset.minBytes,
            duration,
            decodeError
          };
        }));
      })()`
    );
    for (const asset of assets) {
      assert(asset.ok, `${asset.url} was not served: HTTP ${asset.status}`);
      assert(asset.bytes >= asset.minBytes, `${asset.url} was too small: ${asset.bytes} bytes`);
      assert(asset.duration > 0.05, `${asset.url} did not decode as browser audio: ${asset.decodeError}`);
    }
  });

  await check("clear, save, and load update scene state", async () => {
    await click(cdp, '[data-testid="save-scene"]');
    await waitForStatus(cdp, "saved in browser");
    await click(cdp, '[data-testid="clear-scene"]');
    await waitForStatus(cdp, "tray cleared");
    await click(cdp, '[data-testid="load-scene"]');
    await waitForStatus(cdp, "browser save loaded");
    const savedScene = await evaluate(cdp, `JSON.parse(localStorage.getItem("cozy-pixel-sandbox:scene:v1"))`);
    assert(savedScene.format === "CXS2", `expected CXS2 local scene, got ${savedScene.format}`);
    assert(savedScene.metadata?.app === "cozy-pixel-sandbox", "local scene metadata app marker missing");
    assert(savedScene.metadata?.room === "rain-desk", `local scene room metadata mismatch: ${savedScene.metadata?.room}`);
    assert(savedScene.metadata?.mood === "rain", `local scene mood metadata mismatch: ${savedScene.metadata?.mood}`);
    assert(savedScene.metadata?.musicProvider === "generated", `local scene legacy provider metadata mismatch: ${savedScene.metadata?.musicProvider}`);
  });

  await check("export, metadata import, and invalid import produce clear feedback", async () => {
    try {
      await cdp.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: browser.downloadDir
      });
    } catch {
      // Some Chromium builds only expose download behavior on browser contexts.
    }
    await click(cdp, '[data-testid="export-scene"]');
    await waitForStatus(cdp, "scene JSON exported");
    await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem("cozy-pixel-sandbox:scene:v1"));
        saved.metadata = {
          app: "cozy-pixel-sandbox",
          title: "Snow Window",
          room: "snow-window",
          mood: "window",
          musicProvider: "generated"
        };
        const input = document.querySelector('[data-testid="scene-file-input"]');
        const file = new File([JSON.stringify(saved)], "snow-window-scene.json", { type: "application/json" });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`
    );
    await waitForStatus(cdp, "scene JSON imported");
    const importedMetadata = await evaluate(cdp, `(() => ({
      roomClass: document.querySelector(".app-shell")?.classList.contains("scene-snow-window"),
      roomImage: getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--room-image"),
      purrMoodActive: document.querySelector('[data-testid="audio-mood-purr"]')?.classList.contains("active")
    }))()`);
    assert(importedMetadata.roomClass, "imported scene metadata did not restore the snow room");
    assert(importedMetadata.roomImage.includes("snow-window.jpg"), `imported scene room image was not applied: ${importedMetadata.roomImage}`);
    assert(importedMetadata.purrMoodActive, "imported legacy window mood metadata did not map to the purr mood");
    await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('[data-testid="scene-file-input"]');
        const file = new File(["not a cozy scene"], "bad-scene.json", { type: "application/json" });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`
    );
    await waitForStatus(cdp, "invalid scene file");
  });

  await check("audio controls start, mute, adjust, and stop", async () => {
    await click(cdp, '[data-testid="scene-environment-rain-desk"]');
    await waitForStatus(cdp, "rain desk backdrop on");
    await click(cdp, '[data-testid="audio-provider-external"]');
    await waitForStatus(cdp, "desk radio needs a YouTube link");
    await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-testid="desk-radio-input"]'))`), "desk radio input to appear");
    await setText(cdp, '[data-testid="desk-radio-input"]', "https://example.com/radio");
    await click(cdp, '[data-testid="desk-radio-tune"]');
    await waitForStatus(cdp, "invalid YouTube link");
    await evaluate(cdp, `window.__cozyAudioProbe = { fetches: [], longBuffers: [], sources: [] }; window.__cozyNativeAmbienceProbe = { starts: [] }`);
    await click(cdp, '[data-testid="audio-toggle"]');
    await waitForStatus(cdp, "rain on");
    await waitUntil(() => textIncludes(cdp, '[data-testid="audio-toggle"]', "Stop"), "audio start button to become stop");
    await waitUntil(
      () => evaluate(
        cdp,
        `(() => (window.__cozyAudioProbe?.sources ?? []).filter((source) => source.started && source.loop && source.duration >= 80).length >= 3)()`
      ),
      "native ambience loop sources to start"
    );
    const nativeAmbience = await evaluate(cdp, `(() => ({
      fetches: window.__cozyAudioProbe?.fetches ?? [],
      longBuffers: window.__cozyAudioProbe?.longBuffers ?? [],
      loopSources: (window.__cozyAudioProbe?.sources ?? []).filter((source) => source.started && source.loop).map((source) => ({
        duration: source.duration,
        startTime: source.startTime
      })),
      nativeStarts: window.__cozyNativeAmbienceProbe?.starts ?? []
    }))()`);
    for (const path of ["/audio/cat-purr.mp3", "/audio/rain.mp3", "/audio/fire-crackle.wav"]) {
      assert(nativeAmbience.fetches.includes(path), `native ambience did not fetch ${path}: ${nativeAmbience.fetches.join(", ")}`);
    }
    assertLoopSource(nativeAmbience.loopSources, "cat purr", 120);
    assertLoopSource(nativeAmbience.loopSources, "rain", 150);
    assertLoopSource(nativeAmbience.loopSources, "fire crackle", 120);
    assertNativeStart(nativeAmbience.nativeStarts, "catPurr", "/audio/cat-purr.mp3", 120, { minGain: 0.001 });
    assertNativeStart(nativeAmbience.nativeStarts, "rainFall", "/audio/rain.mp3", 150, { minGain: 0.01 });
    assertNativeStart(nativeAmbience.nativeStarts, "fireCrackle", "/audio/fire-crackle.wav", 120, { minGain: 0.0001 });

    await evaluate(cdp, `window.__cozyNativeAmbienceProbe = { starts: [] }`);
    await click(cdp, '[data-testid="scene-environment-stardust-hearth"]');
    await waitForStatus(cdp, "stardust hearth backdrop on");
    await waitUntil(
      () => evaluate(
        cdp,
        `(() => (window.__cozyNativeAmbienceProbe?.starts ?? []).some((start) => start.id === "fireCrackle" && start.url === "/audio/fire-crackle.wav" && start.duration >= 119 && start.gain >= 0.05))()`
      ),
      "hearth fire crackle native loop to start"
    );
    const hearthAmbience = await evaluate(cdp, `window.__cozyNativeAmbienceProbe?.starts ?? []`);
    assertNativeStart(hearthAmbience, "fireCrackle", "/audio/fire-crackle.wav", 120, { minGain: 0.05 });
    await click(cdp, '[data-testid="audio-mood-fire"]');
    await waitForStatus(cdp, "fireplace crackle on");
    await click(cdp, '[data-testid="audio-mute"]');
    await waitForStatus(cdp, "audio muted");
    await waitUntil(() => textIncludes(cdp, '[data-testid="audio-mute"]', "Muted"), "mute button to show muted");
    await setRange(cdp, '[data-testid="audio-volume-ambience"]', "0.52");
    const ambienceVolume = await evaluate(cdp, `document.querySelector('[data-testid="audio-volume-ambience"]')?.value`);
    assert(ambienceVolume === "0.52", `ambience volume did not update, got ${ambienceVolume}`);
    await click(cdp, '[data-testid="audio-mute"]');
    await waitForStatus(cdp, "audio unmuted");
    await click(cdp, '[data-testid="audio-toggle"]');
    await waitForStatus(cdp, "Fireplace resting");
  });

  await check("desk radio handles playable and blocked YouTube embeds", async () => {
    await evaluate(cdp, `window.__cozyYouTubeMockMode = "ready"`);
    await click(cdp, '[data-testid="audio-provider-external"]');
    await waitForStatus(cdp, "desk radio needs a YouTube link");
    await setText(cdp, '[data-testid="desk-radio-input"]', "https://youtu.be/dQw4w9WgXcQ?t=1m12s");
    await click(cdp, '[data-testid="desk-radio-tune"]');
    await waitForStatus(cdp, "desk radio ready");
    const readyState = await evaluate(cdp, `(() => ({
      externalActive: document.querySelector('[data-testid="audio-provider-external"]')?.classList.contains("active"),
      iframeSrc: document.querySelector('[data-testid="desk-radio-frame"] iframe')?.getAttribute("src") ?? "",
      nowPlaying: document.querySelector('[data-testid="desk-radio-now"]')?.textContent ?? "",
      storedSource: JSON.parse(localStorage.getItem("cozy-pixel-sandbox:desk-radio:v1") || "null")
    }))()`);
    assert(readyState.externalActive, "Desk Radio provider was not active after a playable embed");
    assert(readyState.iframeSrc.includes("youtube.com/embed/dQw4w9WgXcQ"), `Desk Radio iframe source was wrong: ${readyState.iframeSrc}`);
    assert(readyState.iframeSrc.includes("start=72"), `Desk Radio iframe start time was missing: ${readyState.iframeSrc}`);
    assert(readyState.nowPlaying.includes("Video"), `Desk Radio ready state was missing: ${readyState.nowPlaying}`);
    assert(readyState.storedSource?.id === "dQw4w9WgXcQ", "Playable Desk Radio source was not saved");
    assert(readyState.storedSource?.startSeconds === 72, "Playable Desk Radio start time was not saved");
    await click(cdp, '[data-testid="desk-radio-clear"]');
    await waitForStatus(cdp, "native ambience selected");

    await click(cdp, '[data-testid="audio-provider-external"]');
    await waitForStatus(cdp, "desk radio needs a YouTube link");
    await setText(cdp, '[data-testid="desk-radio-input"]', "https://www.youtube.com/watch?v=-rRFxzRCHKI&list=RD-rRFxzRCHKI&start_radio=1");
    await click(cdp, '[data-testid="desk-radio-tune"]');
    await waitForStatus(cdp, "desk radio ready");
    const playlistState = await evaluate(cdp, `(() => ({
      iframeSrc: document.querySelector('[data-testid="desk-radio-frame"] iframe')?.getAttribute("src") ?? "",
      nowPlaying: document.querySelector('[data-testid="desk-radio-now"]')?.textContent ?? "",
      storedSource: JSON.parse(localStorage.getItem("cozy-pixel-sandbox:desk-radio:v1") || "null")
    }))()`);
    assert(playlistState.iframeSrc.includes("youtube.com/embed/videoseries?list=RD-rRFxzRCHKI"), `Desk Radio playlist iframe source was wrong: ${playlistState.iframeSrc}`);
    assert(playlistState.nowPlaying.includes("Playlist"), `Desk Radio playlist ready state was missing: ${playlistState.nowPlaying}`);
    assert(playlistState.storedSource?.kind === "playlist", "Playlist Desk Radio source was not saved as a playlist");
    assert(playlistState.storedSource?.id === "RD-rRFxzRCHKI", `Playlist Desk Radio source ID was wrong: ${playlistState.storedSource?.id}`);
    await click(cdp, '[data-testid="desk-radio-clear"]');
    await waitForStatus(cdp, "native ambience selected");

    await evaluate(cdp, `window.__cozyYouTubeMockMode = "blocked"`);
    await click(cdp, '[data-testid="audio-provider-external"]');
    await waitForStatus(cdp, "desk radio needs a YouTube link");
    await setText(cdp, '[data-testid="desk-radio-input"]', "https://www.youtube.com/watch?v=jfKfPfyJRdk");
    await click(cdp, '[data-testid="desk-radio-tune"]');
    await waitForStatus(cdp, "YouTube blocked embed; native ambience restored");
    const blockedState = await evaluate(cdp, `(() => ({
      nativeActive: document.querySelector('[data-testid="audio-provider-native"]')?.classList.contains("active"),
      message: document.querySelector('[data-testid="desk-radio-message"]')?.textContent ?? "",
      storedSource: localStorage.getItem("cozy-pixel-sandbox:desk-radio:v1"),
      shareSummary: document.querySelector(".share-summary")?.textContent ?? ""
    }))()`);
    assert(blockedState.nativeActive, "Blocked Desk Radio did not return to native ambience");
    assert(blockedState.message.includes("will not embed"), `Blocked embed message was unclear: ${blockedState.message}`);
    assert(
      blockedState.message.includes("Native ambience is selected again"),
      `Blocked embed fallback was unclear: ${blockedState.message}`
    );
    assert(blockedState.storedSource === null, "Blocked Desk Radio source was saved locally");
    assert(blockedState.shareSummary.includes("Native"), "Blocked Desk Radio still appeared in the share summary");
    await click(cdp, '[data-testid="desk-radio-clear"]');
    await waitForStatus(cdp, "native ambience selected");
  });

  await check("room scenes change the backdrop without loading starter worlds", async () => {
    await click(cdp, '[data-testid="scene-environment-moonwater-garden"]');
    await waitForStatus(cdp, "moonlit garden backdrop on");
    const moonClass = await evaluate(cdp, `document.querySelector(".app-shell")?.classList.contains("scene-moonwater-garden")`);
    const moonImage = await evaluate(cdp, `getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--room-image")`);
    assert(moonClass, "moonwater room class was not applied");
    assert(moonImage.includes("moonwater-garden.jpg"), `moonwater room image was not applied: ${moonImage}`);
    await waitUntil(() => textIncludes(cdp, '[data-testid="audio-mood-purr"]', "Purr"), "purr mood control to stay visible");
    await click(cdp, '[data-testid="scene-environment-stardust-hearth"]');
    await waitForStatus(cdp, "stardust hearth backdrop on");
    const hearthClass = await evaluate(cdp, `document.querySelector(".app-shell")?.classList.contains("scene-stardust-hearth")`);
    const hearthImage = await evaluate(cdp, `getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--room-image")`);
    assert(hearthClass, "stardust hearth room class was not applied");
    assert(hearthImage.includes("stardust-hearth.jpg"), `hearth room image was not applied: ${hearthImage}`);

    for (const room of [
      { id: "cozy-fireplace", status: "cozy fireplace backdrop on", className: "scene-cozy-fireplace", image: "cozy-fireplace.jpg" },
      { id: "forest-hut", status: "forest hut backdrop on", className: "scene-forest-hut", image: "forest-hut.jpg" },
      { id: "snow-window", status: "snow window backdrop on", className: "scene-snow-window", image: "snow-window.jpg" }
    ]) {
      await click(cdp, `[data-testid="scene-environment-${room.id}"]`);
      await waitForStatus(cdp, room.status);
      const hasClass = await evaluate(cdp, `document.querySelector(".app-shell")?.classList.contains("${room.className}")`);
      const roomImage = await evaluate(cdp, `getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--room-image")`);
      assert(hasClass, `${room.id} room class was not applied`);
      assert(roomImage.includes(room.image), `${room.id} room image was not applied: ${roomImage}`);
    }
  });

  await check("narrow desktop layout keeps controls from overlapping the tray", async () => {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 960,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(160);
    const layout = await evaluate(cdp, `(() => {
      const tray = document.querySelector(".tray")?.getBoundingClientRect();
      const controls = document.querySelector(".control-panel")?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        trayRight: tray?.right ?? 0,
        trayBottom: tray?.bottom ?? 0,
        controlsLeft: controls?.left ?? 0,
        controlsRight: controls?.right ?? 0,
        controlsTop: controls?.top ?? 0
      };
    })()`);
    assert(layout.controlsRight <= layout.viewportWidth + 1, `controls overflow viewport: ${JSON.stringify(layout)}`);
    assert(
      layout.trayRight <= layout.controlsLeft || layout.controlsTop >= layout.trayBottom - 1,
      `controls overlap tray: ${JSON.stringify(layout)}`
    );
  });

  await check("page stayed free of browser errors", async () => {
    const pageErrors = await evaluate(cdp, `window.__smokeErrors ?? []`);
    assert(pageErrors.length === 0, `page errors: ${pageErrors.join("; ")}`);
    assert(protocolErrors.length === 0, `protocol errors: ${protocolErrors.join("; ")}`);
  });

    await cdp.close();
  } finally {
    await browser.close();
    await staticServer.close();
  }

  for (const name of checks) console.log(`OK ${name}`);
  console.log("Browser smoke checks passed");
}

async function canvasSignature(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const canvas = document.querySelector(".base-canvas");
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !context || canvas.width === 0 || canvas.height === 0) return 0;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let signature = 0;
      // Sample every pixel: a small falling blob can slip entirely between sparser samples.
      for (let i = 0; i < data.length; i += 4) {
        signature = (signature + data[i] + data[i + 1] * 3 + data[i + 2] * 7 + data[i + 3] * 11) % 1000000007;
      }
      return signature;
    })()`
  );
}

async function textIncludes(cdp, selector, expected) {
  return evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.textContent?.includes(${JSON.stringify(expected)}) ?? false`);
}

function assertLoopSource(sources, label, minimumDuration) {
  const tolerance = 1;
  const source = sources.find((candidate) => candidate.duration >= minimumDuration - tolerance);
  assert(source, `${label} native ambience loop did not reach ${minimumDuration}s: ${sources.map((candidate) => candidate.duration.toFixed(2)).join(", ")}`);
}

function assertNativeStart(starts, id, url, minimumDuration, options = {}) {
  const tolerance = 1;
  const start = starts.find((candidate) => candidate.id === id && candidate.url === url && candidate.duration >= minimumDuration - tolerance);
  assert(
    start,
    `${id} did not start from ${url} at ${minimumDuration}s: ${starts.map((candidate) => `${candidate.id}:${candidate.url}:${candidate.duration?.toFixed?.(2) ?? candidate.duration}`).join(", ")}`
  );
  assert(start.loop, `${id} native ambience did not start as a loop`);
  const minGain = options.minGain ?? 0;
  const maxGain = options.maxGain ?? Number.POSITIVE_INFINITY;
  assert(start.gain >= minGain && start.gain <= maxGain, `${id} gain ${start.gain} outside expected range ${minGain}-${maxGain}`);
}

async function check(name, task) {
  await task();
  checks.push(name);
}

await main();
