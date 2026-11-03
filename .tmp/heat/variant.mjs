// Scratch: score an engine variant (find/replace edits on engine.ts) on the thaw scene's ice
// and on chosen audit checks. node .tmp/heat/variant.mjs <variant> [seeds=16] [id,id]
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKS, jsEngine, runCheck, auditVerdict, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SCENES } from "./scenes.mjs";

const VARIANTS = {
  none: [],
  // Steam freezes onto ice at any heat, and gives the ice it freezes against its heat.
  "steam-warms-ice": [
    ["iceNearby && readU16(old, idx + 4) < STEAM_FREEZE && this.chance(5)", "iceNearby && this.chance(5)"],
    ["      } else if (other === MATERIAL.Steam && readU16(old, nidx + 4) < STEAM_FREEZE && this.chance(4)) {\n",
     "      } else if (other === MATERIAL.Steam && this.chance(4)) {\n        if (next[nidx] === MATERIAL.Steam) writeU16(next, idx + 4, Math.min(255, readU16(next, idx + 4) + Math.max(0, Math.trunc((readU16(old, nidx + 4) - ICE_TEMP) / STEAM_GIFT))));\n"],
    ["const ICE_COLD = 110;", "const ICE_COLD = 110;\nconst STEAM_GIFT = Number((globalThis as any).process?.env?.STEAM_GIFT ?? 2);"],
  ],
};
const repo = resolve(import.meta.dirname, "../..");
const [name = "none", seedArg = "16", only = "ice.condenses,steam.frosts"] = process.argv.slice(2);
const root = resolve(repo, ".tmp/heat/root-" + name);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
for (const [find, replace] of VARIANTS[name]) {
  if (src.split(find).length !== 2) throw new Error(`${name}: no single match for ${find.slice(0, 60)}`);
  src = src.replace(find, replace);
}
writeFileSync(resolve(root, "app/src/engine.ts"), src);
copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const app = compileApp("heatvar-" + name, ["engine.ts", "materials.ts"], { root });
const { createFallbackEngine } = app.load("engine");
const M = app.load("materials").MATERIAL;
const seeds = Number(seedArg);
// The thaw scene's ice at t=400 (20 s): 52 painted; live grows it to ~70.
const scene = SCENES.thaw;
let ice = 0;
for (let s = 0; s < 8; s++) {
  const e = createFallbackEngine(scene.w, scene.h, scene.seed + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  scene.paint(p, M); for (let x = 1; x < scene.w; x += 3) p(x, scene.h - 2, 1, M.Wall);
  for (let t = 1; t <= 400; t++) { scene.act?.(p, t, M); e.tick(); }
  const b = e.getCellBytes(); for (let i = 0; i < b.length; i += 8) if (b[i] === M.Ice) ice++;
}
const engine = jsEngine(createFallbackEngine), ids = new Set(only.split(","));
const out = [`thaw ice@400 ${(ice / 8).toFixed(1)}`];
for (const c of CHECKS) {
  if (!ids.has(c.covers)) continue;
  let pass = 0;
  for (let k = 0; k < seeds; k++) if (auditVerdict({ ...c, ...runCheck({ ...c, seed: c.seed + k * 1000 }, { engine, colorForCell }) }).kind === "pass") pass++;
  out.push(`${c.covers} "${c.role.slice(0, 28)}" ${pass}/${seeds}`);
}
console.log(`${name.padEnd(16)} ${out.join("  |  ")}`);
