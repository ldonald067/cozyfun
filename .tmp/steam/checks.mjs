// Scratch: pass counts of chosen audit checks over N seeds (seed + k * 1000, as audit:drift),
// on JS engines: main (.tmp/steam/base), the working tree, and named variants.
// node .tmp/steam/checks.mjs <roleRegex> <seeds> [variant,...]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { CHECKS, runCheck, auditVerdict, colorForCell, jsEngine } from "../../scripts/interaction-scenes.mjs";
import { build } from "./variant.mjs";
const [re, seedsArg = "32", list = ""] = process.argv.slice(2);
const seeds = Number(seedsArg);
const mainApp = compileApp("steam-checks-main", ["engine.ts", "materials.ts"], { root: resolve(import.meta.dirname, "base") });
const engines = { main: jsEngine(mainApp.load("engine").createFallbackEngine), tree: jsEngine(build("live").create) };
for (const v of list.split(",").filter(Boolean)) engines[v] = jsEngine(build(v).create);
for (const check of CHECKS.filter((c) => new RegExp(re).test(`${c.covers} ${c.role}`))) {
  console.log(`${check.covers}  ${check.role}`);
  for (const [label, engine] of Object.entries(engines)) {
    const runs = []; for (let k = 0; k < seeds; k++) runs.push({ ...check, ...runCheck({ ...check, seed: check.seed + k * 1000 }, { engine, colorForCell }) });
    const pass = runs.filter((r) => auditVerdict(r).kind === "pass").length;
    const cells = runs.map((r) => r.spreadCells).sort((a, b) => a - b);
    console.log(`  ${label.padEnd(18)} ${pass}/${seeds} pass, cells median ${cells[seeds >> 1]} min ${cells[0]}`);
  }
}
