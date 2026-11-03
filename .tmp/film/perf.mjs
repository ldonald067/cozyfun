// Per-frame renderer cost on a 220x140 board planted with 24 full heads, old (HEAD~1) vs new.
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../..");
const t = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8"), a = t.indexOf("const BLOOM_SHAPES");
const SHAPES = [...t.slice(t.indexOf("= [", a) + 3, t.indexOf("\n];", a)).matchAll(/^\s*\[((?:\s*\[-?\d+,\s*-?\d+\],?)+)\],\s*$/gm)]
  .map((m) => [...m[1].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)].map((q) => [Number(q[1]), Number(q[2])]));
const W = 220, H = 140;
for (const [label, root] of [["old", resolve(repo, ".tmp/film/base")], ["new", repo]]) {
  const app = compileApp("perf-" + label, ["rendering/materialColor.ts", "materials.ts"], { root });
  const { colorForCell } = app.load("rendering/materialColor"); const { MATERIAL } = app.load("materials");
  const cells = new Uint8Array(W * H * 8);
  const put = (x, y, k, v, e, f, age) => { const o = (y * W + x) * 8; cells[o] = k; cells[o + 1] = v; cells[o + 2] = age & 255; cells[o + 3] = age >> 8; cells[o + 4] = e & 255; cells[o + 5] = e >> 8; cells[o + 6] = f; };
  for (let x = 0; x < W; x++) { put(x, 130, MATERIAL.Soil, 0, 120, 1, 0); put(x, 131, MATERIAL.Wall, 0, 0, 0, 0); }
  let flowers = 0;
  for (let p = 0; p < 24; p++) {
    const x = 8 + p * 9, v = p & 7, cy = 123;
    for (let y = 124; y < 130; y++) put(x, y, MATERIAL.Stem, v, 20, y === 129 ? 2 : 0, 0);
    put(x, cy, MATERIAL.Flower, v, 95, 2, 200); flowers++;
    for (const [dx, dy] of SHAPES[v]) { put(x + dx, cy + dy, MATERIAL.Flower, v, 90, 0, 180); flowers++; }
  }
  const frame = (time) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8; if (!cells[o]) continue;
    colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6], time, cells, width: W, height: H, x, y }); } };
  for (let i = 0; i < 20; i++) frame(i);
  const t0 = performance.now(); for (let i = 0; i < 200; i++) frame(i * 50); const ms = (performance.now() - t0) / 200;
  console.log(label, `${flowers} flower cells, ${ms.toFixed(3)} ms per frame of non-empty cells`);
}
