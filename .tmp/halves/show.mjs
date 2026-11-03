// Scratch: play a c-b3 candidate on the JS mirror and print the board at given ticks.
// node .tmp/halves/show.mjs <module> <label> <seed k> <tick,tick,...>
import { resolve } from "node:path";
import { M, jsEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const [mod, label, k = "0", at = "1"] = process.argv.slice(2);
const { CANDIDATES } = await import(resolve(mod));
const c = CANDIDATES.find((x) => x.label === label);
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const ch = { [M.Empty]: ".", [M.Wall]: "#", [M.Stone]: "S", [M.Wood]: "W", [M.Ember]: "e", [M.Fire]: "f", [M.Rocket]: "r", [M.Smoke]: "~", [M.Spark]: "*", [M.Stardust]: "+", [M.Steam]: "'", [M.Water]: "w", [M.Soil]: "o", [M.Moss]: "m" };
const ticks = new Set(at.split(",").map(Number));
let t = 0;
runCheck({ ...c, seed: c.seed + Number(k) * 1000, outcome: (g, before, memo, prev) => {
  if (ticks.has(t)) {
    console.log(`tick ${t}`);
    for (let y = 0; y < g.h; y++) { let row = ""; for (let x = 0; x < g.w; x++) { const i = y * g.w + x; row += g.kindOf(i) === M.Rocket && g.energyAt(i) > 0 ? "R" : g.kindOf(i) === M.Ember ? (g.energyAt(i) > 90 ? "E" : "e") : ch[g.kindOf(i)] ?? "?"; } console.log(row); }
    if (t === 0 || t === 1) { const a = before; const diff = []; for (let i = 0; i < g.size; i++) if (g.kindOf(i) !== a.kindOf(i)) diff.push(g.xyOf(i).join(",") + ":" + a.kindOf(i) + "->" + g.kindOf(i)); console.log("diff vs before", diff.join(" ")); }
  }
  t++;
  return c.outcome(g, before, memo, prev);
} }, { engine, colorForCell });
