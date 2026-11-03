// For the audit's garden scene on a few seeds: when the first seed is set (and where), and when a sown plant sprouts.
import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("garden-when", ["materials.ts", "engine.ts"]);
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const W = 80, H = 40, S = 8;
const fl = (c, i) => c[i + 6] | (c[i + 7] << 8);
for (const seed of [102, 1102, 2102, 3102, 4102]) {
  const e = createFallbackEngine(W, H, seed);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 4; x <= 76; x++) p(x, 36, 3, M.Soil, 55);
  p(40, 31, 1, M.Seed); p(40, 26, 3, M.Water);
  for (let x = 1; x < W; x += 3) p(x, H - 2, 1, M.Wall);
  const landed = new Set(); const sets = []; let sown = -1, bloom = -1;
  for (let t = 1; t <= 6000; t++) {
    if (t % 400 === 200) for (let x = 6; x <= 74; x += 3) p(x, 20, 1, M.Water, 30);
    const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
    for (let i = 0; i < a.length; i += S) {
      if (bloom < 0 && a[i] === M.Flower) bloom = t;
      if (b[i] === M.Pollen && a[i] === M.Seed && sets.length < 4) sets.push(`${t}@(${(i / S) % W},${Math.floor(i / S / W)})`);
      if (b[i] === M.Seed && a[i] === M.Seed && fl(b, i) & F.Windborne && !(fl(a, i) & F.Windborne)) landed.add(i);
      if (sown < 0 && b[i] === M.Seed && a[i] === M.Stem && landed.has(i)) sown = t;
    }
  }
  console.log(`seed ${seed}: bloom ${bloom}, first sets ${sets.join(" ")}, first sown ${sown}`);
}
