import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
for (const [label, root] of [["sabotaged", resolve(import.meta.dirname, "../halves/root-lava-deletes-lava")], ["tree", undefined], ["HEAD", resolve(import.meta.dirname, "base")]]) {
  const app = compileApp("dbg-" + label, ["engine.ts", "materials.ts"], root ? { root } : {});
  const M = app.load("materials").MATERIAL, e = app.load("engine").createFallbackEngine(40, 30, 168);
  const p = (x, y, r, m) => e.paint(x, y, r, m, 100);
  for (let x = 0; x < 40; x++) p(x, 28, 1, M.Wall); for (let y = 10; y <= 28; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
  for (let x = 1; x < 40; x += 3) p(x, 26, 1, M.Wall);
  const out = [];
  for (let t = 1; t <= 600; t++) { if (t <= 90 && t % 3 === 1) p(20, 4, 4, M.Lava); e.tick();
    if (t % 100 === 0) { const b = e.getCellBytes(); let n = 0, deep = 0, deep5 = 0; for (let i = 0; i < b.length; i += 8) { if (b[i] !== M.Lava) continue; n++; const c = i / 8; let d = 0; for (let k = 1; k <= 5 && c - 40 * k >= 0; k++) { if (b[(c - 40 * k) * 8] === M.Lava) d++; else break; } if (d >= 3) deep++; if (d >= 5) deep5++; } out.push(`t${t} ${n}/${deep}/${deep5}`); } }
  console.log(label.padEnd(10), out.join("  "));
}
