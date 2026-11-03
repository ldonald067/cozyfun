// Scratch: sabotage one rule in a copy of the JS engine and see which audit checks notice.
// node .tmp/halves/sab.mjs <sabotage-name|none> [seeds=4] [id,id,...]
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKS, jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "./sabotages.mjs";

const repo = resolve(import.meta.dirname, "../..");
const [name = "none", seedArg = "4", only] = process.argv.slice(2);
const seeds = Number(seedArg);
const root = resolve(repo, ".tmp/halves/root-" + name);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
for (const [find, replace] of name === "none" ? [] : SABOTAGES[name]) {
  const n = src.split(find).length - 1;
  if (n !== 1) throw new Error(`${name}: expected one match for ${JSON.stringify(find).slice(0, 80)}, found ${n}`);
  src = src.replace(find, replace);
}
writeFileSync(resolve(root, "app/src/engine.ts"), src);
copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const app = compileApp("halves-" + name, ["engine.ts", "materials.ts"], { root });
const engine = jsEngine(app.load("engine").createFallbackEngine);
// The unsabotaged mirror, played on the same seeds: a detection is baseline-pass -> mutant-fail
// only, so a check that fails a seed on its own is not read as noticing the sabotage.
const base = name === "none" ? null : jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const ids = only ? new Set(only.split(",")) : null;
const rows = [];
for (const c of CHECKS) {
  if (ids && !ids.has(c.covers)) continue;
  let pass = 0, basePass = 0, caught = 0; const why = [];
  for (let k = 0; k < seeds; k++) {
    const seeded = { ...c, seed: c.seed + k * 1000 };
    const v = auditVerdict({ ...c, ...runCheck(seeded, { engine, colorForCell }) });
    const ok = !base || auditVerdict({ ...c, ...runCheck(seeded, { engine: base, colorForCell }) }).kind === "pass";
    if (ok) basePass++;
    if (v.kind === "pass") pass++;
    else { if (ok) caught++; why.push(`#${k} ${v.kind}${v.why ? ":" + v.why.join(",") : ""}`); }
  }
  rows.push({ id: c.covers, role: c.role, pass, basePass, caught, why });
  if (caught || pass < basePass || (!base && pass < seeds)) console.log(`${c.covers.padEnd(22)} ${String(pass).padStart(2)}/${seeds} (baseline ${basePass}, caught ${caught})  ${c.role.slice(0, 44).padEnd(44)} ${why.slice(0, 2).join("; ")}`);
}
writeFileSync(resolve(repo, `.tmp/halves/out-${name}.json`), JSON.stringify(rows));
console.log(base
  ? `${name}: ${rows.filter((r) => r.caught).length} of ${rows.length} checks fail a seed their baseline passes`
  : `${name}: ${rows.filter((r) => r.pass < seeds).length} of ${rows.length} checks below ${seeds}/${seeds}`);
