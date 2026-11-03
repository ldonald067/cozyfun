import { M } from "../../scripts/interaction-scenes.mjs";
const HOT = [M.Fire, M.Lava, M.Meteor];
const basin = (p) => { for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall); for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); } };
const near = (g, x, y, pred) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && pred(g.kindAt(x + dx, y + dy), (y + dy) * g.w + x + dx)) return true; return false; };
const HOLD = (t) => t >= 20 && t < 100 && t % 4 === 0;
const meltByHot = (g, before, memo, prev) => {
  memo.t = (memo.t ?? -1) + 1;
  memo.melted ??= new Set();
  if (!HOLD(memo.t)) for (let i = 0; i < g.size; i++) {
    if (prev.kindOf(i) !== M.Ice || g.kindOf(i) !== M.Water) continue;
    const [x, y] = g.xyOf(i);
    if (!near(prev, x, y, (k) => HOT.includes(k))) memo.melted.add(i);
  }
  return [...memo.melted].filter((i) => g.kindOf(i) === M.Water);
};
const resist = (K) => (g, before, memo, prev) => {
  memo.run ??= new Map();
  const hotBesideIce = (G, i) => { if (G.kindOf(i) !== M.Water || G.energyAt(i) <= 120) return false; const [x, y] = G.xyOf(i); return near(G, x, y, (k) => k === M.Ice); };
  const run = new Map();
  for (let i = 0; i < g.size; i++) if (hotBesideIce(g, i)) run.set(i, (memo.run.get(i) ?? 0) + 1);
  memo.run = run;
  memo.max = Math.max(memo.max ?? 0, ...run.values());
  return [...run].filter(([, n]) => n >= K).map(([i]) => i);
};
const scene = { w: 30, h: 26, seed: 141, ticks: 600,
  paint: (p) => { basin(p); for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice); },
  act: (p, t) => { if (HOLD(t)) p(15, 12, 2, M.Fire); } };
export const CANDIDATES = [
  { label: "melt by hot water", ...scene, outcome: meltByHot },
  { label: "hot water beside ice 2", ...scene, outcome: resist(2) },
  { label: "hot water beside ice 4", ...scene, outcome: resist(4) },
];
