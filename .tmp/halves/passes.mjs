// Scratch: which seeds pass a candidate. node passes.mjs <module> <label> <seeds>
import { resolve } from "node:path";
import { jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const [mod, label, n = "16"] = process.argv.slice(2);
const c = (await import(resolve(mod))).CANDIDATES.find((x) => x.label === label);
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { SABOTAGES } from "./sabotages.mjs";
let root;
if (process.env.SAB) {
  root = resolve(import.meta.dirname, "root-" + process.env.SAB);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  let src = readFileSync(resolve(import.meta.dirname, "../../app/src/engine.ts"), "utf8");
  for (const [f, r] of SABOTAGES[process.env.SAB]) { if (src.split(f).length !== 2) throw new Error("not one match"); src = src.replace(f, r); }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(import.meta.dirname, "../../app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
}
const engine = jsEngine((root ? compileApp("pass-" + process.env.SAB, ["engine.ts", "materials.ts"], { root }) : compileApp("halves-base", ["engine.ts", "materials.ts"])).load("engine").createFallbackEngine);
const out = [];
for (let k = 0; k < Number(n); k++) { const r = runCheck({ ...c, seed: c.seed + k * 1000 }, { engine, colorForCell }); out.push(`${c.seed + k * 1000}:${r.firstTick}`); }
console.log(out.join(" "));
