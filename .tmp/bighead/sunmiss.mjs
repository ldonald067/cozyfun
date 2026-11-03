// Scratch: on the sunflower check's missed seeds, did a sunflower grow, and how far did it open?
import { CHECKS, runCheck, jsEngine, colorForCell, M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("bh-sunmiss", ["engine.ts", "materials.ts"]);
const engine = jsEngine(app.load("engine").createFallbackEngine);
const SHAPE = app.load("engine").BLOOM_SHAPES[3];
const c = CHECKS.find((x) => /sunflower whole/.test(x.role));
for (const k of process.argv.slice(2).map(Number)) {
  const best = new Map();
  runCheck({ ...c, seed: c.seed + k * 1000, outcome: (g, b, m, p) => {
    for (const crown of g.all(M.Flower)) {
      if (!g.hasFlag(crown, F.Rooted) || g.cells[crown * STRIDE + 1] !== 3) continue;
      const [x, y] = g.xyOf(crown);
      const open = SHAPE.filter(([dx, dy]) => g.kindAt(x + dx, y + dy) === M.Flower && g.cells[((y + dy) * g.w + x + dx) * STRIDE + 1] === 3).length;
      const shut = SHAPE.filter(([dx, dy]) => g.kindAt(x + dx, y + dy) !== M.Flower).map(([dx, dy]) => g.kindAt(x + dx, y + dy));
      if (open > (best.get(x)?.open ?? -1)) best.set(x, { open, blockers: [...new Set(shut)].join(",") });
    }
    return c.outcome(g, b, m, p);
  } }, { engine, colorForCell });
  console.log(`#${k}:`, best.size ? [...best].map(([x, r]) => `sunflower at x=${x} opened ${r.open}/${SHAPE.length} (shut cells hold kinds ${r.blockers})`).join("; ") : "no sunflower grew");
}
