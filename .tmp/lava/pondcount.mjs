import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SCENES } from "./scenes.mjs";
const s = SCENES["oil-pond"];
for (const [label, root] of [["live", resolve(import.meta.dirname, "base")], ["approved", undefined], ["crowd 2+", resolve(import.meta.dirname, "root-crowd2")]]) {
  const app = compileApp("pc-" + label.replace(/\W/g, ""), ["engine.ts", "materials.ts"], root ? { root } : {});
  const M = app.load("materials").MATERIAL, rows = [];
  for (let k = 0; k < 4; k++) {
    const e = app.load("engine").createFallbackEngine(s.w, s.h, s.seed + k), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    s.paint(p); for (let x = 1; x < s.w; x += 3) p(x, s.h - 4, 1, M.Wall);
    const at = []; for (let t = 1; t <= 1200; t++) { s.act(p, t); e.tick(); if (s.ticks.includes(t)) { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === M.Oil) n++; at.push(n); } }
    rows.push(at.join(","));
  }
  console.log(`${label.padEnd(9)} oil on a pond at 2,5,10,30,60 s: ${rows.join("  ")}`);
}
