// Scratch: oil thins only when it moves out of a crowd (OIL_CROWD oil neighbours or more).
// Applied to the working tree's engine.ts copy. node .tmp/lava/crowd.mjs <crowd>
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const crowd = Number(process.argv[2] ?? 2);
const repo = resolve(import.meta.dirname, "../.."), root = resolve(repo, `.tmp/lava/root-crowd${crowd}`);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
const f = "        if (this.chance(OIL_THINS)) {";
if (src.split(f).length !== 2) throw new Error("anchor");
src = src.replace(f, `        if (this.neighbors(x, y).filter((n) => old[n] === MATERIAL.Oil).length >= ${crowd} && this.chance(OIL_THINS)) {`);
writeFileSync(resolve(root, "app/src/engine.ts"), src); copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const app = compileApp(`crowd${crowd}`, ["engine.ts", "materials.ts"], { root });
const M = app.load("materials").MATERIAL, { createFallbackEngine: create } = app.load("engine");
const count = (e) => { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === M.Oil) n++; return n; };
const open = [];
for (let s = 0; s < 4; s++) {
  const e = create(80, 40, 11 + s), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
  for (let x = 0; x < 80; x++) p(x, 36, 1, M.Wall); p(40, 30, 4, M.Oil);
  const at = []; for (let t = 1; t <= 1200; t++) { e.tick(); if ([100, 200, 600, 1200].includes(t)) at.push(count(e)); }
  open.push(at.join(","));
}
const e = create(40, 30, 5), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
for (let x = 0; x < 40; x++) p(x, 28, 1, M.Wall); for (let y = 10; y <= 28; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
let painted = 0; for (let t = 1; t <= 690; t++) { if (t <= 90 && t % 3 === 1) { const b = count(e); p(20, 4, 4, M.Oil); painted += count(e) - b; } e.tick(); }
const W = 220, H = 140, sp = create(W, H, 3), q = (x, y, r, m) => sp.paint(x, y, r, m, 100);
for (let x = 0; x < W; x++) q(x, H - 2, 1, M.Wall); q(110, 100, 4, M.Wellspring); for (let t = 0; t < 5; t++) sp.tick(); q(110, 94, 1, M.Oil);
const spring = []; let t = 0; for (const at of [4000, 8000, 16000]) { while (t < at) { sp.tick(); t++; } spring.push(`${((100 * count(sp)) / (W * H)).toFixed(1)}%`); }
console.log(`crowd>=${crowd}: open dab of 49 at 5,10,30,60 s: ${open.join("  ")} | basin pour ${painted} -> ${count(e)} | spring ${spring.join(" ")}`);
