// Scratch: colorForCell cost, a board half lava and a quarter vapour, base vs build.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../.."), W = 220, H = 140;
for (let round = 0; round < 2; round++) for (const [label, root] of [["main", resolve(repo, ".tmp/heat2/base")], ["build", repo]]) {
  const app = compileApp("hperf-" + label, ["rendering/materialColor.ts", "materials.ts"], { root });
  const { colorForCell } = app.load("rendering/materialColor"); const { MATERIAL } = app.load("materials");
  const cells = new Uint8Array(W * H * 8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8; cells[o] = y > 70 ? MATERIAL.Lava : y > 35 ? MATERIAL.Smoke : y > 25 ? MATERIAL.Fire : 0; cells[o + 1] = (x * 7 + y * 3) & 255; cells[o + 2] = (x + y) & 127; }
  const frame = (time) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8; colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2], energy: 0, flags: 0, time, cells, width: W, height: H, x, y }); } };
  for (let i = 0; i < 30; i++) frame(i * 50);
  const t0 = performance.now(); for (let i = 0; i < 100; i++) frame(i * 50);
  console.log(label.padEnd(6), ((performance.now() - t0) / 100).toFixed(2), "ms per frame");
}
