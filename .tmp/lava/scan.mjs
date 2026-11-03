// Scratch: every audit check on live and on a variant, N seeds each; lists checks whose pass
// count changes. node .tmp/lava/scan.mjs <variant> [seeds]
import { CHECKS, jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { build } from "./variant.mjs";
const [name = "candidate", seedArg = "8"] = process.argv.slice(2);
const seeds = Number(seedArg);
const live = jsEngine(build("live").create), variant = jsEngine(build(name).create);
const rows = [];
for (const c of CHECKS) {
  let a = 0, b = 0; const lost = [];
  for (let k = 0; k < seeds; k++) {
    const s = { ...c, seed: c.seed + k * 1000 };
    const va = auditVerdict({ ...c, ...runCheck(s, { engine: live, colorForCell }) });
    const vb = auditVerdict({ ...c, ...runCheck(s, { engine: variant, colorForCell }) });
    if (va.kind === "pass") a++;
    if (vb.kind === "pass") b++; else if (va.kind === "pass") lost.push(`#${k} ${vb.kind}:${(vb.why ?? []).join(",")}`);
  }
  if (a !== b) rows.push(`${c.covers.padEnd(22)} ${String(a).padStart(2)} -> ${String(b).padStart(2)} of ${seeds}  ${c.role.slice(0, 50)}  ${lost.slice(0, 2).join("; ")}`);
}
console.log(`${name}: ${rows.length} of ${CHECKS.length} checks change pass count on ${seeds} seeds`);
for (const r of rows) console.log("  " + r);
