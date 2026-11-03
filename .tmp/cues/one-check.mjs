// Play one audit check on one seed through the audit's own runner, with a hook that prints
// what the board holds around the cut, to see what the witness sees.
import { CHECKS, jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const [role, k] = [process.argv[2], Number(process.argv[3])];
const c = CHECKS.find((x) => x.role === role);
const app = compileApp("one-check", ["engine.ts", "materials.ts"]);
const { MATERIAL: M } = app.load("materials");
const inner = jsEngine(app.load("engine").createFallbackEngine);
let ticks = 0;
const engine = { ...inner, create(w, h, seed) {
  const u = inner.create(w, h, seed);
  const tick = u.tick.bind(u);
  u.tick = () => { tick(); ticks++;
    if (ticks === 2499 || ticks === 2503) {
      const v = u.view(); let out = `tick ${ticks}:\n`;
      for (let y = 14; y < 32; y++) { let row = ""; for (let x = 12; x < 30; x++) { const kk = v[(y * w + x) * 8]; row += kk === M.Stem ? "|" : kk === M.Flower ? "*" : kk === M.Seed ? "o" : kk === M.Moss ? "m" : kk === 0 ? "." : "#"; } out += row + "\n"; }
      console.log(out);
    } };
  return u; } };
const r = runCheck({ ...c, seed: c.seed + k * 1000 }, { engine, colorForCell });
console.log(JSON.stringify(auditVerdict({ ...c, ...r })), "firstTick", r.firstTick);
