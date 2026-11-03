// Scratch: each species' plain head outline against each wash tone, at a given ring opacity.
// node .tmp/nightsky/rings.mjs  (reads the current working tree)
import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("nightsky-rings", ["rendering/materialColor.ts", "materials.ts"]);
const { colorForCell } = app.load("rendering/materialColor");
const { washAt } = app.load("rendering/nightWash");
const { MATERIAL } = app.load("materials");
const redmean = ([r1, g1, b1], [r2, g2, b2]) => { const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2; return Math.round(Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)); };
const tones = []; for (let y = 0; y < 140; y++) for (let x = 0; x < 220; x++) tones.push(washAt(x, y));
const W = 5, H = 5;
const names = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
for (let v = 0; v < 8; v++) {
  const cells = new Uint8Array(W * H * 8);
  const o = (2 * W + 2) * 8; cells[o] = MATERIAL.Flower; cells[o + 1] = v; cells[o + 4] = 90; // a loose petal, energy 90
  const ringOn = (night) => colorForCell({ kind: 0, variant: 0, age: 0, energy: 0, flags: 0, time: 0, cells, width: W, height: H, x: 2, y: 1, backdrop: night });
  const ds = tones.map((t) => redmean(ringOn(t), t)).sort((a, b) => a - b);
  const below = ds.filter((d) => d < 110).length / ds.length;
  console.log(`${names[v].padEnd(10)} ring vs wash: worst ${ds[0]}, p10 ${ds[Math.floor(ds.length * 0.1)]}, median ${ds[ds.length >> 1]}; under 110 on ${(below * 100).toFixed(1)}% of the board;  vs old night ${redmean(ringOn([9, 14, 20]), [9, 14, 20])}`);
}
