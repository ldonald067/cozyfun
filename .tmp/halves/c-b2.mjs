import { M, F } from "../../scripts/interaction-scenes.mjs";
const nbrs = (g, i) => { const [x, y] = g.xyOf(i); const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.kindAt(x + dx, y + dy) >= 0) out.push((y + dy) * g.w + x + dx); return out; };
// Moss that took two wood cells in one tick from one parent: each new cell's ONLY possible parent.
const burst = (g, before, memo, prev) => {
  memo.burst ??= new Set();
  const byParent = new Map();
  for (let i = 0; i < g.size; i++) {
    if (g.kindOf(i) !== M.Moss || prev.kindOf(i) !== M.Wood) continue;
    const parents = nbrs(prev, i).filter((j) => prev.kindOf(j) === M.Moss);
    if (parents.length === 1) byParent.set(parents[0], [...(byParent.get(parents[0]) ?? []), i]);
  }
  for (const kids of byParent.values()) if (kids.length >= 2) for (const k of kids) memo.burst.add(k);
  return [...memo.burst].filter((i) => g.kindOf(i) === M.Moss);
};
const tookWall = (g, before, memo, prev) => {
  memo.took ??= new Set();
  for (let i = 0; i < g.size; i++) if (g.kindOf(i) === M.Moss && prev.kindOf(i) === M.Wall) memo.took.add(i);
  return [...memo.took].filter((i) => g.kindOf(i) === M.Moss);
};
const STEM_ICE = Array.from({ length: 9 }, (_, k) => [14 + 4 * k, 14]);
const garden = (p) => {
  for (let x = 14; x <= 46; x++) p(x, 28, 4, M.Soil, 55);
  for (let x = 14; x <= 46; x++) p(x, 23, 4, M.Seed, 55);
  for (let x = 14; x <= 46; x += 2) p(x, 17, 4, M.Water, 55);
};
const frozeStem = (g, before, memo, prev) => {
  memo.froze ??= new Set();
  for (let i = 0; i < g.size; i++) if (g.kindOf(i) === M.Stem && g.hasFlag(i, F.Frozen) && prev.kindOf(i) === M.Stem && !prev.hasFlag(i, F.Frozen)) { memo.froze.add(i); memo.against ??= prev; }
  return [...memo.froze].filter((i) => g.kindOf(i) === M.Stem && g.hasFlag(i, F.Frozen));
};
const lavaThaw = (g, before, memo, prev) => {
  memo.thawed ??= new Set();
  for (let i = 0; i < g.size; i++) {
    const k = g.kindOf(i);
    if (k === M.Ice || k !== prev.kindOf(i) || !prev.hasFlag(i, F.Frozen) || g.hasFlag(i, F.Frozen) || g.energyAt(i) === 0) continue;
    let lava = false, other = false;
    for (const j of nbrs(prev, i)) {
      const n = prev.kindOf(j);
      if (n === M.Lava) lava = true;
      if (n === M.Fire || n === M.Meteor || n === M.Wall) other = true;
    }
    if (lava && !other) memo.thawed.add(i);
  }
  return [...memo.thawed].filter((i) => g.kindOf(i) === prev.kindOf(i) && !g.hasFlag(i, F.Frozen));
};
export const CANDIDATES = [
  { label: "moss burst (spreads scene)", w: 30, h: 26, seed: 26, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); }, outcome: burst },
  { label: "moss burst, no water", w: 30, h: 26, seed: 26, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(9, 20, 1, M.Moss); }, outcome: burst },
  { label: "moss takes moonwater wall", w: 34, h: 26, seed: 145, ticks: 2500,
    paint: (p) => { p(8, 20, 3, M.Soil); p(8, 20, 1, M.Moss); for (let y = 14; y < 22; y += 2) p(17, y, 1, M.Wall); p(12, 14, 2, M.Moonwater); },
    outcome: tookWall },
  { label: "moss wall, plain water", w: 34, h: 26, seed: 145, ticks: 2500,
    paint: (p) => { p(8, 20, 3, M.Soil); p(8, 20, 1, M.Moss); for (let y = 14; y < 22; y += 2) p(17, y, 1, M.Wall); p(12, 14, 2, M.Water); },
    outcome: tookWall },
  { label: "stem freezes", w: 60, h: 34, seed: 146, ticks: 3000,
    paint: garden, act: (p, t) => { if (t === 2500) for (const [x, y] of STEM_ICE) p(x, y, 4, M.Ice, 55); }, outcome: frozeStem },
  { label: "lava thaws", w: 30, h: 26, seed: 147, ticks: 3000,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 1, M.Water); },
    act: (p, t) => { if (t === 200) p(15, 17, 1, M.Ice); if (t === 1400) p(15, 16, 2, M.Lava); }, outcome: lavaThaw },
];
