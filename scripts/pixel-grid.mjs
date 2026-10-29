import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  connectToFirstPage,
  evaluate,
  sleep,
  startAppTarget,
  startBrowser,
  statusText,
  waitUntil
} from "./browser-qa-helpers.mjs";
import { showcaseTables } from "./material-showcase.mjs";

// Does every cell reach the screen at the same size?
//
// The board is 220x140 cells drawn into whatever box the layout gives it, and that box is
// never a whole number of pixels per cell: 3.14 px at 1024 wide, 3.2 at 1280, 3.93 at 1440,
// 4.66 at 1920, 1.59 on a phone. Nearest-neighbour at a fractional scale draws a one-cell
// line 3 px wide four times in five and 4 px the fifth (measured 2,851 to 710 runs at 1280),
// so ten identical flower stems drew at two widths. Nothing could see it: visual:qa composites
// at exactly 4.0 px a cell, the one scale no player gets.
//
// This paints a grid of one-cell Wall lines and measures them ON SCREEN, at real device
// pixels, across window sizes and pixel densities. It does not read how the board is sized,
// only what that produced, so it holds whichever way the evenness is achieved. A line's
// "coverage" is the sum of its normalised brightness across the scan: a crisp 3 px line
// covers 3.0, a line drawn 6.4 px wide with soft edges covers 6.4. Every line must cover the
// same amount (spread under SPREAD_LIMIT device px).
//
// The lines sit at gaps of 3 or 4 cells along a Beatty sequence, not every third cell.
// Nearest-neighbour widths repeat with the scale's period, and evenly spaced lines can all
// land on the same phase of it: at 10/3 px a cell, widths run 3, 4, 3 and every third line is
// 4 (review, 2026-10-28, reproduced against this scanner). A Beatty sequence visits every
// phase of every period.
//
// Cells must also be square, because they were 2% wider than tall (3.200 x 3.138 at 1280).
// That is 0.06 px a cell, under anything a per-line width can resolve, so it is measured as
// a pitch instead: each axis's sub-pixel span across the whole pattern, over its cell count.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");

const SPREAD_LIMIT = 0.5;   // fractional nearest-neighbour spreads a full 1.0 px
const ASPECT_LIMIT = 0.006; // pitch across over pitch down, minus one; the old board was 0.020
// The owner's pick (2026-10-28): a snap that would keep less of the board smooths instead.
// At 960 wide a snap kept 72%, inside a 94 px band where painting did nothing.
const KEPT_FLOOR = 0.9;

const CASES = [
  { label: "960x800 @1x", width: 960, height: 800, dsf: 1 },
  { label: "1024x768 @1x", width: 1024, height: 768, dsf: 1 },
  { label: "1280x900 @1x", width: 1280, height: 900, dsf: 1 },
  { label: "1440x900 @1x", width: 1440, height: 900, dsf: 1 },
  { label: "1920x1080 @1x", width: 1920, height: 1080, dsf: 1 },
  { label: "1280x720 @1.5x", width: 1280, height: 720, dsf: 1.5 },
  { label: "1280x900 @2x", width: 1280, height: 900, dsf: 2 },
  { label: "1440x900 @2x", width: 1440, height: 900, dsf: 2 },
  { label: "390x820 @3x phone", width: 390, height: 820, dsf: 3, mobile: true }
];

// Vertical one-cell lines in one band, horizontal ones in another, never touching. Wall never
// moves, so the pattern is what the shutter sees.
const V_BAND = { x0: 10, x1: 209, y0: 20, y1: 50 };
const H_BAND = { x0: 20, x1: 200, y0: 70, y1: 130 };
const beatty = (from, to) => {
  const out = [];
  for (let i = 0; from + Math.floor(i * (2 + (1 + Math.sqrt(5)) / 2)) <= to; i++) out.push(from + Math.floor(i * (2 + (1 + Math.sqrt(5)) / 2)));
  return out;
};
const V_LINES = beatty(V_BAND.x0, V_BAND.x1);
const H_LINES = beatty(H_BAND.y0, H_BAND.y1);

function patternScript() {
  const { MATERIAL } = showcaseTables();
  return `(() => {
    const width = 220, height = 140, stride = 8;
    const cells = new Uint8Array(width * height * stride);
    const wall = (x, y) => { cells[(y * width + x) * stride] = ${MATERIAL.Wall}; };
    for (const x of ${JSON.stringify(V_LINES)}) for (let y = ${V_BAND.y0}; y <= ${V_BAND.y1}; y++) wall(x, y);
    for (const y of ${JSON.stringify(H_LINES)}) for (let x = ${H_BAND.x0}; x <= ${H_BAND.x1}; x++) wall(x, y);
    let binary = "";
    for (let i = 0; i < cells.length; i += 0x8000) binary += String.fromCharCode(...cells.slice(i, i + 0x8000));
    localStorage.setItem("cozy-pixel-sandbox:scene:v1", JSON.stringify({
      format: "CXS2", width, height, tick: 0, engine: "wasm", cells: btoa(binary),
      savedAt: new Date().toISOString(),
      metadata: { app: "cozy-pixel-sandbox", title: "Pixel Grid", room: "snow-window", mood: "rain", musicProvider: "generated" }
    }));
    document.querySelector('[data-testid="load-scene"]').click();
    return true;
  })()`;
}

