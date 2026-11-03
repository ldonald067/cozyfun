import { CHECKS, M, F } from "../../scripts/interaction-scenes.mjs";
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const by = (role) => CHECKS.find((x) => x.role === role);
const near = (g, x, y, pred) => AROUND.some(([dx, dy]) => { const k = g.kindAt(x + dx, y + dy); return k >= 0 && pred(k, (y + dy) * g.w + x + dx); });
const divider = (g, j) => { const [wx, wy] = g.xyOf(j); return wx >= 16 && wx <= 18 && wy <= 20; };
const resists = (g) => g.all(M.Moss).some((i) => { const [x, y] = g.xyOf(i); return g.energyAt(i) > 150 && !g.hasFlag(i, F.Cosmic) && near(g, x, y, (k, j) => k === M.Wall && divider(g, j) && (g.hasFlag(j, F.Wet) || g.energyAt(j) > 40)); });
const atWall = (g) => g.all(M.Moss).some((i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k, j) => k === M.Wall && divider(g, j)); });
const smo = by("smothers hydration so seeds cannot sprout"), smo2 = by("is smothered by an oil coating");
const res = by("resists casual moss crossing"), twin = by("takes a soaked wall once moonwater has charged it");
const twinPaint = (p) => { p(8, 20, 3, M.Soil); p(8, 20, 1, M.Moss); for (let y = 14; y < 22; y += 2) p(17, y, 1, M.Wall); p(12, 14, 2, M.Water); };
export const CANDIDATES = [
  { ...smo, label: "smother" }, { ...smo2, label: "smother2" },
  { ...twin, absent: true, label: "twin took", requires: resists, paint: twinPaint },
  { ...twin, absent: true, label: "twin took at-wall", requires: atWall, paint: twinPaint },
  { ...res, label: "twin far", requires: resists, paint: (p) => { twinPaint(p); p(24, 20, 3, M.Soil); } },
];
export const AGAINST = {
  smother: ["oil-never-dries", "oil-never-smothers"], smother2: ["oil-never-dries", "oil-never-smothers"],
  "twin took": ["plain-moss-takes-wall"], "twin took at-wall": ["plain-moss-takes-wall"], "twin far": ["plain-moss-takes-wall"],
};
