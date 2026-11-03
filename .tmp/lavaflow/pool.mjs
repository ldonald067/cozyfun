// Scratch: lava basin pour (lava/stone at 10,30,50,75 s) and a lava spring's hill, per variant.
// node .tmp/lavaflow/pool.mjs <mode> [k]
import { build } from "./variant.mjs";
const [mode = "live", k = "4"] = process.argv.slice(2);
const { create, M, name } = build(mode, Number(k));
const count = (e, kd) => { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === kd) n++; return n; };
const pour = [];
for (let s = 0; s < 4; s++) {
  const e = create(40, 30, 5 + s), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
  for (let x = 0; x < 40; x++) p(x, 28, 1, M.Wall); for (let y = 10; y <= 28; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
  let painted = 0; const at = [];
  for (let t = 1; t <= 1500; t++) { if (t <= 90 && t % 3 === 1) { const b = count(e, M.Lava); p(20, 4, 4, M.Lava); painted += count(e, M.Lava) - b; } e.tick(); if ([200, 600, 1000, 1500].includes(t)) at.push(`${count(e, M.Lava)}/${count(e, M.Stone)}`); }
  pour.push(`${painted}->${at.join(",")}`);
}
const W = 220, H = 140, sp = create(W, H, 3), q = (x, y, r, m) => sp.paint(x, y, r, m, 100);
for (let x = 0; x < W; x++) q(x, H - 2, 1, M.Wall); q(110, 100, 4, M.Wellspring); for (let t = 0; t < 5; t++) sp.tick(); q(110, 94, 1, M.Lava);
const spring = []; let t = 0; for (const at of [1000, 4000, 8000, 16000]) { while (t < at) { sp.tick(); t++; } spring.push(`t${at} lava ${(100 * count(sp, M.Lava) / (W * H)).toFixed(1)}% stone ${count(sp, M.Stone)} (${(100 * count(sp, M.Stone) / (W * H)).toFixed(1)}%)`); }
console.log(`== ${name}\n  basin pour (lava/stone at 10,30,50,75s): ${pour.join("  ")}\n  spring: ${spring.join("  ")}`);
