import { M } from "../../scripts/interaction-scenes.mjs";
const HOT = [M.Fire, M.Lava, M.Meteor];
const basin = (p) => { for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall); for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); } };
const near = (g, x, y, pred) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && pred(g.kindAt(x + dx, y + dy))) return true; return false; };
const mk = (label, hold, r) => {
  const scene = { w: 30, h: 26, seed: 141, ticks: 600,
    paint: (p) => { basin(p); for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice); },
    act: (p, t) => { if (hold(t)) p(15, 12, r, M.Fire); } };
  return [
    { label: label + " melt", ...scene, outcome: (g, before, memo, prev) => {
      memo.t = (memo.t ?? -1) + 1;
      memo.melted ??= new Set();
      if (!hold(memo.t)) for (let i = 0; i < g.size; i++) {
        if (prev.kindOf(i) !== M.Ice || g.kindOf(i) !== M.Water) continue;
        const [x, y] = g.xyOf(i);
        if (!near(prev, x, y, (k) => HOT.includes(k))) memo.melted.add(i);
      }
      return [...memo.melted].filter((i) => g.kindOf(i) === M.Water);
    } },
    { label: label + " absent", ...scene, absent: true,
      outcome: (g, before, memo, prev) => g.all(M.Ice).filter((i) => prev.kindOf(i) === M.Water && prev.energyAt(i) > 120) },
  ];
};
export const CANDIDATES = [
  ...mk("hold4s r2", (t) => t >= 20 && t < 100 && t % 4 === 0, 2),
  ...mk("hold9s r3", (t) => t >= 20 && t < 200 && t % 4 === 0, 3),
];
