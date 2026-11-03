// Scratch: per-seed verdicts for one candidate on the JS mirror. node why.mjs <module> <label> <seeds>
import { resolve } from "node:path";
import { jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const [mod, label, n = "32"] = process.argv.slice(2);
const { CANDIDATES } = await import(resolve(mod));
const c = CANDIDATES.find((x) => x.label === label);
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
for (let k = 0; k < Number(n); k++) {
  const r = runCheck({ ...c, seed: c.seed + k * 1000 }, { engine, colorForCell });
  const v = auditVerdict({ ...c, ...r });
  if (v.kind !== "pass") console.log(`#${k} ${v.kind}: ${v.why.join(", ")}`);
}
