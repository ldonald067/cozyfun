// Do the jar creatures actually move? Samples each one's box and opacity twice, 3 s apart.
import { startBrowser, connectToFirstPage, sleep } from "../../scripts/browser-qa-helpers.mjs";
const [url, reduced] = process.argv.slice(2);
const browser = await startBrowser();
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 960, height: 620, deviceScaleFactor: 1, mobile: false });
  if (reduced) await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await cdp.send("Page.navigate", { url });
  await sleep(1500);
  const sels = [".ladybug", ".spider", ".thread", ".snail", ".flight", ".firefly", ".butterfly", ".jar--bugs .jar-sway", ".mote", ".moonglow", ".bolt--1"];
  const probe = `JSON.stringify(${JSON.stringify(sels)}.map((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [r.x.toFixed(1), r.y.toFixed(1), r.width.toFixed(1), r.height.toFixed(1), (+getComputedStyle(e).opacity).toFixed(2)]; }))`;
  const a = JSON.parse((await cdp.send("Runtime.evaluate", { expression: probe })).result.value);
  await sleep(3000);
  const b = JSON.parse((await cdp.send("Runtime.evaluate", { expression: probe })).result.value);
  sels.forEach((s, i) => console.log(s.padEnd(22), JSON.stringify(a[i]) === JSON.stringify(b[i]) ? "still " : "moved ", a[i].join(" "), "->", b[i].join(" ")));
  await cdp.close();
} finally { await browser.close(); }
