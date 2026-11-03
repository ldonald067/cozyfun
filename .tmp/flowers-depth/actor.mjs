// The reshape checks with the actor taken away: the meadow painted without its watering.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { CHECKS, runCheck, jsEngine, auditVerdict, colorForCell, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const engine = jsEngine(compileApp("act-tree", ["engine.ts", "materials.ts"], { root: repo }).load("engine").createFallbackEngine);
const dry = (p) => { for (let x = 4; x <= 215; x++) p(x, 40, 3, M.Soil, 55); for (let x = 8; x <= 212; x += 7) p(x, 35, 0, M.Seed); };
for (const check of CHECKS.filter((c) => /tulip into a cup|bluebell's bells/.test(c.role))) {
  const kinds = [];
  for (let s = 0; s < 4; s++) kinds.push(auditVerdict(runCheck({ ...check, paint: dry, seed: check.seed + s * 1000 }, { engine, colorForCell })).kind);
  console.log(check.role, "without water:", kinds.join(" "));
}
