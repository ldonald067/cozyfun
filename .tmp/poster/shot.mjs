// Capture the embed poster at a given size. Usage:
//   node .tmp/poster/shot.mjs <url> <out.png> [width] [height] [dpr] [atSeconds] [reduced]
// Animations are paused at `atSeconds` into the cycle so a lightning frame can be chosen.
import { startBrowser, connectToFirstPage, sleep } from "../../scripts/browser-qa-helpers.mjs";
import { writeFile } from "node:fs/promises";

const [url, out, w = "960", h = "620", dpr = "2", at = "6", reduced = ""] = process.argv.slice(2);
const browser = await startBrowser();
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false });
  if (reduced) await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.send("Page.navigate", { url });
  await sleep(1500);
  const metrics = (await cdp.send("Performance.getMetrics")).metrics;
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  await cdp.send("Runtime.evaluate", {
    expression: `document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${+at * 1000}; })`,
  });
  await sleep(300);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(out, Buffer.from(shot.data, "base64"));
  console.log(`${out}: script ${(m.ScriptDuration * 1000).toFixed(0)} ms, tasks ${(m.TaskDuration * 1000).toFixed(0)} ms`);
  await cdp.close();
} finally {
  await browser.close();
}
