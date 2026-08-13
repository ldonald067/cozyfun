import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  clickSelector as click,
  connectToFirstPage,
  evaluate,
  setRange,
  setText,
  sleep,
  startBrowser,
  startAppTarget,
  statusText,
  waitForStatus,
  waitUntil
} from "./browser-qa-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");

const checks = [];
const protocolErrors = [];

async function main() {
  // startAppTarget owns "what am I testing", including whether a local build is even
  // required — a COZY_QA_URL run tests something already deployed.
  const target = await startAppTarget(distDir);
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

    const appUrl = target.url;
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
    assert(state.materials === 19, `expected exactly 19 selectable material buttons, found ${state.materials}: ${state.materialLabels.join(", ")}`);
    for (const generatedOnly of ["Flower", "Smoke", "Steam", "Spark"]) {
      assert(!state.materialLabels.includes(generatedOnly), `generated-only ${generatedOnly} should not be selectable`);
    }
    assert(state.audioInfos === 2, `expected two audio info icons, found ${state.audioInfos}`);
    assert(state.audioMoods === 3, `expected three audio mood buttons, found ${state.audioMoods}`);
    assert(state.audioProviders === 2, `expected two sound source buttons, found ${state.audioProviders}`);
    assert(state.providerLabels.join("|") === "Native|Desk Radio", `unexpected sound providers: ${state.providerLabels.join(", ")}`);
    assert(state.nativeProviderActive, "legacy generated audio provider did not normalize to native");
    assert(state.storedAudioProvider === "native", `legacy generated audio provider was not migrated in prefs: ${state.storedAudioProvider}`);
    assert(state.shareActions === 4, `expected four share actions, found ${state.shareActions}`);
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

  await check("a first-time outcome earns a lingering field note", async () => {
    // Wood, then fire on top of it: within seconds the log ignites into ember, a
    // generated kind this profile has never seen, so the journal's first note fires.
    // The note must appear in its own element — never the functional status line —
    // and hold long enough to actually read (the linger is the whole point).
    await evaluate(cdp, `(() => {
      const pick = (title) => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").startsWith(title))?.click();
      pick("Wood");
      return true;
    })()`);
    await click(cdp, '[data-testid="sandbox-tray"]', { xRatio: 0.4, yRatio: 0.8 });
    await sleep(150);
    await evaluate(cdp, `(() => {
      const pick = (title) => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").startsWith(title))?.click();
      pick("Fire");
      return true;
    })()`);
    await click(cdp, '[data-testid="sandbox-tray"]', { xRatio: 0.4, yRatio: 0.78 });
    await waitUntil(
      async () => ((await evaluate(cdp, `document.querySelector('[data-testid="field-note"]')?.textContent ?? ""`)).trim().length > 0),
      "field note to appear",
      30_000
    );
    const note = (await evaluate(cdp, `document.querySelector('[data-testid="field-note"]').textContent`)).trim();
    const ledger = await evaluate(cdp, `JSON.parse(localStorage.getItem("cozy-pixel-sandbox:fieldnotes:v1") ?? "[]")`);
    assert(ledger.length === 1, `expected exactly one witnessed note, got ${JSON.stringify(ledger)}`);
    // Reset the tray and selection so the checks downstream start from the same
    // state they always did.
    await evaluate(cdp, `(() => {
      const pick = (title) => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").startsWith(title))?.click();
      pick("Sand");
      return true;
    })()`);
    await click(cdp, '[data-testid="clear-scene"]');
    await waitForStatus(cdp, "tray cleared");
    console.log(`    field note: "${note}" (${ledger[0]})`);
  });

  await check("native ambience recordings are served and decodable", async () => {
    const assets = await evaluate(
      cdp,
      `(async () => {
        // 400k floor catches a missing or truncated recording without failing on a
        // properly compressed one (the purr is ~0.89 MB since the beds were encoded down).
        const checks = [
          { url: "/audio/cat-purr.mp3", minBytes: 400000, minSeconds: 110 },
          { url: "/audio/rain.mp3", minBytes: 400000, minSeconds: 260 },
          { url: "/audio/fire-crackle.mp3", minBytes: 400000, minSeconds: 110 }
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
            minSeconds: asset.minSeconds,
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
      // Guard the recording itself, not just that bytes decoded: runtime loop extension
      // would happily stretch a one-second clip into a 120s bed, so a truncated or
      // substituted source has to be caught here at its true length.
      assert(
        asset.duration >= asset.minSeconds,
        `${asset.url} decoded to ${asset.duration.toFixed(2)}s, expected at least ${asset.minSeconds}s of source recording`
      );
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
    for (const path of ["/audio/cat-purr.mp3", "/audio/rain.mp3", "/audio/fire-crackle.mp3"]) {
      assert(nativeAmbience.fetches.includes(path), `native ambience did not fetch ${path}: ${nativeAmbience.fetches.join(", ")}`);
    }
    assertLoopSource(nativeAmbience.loopSources, "cat purr", 120);
    assertLoopSource(nativeAmbience.loopSources, "rain", 150);
    assertLoopSource(nativeAmbience.loopSources, "fire crackle", 120);
    assertNativeStart(nativeAmbience.nativeStarts, "catPurr", "/audio/cat-purr.mp3", 120, { minGain: 0.001 });
    assertNativeStart(nativeAmbience.nativeStarts, "rainFall", "/audio/rain.mp3", 150, { minGain: 0.01 });
    assertNativeStart(nativeAmbience.nativeStarts, "fireCrackle", "/audio/fire-crackle.mp3", 120, { minGain: 0.0001 });

    await evaluate(cdp, `window.__cozyNativeAmbienceProbe = { starts: [] }`);
    await click(cdp, '[data-testid="audio-mood-purr"]');
    await waitForStatus(cdp, "cat purr on");
    await waitUntil(
      () => evaluate(
        cdp,
        `(() => (window.__cozyNativeAmbienceProbe?.starts ?? []).some((start) => start.id === "catPurr" && start.gain >= 0.05))()`
      ),
      "featured purr bed to skip the rain room gain bias"
    );
    await click(cdp, '[data-testid="audio-mood-rain"]');
    await waitForStatus(cdp, "rain on");

    await evaluate(cdp, `window.__cozyNativeAmbienceProbe = { starts: [] }`);
    await click(cdp, '[data-testid="scene-environment-stardust-hearth"]');
    await waitForStatus(cdp, "stardust hearth backdrop on");
    await waitUntil(
      () => evaluate(
        cdp,
        `(() => (window.__cozyNativeAmbienceProbe?.starts ?? []).some((start) => start.id === "fireCrackle" && start.url === "/audio/fire-crackle.mp3" && start.duration >= 119 && start.gain >= 0.05))()`
      ),
      "hearth fire crackle native loop to start"
    );
    const hearthAmbience = await evaluate(cdp, `window.__cozyNativeAmbienceProbe?.starts ?? []`);
    assertNativeStart(hearthAmbience, "fireCrackle", "/audio/fire-crackle.mp3", 120, { minGain: 0.05 });
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
    await waitForStatus(cdp, "Hearth Crackle resting");
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

  await check("an open window lets tonight's weather into the tray", async () => {
    // Rain Desk with the window open: within seconds real water cells should drift in
    // and change the (cleared, otherwise static) canvas. Shut the window and the same
    // empty tray must stay byte-still — weather is input, and shut means shut.
    await click(cdp, '[data-testid="scene-environment-rain-desk"]');
    await waitForStatus(cdp, "rain desk backdrop on");
    const windowState = await evaluate(cdp, `document.querySelector('[data-testid="window-toggle"]')?.textContent`);
    assert(windowState?.includes("open"), `window should default open, reads: ${windowState}`);
    await click(cdp, '[data-testid="clear-scene"]');
    await waitForStatus(cdp, "tray cleared");
    const before = await canvasSignature(cdp);

    // The budget is in SIM TICKS, converted to wall-clock using the rate this machine
    // actually achieves. Clearing the tray can land just after a drop and leave a full
    // interval to wait out, and Rain Desk's worst case is 340 ticks between drops
    // divided by the calmest intensity tier (0.55) times the per-drop jitter (1.4) —
    // about 866 ticks.
    //
    // A budget whose unit is ticks cannot be written as a constant number of seconds:
    // 866 ticks is ~33s only on a machine sustaining 26 ticks/second, and a loaded CI
    // runner does not. So measure the rate and derive the deadline from it.
    // Saving is the only way to read the engine's tick count from outside, but it
    // overwrites the manual save — and the away-growth check downstream stages exactly
    // that key. Left unrestored, that check silently ended up ageing this cleared tray
    // instead of a real scene, and still passed because its assertion reads a status
    // string. So put the manual save back exactly as it was.
    const manualSave = await evaluate(cdp, `localStorage.getItem("cozy-pixel-sandbox:scene:v1")`);
    const restoreManualSave = () => evaluate(cdp, `(() => {
      const raw = ${JSON.stringify(manualSave)};
      if (raw === null) localStorage.removeItem("cozy-pixel-sandbox:scene:v1");
      else localStorage.setItem("cozy-pixel-sandbox:scene:v1", raw);
      return true;
    })()`);
    const tickCount = async () => {
      await click(cdp, '[data-testid="save-scene"]');
      return evaluate(cdp, `JSON.parse(localStorage.getItem("cozy-pixel-sandbox:scene:v1") || "{}").tick ?? 0`);
    };
    // One interval is at most 866 ticks, but two things can swallow an interval whole,
    // and both were missed the first time this budget was computed:
    //   - `drop()` advances `nextDropAt` BEFORE the cell-count cap check, so a
    //     suppressed drop costs a full interval and returns nothing.
    //   - the census behind that cap only recounts every 300 ticks, so a stale count
    //     from a busier moment can suppress drops for a while after the tray is cleared.
    // 2200 covers a swallowed interval, a real one, and the census lag, with headroom.
    //
    // This is a CEILING, not an expected wait: an ordinary day drops every ~340 ticks
    // and the check returns the moment the canvas moves, so the common case is seconds.
    const TICK_BUDGET = 2200;
    const sampleMs = 2000;
    const firstTick = await tickCount();
    await sleep(sampleMs);
    const ticksPerMs = Math.max((await tickCount() - firstTick) / sampleMs, 0.002);
    await restoreManualSave();
    // The ceiling is sized so it cannot itself become the flake, but past 240s the
    // simulation is not really running, which is a failure worth reporting rather than
    // waiting out.
    const budgetMs = Math.min(240_000, Math.max(30_000, Math.ceil(TICK_BUDGET / ticksPerMs)));
    await waitUntil(
      async () => (await canvasSignature(cdp)) !== before,
      `drizzle to reach the tray (${TICK_BUDGET} sim ticks at ${(ticksPerMs * 1000).toFixed(1)}/s)`,
      budgetMs
    );

    await click(cdp, '[data-testid="window-toggle"]');
    await click(cdp, '[data-testid="clear-scene"]');
    await waitForStatus(cdp, "tray cleared");
    await sleep(1000); // let any mid-air drop land before taking the reference frame
    const shutBefore = await canvasSignature(cdp);
    await sleep(6000);
    const shutAfter = await canvasSignature(cdp);
    assert(shutBefore === shutAfter, "weather leaked into the tray with the window shut");
    await click(cdp, '[data-testid="window-toggle"]'); // leave it open, the default
  });

  await check("a newer window takes over and play reclaims", async () => {
    // A second surface (embed vs new tab) announcing itself must pause THIS one with a
    // plain explanation — two live engines diverging from one autosave was the "why does
    // it look different over there" bug. Unpausing takes the terrarium back.
    const fullscreenButton = await evaluate(cdp, `Boolean(document.querySelector('[data-testid="fullscreen-toggle"]')) === document.fullscreenEnabled`);
    assert(fullscreenButton, "fullscreen button should render exactly when the browser supports it");
    const send = (message) => evaluate(cdp, `new BroadcastChannel("cozy-pixel-sandbox:owner").postMessage(${JSON.stringify(message)})`);

    // A claim OLDER than this window's must be ignored. Without a total order on claims,
    // two windows starting together each demote on the other's claim and NOBODY owns the
    // terrarium or saves it — so this half is what keeps the tiebreak honest.
    await send({ type: "claim", id: "smoke-stale", at: 1 });
    await sleep(400);
    assert(
      !(await evaluate(cdp, `Boolean(document.querySelector(".status-paused"))`)),
      "a claim older than this window's must not take the terrarium away"
    );

    await send({ type: "claim", id: "smoke-foreign", at: Date.now() });
    await waitForStatus(cdp, "another window is tending this terrarium — press play to take over", 10_000);
    const pausedBadge = await evaluate(cdp, `Boolean(document.querySelector(".status-paused"))`);
    assert(pausedBadge, "takeover should pause this window");

    // Pausing the loser is not enough on its own: the dangerous write is the one on the
    // way out. A stale second copy closing LAST used to overwrite the scene the player
    // had just been tending in the other window, because the close handler saved
    // unconditionally. Dispatching pagehide here drives that exact handler.
    const beforeLoserClose = await evaluate(cdp, `localStorage.getItem("cozy-pixel-sandbox:scene:auto:v1")`);
    await evaluate(cdp, `window.dispatchEvent(new Event("pagehide"))`);
    const afterLoserClose = await evaluate(cdp, `localStorage.getItem("cozy-pixel-sandbox:scene:auto:v1")`);
    assert(
      afterLoserClose === beforeLoserClose,
      "a window that lost the terrarium must not write the autosave when it closes"
    );

    // The owner leaving must hand the terrarium back. Without a release, closing the
    // newest window strands this one demoted forever: paused, refusing to save, and
    // advertising a window that no longer exists.
    await send({ type: "release", id: "smoke-foreign" });
    await waitForStatus(cdp, "this window is tending the terrarium now", 5_000);
    await waitUntil(
      async () => !(await evaluate(cdp, `Boolean(document.querySelector(".status-paused"))`)),
      "the released terrarium to resume here",
      5_000
    );

    // Reclaiming by pressing play has to SAY so too. Caught on the live site: the status
    // kept reading "press play to take over" after the player had done exactly that.
    await send({ type: "claim", id: "smoke-foreign-2", at: Date.now() });
    await waitForStatus(cdp, "another window is tending this terrarium — press play to take over", 10_000);
    await click(cdp, '[data-testid="pause-toggle"]');
    await waitUntil(async () => !(await evaluate(cdp, `Boolean(document.querySelector(".status-paused"))`)), "play to reclaim", 5_000);
    await waitForStatus(cdp, "this window is tending the terrarium now", 5_000);

    // ...and the pairing half, so the guard above cannot pass by having broken saving
    // outright: once this window owns the terrarium again, closing DOES record it.
    await evaluate(cdp, `window.dispatchEvent(new Event("pagehide"))`);
    const afterOwnerClose = await evaluate(cdp, `localStorage.getItem("cozy-pixel-sandbox:scene:auto:v1")`);
    assert(
      afterOwnerClose && afterOwnerClose !== beforeLoserClose,
      "the window that owns the terrarium must still record it on close"
    );
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

  await check("a saved scene changes while the player is away", async () => {
    // The whole "living terrarium" loop: storage timestamp -> boot restore -> slow
    // steps -> chunked catch-up in the render loop.
    //
    // Reloads reset window.__smokeErrors, so bank the pre-reload errors first —
    // otherwise the final error check would silently cover only the last page load.
    const preReloadErrors = await evaluate(cdp, `window.__smokeErrors ?? []`);
    assert(preReloadErrors.length === 0, `page errors before reload: ${preReloadErrors.join("; ")}`);

    await stageAgedAutosave(cdp, appUrl, 2);

    // Two hours earns slow steps as well as tick catch-up, so this wording proves the
    // real browser took the slow-world branch at boot and survived it. It does NOT
    // prove a cell changed — the string is chosen from the step COUNT alone. That claim
    // belongs to the bloom check below and to `npm run slow-world:audit`.
    await waitForStatus(cdp, "your terrarium changed while you were away", 20_000);
  });

  await check("a garden planted in the app actually blooms", async () => {
    // The one thing every other gate proves about a DIFFERENT surface. The interaction
    // audit already grows a flower from painted soil/seed/water, but it drives the
    // engine compiled straight out of the repo — it cannot tell you the shipped bundle
    // in a real browser does the same, and with COZY_QA_URL this check runs against
    // production. "No player has ever seen a flower" is a mistake this repo has already
    // made once, and it was invisible to every test that did not start from the brush.
    //
    // Waiting for a bloom in real time would take about two and a half minutes at 26
    // ticks/second. So the scene is planted, aged two days, and reloaded: the wake-up
    // catch-up replays 4,000 ticks in seconds. That also makes this the check that
    // proves the absence path GROWS something, which the status-text assertion above
    // deliberately does not.
    const pickMaterial = async (label) => {
      const picked = await evaluate(cdp, `(() => {
        const button = [...document.querySelectorAll("button.material-button")]
          .find((b) => b.textContent.trim() === ${JSON.stringify(label)});
        if (!button) return false;
        button.click();
        return true;
      })()`);
      assert(picked, `no material button labelled ${label}`);
      // React commits between round trips, so the next paint uses the new material.
      // Selecting and painting inside ONE evaluate silently paints with the PREVIOUS
      // material, which is exactly how a hand-run of this scene came out as sand.
      await sleep(120);
      const active = await evaluate(cdp, `document.querySelector("button.material-button.active")?.textContent.trim()`);
      assert(active === label, `expected ${label} selected, got ${active}`);
    };

    await click(cdp, '[data-testid="clear-scene"]');
    await waitForStatus(cdp, "tray cleared");

    await pickMaterial("Soil");
    for (const xRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      await click(cdp, '[data-testid="sandbox-tray"]', { xRatio, yRatio: 0.92 });
    }
    await pickMaterial("Seed");
    await click(cdp, '[data-testid="sandbox-tray"]', { xRatio: 0.5, yRatio: 0.84 });
    await pickMaterial("Water");
    for (const xRatio of [0.42, 0.5, 0.58]) {
      await click(cdp, '[data-testid="sandbox-tray"]', { xRatio, yRatio: 0.45 });
    }

    // Census straight off a scene snapshot, so this counts SIM CELLS rather than
    // guessing at pixels: a green-ish pixel could be moss, and moss is not a bloom.
    const census = async () => {
      await click(cdp, '[data-testid="save-scene"]');
      return evaluate(cdp, `(() => {
        const raw = localStorage.getItem("cozy-pixel-sandbox:scene:v1");
        if (!raw) return null;
        const bytes = atob(JSON.parse(raw).cells);
        const counts = {};
        for (let i = 0; i < bytes.length; i += 8) {
          const kind = bytes.charCodeAt(i);
          if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
        }
        return { flower: counts[19] ?? 0, stem: counts[23] ?? 0, seed: counts[11] ?? 0, soil: counts[5] ?? 0 };
      })()`);
    };

    const planted = await census();
    assert(planted, "planting produced no saveable scene");
    assert(planted.soil > 0 && planted.seed > 0, `expected painted soil and seed, saw ${JSON.stringify(planted)}`);
    assert(planted.flower === 0, `the scene already had ${planted.flower} flower cells before growing anything`);

    await stageAgedAutosave(cdp, appUrl, 48);

    let grown = null;
    await waitUntil(async () => {
      grown = await census();
      // Four is the smallest real head: a crown plus the three-petal poppy silhouette.
      return Boolean(grown && grown.flower >= 4);
      // Poll slowly: every census clicks Save and rewrites localStorage, and the default
      // 80ms cadence would do that hundreds of times to watch one plant grow.
    }, "a bloom to open in the app", 90_000, 750);
    assert(grown.stem > 0, `flowers appeared with no stalk under them: ${JSON.stringify(grown)}`);
  });

  await check("page stayed free of browser errors", async () => {
    const pageErrors = await evaluate(cdp, `window.__smokeErrors ?? []`);
    assert(pageErrors.length === 0, `page errors: ${pageErrors.join("; ")}`);
    assert(protocolErrors.length === 0, `protocol errors: ${protocolErrors.join("; ")}`);
  });

    await cdp.close();
  } finally {
    await browser.close();
    await target.close();
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

/**
 * Age the manual save into the past, promote it to the autosave slot the boot path
 * restores from, and reload — the only way to exercise the return-from-absence path.
 *
 * The hop through `?cozyNoAutosave=1` is load-bearing: leaving a normal page fires the
 * pagehide autosave, which faithfully overwrites the staged timestamp with "now". That
 * is correct in production and exactly what makes this scenario impossible to set up
 * without the QA hook.
 */
async function stageAgedAutosave(cdp, appUrl, hoursAway) {
  await cdp.send("Page.navigate", { url: `${appUrl}?cozyNoAutosave=1` });
  await waitUntil(async () => (await statusText(cdp)).length > 0, "no-autosave page", 20_000);
  const staged = await evaluate(cdp, `(() => {
    const raw = localStorage.getItem("cozy-pixel-sandbox:scene:v1");
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    snapshot.savedAt = new Date(Date.now() - ${hoursAway} * 3600 * 1000).toISOString();
    localStorage.setItem("cozy-pixel-sandbox:scene:auto:v1", JSON.stringify(snapshot));
    return true;
  })()`);
  assert(staged, "no manual save found to stage an absence from");
  await cdp.send("Page.navigate", { url: appUrl });
  await waitUntil(
    () => evaluate(cdp, `Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`),
    "app to come back after the absence"
  );
}

async function check(name, task) {
  // One outer deadline per check. Individual waits have their own budgets, but an
  // awaited CDP evaluate that never settles has none — and that hangs the whole CI job
  // instead of failing it.
  const CHECK_TIMEOUT_MS = 300_000;
  let timer;
  try {
    await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`check "${name}" exceeded ${CHECK_TIMEOUT_MS / 1000}s`)), CHECK_TIMEOUT_MS);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
  checks.push(name);
}

await main();
