// Scratch: a watered bed's heads over time, today vs the big-head mock.
// node .tmp/bighead/arc.mjs <root|-> [seeds=4] [reachUp] [reachSide]   (- = working tree)
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, STRIDE, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [rootArg = "-", seedsArg = "4", upArg = "10", sideArg = "6"] = process.argv.slice(2);
const root = rootArg === "-" ? undefined : resolve(repo, rootArg);
const make = compileApp("bh-arc-" + rootArg.replace(/\W/g, ""), ["engine.ts", "materials.ts"], root ? { root } : {}).load("engine").createFallbackEngine;
const W = 220, H = 48, T = 9600, UP = Number(upArg), SIDE = Number(sideArg), seeds = Number(seedsArg), sum = {};
let crownsSeen = 0;
for (let s = 1; s <= seeds; s++) {
  const e = make(W, H, s * 1009);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 4; x <= 215; x++) p(x, 40, 3, M.Soil, 55);
  for (let x = 8; x <= 212; x += 7) p(x, 35, 0, M.Seed);
  for (let x = 6; x <= 214; x += 4) p(x, 30, 1, M.Water);
  for (let x = 1; x < W; x += 3) p(x, H - FLOOR_FROM_BOTTOM, 1, 1);
  for (let t = 1; t <= T; t++) {
    e.tick();
    if (t % 600) continue;
    const c = e.getCellBytes();
    let flower = 0, heads = 0, buds = 0, biggest = 0;
    for (let i = 0; i < W * H; i++) {
      if (c[i * STRIDE] !== M.Flower) continue;
      flower++;
      if (!(c[i * STRIDE + 6] & F.Rooted)) continue;
      const x = i % W, y = (i / W) | 0, v = c[i * STRIDE + 1];
      let n = 0;
      for (let dy = -UP; dy <= 1; dy++) for (let dx = -SIDE; dx <= SIDE; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && c[(yy * W + xx) * STRIDE] === M.Flower && c[(yy * W + xx) * STRIDE + 1] === v) n++; }
      if (n >= 5) heads++; else buds++;
      biggest = Math.max(biggest, n);
    }
    const r = (sum[t] ??= { flower: 0, heads: 0, buds: 0, biggest: 0 });
    r.flower += flower; r.heads += heads; r.buds += buds; r.biggest = Math.max(r.biggest, biggest);
  }
}
const mmss = (t) => `${Math.floor(t / 1200)}:${String(Math.round((t % 1200) / 20)).padStart(2, "0")}`;
console.log(`${rootArg}, ${seeds} beds, mean per bed (head = crown with 5+ cells of its kind in reach)`);
for (const [t, r] of Object.entries(sum)) console.log(`${mmss(Number(t)).padStart(5)}  flower cells ${(r.flower / seeds).toFixed(0).padStart(5)}  open heads ${(r.heads / seeds).toFixed(1).padStart(5)}  crowns not open ${(r.buds / seeds).toFixed(1).padStart(5)}  biggest head ${r.biggest}`);
