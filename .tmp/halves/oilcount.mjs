import { M, jsEngine, grid } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
for (const [name, paint] of [
  ["slick+water on soil", (p) => { p(15, 20, 4, M.Soil); for (let x = 9; x <= 21; x++) p(x, 16, 0, M.Oil); p(15, 11, 3, M.Water); }],
  ["slick on soil, no water", (p) => { p(15, 20, 4, M.Soil); for (let x = 9; x <= 21; x++) p(x, 16, 0, M.Oil); }],
  ["slick+water on wall", (p) => { for (let x = 5; x <= 25; x++) p(x, 19, 1, M.Wall); for (let x = 9; x <= 21; x++) p(x, 16, 0, M.Oil); p(15, 11, 3, M.Water); }],
]) {
  const u = engine.create(30, 26, 63); paint((x, y, r, m, d = 100) => u.paint(x, y, r, m, d));
  for (let x = 1; x < 30; x += 3) u.paint(x, 22, 1, M.Wall, 100);
  const out = [];
  for (let t = 0; t <= 60; t++) { if (t % 6 === 0) { const g = grid(u.view(), 30, 26); out.push(`${t}:${g.count(M.Oil)}/${g.count(M.Water)}`); } u.tick(); }
  console.log(name.padEnd(26), out.join(" ")); u.free();
}
