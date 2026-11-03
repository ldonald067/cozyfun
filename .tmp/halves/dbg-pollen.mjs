import { CHECKS, M, F, jsEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
for (const water of [M.Water, M.Moonwater]) for (let k = 0; k < 3; k++) {
  const stats = { seedsFromPollen: 0, cosmicSeeds: 0, pollen: 0, cosmicPollen: 0, flowers: 0, cosmicFlowers: 0 };
  runCheck({ w: 40, h: 34, seed: 156 + k * 1000, ticks: 9000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, water); },
    outcome: (g, before, memo, prev) => {
      for (let i = 0; i < g.size; i++) {
        if (g.kindOf(i) === M.Seed && prev.kindOf(i) === M.Pollen) { stats.seedsFromPollen++; if (g.hasFlag(i, F.Cosmic)) stats.cosmicSeeds++; }
        if (g.kindOf(i) === M.Pollen && prev.kindOf(i) !== M.Pollen) { stats.pollen++; if (g.hasFlag(i, F.Cosmic)) stats.cosmicPollen++; }
        if (g.kindOf(i) === M.Flower && prev.kindOf(i) !== M.Flower) { stats.flowers++; if (g.hasFlag(i, F.Cosmic)) stats.cosmicFlowers++; }
      }
      return [];
    } }, { engine, colorForCell });
  console.log(water === M.Water ? "water" : "moonwater", k, JSON.stringify(stats));
}
