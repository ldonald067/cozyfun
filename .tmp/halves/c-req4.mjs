import { CHECKS, M, F } from "../../scripts/interaction-scenes.mjs";
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const near = (g, x, y, pred) => AROUND.some(([dx, dy]) => { const k = g.kindAt(x + dx, y + dy); return k >= 0 && pred(k, (y + dy) * g.w + x + dx); });
const oiled = (g) => g.all(M.Seed).some((i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k) => k === M.Water) && near(g, x, y, (k) => k === M.Oil); });
const blk = CHECKS.find((x) => x.role === "is blocked from feeding life by oil");
const touchesOil = (g, i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k) => k === M.Oil); };
export const CANDIDATES = [
  { ...blk, label: "stem", requires: oiled, outcome: (g, b) => g.appeared(M.Stem, b) },
  { ...blk, label: "rooted", requires: oiled, outcome: (g, b) => g.gained(M.Seed, F.Rooted, b) },
  { ...blk, label: "moss", requires: oiled, outcome: (g, b) => g.appeared(M.Moss, b) },
  { ...blk, label: "wet-oiled", requires: oiled, outcome: (g) => [...g.all(M.Seed), ...g.all(M.Soil), ...g.all(M.Moss)].filter((i) => g.hasFlag(i, F.Wet) && touchesOil(g, i)) },
  { ...blk, label: "damp-oiled", requires: oiled, outcome: (g) => [...g.all(M.Seed), ...g.all(M.Soil)].filter((i) => g.energyAt(i) > 70 && touchesOil(g, i)) },
];
export const AGAINST = Object.fromEntries(CANDIDATES.map((c) => [c.label, ["oil-never-blocks", "oil-never-dries"]]));
