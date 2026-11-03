// Batch B visibility: moss crossing a gap when watered; stardust rained by a meteor-lit pile vs a fire-lit one.
import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const BASE = process.env.BASE === "1";
const app = compileApp(BASE ? "bb-base" : "bb-now", ["materials.ts", "engine.ts"], BASE ? { root: resolve(import.meta.dirname, "base") } : {});
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const S = 8;
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
// Moss: two wood planks, a gap of `gap` cells, moss on the left plank, water poured on it.
for (const gap of [1, 2]) {
  const crossed = [];
  for (const seed of seeds) {
    const W = 48, H = 30, e = createFallbackEngine(W, H, seed);
    const right0 = 22 + gap;
    const bytes = e.getCellBytes().slice();
    const put = (x, y, k, energy = 0) => { const o = (y * W + x) * S; bytes[o] = k; bytes[o + 4] = energy; };
    for (let x = 4; x <= 44; x++) { put(x, 23, M.Wall); put(x, 24, M.Wall); }
    // Planks on wall posts, open air beneath and in the gap, so nothing but a spore bridges it.
    for (let x = 6; x <= 21; x++) put(x, 18, M.Wood, 20);
    for (let x = right0; x <= 40; x++) put(x, 18, M.Wood, 20);
    for (const x of [6, 21, right0, 40]) for (let y = 19; y <= 22; y++) put(x, y, M.Wall);
    put(8, 17, M.Moss, 60);
    e.loadCellBytes(bytes);
    let at = -1;
    for (let t = 1; t <= 3000 && at < 0; t++) {
      if (t < 300 && t % 10 === 0) e.paint(12, 10, 1, M.Water, 50);
      e.tick();
      const a = e.getCellBytes();
      for (let x = right0; x <= 40; x++) for (const y of [17, 18]) if (a[(y * W + x) * S] === M.Moss) at = t;
    }
    crossed.push(at);
  }
  console.log(`moss, gap ${gap}: crossed at ${crossed.join(" ")}`);
}
// Fireworks: a pile on a floor, lit by a meteor or by fire; stardust born from sparks.
for (const by of ["meteor", "fire"]) {
  const counts = [];
  for (const seed of seeds) {
    const W = 48, H = 80, e = createFallbackEngine(W, H, seed);
    for (let x = 4; x <= 44; x++) { e.paint(x, 76, 0, M.Wall); e.paint(x, 77, 0, M.Wall); }
    for (let x = 18; x <= 30; x++) for (let y = 72; y <= 75; y++) e.paint(x, y, 0, M.Rocket);
    let rained = 0, starSparks = 0, plainSparks = 0;
    for (let t = 1; t <= 400; t++) {
      if (t === 1) by === "meteor" ? e.paint(24, 40, 0, M.Meteor) : e.paint(24, 71, 0, M.Fire);
      const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
      for (let i = 0; i < a.length; i += S) {
        if (b[i] === M.Spark && a[i] === M.Stardust) rained++;
        if (a[i] === M.Spark && b[i] !== M.Spark && b[i] === M.Empty) (a[i + 6] & F.Cosmic) ? starSparks++ : plainSparks++;
      }
    }
    counts.push(`${rained}(${starSparks}*/${plainSparks})`);
  }
  console.log(`fireworks lit by ${by}: stardust from sparks ${counts.join(" ")}`);
}
