import { M, F } from "../../scripts/interaction-scenes.mjs";
const nbrs = (g, i) => { const [x, y] = g.xyOf(i); const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.kindAt(x + dx, y + dy) >= 0) out.push((y + dy) * g.w + x + dx); return out; };
const lavaThaw = (g, before, memo, prev) => {
  memo.thawed ??= new Set();
  for (let i = 0; i < g.size; i++) {
    const k = g.kindOf(i);
    if (k === M.Ice || k !== prev.kindOf(i) || !prev.hasFlag(i, F.Frozen) || g.hasFlag(i, F.Frozen) || g.energyAt(i) === 0) continue;
    let lava = false, other = false;
    for (const j of nbrs(prev, i)) {
      if (prev.kindOf(j) === M.Lava || g.kindOf(j) === M.Lava) lava = true;
      const n = prev.kindOf(j);
      if (n === M.Fire || n === M.Meteor || n === M.Wall) other = true;
    }
    if (lava && !other) { memo.thawed.add(i); memo.against ??= prev; }
  }
  return [...memo.thawed].filter((i) => g.kindOf(i) !== M.Ice && !g.hasFlag(i, F.Frozen) && g.kindOf(i) === before.kindOf(i));
};
const stresses = (p) => { p(20, 21, 4, M.Stone); };
const stressAct = (lavaAt, x, y, r) => (p, t) => { if (t === 20) p(20, 12, 4, M.Water, 55); if (t === 60) p(13, 21, 4, M.Ice); if (t === lavaAt) p(x, y, r, M.Lava, 55); };
export const CANDIDATES = [
  { label: "rock, lava on the ice", w: 40, h: 30, seed: 147, ticks: 1500, paint: stresses, act: stressAct(400, 13, 12, 3), outcome: lavaThaw },
  { label: "rock, lava on the rock", w: 40, h: 30, seed: 147, ticks: 1500, paint: stresses, act: stressAct(400, 20, 12, 3), outcome: lavaThaw },
  { label: "rock, lava on the seam", w: 40, h: 30, seed: 147, ticks: 1500, paint: stresses, act: stressAct(400, 16, 11, 2), outcome: lavaThaw },
];
CANDIDATES.length = 0;
const thawScene = (lava, r) => ({ w: 30, h: 26, seed: 147, ticks: 3000, paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 1, M.Water); },
  act: (p, t) => { if (t === 200) p(15, 17, 1, M.Ice); if (t === 1400) p(15, 16, r, lava); }, outcome: lavaThaw });
CANDIDATES.push({ label: "fire.thaws gesture, lava r2", ...thawScene(M.Lava, 2) });
CANDIDATES.push({ label: "fire.thaws gesture, lava r3", ...thawScene(M.Lava, 3) });
CANDIDATES.length = 0;
const slab = (lavaR) => ({ w: 34, h: 28, seed: 147, ticks: 2000,
  paint: (p) => { for (let x = 7; x <= 27; x++) p(x, 20, 1, M.Stone); },
  act: (p, t) => { if (t === 20) p(17, 12, 4, M.Water, 55); if (t === 120) for (let x = 9; x <= 25; x += 2) p(x, 17, 1, M.Ice); if (t === 600) p(17, 13, lavaR, M.Lava, 55); },
  outcome: lavaThaw });
CANDIDATES.push({ label: "slab under ice, lava r3", ...slab(3) });
CANDIDATES.push({ label: "slab under ice, lava r4", ...slab(4) });
