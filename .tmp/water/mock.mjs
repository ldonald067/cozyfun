// Scratch (2026-10-29): a MOVING mock of water looks for the owner, through the real engine and
// renderer. One scene (a pour onto a shelf that spills as a waterfall into a basin), three looks:
//   today   - colorForCell as shipped
//   current - B: still pixels, with drifting current bands, surface glints, falling streaks, foam
//   painted - A2: the water as one smooth watercolour shape with soft drifting light
// node .tmp/water/mock.mjs [seed]  -> .tmp/water/frames.raw + frames.json (sheet.py makes the GIF)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";

const repo = resolve(import.meta.dirname, "../..");
const seed = Number(process.argv[2] ?? 11);
const { createFallbackEngine } = compileApp("water-mock", ["engine.ts", "materials.ts"]).load("engine");
const { colorForCell } = loadRenderer("water-mock-r");
const { washAt } = compileApp("water-mock-w", ["rendering/nightWash.ts", "materials.ts"]).load("rendering/nightWash");

const W = 96, H = 56, S = 4, WARM = 320, FRAMES = 80, STEP = 2;
const e = createFallbackEngine(W, H, seed);
const p = (x, y, r, m) => e.paint(x, y, r, m, 100);
for (let x = 4; x <= 40; x++) p(x, 20, 0, M.Wall);          // the shelf
for (let y = 15; y <= 20; y++) p(4, y, 0, M.Wall);           // its back lip
for (let x = 30; x <= 90; x++) p(x, 52, 0, M.Wall);          // basin floor
for (let y = 36; y <= 52; y++) { p(30, y, 0, M.Wall); p(90, y, 0, M.Wall); }
for (let x = 60; x <= 66; x++) for (let y = 44; y <= 50; y++) p(x, y, 0, M.Stone); // a rock in the pond
const pour = (t) => { if (t % 3 === 0) p(12, 8, 1, M.Water); };

const hash = (x, y) => { let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519); h ^= h >>> 13; return (Math.imul(h, 1274126177) >>> 0); };
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const PW = W * S, PH = H * S, PANELS = 3;
const out = Buffer.alloc(FRAMES * PANELS * PW * PH * 3);

