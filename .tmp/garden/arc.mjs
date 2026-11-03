// Scratch: a garden's bloom over time. Flower cells and open heads (crown + >=4 petals) per 20 s.
// node .tmp/garden/arc.mjs <tidy|brush> [seeds] [ticks] [root]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, STRIDE, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [kind = "tidy", seedsArg = "6", ticksArg = "8000", rootArg] = process.argv.slice(2);
const root = rootArg ? resolve(repo, rootArg) : undefined;
const make = compileApp("arc-" + (rootArg ?? "live").replace(/\W/g, ""), ["engine.ts", "materials.ts"], root ? { root } : {}).load("engine").createFallbackEngine;
const W = 220, H = kind === "brush" ? 140 : 48;
const scenes = {
  // interaction-scenes' wideMeadow
  tidy: (p) => {
    for (let x = 4; x <= 215; x++) p(x, 40, 3, M.Soil, 55);
    for (let x = 8; x <= 212; x += 7) p(x, 35, 0, M.Seed);
    for (let x = 6; x <= 214; x += 4) p(x, 30, 1, M.Water);
  },
  // the app's brush (radius 4, powders at 55): a soil stroke, a seed stroke over it, a watering
  brush: (p) => {
    for (let x = 30; x <= 190; x += 2) { p(x, 128, 4, M.Soil, 55); p(x, 124, 4, M.Soil, 55); }
    for (let x = 40; x <= 180; x += 3) p(x, 112, 4, M.Seed, 55);
    for (let x = 40; x <= 180; x += 6) p(x, 80, 4, M.Water, 100);
  },
};
const T = Number(ticksArg), seeds = Number(seedsArg), step = 400;
const sum = {};
for (let s = 1; s <= seeds; s++) {
  const e = make(W, H, s * 1009);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  scenes[kind](p);
  for (let x = 1; x < W; x += 3) p(x, H - FLOOR_FROM_BOTTOM, 1, 1);
  for (let t = 1; t <= T; t++) {
    e.tick();
    if (t % step) continue;
    const c = e.getCellBytes();
    let flower = 0, heads = 0, stem = 0, seed = 0;
    for (let i = 0; i < W * H; i++) {
      const k = c[i * STRIDE];
      if (k === M.Stem) stem++;
      if (k === M.Seed) seed++;
      if (k !== M.Flower) continue;
      flower++;
      if (!(c[i * STRIDE + 6] & F.Rooted)) continue;
      const x = i % W, y = (i / W) | 0;
      let n = 0;
      for (let dy = -4; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && c[(yy * W + xx) * STRIDE] === M.Flower) n++;
      }
      if (n >= 5) heads++;
    }
    const r = (sum[t] ??= { flower: 0, heads: 0, stem: 0, seed: 0 });
    r.flower += flower; r.heads += heads; r.stem += stem; r.seed += seed;
  }
}
console.log(`${kind}, ${seeds} beds, mean per bed`);
for (const [t, r] of Object.entries(sum)) console.log(`${String(t / 20).padStart(4)} s  flower ${(r.flower / seeds).toFixed(0).padStart(4)}  open heads ${(r.heads / seeds).toFixed(1).padStart(5)}  stem ${(r.stem / seeds).toFixed(0).padStart(4)}  seed ${(r.seed / seeds).toFixed(0)}`);
