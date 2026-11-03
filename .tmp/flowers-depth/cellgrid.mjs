// Print kind and rendered colour per cell for a crop of a film scene on the working tree.
// node cellgrid.mjs <scene> <tick> x0,y0,x1,y1
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../film/scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, tickArg, cropArg] = process.argv.slice(2);
const scene = SCENES[name], at = Number(tickArg), [x0, y0, x1, y1] = cropArg.split(",").map(Number);
const e = compileApp("cg-eng", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine(scene.w, scene.h, scene.seed);
const { colorForCell } = loadRenderer("cg-r");
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
scene.paint(p);
for (let x = 1; x < scene.w; x += 3) p(x, scene.h - FLOOR_FROM_BOTTOM, 1, 1);
if (scene.cells) e.loadCellBytes(scene.cells(e.getCellBytes().slice(), scene.w, repo));
for (let t = 1; t <= at; t++) { if (scene.act) scene.act(p, t); e.tick(); }
const c = e.getCellBytes(), W = scene.w;
for (let y = y0; y <= y1; y++) {
  let line = String(y).padStart(3) + " ";
  for (let x = x0; x <= x1; x++) {
    const o = (y * W + x) * 8;
    const rgb = colorForCell({ kind: c[o], variant: c[o + 1], age: c[o + 2] | (c[o + 3] << 8), energy: c[o + 4] | (c[o + 5] << 8),
      flags: c[o + 6] | (c[o + 7] << 8), time: at * 50, cells: c, width: W, height: scene.h, x, y });
    line += `${String(c[o]).padStart(2)}:${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")} `;
  }
  console.log(line);
}
