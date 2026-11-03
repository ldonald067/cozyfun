// Scratch: show.mjs with steam energy, wellspring, ice, moss, seed and stem glyphs.
import { resolve } from "node:path";
import { M, MIST_ENERGY, jsEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const [mod, label, k = "0", at = "1", x0 = "0", x1 = "999", y0 = "0", y1 = "999"] = process.argv.slice(2);
const { CANDIDATES } = await import(resolve(mod));
const c = CANDIDATES.find((x) => x.label === label);
// SAB=<sabotage> plays the board on a sabotaged JS mirror instead.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { SABOTAGES } from "./sabotages.mjs";
let engineRoot;
if (process.env.SAB) {
  engineRoot = resolve(import.meta.dirname, "root-" + process.env.SAB);
  mkdirSync(resolve(engineRoot, "app/src"), { recursive: true });
  let src = readFileSync(resolve(import.meta.dirname, "../../app/src/engine.ts"), "utf8");
  for (const [f, r] of SABOTAGES[process.env.SAB]) { if (src.split(f).length !== 2) throw new Error("not one match"); src = src.replace(f, r); }
  writeFileSync(resolve(engineRoot, "app/src/engine.ts"), src);
  copyFileSync(resolve(import.meta.dirname, "../../app/src/materials.ts"), resolve(engineRoot, "app/src/materials.ts"));
}
const engine = jsEngine((engineRoot ? compileApp("show-" + process.env.SAB, ["engine.ts", "materials.ts"], { root: engineRoot }) : compileApp("halves-base", ["engine.ts", "materials.ts"])).load("engine").createFallbackEngine);
const ch = { [M.Empty]: ".", [M.Wall]: "#", [M.Stone]: "S", [M.Wood]: "W", [M.Ember]: "e", [M.Fire]: "f", [M.Rocket]: "r", [M.Smoke]: "~", [M.Spark]: "*", [M.Stardust]: "+", [M.Water]: "w", [M.Soil]: "o", [M.Moss]: "m", [M.Ice]: "I", [M.Wellspring]: "@", [M.Seed]: "s", [M.Stem]: "|", [M.Flower]: "F", [M.Moonwater]: "u", [M.Meteor]: "O", [M.Sand]: "z", [M.Oil]: "l" };
const ticks = new Set(at.split(",").map(Number));
let t = 0;
runCheck({ ...c, seed: c.seed + Number(k) * 1000, outcome: (g, before, memo, prev) => {
  const hit = c.outcome(g, before, memo, prev);
  if (ticks.has(t)) {
    const hs = new Set(hit);
    console.log(`tick ${t} hit ${hit.length}`);
    for (let y = Math.max(0, +y0); y < Math.min(g.h, +y1 + 1); y++) { let row = ""; for (let x = Math.max(0, +x0); x < Math.min(g.w, +x1 + 1); x++) { const i = y * g.w + x; const kd = g.kindOf(i); let s = kd === M.Steam ? (g.energyAt(i) > MIST_ENERGY ? "'" : ",") : kd === M.Rocket && g.energyAt(i) > 0 ? "R" : ch[kd] ?? "?"; if (hs.has(i)) s = "\x1b[7m" + s + "\x1b[0m"; row += s; } console.log(row); }
  }
  t++;
  return hit;
} }, { engine, colorForCell });
