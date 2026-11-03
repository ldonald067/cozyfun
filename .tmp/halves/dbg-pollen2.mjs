import { M, F, jsEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const scenes = {
  // A wide wet bed, one small seed patch in the middle: pollen lands on open soil.
  wide: (water) => (p) => { for (let x = 3; x <= 37; x++) p(x, 28, 1, M.Soil); p(20, 25, 1, M.Seed); for (let x = 4; x <= 36; x += 4) p(x, 22, 1, water); },
  // The painted garden on a wide soil floor.
  floor: (water) => (p) => { for (let x = 3; x <= 37; x++) p(x, 28, 1, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, water); },
};
for (const [name, scene] of Object.entries(scenes)) for (const water of [M.Water, M.Moonwater]) for (let k = 0; k < 3; k++) {
  const s = { fromPollen: 0, cosmic: 0, onSoil: 0, wetSoilUnder: 0 };
  runCheck({ w: 40, h: 34, seed: 156 + k * 1000, ticks: 9000, paint: scene(water),
    outcome: (g, before, memo, prev) => {
      for (let i = 0; i < g.size; i++) {
        if (g.kindOf(i) === M.Seed && prev.kindOf(i) === M.Pollen) { s.fromPollen++; if (g.hasFlag(i, F.Cosmic)) s.cosmic++; }
        if (g.kindOf(i) === M.Pollen && i + g.w < g.size && g.kindOf(i + g.w) === M.Soil) { s.onSoil++; if (g.hasFlag(i + g.w, F.Wet) || g.energyAt(i + g.w) > 60) s.wetSoilUnder++; }
      }
      return [];
    } }, { engine, colorForCell });
  console.log(name, water === M.Water ? "water" : "moonwater", k, JSON.stringify(s));
}
