// Scratch: play a candidate over N seeds on the live JS mirror and on sabotaged copies.
// node .tmp/batch2/try.mjs <candidate> <seeds> [variant,...]   (variants: names in .tmp/halves/sabotages.mjs)
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { jsEngine, runCheck, colorForCell, auditVerdict } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "../halves/sabotages.mjs";
import { CANDIDATES } from "./candidates.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, seedArg = "8", variantArg = ""] = process.argv.slice(2);
const c = CANDIDATES[name];
const engineFor = (v) => {
  if (v === "live") return jsEngine(compileApp("b2-live", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
  const root = resolve(repo, ".tmp/batch2/root-" + v);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
  for (const [find, replace] of SABOTAGES[v]) {
    const n = src.split(find).length - 1;
    if (n !== 1) throw new Error(`${v}: expected one match, found ${n}`);
    src = src.replace(find, replace);
  }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
  return jsEngine(compileApp("b2-" + v, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine);
};
for (const v of ["live", ...variantArg.split(",").filter(Boolean)]) {
  const engine = engineFor(v), rows = [];
  for (let k = 0; k < Number(seedArg); k++) {
    let memo;
    const check = { ...c, seed: c.seed + k * 1000, outcome: (g, b, m, p) => { memo = m; return c.outcome(g, b, m, p); } };
    const r = runCheck(check, { engine, colorForCell });
    const v = auditVerdict({ ...check, ...r });
    rows.push({ ...(c.stat ? c.stat(memo) : {}), verdict: v.kind === "pass" ? "P" : v.kind[0], cells: r.spreadCells ?? 0, shown: r.visibleTicks ?? 0, contrast: Math.round(r.contrast ?? 0) });
  }
  console.log(`== ${v}  pass ${rows.filter((r) => r.verdict === "P").length}/${rows.length}`);
  for (const key of Object.keys(rows[0])) {
    const vals = rows.map((r) => r[key]);
    const nums = vals.filter((x) => typeof x === "number").sort((a, b) => a - b);
    console.log(`  ${key.padEnd(9)} ${nums.length ? `min ${nums[0]} p25 ${nums[Math.floor(nums.length / 4)]} med ${nums[Math.floor(nums.length / 2)]} max ${nums[nums.length - 1]}  ` : ""}${vals.join(" ")}`);
  }
}
