// Scratch: a spent garden given water at 5:00, over time. node .tmp/garden/rearc.mjs <today|drink|turnover> <rewater|rain> [seeds=4]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, STRIDE, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [variant, mode, seedsArg = "4"] = process.argv.slice(2);
const root = resolve(repo, `.tmp/garden/r-${variant}`);
const make = compileApp(`rearc-${variant}`, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine;
const W = 220, H = 48, T = 12000, WATER_AT = 6000;
const water = (p, y = 30) => { for (let x = 6; x <= 214; x += 4) p(x, y, 1, M.Water); };
export const act = (p, t) => {
  if (mode === "rewater" && t === WATER_AT) water(p, 6); // poured from above the plants
  // the rain-desk room at intensity 1: a radius-1 dab at density 22 about every 240 ticks
  if (mode === "rain" && t >= WATER_AT && t % 240 === 0) p(2 + ((t * 7919) % 216), 1, 1, M.Water, 22);
};
const seeds = Number(seedsArg), sum = {};
for (let s = 1; s <= seeds; s++) {
  const e = make(W, H, s * 1009);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 4; x <= 215; x++) p(x, 40, 3, M.Soil, 55);
  for (let x = 8; x <= 212; x += 7) p(x, 35, 0, M.Seed);
  water(p);
  for (let x = 1; x < W; x += 3) p(x, H - FLOOR_FROM_BOTTOM, 1, 1);
  for (let t = 1; t <= T; t++) {
    act(p, t); e.tick();
    if (t < 5400 || t % 600) continue;
    const c = e.getCellBytes();
    let flower = 0, heads = 0, stem = 0, seed = 0;
    for (let i = 0; i < W * H; i++) {
      const k = c[i * STRIDE];
      if (k === M.Stem) stem++; else if (k === M.Seed) seed++;
      if (k !== M.Flower) continue;
      flower++;
      if (!(c[i * STRIDE + 6] & F.Rooted)) continue;
      const x = i % W, y = (i / W) | 0; let n = 0;
      for (let dy = -5; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && c[(yy * W + xx) * STRIDE] === M.Flower) n++; }
      if (n >= 5) heads++;
    }
    const r = (sum[t] ??= { flower: 0, heads: 0, stem: 0, seed: 0 });
    r.flower += flower; r.heads += heads; r.stem += stem; r.seed += seed;
  }
}
const mmss = (t) => `${Math.floor(t / 1200)}:${String(Math.round((t % 1200) / 20)).padStart(2, "0")}`;
console.log(`${variant} / ${mode}, ${seeds} beds, mean per bed`);
for (const [t, r] of Object.entries(sum)) console.log(`${mmss(Number(t)).padStart(5)}  flower ${(r.flower / seeds).toFixed(0).padStart(4)}  open heads ${(r.heads / seeds).toFixed(1).padStart(5)}  stem ${(r.stem / seeds).toFixed(0).padStart(4)}  seed ${(r.seed / seeds).toFixed(0)}`);
