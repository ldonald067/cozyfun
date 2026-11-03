// Scratch: score candidate checks (exported as CANDIDATES from a module) on the unsabotaged JS
// mirror and on sabotaged copies. node .tmp/halves/try.mjs <module> <seeds> <sabotage,...>
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "./sabotages.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [mod, seedArg = "8", sabs = ""] = process.argv.slice(2);
const { CANDIDATES } = await import(resolve(mod));
const seeds = Number(seedArg);
function build(name) {
  if (name === "none") return jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
  const root = resolve(repo, ".tmp/halves/root-" + name);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
  for (const [find, replace] of SABOTAGES[name]) {
    if (src.split(find).length !== 2) throw new Error(`${name}: not one match`);
    src = src.replace(find, replace);
  }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
  return jsEngine(compileApp("halves-" + name, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine);
}
const engines = ["none", ...sabs.split(",").filter(Boolean)].map((n) => [n, build(n)]);
for (const c of CANDIDATES) {
  for (const [name, engine] of engines) {
    let pass = 0; const cells = [], ticks = [], con = [], why = [];
    for (let k = 0; k < seeds; k++) {
      const r = runCheck({ ...c, seed: c.seed + k * 1000 }, { engine, colorForCell });
      const v = auditVerdict({ ...c, ...r });
      if (v.kind === "pass") pass++; else why.push(`#${k} ${v.kind}:${v.why.join(",")}`);
      cells.push(r.spreadCells ?? 0); ticks.push(r.visibleTicks ?? 0); con.push(Math.round(r.contrast ?? 0));
    }
    const s = (a) => [...a].sort((x, y) => x - y);
    console.log(`${c.label.padEnd(30)} ${name.padEnd(22)} ${String(pass).padStart(2)}/${seeds}  cells min ${s(cells)[0]} med ${s(cells)[seeds >> 1]}  ticks min ${s(ticks)[0]} med ${s(ticks)[seeds >> 1]}  contrast min ${s(con)[0]}  ${why.slice(0, 2).join("; ")}`);
  }
}
