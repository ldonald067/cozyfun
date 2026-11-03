// Scratch: mean of one stat at one tick, per scene, for the working tree under the current env.
import { compileApp } from "../../scripts/compile-app.mjs";
import { SCENES } from "./scenes.mjs";
import { SABOTAGES } from "../halves/sabotages.mjs";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
const sab = process.argv[3] ?? "none", repo = resolve(import.meta.dirname, "../.."), root = resolve(repo, ".tmp/heat/abl-" + sab);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
for (const [f, r] of sab === "none" ? [] : SABOTAGES[sab]) { if (src.split(f).length !== 2) throw new Error(sab); src = src.replace(f, r); }
writeFileSync(resolve(root, "app/src/engine.ts"), src); copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const app = compileApp("heat-abl-" + sab, ["engine.ts", "materials.ts"], { root });
const M = app.load("materials").MATERIAL, { createFallbackEngine } = app.load("engine");
const PLAN = { "thaw/ice": [400, "ice"], slab: [200, "ice"], puddle: [200, "ice"], "warm-puddle": [160, "ice"], thaw: [500, "frozen"], "warm-then-ice": [200, "ice"] };
const seeds = Number(process.argv[2] ?? 8), out = [];
for (const [name, [at, key]] of Object.entries(PLAN)) {
  const scene = SCENES[name.replace(/\/ice$/, "")]; let sum = 0;
  for (let s = 0; s < seeds; s++) {
    const e = createFallbackEngine(scene.w, scene.h, scene.seed + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    scene.paint(p, M); for (let x = 1; x < scene.w; x += 3) p(x, scene.h - 2, 1, M.Wall);
    for (let t = 1; t <= at; t++) { scene.act?.(p, t, M); e.tick(); }
    const b = e.getCellBytes(), [x0, y0, x1, y1] = scene.box;
    for (let i = 0, c = 0; i < b.length; i += 8, c++) {
      const x = c % scene.w, y = Math.floor(c / scene.w); if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (key === "ice" ? b[i] === M.Ice : b[i + 6] & 8) sum++;
    }
  }
  out.push(`${name}@${at} ${key} ${(sum / seeds).toFixed(1)}`);
}
console.log(out.join("  |  "));
