// Scratch: run audit checks matching a role regex against HEAD's and the working tree's JS engine.
// node .tmp/lavaflow/check.mjs <roleRegex> [seeds]
import { CHECKS, runCheck, jsEngine, colorForCell, auditVerdict } from "../../scripts/interaction-scenes.mjs";
import { build } from "./variant.mjs";
const [re, seeds = "4"] = process.argv.slice(2);
const engines = { head: jsEngine(build("head").create), now: jsEngine(build("live").create) };
for (const check of CHECKS.filter((c) => new RegExp(re).test(c.role))) {
  for (const [name, engine] of Object.entries(engines)) {
    const rows = [];
    for (let s = 0; s < Number(seeds); s++) {
      const r = runCheck({ ...check, seed: check.seed + 1000 * s }, { engine, colorForCell });
      const v = auditVerdict({ ...r, ticks: check.ticks });
      rows.push(`${v.kind === "pass" ? "PASS" : v.kind}(${r.spreadCells ?? 0}c/${r.visibleTicks ?? 0}t)`);
    }
    console.log(`${name.padEnd(4)} ${check.role.slice(0, 50).padEnd(50)} ${rows.join(" ")}`);
  }
}
