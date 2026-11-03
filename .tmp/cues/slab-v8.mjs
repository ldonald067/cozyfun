// Ice left in the audit's hot-water basin, and in a lava trough scene, old vs new, 8 seeds.
import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const BASE = process.env.BASE === "1";
const app = compileApp(BASE ? "slab-base" : "slab-v8", ["materials.ts", "engine.ts"], { root: resolve(".tmp/cues/var-melt8") });
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M } = app.load("materials");
const S = 8, count = (e, k) => { const a = e.getCellBytes(); let n = 0; for (let i = 0; i < a.length; i += S) if (a[i] === k) n++; return n; };
const basin = [], trough = [];
for (let seed = 1; seed <= 8; seed++) {
  let W = 30, H = 26, e = createFallbackEngine(W, H, seed + 164);
  let p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall);
  for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); }
  for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice);
  for (let x = 1; x < W; x += 3) p(x, H - 2, 1, M.Wall);
  const start = count(e, M.Ice); const at = [];
  for (let t = 1; t <= 400; t++) { if (t >= 20 && t < 200 && t % 4 === 0) p(15, 12, 3, M.Fire); e.tick(); if (t === 200 || t === 400) at.push(count(e, M.Ice)); }
  basin.push(`${start}->${at.join("->")}`);
  // Lava held in a wall trough; an ice block against the trough's outer wall.
  W = 40; H = 30; e = createFallbackEngine(W, H, seed + 165);
  p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 4; x <= 36; x++) p(x, 25, 0, M.Wall);
  for (let y = 18; y <= 24; y++) { p(8, y, 0, M.Wall); p(18, y, 0, M.Wall); }
  for (let x = 20; x <= 26; x += 2) for (let y = 20; y <= 23; y += 2) p(x, y, 0, M.Ice);
  for (let x = 1; x < W; x += 3) p(x, H - 2, 1, M.Wall);
  const s2 = count(e, M.Ice); const at2 = [];
  for (let t = 1; t <= 600; t++) { if (t < 60 && t % 6 === 0) p(13, 14, 1, M.Lava, 70); e.tick(); if (t === 200 || t === 600) at2.push(count(e, M.Ice)); }
  trough.push(`${s2}->${at2.join("->")}`);
}
console.log(`${BASE ? "OLD" : "NEW"} basin ice (start->t200->t400): ${basin.join("  ")}`);
console.log(`${BASE ? "OLD" : "NEW"} trough ice (start->t200->t600): ${trough.join("  ")}`);
