import { M, STRIDE, jsEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const engine = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
let t = 0; const seen = [];
runCheck({ w: 30, h: 34, seed: 150, ticks: 200, paint: (p) => { p(15, 28, 3, M.Stone); p(15, 8, 3, M.Meteor); },
  outcome: (g, b, m, prev) => { t++;
    for (let i = 0; i < g.size; i++) if (g.kindOf(i) === M.Stardust && prev.kindOf(i) === M.Meteor && seen.length < 12)
      seen.push(`t${t} v${g.cells[i*STRIDE+1]} age${g.cells[i*STRIDE+2] | g.cells[i*STRIDE+3] << 8} e${g.energyAt(i)}`);
    return []; } }, { engine, colorForCell });
console.log(seen.join("\n"));
