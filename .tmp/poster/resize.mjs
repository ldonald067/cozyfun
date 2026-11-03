// Does a resize repaint the same picture? Capture at 960x620, resize to 700x620 and back,
// capture again with every animation paused at the same moment, and diff. Also counts
// the jar layers and creatures before and after.
import { startBrowser, connectToFirstPage, sleep } from "../../scripts/browser-qa-helpers.mjs";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const [url] = process.argv.slice(2);
const browser = await startBrowser();
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  const size = (width, height) => cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
  const census = `JSON.stringify([...document.querySelectorAll(".jar")].map((j) => [j.className, j.querySelectorAll(".jar-glass").length, j.querySelectorAll(".critter").length, j.querySelectorAll(".glint").length, j.querySelector(".jar-glass").width]))`;
  const shot = async (file) => {
    await cdp.send("Runtime.evaluate", { expression: `document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 7000; })` });
    await sleep(300);
    const s = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(file, Buffer.from(s.data, "base64"));
    console.log(file, (await cdp.send("Runtime.evaluate", { expression: census })).result.value);
  };
  await size(960, 620);
  await cdp.send("Page.navigate", { url });
  await sleep(1500);
  await shot(".tmp/poster/r1.png");
  await cdp.send("Runtime.evaluate", { expression: `document.getAnimations().forEach((a) => a.play())` });
  await size(700, 620); await sleep(800);
  await size(960, 620); await sleep(800);
  await shot(".tmp/poster/r2.png");
  console.log(execFileSync("python3", ["-c", `
from PIL import Image, ImageChops
a, b = Image.open(".tmp/poster/r1.png").convert("RGB"), Image.open(".tmp/poster/r2.png").convert("RGB")
d = ImageChops.difference(a, b); px = sum(1 for p in d.getdata() if max(p) > 8)
print("pixels differing by more than 8:", px, "of", a.size[0] * a.size[1], "bbox", d.getbbox())`], { encoding: "utf8" }));
  await cdp.close();
} finally { await browser.close(); }
