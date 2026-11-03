import { M, F, jsEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const names = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
let t = 0;
const landed = {};
runCheck({ w: 40, h: 34, seed: 156, ticks: 9000,
  paint: (p) => { for (let x = 3; x <= 37; x++) p(x, 28, 1, M.Soil); p(20, 25, 1, M.Seed); for (let x = 4; x <= 36; x += 4) p(x, 22, 1, M.Water); },
  outcome: (g, before, memo, prev) => {
    t++;
    // What does settled pollen rest on?
    for (const i of g.all(M.Pollen)) if (prev.kindOf(i) === M.Pollen && i + g.w < g.size) { const k = names[g.kindOf(i + g.w)]; landed[k] = (landed[k] ?? 0) + 1; }
    if ([200, 1000, 3000, 6000, 9000].includes(t)) {
      const c = {}; for (let i = 0; i < g.size; i++) { const k = names[g.kindOf(i)]; if (k !== "Empty") c[k] = (c[k] ?? 0) + 1; }
      // the surface row material under open air, x 3..37
      let surf = {}; for (let x = 3; x <= 37; x++) for (let y = 0; y < g.h; y++) { const k = g.kindAt(x, y); if (k !== M.Empty && k !== M.Pollen && k !== M.Steam) { surf[names[k]] = (surf[names[k]] ?? 0) + 1; break; } }
      console.log(t, JSON.stringify(c), "surface", JSON.stringify(surf));
    }
    return [];
  } }, { engine, colorForCell });
console.log("pollen rests on", JSON.stringify(landed));
