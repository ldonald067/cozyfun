// Frame-interval probe: 4 s of requestAnimationFrame on the poster, plus layout/style counts.
import { startBrowser, connectToFirstPage, sleep } from "../../scripts/browser-qa-helpers.mjs";
const [url] = process.argv.slice(2);
const browser = await startBrowser();
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 960, height: 620, deviceScaleFactor: 2, mobile: false });
  await cdp.send("Page.navigate", { url });
  await sleep(1500);
  const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const r = (await cdp.send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `new Promise((done) => {
    const f = []; let last = performance.now(); const t0 = last;
    (function tick(now) { f.push(now - last); last = now; if (now - t0 < 4000) requestAnimationFrame(tick); else {
      const s = f.slice(2).sort((a, b) => a - b); done({ n: s.length, median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }); } })(last);
  })` })).result.value;
  const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  console.log(url.split("/").pop(), JSON.stringify(r), "layouts", m1.LayoutCount - m0.LayoutCount, "styles", m1.RecalcStyleCount - m0.RecalcStyleCount, "script ms", ((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0), "task ms", ((m1.TaskDuration - m0.TaskDuration) * 1000).toFixed(0));
  await cdp.close();
} finally { await browser.close(); }
