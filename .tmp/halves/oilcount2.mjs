import { M, jsEngine, grid, loadWasmEngine } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const js = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const wasm = await loadWasmEngine();
const scenes = [
  ["basin, oil only", (p) => { for (let x = 5; x <= 25; x++) p(x, 20, 0, M.Wall); for (let y = 10; y <= 20; y++) { p(5, y, 0, M.Wall); p(25, y, 0, M.Wall); } for (let x = 9; x <= 21; x++) p(x, 16, 0, M.Oil); }],
  ["one blob of oil in basin", (p) => { for (let x = 5; x <= 25; x++) p(x, 20, 0, M.Wall); for (let y = 10; y <= 20; y++) { p(5, y, 0, M.Wall); p(25, y, 0, M.Wall); } p(15, 15, 2, M.Oil); }],
];
for (const [ename, engine] of [["js", js], ["wasm", wasm]]) for (const [name, paint] of scenes) {
  const u = engine.create(30, 26, 63); paint((x, y, r, m, d = 100) => u.paint(x, y, r, m, d));
  const out = [];
  for (let t = 0; t <= 120; t++) { if (t % 12 === 0) out.push(`${t}:${grid(u.view(), 30, 26).count(M.Oil)}`); u.tick(); }
  console.log(ename.padEnd(5), name.padEnd(26), out.join(" ")); u.free();
}
