// Scratch: per-frame renderer cost of a bed in full bloom, today (24 small heads at once) vs big
// heads (24 plants nine apart, every other one open, the rest buds), all cells including air.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../..");
const W = 220, H = 140;
for (const [label, root, everyOther] of [["today", resolve(repo, ".tmp/bighead/base"), false], ["big", repo, true]]) {
  const app = compileApp("bhperf-" + label, ["rendering/materialColor.ts", "materials.ts", "engine.ts"], { root });
  const { colorForCell } = app.load("rendering/materialColor"); const { MATERIAL } = app.load("materials");
  const SHAPES = app.load("engine").BLOOM_SHAPES;
  const cells = new Uint8Array(W * H * 8);
  const put = (x, y, k, v, e, f, age) => { const o = (y * W + x) * 8; cells[o] = k; cells[o + 1] = v; cells[o + 2] = age & 255; cells[o + 3] = age >> 8; cells[o + 4] = e & 255; cells[o + 5] = e >> 8; cells[o + 6] = f; };
  for (let x = 0; x < W; x++) { put(x, 130, MATERIAL.Soil, 0, 120, 1, 0); put(x, 131, MATERIAL.Wall, 0, 0, 0, 0); }
  let flowers = 0;
  for (let p = 0; p < 24; p++) {
    const x = 8 + p * 9, v = p & 7, cy = 121;
    for (let y = 122; y < 130; y++) put(x, y, MATERIAL.Stem, v, 20, y === 129 ? 2 : 0, 0);
    put(x, cy, MATERIAL.Flower, v, 95, 2, 200); flowers++;
    if (everyOther && p % 2) continue;
    for (const [dx, dy] of SHAPES[v]) { put(x + dx, cy + dy, MATERIAL.Flower, v, 90, 0, 180); flowers++; }
  }
  const frame = (time) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8;
    colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6], time, cells, width: W, height: H, x, y }); } };
  for (let i = 0; i < 20; i++) frame(i);
  const t0 = performance.now(); for (let i = 0; i < 100; i++) frame(i * 50); const ms = (performance.now() - t0) / 100;
  console.log(label.padEnd(6), `${flowers} flower cells, ${ms.toFixed(2)} ms per full-board frame`);
}
