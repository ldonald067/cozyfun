// Worst-case WCAG contrast of each line of poster text against the painting behind it.
// Captures the poster with the text hidden, then takes the LIGHTEST background pixel in
// each text box (the type is light, so that is its worst case), at several moments of the
// animation including mid-strike.
//   node .tmp/poster/contrast.mjs <url> [width] [height]
import { startBrowser, connectToFirstPage, sleep } from "../../scripts/browser-qa-helpers.mjs";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const [url, w = "960", h = "620"] = process.argv.slice(2);
const browser = await startBrowser();
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url });
  await sleep(1500);
  const boxes = (await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `[...document.querySelectorAll(".content h1, .content p, .play, .hint")].map((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { name: el.className || el.tagName, x: r.x, y: r.y, w: r.width, h: r.height, color: cs.color };
    })`,
  })).result.value;
  await cdp.send("Runtime.evaluate", { expression: `document.querySelector(".content").style.visibility = "hidden"` });
  const files = [];
  for (const at of [0.08, 0.2, 4.29, 6, 8.69]) {
    await cdp.send("Runtime.evaluate", { expression: `document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${at * 1000}; })` });
    await sleep(200);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const file = `.tmp/poster/bg-${at}.png`;
    await writeFile(file, Buffer.from(shot.data, "base64"));
    files.push(file);
  }
  await cdp.close();
  const py = `
import json, sys
from PIL import Image
boxes = json.loads(sys.argv[1]); files = sys.argv[2:]
def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
for b in boxes:
    rgb = [int(v) for v in b["color"][b["color"].index("(") + 1:-1].split(",")[:3]]
    worst = None
    for f in files:
        im = Image.open(f).convert("RGB")
        crop = im.crop((int(b["x"]), int(b["y"]), int(b["x"] + b["w"]), int(b["y"] + b["h"])))
        ls = sorted(lum(p) for p in crop.getdata())
        r = [(lum(rgb) + 0.05) / (ls[int(len(ls) * q) - 1] + 0.05) for q in (1.0, 0.95)]
        worst = r if worst is None else [min(a, c) for a, c in zip(worst, r)]
        print(f"   {f}: {r[1]:.2f}")
    print(f'{b["name"]:>8}: lightest pixel {worst[0]:.2f}:1, 95th percentile {worst[1]:.2f}:1')
`;
  console.log(execFileSync("python3", ["-c", py, JSON.stringify(boxes), ...files], { encoding: "utf8" }));
} finally {
  await browser.close();
}