// Runs in the page: the browser decodes its own screenshot, so no PNG decoder is needed here.
function scanInPage(lumaRows, lumaColumns, reach) {
  const localFloor = (samples, i) => {
    let low = Infinity;
    for (let k = Math.max(0, i - reach); k <= Math.min(samples.length - 1, i + reach); k++) low = Math.min(low, samples[k]);
    return low;
  };
  // Lines along one scan: runs that rise clearly over the local background, edges included.
  const scanLines = (samples) => {
    const lines = [];
    let i = 0;
    while (i < samples.length) {
      if (samples[i] - localFloor(samples, i) < 12) { i++; continue; }
      let start = i;
      while (start > 0 && samples[start - 1] > localFloor(samples, start - 1) + 2) start--;
      let end = i;
      while (end + 1 < samples.length && samples[end + 1] > localFloor(samples, end + 1) + 2) end++;
      const floor = Math.min(localFloor(samples, start), localFloor(samples, end));
      const peak = Math.max(...samples.slice(start, end + 1));
      const covered = (k) => Math.min(1, Math.max(0, (samples[k] - floor) / (peak - floor)));
      let coverage = 0;
      for (let k = start; k <= end; k++) coverage += covered(k);
      // Sub-pixel edges: a pixel a line half covers puts the edge halfway across it.
      lines.push({ start, end, coverage, left: start + 1 - covered(start), right: end + covered(end) });
      i = end + 1;
    }
    return lines;
  };
  return { rows: lumaRows.map(scanLines), columns: lumaColumns.map(scanLines) };
}

async function measure(cdp, testCase) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: testCase.width, height: testCase.height, deviceScaleFactor: testCase.dsf, mobile: Boolean(testCase.mobile)
  });
  await sleep(700);
  const box = await evaluate(cdp, `(() => {
    const tray = document.querySelector('[data-testid="sandbox-tray"]');
    const r = tray.getBoundingClientRect();
    return { x: r.x + tray.clientLeft, y: r.y + tray.clientTop, width: tray.clientWidth, height: tray.clientHeight, dpr: devicePixelRatio };
  })()`);
  // The glass sheen and the glow sit over the board; hide them so the scan reads the grid.
  await evaluate(cdp, `(document.querySelectorAll('.glass-sheen, .glow-canvas').forEach((el) => { el.style.visibility = 'hidden'; }), true)`);
  await sleep(150);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png", fromSurface: true,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 }
  });
  await evaluate(cdp, `(document.querySelectorAll('.glass-sheen, .glow-canvas').forEach((el) => { el.style.visibility = ''; }), true)`);

  // Where the board landed is read off the pattern on screen, never from how it was sized:
  // the top of the first band is cell row V_BAND.y0, the bottom of the last is the last
  // horizontal line + 1.
  const scanned = await evaluate(cdp, `(async () => {
    const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64,${shot.data}")).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const luma = (x, y) => { const i = (y * bitmap.width + x) * 4; return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; };
    const brightIn = (y) => { let n = 0; for (let x = 0; x < bitmap.width; x++) if (luma(x, y) > 60) n++; return n; };
    let top = 0; while (top < bitmap.height && brightIn(top) < 20) top++;
    let bottom = bitmap.height - 1; while (bottom > top && brightIn(bottom) < 20) bottom--;
    const cell = (bottom + 1 - top) / (${H_LINES.at(-1) + 1 - V_BAND.y0});
    const bandRow = Math.round(top + 2.5 * cell);
    let left = 0; while (left < bitmap.width && luma(left, bandRow) <= 60) left++;
    const x0 = left - ${V_BAND.x0} * cell;
    const at = (cellY) => Math.round(top + (cellY - ${V_BAND.y0} + 0.5) * cell);
    const rowsAt = [24, 29, 35, 41, 46].map(at);
    const columnsAt = [40, 75, 110, 145, 180].map((cx) => Math.round(x0 + (cx + 0.5) * cell));
    const rows = rowsAt.map((y) => Array.from({ length: bitmap.width }, (_, x) => luma(x, y)));
    const columns = columnsAt.map((x) => Array.from({ length: bitmap.height }, (_, y) => luma(x, y)));
    const scan = (${scanInPage.toString()});
    const reach = Math.ceil(cell * 1.5) + 1;
    const lines = scan(rows, columns, reach);
    // Pitch across: the first vertical line's left edge to the last one's right, in each row.
    const across = lines.rows.map((row) => (row.at(-1).right - row[0].left) / ${V_LINES.at(-1) + 1 - V_LINES[0]});
    // Pitch down: down the middle vertical line, from the band's top to the last horizontal line.
    const middle = lines.rows[2][Math.floor(lines.rows[2].length / 2)];
    const spine = Math.round((middle.left + middle.right) / 2);
    const down = scan([], [Array.from({ length: bitmap.height }, (_, y) => luma(spine, y))], reach).columns[0];
    const pitchDown = (down.at(-1).right - down[0].left) / ${H_LINES.at(-1) + 1 - V_BAND.y0};
    return {
      ...lines, cell, pitchAcross: across.reduce((a, b) => a + b, 0) / across.length, pitchDown,
      hBand: [at(${H_LINES[0]} - 1.5), at(${H_LINES.at(-1)} + 1.5)], scans: [rowsAt.length, columnsAt.length]
    };
  })()`);

  const vertical = scanned.rows.flat().map((line) => line.coverage);
  const horizontal = scanned.columns.flat().filter((line) => line.start > scanned.hBand[0] && line.end < scanned.hBand[1]).map((line) => line.coverage);
  const stats = (values) => ({
    count: values.length,
    mean: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length),
    min: Math.min(...values),
    max: Math.max(...values)
  });
  return {
    ...testCase, dpr: box.dpr, trayCss: [box.width, box.height],
    v: stats(vertical), h: stats(horizontal),
    perScan: { v: vertical.length / scanned.scans[0], h: horizontal.length / scanned.scans[1] },
    aspect: scanned.pitchAcross / scanned.pitchDown,
    // How much of the tray the board kept: what the snap costs, measured off the screen.
    kept: (scanned.pitchAcross * 220) / box.dpr / Math.min(box.width, (box.height * 220) / 140)
  };
}

