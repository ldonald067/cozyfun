// Manual listening-review helper: measures each ambience recording's RMS loudness
// raw and through its bed filter. Re-run after swapping a recording and update the
// levelTrim values in app/src/audio/assets.ts so beds stay loudness-matched.
// Usage: npm run build && node scripts/audio-loudness.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectToFirstPage,
  evaluate,
  startBrowser,
  startStaticServer,
  waitUntil
} from "./browser-qa-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");
const staticServer = await startStaticServer(distDir);
const browser = await startBrowser({ profilePrefix: "cozy-loudness-", extraArgs: ["--autoplay-policy=no-user-gesture-required"] });

try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${staticServer.port}/` });
  await waitUntil(() => evaluate(cdp, `document.readyState === "complete"`), "page load");

  const results = await evaluate(
    cdp,
    `(async () => {
      const beds = [
        { id: "rain", url: "/audio/rain.mp3", filter: { type: "lowpass", frequency: 3800, q: 0.38 } },
        { id: "purr", url: "/audio/cat-purr.mp3", filter: { type: "lowpass", frequency: 480, q: 0.34 } },
        { id: "fire", url: "/audio/fire-crackle.wav", filter: { type: "highpass", frequency: 120, q: 0.28 } }
      ];
      const out = [];
      for (const bed of beds) {
        const bytes = await (await fetch(bed.url)).arrayBuffer();
        const probeCtx = new OfflineAudioContext(1, 1, 44100);
        const decoded = await probeCtx.decodeAudioData(bytes.slice(0));
        const seconds = Math.min(30, decoded.duration);
        const rms = (buffer) => {
          let sum = 0;
          let count = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            const limit = Math.min(data.length, Math.floor(seconds * buffer.sampleRate));
            for (let i = 0; i < limit; i++) sum += data[i] * data[i];
            count += limit;
          }
          return Math.sqrt(sum / count);
        };

        const renderCtx = new OfflineAudioContext(decoded.numberOfChannels, Math.floor(seconds * decoded.sampleRate), decoded.sampleRate);
        const source = renderCtx.createBufferSource();
        source.buffer = decoded;
        const filter = renderCtx.createBiquadFilter();
        filter.type = bed.filter.type;
        filter.frequency.value = bed.filter.frequency;
        filter.Q.value = bed.filter.q;
        source.connect(filter);
        filter.connect(renderCtx.destination);
        source.start();
        const filtered = await renderCtx.startRendering();

        out.push({ id: bed.id, rawRms: rms(decoded), filteredRms: rms(filtered) });
      }
      return out;
    })()`
  );

  for (const bed of results) {
    console.log(`${bed.id}: raw RMS ${bed.rawRms.toFixed(4)}, filtered RMS ${bed.filteredRms.toFixed(4)}`);
  }
} finally {
  await browser.close();
  await staticServer.close();
}
