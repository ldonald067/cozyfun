import { M, grid } from "../../scripts/interaction-scenes.mjs";
const launched = (x0) => (g, before, memo) => {
  memo.t = (memo.t ?? -1) + 1;
  if (memo.t <= 5) { memo.against = grid(g.cells.slice(), g.w, g.h); return []; }
  return g.vanished(M.Rocket, memo.against).filter((i) => { const [x, y] = g.xyOf(i); return x >= x0 && y >= 57 && y <= 61; });
};
// Ledge from `ledge` (its brush arm reaches one cell further left), fuse from `fuse`.
const scene = (ledge, fuse, every, last) => ({ w: 48, h: 96, seed: 175, ticks: 700,
  paint: (p) => { for (let x = fuse; x <= 38; x++) p(x, 60, 1, M.Rocket); for (let x = ledge; x <= 40; x++) p(x, 62, 0, M.Wall); },
  act: (p, t) => { if (t % every === 1 && t <= last) p(19, 8, 0, M.Meteor); },
  outcome: launched(ledge - 1) });
export const AGAINST = {};
export const CANDIDATES = [];
for (const [ledge, fuse] of [[23, 25], [24, 26]]) for (const [every, last, tag] of [[1000, 1, "x1"], [40, 450, "x12"], [30, 600, "x20"]]) {
  const label = `ledge ${ledge} fuse ${fuse} ${tag}`;
  AGAINST[label] = ["trail-straight-down"];
  CANDIDATES.push({ label, ...scene(ledge, fuse, every, last) });
}
const tall = (drops) => ({ w: 48, h: 140, seed: 175, ticks: 30 * drops + 300,
  paint: (p) => { for (let x = 26; x <= 38; x++) p(x, 60, 1, M.Rocket); for (let x = 24; x <= 40; x++) p(x, 62, 0, M.Wall); },
  act: (p, t) => { if (t % 30 === 1 && t <= 30 * drops) p(19, 8, 0, M.Meteor); },
  outcome: launched(23) });
for (const d of [24, 32]) { AGAINST["tall x" + d] = ["trail-straight-down"]; CANDIDATES.push({ label: "tall x" + d, ...tall(d) }); }
// The fuse launched while no meteor had stopped beside the ledge: a meteor stops by turning
// into stone or stardust where it stands.
const passedNotLanded = (g, before, memo, prev) => {
  memo.t = (memo.t ?? -1) + 1;
  if (memo.t <= 5) { memo.against = grid(g.cells.slice(), g.w, g.h); return []; }
  const gone = g.vanished(M.Rocket, memo.against).filter((i) => { const [x, y] = g.xyOf(i); return x >= 23 && y >= 57 && y <= 61; });
  if (!memo.lit) {
    for (let i = 0; i < g.size; i++) {
      const [x, y] = g.xyOf(i);
      if (x >= 21 && y >= 50 && y <= 63 && prev.kindOf(i) === M.Meteor && (g.kindOf(i) === M.Stone || g.kindOf(i) === M.Stardust)) memo.landed = true;
    }
    if (gone.length) memo.lit = true;
  }
  return memo.landed ? [] : gone;
};
for (const d of [24]) { AGAINST["tall passed x" + d] = ["trail-straight-down"]; CANDIDATES.push({ label: "tall passed x" + d, ...tall(d), outcome: passedNotLanded }); }
