// Scratch: colorForCell cost on 220x140, two thirds one solid, base vs build. Rests on the sim's byte layout.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../.."), W = 220, H = 140;
const rows = {};
for (let round = 0; round < 3; round++) for (const [label, root] of [["main", resolve(repo, ".tmp/solids/base")], ["build", repo]]) {
  const app = compileApp("sperf-" + label, ["rendering/materialColor.ts", "materials.ts"], { root });
  const { colorForCell } = app.load("rendering/materialColor"); const { MATERIAL } = app.load("materials");
  for (const name of ["Stone", "Sand", "Soil", "Wood", "Ice", "Wall", "Glass"]) {
    const cells = new Uint8Array(W * H * 8);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8; cells[o] = y > H / 3 ? MATERIAL[name] : 0; cells[o + 1] = (x * 7 + y * 3) & 7; }
    const frame = (time) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8; if (cells[o]) colorForCell({ kind: cells[o], variant: cells[o + 1], age: 0, energy: 0, flags: 0, time, cells, width: W, height: H, x, y }); } };
    for (let i = 0; i < 20; i++) frame(i * 50);
    const t0 = performance.now(); for (let i = 0; i < 60; i++) frame(i * 50);
    if (round) (rows[name] ??= {})[label] = Math.min(rows[name][label] ?? 99, (performance.now() - t0) / 60);
  }
}
for (const [name, r] of Object.entries(rows)) console.log(name.padEnd(7), "main", r.main.toFixed(2).padStart(6), "build", r.build.toFixed(2).padStart(6), "ms a frame");
