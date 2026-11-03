// Scratch: measure one Catmull-Rom octave's sd over a uniform lattice (the LATTICE_SD constant).
import { compileApp } from "../../scripts/compile-app.mjs";
const hash = compileApp("nightsky-sd", ["rendering/hash.ts", "materials.ts"]).load("rendering/hash");
const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
const L = (s, i, j) => hash.hashCell(i, j, s) / 4294967296;
const row = (s, i, j, t) => cr(L(s, i - 1, j), L(s, i, j), L(s, i + 1, j), L(s, i + 2, j), t);
let n = 0, sum = 0, sq = 0;
for (const seed of [1, 2, 3, 7, 11]) for (let k = 0; k < 200000; k++) {
  const x = ((k * 0.618034) % 1) * 300 + seed * 17, y = ((k * 0.7548777) % 1) * 300;
  const i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
  const v = cr(row(seed, i, j - 1, tx), row(seed, i, j, tx), row(seed, i, j + 1, tx), row(seed, i, j + 2, tx), ty);
  n++; sum += v; sq += v * v;
}
const mean = sum / n;
console.log({ n, mean: mean.toFixed(4), sd: Math.sqrt(sq / n - mean * mean).toFixed(4) });
