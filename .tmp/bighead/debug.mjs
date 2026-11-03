import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, STRIDE, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
const root = resolve(import.meta.dirname, "m-big");
const make = compileApp("bh-debug", ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine;
const W = 220, H = 48;
const e = make(W, H, 1009);
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
for (let x = 4; x <= 215; x++) p(x, 40, 3, M.Soil, 55);
for (let x = 8; x <= 212; x += 7) p(x, 35, 0, M.Seed);
for (let x = 6; x <= 214; x += 4) p(x, 30, 1, M.Water);
for (let x = 1; x < W; x += 3) p(x, H - FLOOR_FROM_BOTTOM, 1, 1);
for (let t = 1; t <= 6000; t++) e.tick();
const c = e.getCellBytes();
const eng = e.engine ?? e;
for (let i = 0; i < W * H; i++) {
  if (c[i * STRIDE] !== M.Flower || !(c[i * STRIDE + 6] & F.Rooted)) continue;
  const x = i % W, y = (i / W) | 0;
  const age = c[i * STRIDE + 2] | (c[i * STRIDE + 3] << 8), energy = c[i * STRIDE + 4] | (c[i * STRIDE + 5] << 8);
  let why = "";
  try { why = eng.headInReach(x, y, c, c) ? "BLOCKED" : "free"; } catch (err) { why = "no access: " + err.message; }
  console.log(`crown (${x},${y}) v${c[i * STRIDE + 1]} age ${age} energy ${energy} flags ${c[i * STRIDE + 6]} ${why}`);
}
console.log(Object.keys(e).slice(0, 10));