async function main() {
  const target = await startAppTarget(distDir);
  const browser = await startBrowser({ profilePrefix: "cozy-pixel-grid-", windowSize: "1440,1080" });
  const results = [];
  try {
    const cdp = await connectToFirstPage(browser.debugPort);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: target.url });
    await waitUntil(() => evaluate(cdp, `document.readyState === "complete" && Boolean(document.querySelector('[data-testid="sandbox-tray"]'))`), "app shell");
    await waitUntil(async () => (await statusText(cdp)).includes("online"), "engine online", 20_000);
    await evaluate(cdp, patternScript());
    await waitUntil(async () => (await statusText(cdp)).includes("browser save loaded"), "pattern scene");
    await evaluate(cdp, `document.querySelector('[aria-label="Pause simulation"]').click(), true`);
    await sleep(300);
    for (const testCase of CASES) results.push(await measure(cdp, testCase));
  } finally {
    await browser.close();
    await target.close();
  }

  const failures = [];
  console.log("case                 dpr   line width, device px (across | down)   spread across/down   lines across/down   cell aspect   board kept");
  for (const r of results) {
    const spreadV = r.v.max - r.v.min;
    const spreadH = r.h.max - r.h.min;
    console.log(
      `${r.label.padEnd(20)} ${String(r.dpr).padEnd(4)}  ${r.v.mean.toFixed(2)} (${r.v.min.toFixed(2)}-${r.v.max.toFixed(2)}) | ${r.h.mean.toFixed(2)} (${r.h.min.toFixed(2)}-${r.h.max.toFixed(2)})   ${spreadV.toFixed(2)} / ${spreadH.toFixed(2)}            ${r.perScan.v} / ${r.perScan.h}             ${r.aspect.toFixed(4)}        ${(r.kept * 100).toFixed(0)}%`
    );
    if (r.perScan.v !== V_LINES.length || r.perScan.h !== H_LINES.length) {
      failures.push(`${r.label}: found ${r.perScan.v} / ${r.perScan.h} lines a scan, painted ${V_LINES.length} / ${H_LINES.length}; the scan is not seeing the pattern`);
      continue;
    }
    if (spreadV > SPREAD_LIMIT) failures.push(`${r.label}: one-cell lines run ${r.v.min.toFixed(2)}-${r.v.max.toFixed(2)} device px wide (spread ${spreadV.toFixed(2)} > ${SPREAD_LIMIT})`);
    if (spreadH > SPREAD_LIMIT) failures.push(`${r.label}: one-cell lines run ${r.h.min.toFixed(2)}-${r.h.max.toFixed(2)} device px tall (spread ${spreadH.toFixed(2)} > ${SPREAD_LIMIT})`);
    if (Math.abs(r.aspect - 1) > ASPECT_LIMIT) failures.push(`${r.label}: cells are ${((r.aspect - 1) * 100).toFixed(2)}% wider than tall`);
    if (r.kept < KEPT_FLOOR) failures.push(`${r.label}: the board keeps ${(r.kept * 100).toFixed(0)}% of the tray, under ${KEPT_FLOOR * 100}%`);
  }
  assert(failures.length === 0, `uneven pixels:\n  ${failures.join("\n  ")}`);
  console.log("pixel grid: every cell reaches the screen at one size, in every case");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
