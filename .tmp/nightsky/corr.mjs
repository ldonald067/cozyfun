// Scratch: half-correlation length (cells) of a Catmull-Rom value-noise octave at a given period,
// sampled like the mock (3.2 px a cell, every 8th row), to match the mock's measured 19.7/14.1/5.3.
import { compileApp } from "../../scripts/compile-app.mjs";
const hash = compileApp("nightsky-corr", ["rendering/hash.ts", "materials.ts"]).load("rendering/hash");
const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
const L = (s, i, j) => hash.hashCell(i, j, s) / 4294967296;
const row = (s, i, j, t) => cr(L(s, i - 1, j), L(s, i, j), L(s, i + 1, j), L(s, i + 2, j), t);
const f = (s, u, v, P) => { const x = u / P, y = v / P, i = Math.floor(x), j = Math.floor(y), tx = x - i; return cr(row(s, i, j - 1, tx), row(s, i, j, tx), row(s, i, j + 1, tx), row(s, i, j + 2, tx), y - j); };
for (const P of process.argv.slice(2).map(Number)) {
  const lens = [];
  for (const seed of [1, 2, 3, 5, 8, 13]) {
    const rows = [];
    for (let y = 0; y < 448; y += 8) { const r = []; for (let x = 0; x < 704; x++) r.push(f(seed, x / 3.2, y / 3.2, P)); rows.push(r); }
    const all = rows.flat(), m = all.reduce((a, b) => a + b) / all.length;
    const base = all.reduce((a, b) => a + (b - m) ** 2, 0) / all.length;
    for (let d = 1; d < 300; d += 2) {
      let c = 0, n = 0; for (const r of rows) for (let i = 0; i + d < r.length; i++) { c += (r[i] - m) * (r[i + d] - m); n++; }
      if (c / n / base < 0.5) { lens.push(d / 3.2); break; }
    }
  }
  lens.sort((a, b) => a - b);
  console.log(`period ${P}: half-correlation ${lens[3].toFixed(1)} cells`);
}