let t = 0;
for (let f = 0; f < FRAMES; f++) {
  const target = WARM + f * STEP;
  while (t < target) { t++; pour(t); e.tick(); }
  const cells = e.getCellBytes();
  const kind = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 255 : cells[(y * W + x) * 8]);
  const isWater = (x, y) => kind(x, y) === M.Water;
  const ms = t * 50;
  const base = new Array(W * H), cur = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 8;
    const k = cells[o];
    let rgb = k === M.Air ? washAt(x, y) : colorForCell({ kind: k, variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
      energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: ms, cells, width: W, height: H, x, y });
    base[y * W + x] = rgb;
    if (k !== M.Water) { cur[y * W + x] = rgb; continue; }
    // B: what a cell is doing, read from its neighbours only.
    const surface = !isWater(x, y - 1);
    const below = kind(x, y + 1);
    const falling = below === M.Air || (!isWater(x - 1, y) && !isWater(x + 1, y) && kind(x, y + 2) === M.Air);
    const landing = !falling && surface && isWater(x, y - 1) === false && [-1, 0, 1].some((d) => isWater(x + d, y - 2) && kind(x + d, y - 1) !== M.Wall);
    let c = rgb;
    if (falling) {
      // Streaks that run DOWN the stream, one bright dash per column phase.
      const ph = (y - Math.floor(ms / 60) + (hash(x, 0) % 7)) % 6;
      c = mix(c, [205, 238, 255], ph === 0 ? 0.5 : ph === 1 ? 0.25 : 0);
    } else if (surface) {
      // Glints that travel along the surface.
      const ph = ((x - Math.floor(ms / 140)) % 13 + 13) % 13;
      if (ph < 2) c = mix(c, [235, 248, 255], ph === 0 ? 0.55 : 0.3);
      if (landing) c = mix(c, [240, 250, 255], 0.6);
    } else {
      // Calm the per-cell speckle so the body is one tone, then slow slanted current bands
      // drift sideways through it, darker with depth.
      const dd = Math.min(8, (() => { let d = 0; while (isWater(x, y - d - 1)) d++; return d; })());
      c = mix(c, mix([78, 146, 228], [42, 92, 176], dd / 8), 0.6);
      const wob = Math.sin(y * 0.7 + x * 0.15 + ms * 0.0018) * 1.6;
      const band = ((Math.floor((x + y * 0.5 + wob + ms / 220) / 3) % 4) + 4) % 4;
      if (band === 0) c = mix(c, [160, 212, 252], 0.3);
      else if (band === 2) c = mix(c, [24, 60, 120], 0.22);
    }
    cur[y * W + x] = c;
  }

  // A2: the water mask, smoothed at pixel scale and thresholded into one soft shape.
  const mask = new Float32Array(PW * PH);
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) mask[py * PW + px] = isWater(Math.floor(px / S), Math.floor(py / S)) ? 1 : 0;
  const blur = (src, r) => {
    const tmp = new Float32Array(src.length), dst = new Float32Array(src.length), n = 2 * r + 1;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { let s = 0; for (let d = -r; d <= r; d++) s += src[y * PW + Math.min(PW - 1, Math.max(0, x + d))]; tmp[y * PW + x] = s / n; }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { let s = 0; for (let d = -r; d <= r; d++) s += tmp[Math.min(PH - 1, Math.max(0, y + d)) * PW + x]; dst[y * PW + x] = s / n; }
    return dst;
  };
  const soft = blur(blur(mask, 3), 2);
  // Depth below the surface, in cells, for the wash's gradient.
  // Smoothed at pixel scale, so a jagged surface does not stripe the body column by column.
  const depthPx = new Float32Array(PW * PH);
  for (let px = 0; px < PW; px++) { let d = 0; for (let py = 0; py < PH; py++) { d = mask[py * PW + px] ? d + 1 : 0; depthPx[py * PW + px] = Math.min(8 * S, d); } }
  const depth = blur(blur(depthPx, 6), 4);

  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    const x = Math.floor(px / S), y = Math.floor(py / S);
    const write = (panel, rgb) => { const o = (((f * PANELS + panel) * PH + py) * PW + px) * 3; for (let i = 0; i < 3; i++) out[o + i] = Math.max(0, Math.min(255, Math.round(rgb[i]))); };
    write(0, base[y * W + x]);
    write(1, cur[y * W + x]);
    // The painted panel keeps every non-water pixel, and paints water over it.
    let rgb = isWater(x, y) ? washAt(x, y) : base[y * W + x];
    const a = soft[py * PW + px];
    if (a > 0.32) {
      const d = Math.min(8, depth[py * PW + px] / S);
      let w = mix([92, 152, 222], [38, 78, 150], d / 8);
      // Soft drifting light inside the body, a wash rather than cells.
      const lx = Math.sin(px * 0.045 + ms * 0.0011) + Math.sin(py * 0.07 - ms * 0.0007 + px * 0.02);
      w = mix(w, [150, 200, 245], Math.max(0, lx - 0.9) * 0.35);
      // Lit rim on the top edge: where the shape fades going UP.
      const up = soft[Math.max(0, py - 3) * PW + px];
      if (up < 0.32) w = mix(w, [190, 228, 255], 0.55);
      // A wet, slightly darker tide line round the edge, as a watercolour dries.
      if (a < 0.5) w = mix(w, [30, 60, 120], 0.35);
      const k = Math.min(1, (a - 0.32) / 0.12);
      rgb = mix(rgb, w, 0.92 * k);
    }
    write(2, rgb);
  }
}
writeFileSync(resolve(repo, ".tmp/water/frames.raw"), out);
writeFileSync(resolve(repo, ".tmp/water/frames.json"), JSON.stringify({ PW, PH, FRAMES, PANELS, labels: ["Today", "B: currents (pixels)", "A2: painted"], fps: 1000 / (STEP * 50) }));
console.log("frames", FRAMES, PW, "x", PH, "ticks", WARM, "to", t);
