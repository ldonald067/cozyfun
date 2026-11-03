// For failing seeds: how many crowns of the species came up, and the most of its shape any opened.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { CHECKS, M, F, FLOOR_FROM_BOTTOM, jsEngine } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const create = compileApp("why-tree", ["engine.ts", "materials.ts"], { root: repo }).load("engine").createFallbackEngine;
const cases = [[4, [27025, 29025, 25]], [6, [13026, 16026, 25026, 26]]];
const SH = { 4: 15, 6: 12 };
for (const [variant, seeds] of cases) {
  const check = CHECKS.find((c) => c.role.includes(variant === 4 ? "tulip into" : "bluebell's"));
  for (const seed of seeds) {
    const e = create(check.w, check.h, seed);
    const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    check.paint(p); for (let x = 1; x < check.w; x += 3) p(x, check.h - FLOOR_FROM_BOTTOM, 1, M.Wall);
    const crowns = new Set(); let best = 0; const species = new Set();
    for (let t = 1; t <= check.ticks; t++) {
      e.tick();
      if (t % 25) continue;
      const c = e.getCellBytes(), w = check.w;
      for (let i = 0; i < w * check.h; i++) {
        if (c[i * 8] !== M.Flower || !((c[i * 8 + 6] | (c[i * 8 + 7] << 8)) & F.Rooted)) continue;
        species.add(c[i * 8 + 1]);
        if (c[i * 8 + 1] !== variant) continue;
        crowns.add(i);
        let n = 0; const x = i % w, y = Math.floor(i / w);
        for (let dy = -4; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) { const j = (y + dy) * w + x + dx; if ((dx || dy) && c[j * 8] === M.Flower && c[j * 8 + 1] === variant) n++; }
        best = Math.max(best, n);
      }
    }
    console.log(`variant ${variant} seed ${seed}: ${crowns.size} crowns of it, best head ${best}/${SH[variant]}, species seen ${[...species].sort().join("")}`);
    e.dispose();
  }
}
