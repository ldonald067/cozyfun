// Scratch: what a painted, watered bed grows. Per plant: stalk height, leaves, head cells.
// node .tmp/garden/measure.mjs [root] [seeds] [ticks,...]   root = engine tree (default: working tree)
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, STRIDE, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [rootArg, seedsArg = "8", ticksArg = "1500,3000,5000"] = process.argv.slice(2);
const root = rootArg && rootArg !== "-" ? resolve(repo, rootArg) : undefined;
const make = compileApp("garden-" + (rootArg ?? "live").replace(/\W/g, ""), ["engine.ts", "materials.ts"], root ? { root } : {}).load("engine").createFallbackEngine;
const KIND = process.env.KIND ?? "tidy";
const W = 220, H = KIND === "brush" ? 140 : 48;
// interaction-scenes' wideMeadow: a play-width bed, a seed every seven cells, one watering.
const paint = KIND === "brush" ? (p) => {
  for (let x = 30; x <= 190; x += 2) { p(x, 128, 4, M.Soil, 55); p(x, 124, 4, M.Soil, 55); }
  for (let x = 40; x <= 180; x += 3) p(x, 112, 4, M.Seed, 55);
  for (let x = 40; x <= 180; x += 6) p(x, 80, 4, M.Water, 100);
} : (p) => {
  for (let x = 4; x <= 215; x++) p(x, 40, 3, M.Soil, 55);
  for (let x = 8; x <= 212; x += 7) p(x, 35, 0, M.Seed);
  for (let x = 6; x <= 214; x += 4) p(x, 30, 1, M.Water);
};
const ticks = ticksArg.split(",").map(Number);
const rows = Object.fromEntries(ticks.map((t) => [t, []]));
for (let s = 1; s <= Number(seedsArg); s++) {
  const e = make(W, H, s * 1009);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  paint(p);
  for (let x = 1; x < W; x += 3) p(x, H - FLOOR_FROM_BOTTOM, 1, 1);
  for (let t = 1; t <= ticks.at(-1); t++) {
    e.tick();
    if (!rows[t]) continue;
    const c = e.getCellBytes();
    const k = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : c[(y * W + x) * STRIDE]);
    // A plant: a column of Stem whose bottom stands on the bed. Walk up from each stalk base.
    for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
      if (k(x, y) !== M.Stem || k(x, y - 1) === undefined) continue;
      const under = k(x, y + 1);
      if (under === M.Stem || under === M.Empty || under === M.Flower) continue;
      // base found; leaves sit beside it, so require a stalk above or a head
      let top = y; while (k(x, top - 1) === M.Stem) top--;
      const height = y - top + 1;
      let leaves = 0;
      for (let yy = top; yy <= y; yy++) for (const dx of [-1, 1]) if (k(x + dx, yy) === M.Stem && k(x + dx, yy + 1) !== M.Stem) leaves++;
      const crown = k(x, top - 1) === M.Flower;
      let head = 0;
      if (crown) for (let dy = -6; dy <= 1; dy++) for (let dx = -4; dx <= 4; dx++) if (k(x + dx, top - 1 + dy) === M.Flower) head++;
      // skip a leaf mistaken as a base: a leaf has a stalk beside it
      if (height === 1 && (k(x - 1, y) === M.Stem || k(x + 1, y) === M.Stem) && !crown) continue;
      rows[t].push({ s, x, height, leaves, crown, head, variant: c[((top) * W + x) * STRIDE + 1] & 7 });
    }
  }
}
for (const t of ticks) {
  const r = rows[t];
  const hist = (f) => { const h = {}; for (const o of r) h[f(o)] = (h[f(o)] ?? 0) + 1; return JSON.stringify(h); };
  const n = r.length, seeds = Number(seedsArg);
  console.log(`t=${t} (${(t / 20).toFixed(0)} s): ${n} plants over ${seeds} beds (${(n / seeds).toFixed(1)}/bed of 30 seeds)`);
  console.log(`  stalk height ${hist((o) => o.height)}`);
  console.log(`  leaves       ${hist((o) => o.leaves)}`);
  console.log(`  bloomed ${r.filter((o) => o.crown).length}/${n}, head cells ${hist((o) => o.head)}`);
  console.log(`  by variant   ${hist((o) => o.variant)}`);
}
