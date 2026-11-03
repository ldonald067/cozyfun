// Which of a head's listed petals ever open, for a crown on a real stalk, over many seeds.
import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const root = process.argv[2] ? { root: resolve(process.argv[2]) } : {};
const app = compileApp("petal-probe" + (process.argv[2] ? "-v" : ""), ["materials.ts", "engine.ts"], root);
const { createFallbackEngine, BLOOM_SHAPES } = app.load("engine");
const { MATERIAL: M } = app.load("materials");
const W = 40, H = 30, S = 8, variant = Number(process.argv[3] ?? 3), N = 24;
const shape = BLOOM_SHAPES[variant];
const opened = shape.map(() => 0);
for (let seed = 1; seed <= N; seed++) {
  const e = createFallbackEngine(W, H, seed);
  const b = e.getCellBytes();
  const put = (x, y, kind, energy, flags, age = 20) => { const o = (y * W + x) * S; b[o] = kind; b[o + 1] = variant; b[o + 2] = age; b[o + 4] = energy & 255; b[o + 5] = energy >> 8; b[o + 6] = flags; };
  for (let x = 0; x < W; x++) put(x, 28, M.Wall, 0, 0);
  put(20, 27, M.Soil, 120, 1);
  for (let y = 21; y <= 26; y++) put(20, y, M.Stem, 20, y === 26 ? 2 : 0);
  put(20, 20, M.Flower, 200, 2);
  e.loadCellBytes(b);
  const seen = shape.map(() => false);
  for (let t = 0; t < 2000; t++) {
    e.tick();
    const a = e.getCellBytes();
    shape.forEach(([dx, dy], k) => { if (a[((20 + dy) * W + 20 + dx) * S] === M.Flower) seen[k] = true; });
  }
  seen.forEach((v, k) => { if (v) opened[k]++; });
}
console.log(shape.map(([dx, dy], k) => `(${dx},${dy}):${opened[k]}`).join(" "), `of ${N}`);
