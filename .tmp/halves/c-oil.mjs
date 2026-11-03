import { M, F } from "../../scripts/interaction-scenes.mjs";
// Cells still wet while touching both oil and water; logs the longest run any one cell stays so.
const near = (g, i, kind) => { const [x, y] = g.xyOf(i); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.kindAt(x + dx, y + dy) === kind) return true; return false; };
const wetUnderOil = (ticks) => (g, before, memo) => {
  memo.t = (memo.t ?? 0) + 1; memo.run ??= new Map(); memo.best ??= 0;
  const hit = [];
  for (let i = 0; i < g.size; i++) {
    const k = g.kindOf(i);
    if (![M.Wall, M.Sand, M.Soil, M.Wood, M.Stone, M.Seed].includes(k) || !g.hasFlag(i, F.Wet) || !near(g, i, M.Oil) || !near(g, i, M.Water)) { memo.run.delete(i); continue; }
    const r = (memo.run.get(i) ?? 0) + 1; memo.run.set(i, r); memo.best = Math.max(memo.best, r); hit.push(i);
  }
  if (memo.t === ticks) console.log(`   longest single-cell run wet beside oil and water: ${memo.best} ticks`);
  return hit;
};
export const AGAINST = { "wet sand oiled": ["oil-keeps-wet"], "seed bed oiled": ["oil-keeps-wet"] };
export const CANDIDATES = [
  { label: "wet sand oiled", w: 30, h: 26, seed: 173, ticks: 1500, paint: (p) => { p(15, 19, 3, M.Sand); p(15, 13, 2, M.Water); },
    act: (p, t) => { if (t === 300) p(15, 10, 3, M.Oil); if (t === 600) p(15, 8, 2, M.Water); }, outcome: wetUnderOil(1500) },
  { label: "seed bed oiled", w: 30, h: 26, seed: 30, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); }, outcome: wetUnderOil(2000) },
];
