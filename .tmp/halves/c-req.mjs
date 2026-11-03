// The eleven absent checks with a candidate `requires`, and with their precondition taken out.
import { CHECKS, M, F } from "../../scripts/interaction-scenes.mjs";
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const by = (role) => { const c = CHECKS.find((x) => x.role === role); if (!c) throw new Error(role); return c; };
const near = (g, x, y, pred) => AROUND.some(([dx, dy]) => { const k = g.kindAt(x + dx, y + dy); return k >= 0 && pred(k, (y + dy) * g.w + x + dx); });
const growable = (k) => k === M.Empty || k === M.Water || k === M.Moonwater;

const R = {
  pillar: (g) => g.all(M.Stone).some((i) => { const [x, y] = g.xyOf(i); return g.kindAt(x, y + 1) !== M.Empty && (g.kindAt(x - 1, y + 1) === M.Empty || g.kindAt(x + 1, y + 1) === M.Empty); }),
  hot: (g) => g.all(M.Water).some((i) => { const [x, y] = g.xyOf(i); return g.energyAt(i) > 120 && near(g, x, y, (k) => k === M.Ice); }),
  dry: (g) => g.all(M.Ice).some((i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k, j) => (k === M.Stone || k === M.Wall) && !g.hasFlag(j, F.Wet) && g.energyAt(j) <= 40); }),
  oiled: (g) => g.all(M.Seed).some((i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k) => k === M.Water) && near(g, x, y, (k) => k === M.Oil); }),
  frozen: (g) => g.all(M.Seed).some((i) => { const [x, y] = g.xyOf(i); return g.hasFlag(i, F.Frozen) && g.kindAt(x, y + 1) === M.Soil && growable(g.kindAt(x, y - 1)) && g.energyAt(i) > 70; }),
  frozenAny: (g) => g.all(M.Seed).some((i) => g.hasFlag(i, F.Frozen)),
  shadow: (g) => {
    const plants = [...g.all(M.Stem), ...g.all(M.Flower)].map((j) => g.xyOf(j));
    return g.all(M.Seed).some((i) => {
      const [x, y] = g.xyOf(i);
      if (!g.hasFlag(i, F.Rooted) || !growable(g.kindAt(x, y - 1))) return false;
      return plants.some(([px, py]) => Math.abs(px - x) <= 6 && Math.abs(py - y) <= 6);
    });
  },
  resists: (g) => g.all(M.Moss).some((i) => { const [x, y] = g.xyOf(i); return g.energyAt(i) > 150 && !g.hasFlag(i, F.Cosmic) && near(g, x, y, (k, j) => { const [wx, wy] = g.xyOf(j); return k === M.Wall && wx >= 16 && wx <= 18 && wy <= 20 && (g.hasFlag(j, F.Wet) || g.energyAt(j) > 40); }); }),
  mossAtWall: (g) => g.all(M.Moss).some((i) => { const [x, y] = g.xyOf(i); return near(g, x, y, (k, j) => { const [wx, wy] = g.xyOf(j); return k === M.Wall && wx >= 16 && wx <= 18 && wy <= 20; }); }),
  stilled: (g) => g.all(M.Wellspring).some((i) => { const [x, y] = g.xyOf(i); return g.energyAt(i) !== 0 && near(g, x, y, (k) => k === M.Ice); }),
};
const pillar = by("a pillar holds"), hot = by("never freezes hot water"), dry = by("leaves dry stone and wall bare");
const smo = by("smothers hydration so seeds cannot sprout"), smo2 = by("is smothered by an oil coating"), blk = by("is blocked from feeding life by oil");
const pau = by("pauses life in frozen dormancy"), dor = by("waits dormant when frozen"), sha = by("never sprouts in the shadow of a neighbouring plant");
const res = by("resists casual moss crossing"), sti = by("is stilled by nearby ice");
const noWater = (c) => (p) => c.paint((x, y, r, m, d) => { if (m !== M.Water) p(x, y, r, m, d); });
const swap = (c, from, to) => (p) => c.paint((x, y, r, m, d) => p(x, y, r, m === from ? to : m, d));
const drop = (c, mat) => (p) => c.paint((x, y, r, m, d) => { if (m !== mat) p(x, y, r, m, d); });
export const CANDIDATES = [
  { ...pillar, label: "pillar", requires: R.pillar },
  { ...pillar, label: "pillar as wall", requires: R.pillar, paint: swap(pillar, M.Stone, M.Wall) },
  { ...hot, label: "hot", requires: R.hot },
  { ...hot, label: "hot no flame", requires: R.hot, act: undefined },
  { ...dry, label: "dry", requires: R.dry },
  { ...dry, label: "dry no ice", requires: R.dry, act: undefined },
  { ...smo, label: "smother", requires: R.oiled },
  { ...smo, label: "smother no water", requires: R.oiled, paint: noWater(smo) },
  { ...smo, label: "smother no oil", requires: R.oiled, paint: drop(smo, M.Oil) },
  { ...smo2, label: "smother2", requires: R.oiled },
  { ...blk, label: "oilblocked", requires: R.oiled },
  { ...blk, label: "oilblocked no oil", requires: R.oiled, paint: drop(blk, M.Oil) },
  { ...pau, label: "pauses", requires: R.frozen },
  { ...pau, label: "pauses any-frozen", requires: R.frozenAny },
  { ...pau, label: "pauses no ice", requires: R.frozenAny, paint: drop(pau, M.Ice) },
  { ...dor, label: "dormant", requires: R.frozen },
  { ...sha, label: "shadow", requires: R.shadow },
  { ...sha, label: "shadow no water", requires: R.shadow, paint: noWater(sha) },
  { ...res, label: "resists", requires: R.resists },
  { ...res, label: "resists at-wall", requires: R.mossAtWall },
  { ...sti, label: "stilled", requires: R.stilled },
  { ...sti, label: "stilled no dab", requires: R.stilled, paint: noWater(sti) },
  { ...sti, label: "stilled no ice", requires: R.stilled, paint: drop(sti, M.Ice), act: undefined },
];
export const AGAINST = {
  pillar: ["stone-slips"], hot: ["ice-freezes-hot"], dry: ["ice-frosts-dry"],
  smother: ["oil-never-blocks"], smother2: ["oil-never-blocks"], oilblocked: ["oil-never-blocks"],
  pauses: ["frozen-seed-grows"], "pauses any-frozen": ["frozen-seed-grows"], dormant: ["frozen-seed-grows"],
  shadow: ["no-spacing"], resists: ["plain-moss-takes-wall"], "resists at-wall": ["plain-moss-takes-wall"], stilled: ["spring-never-stilled"],
};
