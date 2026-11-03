// Scratch: material census in a scene's box at a tick, base vs now, N seeds.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SCENES } from "./scenes.mjs";
const [name, atArg, seedsArg = "6"] = process.argv.slice(2);
for (const [label, opts] of [["base", { root: resolve(import.meta.dirname, "../film/base") }], ["now", {}]]) {
  const app = compileApp(`heat-${label}`, ["engine.ts", "materials.ts"], opts);
  const M = app.load("materials").MATERIAL, names = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
  const scene = SCENES[name], tot = {};
  for (let s = 0; s < Number(seedsArg); s++) {
    const e = app.load("engine").createFallbackEngine(scene.w, scene.h, scene.seed + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    scene.paint(p, M); for (let x = 1; x < scene.w; x += 3) p(x, scene.h - 2, 1, M.Wall);
    for (let t = 1; t <= Number(atArg); t++) { scene.act?.(p, t, M); e.tick(); }
    const b = e.getCellBytes(), [x0, y0, x1, y1] = scene.box;
    for (let i = 0, c = 0; i < b.length; i += 8, c++) { const x = c % scene.w, y = Math.floor(c / scene.w);
      if (x < x0 || x > x1 || y < y0 || y > y1 || !b[i] || b[i] === M.Wall) continue; const k = names[b[i]]; tot[k] = (tot[k] ?? 0) + 1; }
  }
  console.log(label.padEnd(5), Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / Number(seedsArg)).toFixed(1)}`).join(", "));
}
