import { CHECKS, M, F } from "../../scripts/interaction-scenes.mjs";
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const near = (g, x, y, pred) => AROUND.some(([dx, dy]) => { const k = g.kindAt(x + dx, y + dy); return k >= 0 && pred(k, (y + dy) * g.w + x + dx); });
const divider = (g, j) => { const [wx, wy] = g.xyOf(j); return wx >= 16 && wx <= 18 && wy <= 20; };
const resists = (g) => g.all(M.Moss).some((i) => { const [x, y] = g.xyOf(i); return g.energyAt(i) > 150 && !g.hasFlag(i, F.Cosmic) && near(g, x, y, (k, j) => k === M.Wall && divider(g, j) && (g.hasFlag(j, F.Wet) || g.energyAt(j) > 40)); });
const res = CHECKS.find((x) => x.role === "resists casual moss crossing");
const wall = (p) => { for (let y = 14; y < 22; y += 2) p(17, y, 1, M.Wall); };
export const CANDIDATES = [
  { ...res, label: "bed r4", requires: resists, paint: (p) => { p(11, 20, 4, M.Soil); p(11, 15, 2, M.Water); p(11, 20, 1, M.Moss); wall(p); p(24, 20, 3, M.Soil); } },
  { ...res, label: "bed wide", requires: resists, paint: (p) => { p(8, 20, 3, M.Soil); p(13, 20, 3, M.Soil); p(10, 15, 2, M.Water); p(8, 20, 1, M.Moss); wall(p); p(24, 20, 3, M.Soil); } },
];
export const AGAINST = { "bed r4": ["plain-moss-takes-wall"], "bed wide": ["plain-moss-takes-wall"] };
