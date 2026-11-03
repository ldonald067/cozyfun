// Scratch: does poured lava conserve itself on a bare floor? base engine.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("heat-base", ["engine.ts", "materials.ts"], { root: resolve(import.meta.dirname, "../film/base") });
const M = app.load("materials").MATERIAL, { createFallbackEngine } = app.load("engine");
for (const [label, mat] of [["lava", M.Lava], ["water", M.Water], ["oil", M.Oil]]) {
  const row = [];
  for (let s = 0; s < 4; s++) {
    const e = createFallbackEngine(50, 30, 900 + s), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
    for (let x = 4; x <= 45; x++) { p(x, 25, 0, M.Wall); p(x, 26, 0, M.Wall); }
    for (let y = 12; y <= 26; y++) for (const x of [4, 5, 44, 45]) p(x, y, 0, M.Wall);
    for (let x = 1; x < 50; x += 3) p(x, 28, 1, M.Wall);
    const counts = [];
    for (let t = 1; t <= 120; t++) { if (t < 40 && t % 4 === 0) p(12, 16, 2, mat); e.tick();
      if (t % 20 === 0) { const b = e.getCellBytes(); let n = 0, st = 0; for (let i = 0; i < b.length; i += 8) { if (b[i] === mat) n++; if (b[i] === M.Stone) st++; } counts.push(`${n}/${st}`); } }
    row.push(counts.join(" "));
  }
  console.log(label.padEnd(6), "count/stone every 20 ticks:", row.join("  ;  "));
}
