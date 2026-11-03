// Scratch: print a heat scene's board. node .tmp/heat/board.mjs <scene> <tick,tick> [seedOffset] [base]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SCENES } from "./scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, ticksArg, off = "0", which = "now"] = process.argv.slice(2);
const app = which === "base" ? compileApp("heat-base", ["engine.ts", "materials.ts"], { root: resolve(repo, ".tmp/film/base") }) : compileApp("heat-now", ["engine.ts", "materials.ts"]);
const M = app.load("materials").MATERIAL, scene = SCENES[name];
const e = app.load("engine").createFallbackEngine(scene.w, scene.h, scene.seed + Number(off));
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
scene.paint(p, M); for (let x = 1; x < scene.w; x += 3) p(x, scene.h - 2, 1, M.Wall);
const ch = { [M.Empty]: " ", [M.Wall]: "#", [M.Ice]: "I", [M.Water]: "~", [M.Steam]: "'", [M.Fire]: "^", [M.Lava]: "L", [M.Stone]: "o", [M.Soil]: "s", [M.Smoke]: ".", [M.Glass]: "g" };
let t = 0;
const [bx0, by0, bx1, by1] = scene.box;
for (const at of ticksArg.split(",").map(Number)) {
  while (t < at) { t++; scene.act?.(p, t, M); e.tick(); }
  const b = e.getCellBytes(); console.log(`t=${at}  (~ water: digit = energy/26, H = >120)`);
  for (let y = by0; y <= by1; y++) {
    let row = "";
    for (let x = bx0 - 2; x <= bx1 + 2; x++) {
      const o = (y * scene.w + x) * 8, k = b[o], en = b[o + 4] | (b[o + 5] << 8), f = b[o + 6];
      if (k === M.Water) row += en > 120 ? "H" : String(Math.min(9, Math.floor(en / 26)));
      else row += (f & 8 ? (k === M.Soil ? "S" : "*") : (ch[k] ?? "?"));
    }
    console.log(row);
  }
}
