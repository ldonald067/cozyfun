import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const BASE = process.env.BASE === "1";
const app = compileApp(BASE ? "foot-base" : "foot-now", ["materials.ts", "engine.ts"], BASE ? { root: resolve(import.meta.dirname, "base") } : {});
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M } = app.load("materials");
const W = 40, H = 34, S = 8;
for (const seed of (process.argv[2] ?? "2105").split(",").map(Number)) {
  const e = createFallbackEngine(W, H, seed);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water);
  for (let x = 1; x < W; x += 3) p(x, H - 2, 1, M.Wall);
  let sporeHops = 0;
  var ch = { [M.Empty]: ".", [M.Soil]: "s", [M.Moss]: "m", [M.Seed]: "o", [M.Stem]: "|", [M.Flower]: "*", [M.Pollen]: "'", [M.Water]: "~", [M.Wall]: "#", [M.Fungus]: "f" };
  for (let t = 1; t < 2500; t++) e.tick();
  for (let x = 16; x <= 24; x++) p(x, 22, 1, M.Empty);
  const frames = [];
  for (let t = 0; t < 12; t++) { e.tick(); if (t % 3 === 2) frames.push(e.getCellBytes().slice()); }
  const a = frames[0];
  const show = (a, label) => { console.log(label); for (let y = 14; y < 32; y++) { let row = ""; for (let x = 14; x < 28; x++) row += ch[a[(y * W + x) * S]] ?? "?"; console.log(String(y).padStart(2) + " " + row); } };
  var ch2 = { [M.Empty]: ".", [M.Soil]: "s", [M.Moss]: "m", [M.Seed]: "o", [M.Stem]: "|", [M.Flower]: "*", [M.Pollen]: "'", [M.Water]: "~", [M.Wall]: "#", [M.Fungus]: "f" };
  show(frames[0], `seed ${seed}, 3 ticks after the cut`); show(frames[3], "12 ticks after");
}
