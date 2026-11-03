// Scratch: oil in the open, live (HEAD) vs the working tree. Counts at 5, 10, 30, 60 s.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const builds = {
  live: compileApp("slick-live", ["engine.ts", "materials.ts"], { root: resolve(import.meta.dirname, "base") }),
  now: compileApp("slick-now", ["engine.ts", "materials.ts"]),
};
const SCENES = {
  "oil on a bare floor": (p, M) => { for (let x = 0; x < 80; x++) p(x, 36, 1, M.Wall); for (let t = 0; t < 1; t++) p(40, 30, 4, M.Oil); },
  "oil on a wide pond": (p, M) => {
    for (let x = 0; x < 80; x++) { p(x, 36, 1, M.Wall); }
    for (let y = 26; y <= 36; y++) for (const x of [4, 5, 74, 75]) p(x, y, 0, M.Wall);
    for (let y = 30; y <= 34; y++) for (let x = 7; x <= 72; x++) p(x, y, 0, M.Water);
    p(40, 24, 4, M.Oil);
  },
};
for (const [name, paint] of Object.entries(SCENES)) {
  for (const [label, app] of Object.entries(builds)) {
    const M = app.load("materials").MATERIAL, { createFallbackEngine } = app.load("engine");
    const rows = [];
    for (let s = 0; s < 4; s++) {
      const e = createFallbackEngine(80, 40, 11 + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
      paint(p, M);
      const count = () => { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === M.Oil) n++; return n; };
      const start = count(), at = [];
      for (let t = 1; t <= 1200; t++) { e.tick(); if ([100, 200, 600, 1200].includes(t)) at.push(count()); }
      rows.push(`${start}->${at.join(",")}`);
    }
    console.log(`${name.padEnd(22)} ${label.padEnd(4)} (5,10,30,60 s): ${rows.join("  ")}`);
  }
}
