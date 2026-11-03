import { CHECKS, M, F } from "../../scripts/interaction-scenes.mjs";
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const near = (g, x, y, pred) => AROUND.some(([dx, dy]) => { const k = g.kindAt(x + dx, y + dy); return k >= 0 && pred(k, (y + dy) * g.w + x + dx); });
const blk = CHECKS.find((x) => x.role === "is blocked from feeding life by oil");
const soilOiled = (g) => g.all(M.Soil).some((i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k) => k === M.Water) && near(g, x, y, (k) => k === M.Oil); });
const greenedUnderOil = (g, b, m, prev) => g.all(M.Moss).filter((i) => { const [x, y] = g.xyOf(i); return prev.kindOf(i) === M.Soil && near(prev, x, y, (k) => k === M.Oil); });
// A slick lying on a soil bed, watered from above: water sinks through the oil onto the soil.
const slick = (p) => { p(15, 20, 4, M.Soil); for (let x = 9; x <= 21; x++) p(x, 16, 0, M.Oil); p(15, 11, 3, M.Water); };
export const CANDIDATES = [
  { ...blk, label: "scene greened", requires: soilOiled, outcome: greenedUnderOil },
  { ...blk, label: "slick greened", requires: soilOiled, paint: slick, outcome: greenedUnderOil },
];
export const AGAINST = Object.fromEntries(CANDIDATES.map((c) => [c.label, ["oil-never-blocks", "oil-never-dries"]]));
