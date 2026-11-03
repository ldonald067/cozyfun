// Batch 4 finals, with actor-away and precondition-away variants.
import { M, F, MIST_ENERGY, grid } from "../../scripts/interaction-scenes.mjs";

const newWaterAfter = (from) => (g, before, memo) => {
  memo.t = (memo.t ?? 0) + 1;
  if (memo.t < from) return [];
  if (memo.t === from) { memo.base = grid(g.cells.slice(), g.w, g.h); memo.against = memo.base; memo.count = g.count(M.Water); return []; }
  if (g.count(M.Water) <= memo.count) return [];
  return g.all(M.Water).filter((i) => memo.base.kindOf(i) !== M.Water);
};
const SPRING = [[20, 13], [19, 14], [20, 14], [21, 14], [20, 15]];
const plus = (x, y) => [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
const THAW = [];
for (let y = 10; y <= 18; y++) for (let x = 16; x <= 24; x++) {
  if (!plus(x, y).some(([a, b]) => SPRING.some(([c, d]) => a === c && b === d))) THAW.push([x, y]);
}
const ICE = [[17, 14], [23, 14], [20, 11], [20, 17]];
const spring = (thaw) => ({ w: 40, h: 34, seed: 161, ticks: 1500,
  paint: (p) => { p(20, 14, 1, M.Wellspring); p(20, 10, 0, M.Water); },
  act: (p, t) => {
    if (t === 4) for (const [x, y] of ICE) p(x, y, 1, M.Ice);
    if (thaw && t === 500) for (const [x, y] of THAW) p(x, y, 1, M.Empty);
  },
  outcome: newWaterAfter(500) });

const wisps = (g, before, memo, prev) => {
  memo.born ??= new Set();
  const age = (i) => g.cells[i * 8 + 2] | (g.cells[i * 8 + 3] << 8);
  for (let i = 0; i < g.size; i++) {
    if (g.kindOf(i) !== M.Steam || age(i) !== 0 || prev.kindOf(i) === M.Steam || g.energyAt(i) <= MIST_ENERGY) continue;
    const [x, y] = g.xyOf(i);
    const b = (y + 1) * g.w + x;
    if (y + 1 < g.h && prev.kindOf(b) === M.Soil && prev.energyAt(b) === 0 && g.energyAt(b) > 0) continue;
    memo.born.add(i);
  }
  return [...memo.born].filter((i) => g.kindOf(i) === M.Steam && g.energyAt(i) > MIST_ENERGY);
};
const pour = (soil, from) => ({ w: 30, h: 26, seed: 165, ticks: 2000,
  paint: (p) => { p(15, 19, 6, soil); },
  act: (p, t) => { if (t >= from && t < from + 30 && t % 3 === 0) p(15, 11, 5, M.Water); },
  outcome: wisps });

const tall = (liquid, w = 60) => ({ w, h: 40, seed: 169, ticks: 4000,
  paint: (p) => { for (let x = 8; x <= w - 8; x++) p(x, 34, 1, M.Soil); for (let x = 8; x <= w - 8; x++) p(x, 31, 0, M.Seed); for (let x = 14; x <= w - 8; x += 12) p(x, 24, 2, liquid); },
  outcome: (g) => {
    const out = [];
    for (let x = 0; x < g.w; x++) {
      let run = [];
      for (let y = 0; y <= g.h; y++) {
        const i = y * g.w + x;
        if (y < g.h && g.kindOf(i) === M.Stem) run.push(i);
        else { if (run.length >= 8) out.push(...run); run = []; }
      }
    }
    return out;
  } });

const mound = (volley, sides = [36]) => ({ w: 50, h: 80, seed: 172, ticks: 900,
  paint: (p) => {
    for (const cx of sides) { p(cx, 41, 3, M.Rocket); for (let x = cx - 6; x <= cx + 6; x++) p(x, 46, 0, M.Wall); }
    if (volley) { p(25, 72, 4, M.Rocket); p(25, 66, 4, M.Fire); }
  },
  outcome: (g, before, memo) => {
    memo.t = (memo.t ?? 0) + 1;
    if (memo.t <= 10) { memo.base = grid(g.cells.slice(), g.w, g.h); memo.against = memo.base; return []; }
    return g.vanished(M.Rocket, memo.base).filter((i) => { const [x, y] = g.xyOf(i); return y >= 36 && y <= 45 && Math.abs(x - 25) >= 6; });
  } });

export const AGAINST = {
  "smoke fades": ["smoke-never-fades"],
  "hearth contact": ["hearth-thaws-by-conduction"],
  "cosmic tall": ["cosmic-not-taller"],
  "spring resumes": ["spring-stays-stilled"],
  "spring through pool": ["spring-bare-face-only"],
  "soil pour": ["soil-vents-up-only"],
  "mound": ["burst-never-chains"], "mound both": ["burst-never-chains"], "cosmic tall wide": ["cosmic-not-taller"],
};
export const CANDIDATES = [
  { label: "smoke fades", w: 30, h: 30, seed: 163, ticks: 2400,
    paint: (p) => { p(15, 24, 3, M.Wood); p(15, 21, 1, M.Fire); },
    outcome: (g, before, memo) => {
      const n = g.count(M.Smoke);
      if (n >= (memo.peak ?? 0)) { memo.peak = n; memo.against = grid(g.cells.slice(), g.w, g.h); return []; }
      if (n * 2 > memo.peak) return [];
      return memo.against.all(M.Smoke).filter((i) => g.kindOf(i) === M.Empty);
    } },
  { label: "hearth contact", w: 30, h: 26, seed: 166, ticks: 2500, absent: true,
    paint: (p) => { for (let x = 6; x <= 20; x++) p(x, 16, 0, M.Wall); },
    act: (p, t) => {
      if (t === 1) p(10, 11, 3, M.Water, 60);
      if (t === 60) p(7, 13, 1, M.Ice);
      if (t >= 120 && t % 20 === 0) p(3, 16, 1, M.Fire);
    },
    outcome: (g, before, memo, prev) => g.all(M.Wall).filter((i) => g.xyOf(i)[0] >= 7 && prev.kindOf(i) === M.Wall && prev.hasFlag(i, F.Frozen) && !g.hasFlag(i, F.Frozen)) },
  { label: "cosmic tall", ...tall(M.Moonwater) },
  { label: "cosmic tall plain water", ...tall(M.Water) },
  { label: "spring resumes", ...spring(true) },
  { label: "spring resumes never thawed", ...spring(false) },
  { label: "spring through pool", w: 40, h: 34, seed: 162, ticks: 2500,
    paint: (p) => {
      for (let y = 12; y <= 29; y++) { p(15, y, 0, M.Wall); p(25, y, 0, M.Wall); }
      p(20, 26, 0, M.Water); p(20, 28, 1, M.Wellspring);
    },
    outcome: (g) => g.all(M.Water).filter((i) => g.xyOf(i)[1] <= 24) },
  { label: "soil pour", ...pour(M.Soil, 800) },
  { label: "soil pour as stone", ...pour(M.Stone, 800) },
  { label: "soil pour no dry spell", ...pour(M.Soil, 10) },
  { label: "mound", ...mound(true) },
  { label: "mound no volley", ...mound(false) },
  { label: "mound both", ...mound(true, [14, 36]) },
  { label: "cosmic tall wide", ...tall(M.Moonwater, 220) },
];
