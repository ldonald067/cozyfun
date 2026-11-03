// Scratch: does a small pot still boil dry under a held flame, and how fast? base vs now.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
for (const [label, opts] of [["base", { root: resolve(import.meta.dirname, "../film/base") }], ["now", {}]]) {
  const app = compileApp(`boil-${label}`, ["engine.ts", "materials.ts"], opts);
  const M = app.load("materials").MATERIAL, { createFallbackEngine } = app.load("engine");
  const rows = [];
  for (const width of [3, 8, 16]) {
    const res = [];
    for (let s = 0; s < 6; s++) {
      const e = createFallbackEngine(40, 30, 1200 + s), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
      const x0 = 20 - width, x1 = 20 + width;
      for (let x = x0 - 2; x <= x1 + 2; x++) { p(x, 25, 0, M.Wall); }
      for (let y = 18; y <= 25; y++) { p(x0 - 2, y, 0, M.Wall); p(x1 + 2, y, 0, M.Wall); }
      for (let y = 22; y <= 23; y++) for (let x = x0; x <= x1; x++) p(x, y, 0, M.Water);
      for (let x = 1; x < 40; x += 3) p(x, 28, 1, M.Wall);
      const count = () => { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === M.Water) n++; return n; };
      const start = count(); let half = -1, hot = 0;
      for (let t = 1; t <= 800; t++) { if (t % 4 === 0) p(20, 19, 2, M.Fire); e.tick();
        if (t === 200) { const b = e.getCellBytes(); for (let i = 0; i < b.length; i += 8) if (b[i] === M.Water && (b[i + 4] | (b[i + 5] << 8)) > 120) hot++; }
        if (half < 0 && count() <= start / 2) half = t; }
      res.push(`${start}->${count()} half@${half} hot200=${hot}`);
    }
    rows.push(`  pot ±${width}: ${res.join("  ")}`);
  }
  console.log(label); console.log(rows.join("\n"));
}
