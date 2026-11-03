// Batch 4 candidate witnesses. node .tmp/halves/try-map.mjs .tmp/halves/c-b4.mjs <seeds> [label]
import { M, F, MIST_ENERGY, grid } from "../../scripts/interaction-scenes.mjs";

const driftingStardust = (from, where = () => true) => (g, before, memo, prev) => {
  memo.grains ??= new Map();
  const variant = (i) => g.cells[i * 8 + 1];
  const age = (i) => g.cells[i * 8 + 2] | (g.cells[i * 8 + 3] << 8);
  const now = new Map();
  for (const [i, grain] of memo.grains) {
    const [x, y] = g.xyOf(i);
    for (const [dx, dy] of [[0, 0], [0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
      const j = (y + dy) * g.w + x + dx;
      if (g.kindAt(x + dx, y + dy) !== M.Stardust || now.has(j)) continue;
      if (variant(j) === grain.variant && age(j) === grain.age + 1) { now.set(j, { variant: grain.variant, age: grain.age + 1 }); break; }
    }
  }
  for (let i = 0; i < g.size; i++) {
    if (g.kindOf(i) === M.Stardust && prev.kindOf(i) === from && age(i) === 0 && where(g, i)) now.set(i, { variant: variant(i), age: 0 });
  }
  memo.grains = now;
  return [...now.keys()];
};

// Water that appeared after tick `from`, counted only while there is more water than there was then.
const newWaterAfter = (from) => (g, before, memo) => {
  memo.t = (memo.t ?? 0) + 1;
  if (memo.t < from) return [];
  if (memo.t === from) { memo.base = grid(g.cells.slice(), g.w, g.h); memo.against = memo.base; memo.count = g.count(M.Water); return []; }
  if (g.count(M.Water) <= memo.count) return [];
  return g.all(M.Water).filter((i) => memo.base.kindOf(i) !== M.Water);
};

const ring = [[17, 22], [23, 22], [20, 19], [20, 25]];

export const AGAINST = {
  "spring resumes": ["spring-stays-stilled"],
  "spring through pool": ["spring-bare-face-only"],
  "smoke fades": ["smoke-never-fades"],
  "soil lidded": ["soil-vents-up-only"],
  "soil downpour": ["soil-vents-up-only"],
  "hearth contact": ["hearth-thaws-by-conduction"],
  "fuse gap": ["fuse-jumps-gap"],
  "burst chains": ["burst-never-chains"],
  "cosmic tall": ["cosmic-not-taller"],
};

export const CANDIDATES = [
  { label: "spring resumes", w: 40, h: 30, seed: 161, ticks: 1800,
    paint: (p) => { p(20, 22, 1, M.Wellspring); p(20, 18, 1, M.Water); },
    act: (p, t) => {
      if (t === 60) for (const [x, y] of ring) p(x, y, 1, M.Ice);
      if (t === 700) for (const [x, y] of ring) p(x, y, 1, M.Empty);
    },
    outcome: newWaterAfter(700) },
  { label: "spring through pool", w: 40, h: 34, seed: 162, ticks: 2500,
    paint: (p) => {
      for (let y = 12; y <= 29; y++) { p(15, y, 0, M.Wall); p(25, y, 0, M.Wall); }
      p(20, 28, 1, M.Wellspring); p(20, 24, 0, M.Water);
    },
    outcome: (g) => g.all(M.Water).filter((i) => g.xyOf(i)[1] <= 24) },
  { label: "smoke fades", w: 30, h: 30, seed: 163, ticks: 2400,
    paint: (p) => { p(15, 24, 3, M.Wood); p(15, 21, 1, M.Fire); },
    outcome: (g, before, memo) => {
      const n = g.count(M.Smoke);
      if (n >= (memo.peak ?? 0)) { memo.peak = n; memo.against = grid(g.cells.slice(), g.w, g.h); return []; }
      if (n * 2 > memo.peak) return [];
      return memo.against.all(M.Smoke).filter((i) => g.kindOf(i) === M.Empty);
    } },
  { label: "soil lidded", w: 40, h: 26, seed: 164, ticks: 2000,
    // Soil packed under a wall lid; water arrives along the floor from the side.
    paint: (p) => {
      for (let x = 8; x <= 24; x++) p(x, 14, 0, M.Wall);
      for (let y = 14; y <= 21; y++) p(8, y, 0, M.Wall);
      for (let x = 10; x <= 22; x++) for (let y = 16; y <= 20; y++) p(x, y, 0, M.Soil);
    },
    act: (p, t) => { if (t >= 800 && t < 860 && t % 6 === 0) p(32, 12, 3, M.Water, 40); },
    outcome: (g) => g.all(M.Steam).filter((i) => g.energyAt(i) > MIST_ENERGY) },
  { label: "soil downpour", w: 30, h: 26, seed: 165, ticks: 2000,
    paint: (p) => { p(15, 19, 6, M.Soil); },
    act: (p, t) => { if (t >= 800 && t < 830 && t % 3 === 0) p(15, 11, 5, M.Water); },
    outcome: (g) => g.all(M.Steam).filter((i) => g.energyAt(i) > MIST_ENERGY) },
  { label: "hearth contact", w: 30, h: 26, seed: 166, ticks: 2500, absent: true,
    // A three-row wall bar, a flame held at its left end, ice on the bar three bricks along.
    paint: (p) => { for (let x = 6; x <= 20; x++) p(x, 16, 0, M.Wall); },
    act: (p, t) => {
      if (t === 1) p(10, 11, 3, M.Water, 60);
      if (t === 60) p(7, 13, 1, M.Ice);
      if (t >= 120 && t % 20 === 0) p(3, 16, 1, M.Fire);
    },
    outcome: (g, before, memo, prev) => g.all(M.Wall).filter((i) => g.xyOf(i)[0] >= 7 && prev.kindOf(i) === M.Wall && prev.hasFlag(i, F.Frozen) && !g.hasFlag(i, F.Frozen)) },
  { label: "fuse gap", w: 80, h: 30, seed: 167, ticks: 600, absent: true,
    // Two lines on the floor with one cell of air between their feet, lit at the left end.
    paint: (p) => { for (let x = 6; x <= 36; x++) p(x, 25, 1, M.Rocket); for (let x = 40; x <= 70; x++) p(x, 25, 1, M.Rocket); p(6, 22, 1, M.Fire); },
    outcome: (g) => g.all(M.Rocket).filter((i) => g.energyAt(i) > 0 && g.xyOf(i)[0] >= 39) },
  { label: "burst chains", w: 40, h: 44, seed: 168, ticks: 900,
    // The ceiling launch, with a shelf of powder against the ceiling off to one side.
    paint: (p) => {
      for (let x = 4; x <= 34; x++) p(x, 22, 1, M.Wall);
      for (let x = 24; x <= 32; x++) p(x, 24, 1, M.Rocket);
      for (let x = 23; x <= 33; x++) p(x, 25, 0, M.Wall);
      p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire);
    },
    outcome: driftingStardust(M.Rocket, (g, i) => g.xyOf(i)[0] >= 23) },
  { label: "cosmic tall", w: 60, h: 40, seed: 169, ticks: 4000,
    paint: (p) => { for (let x = 8; x <= 52; x++) p(x, 34, 1, M.Soil); for (let x = 8; x <= 52; x++) p(x, 31, 0, M.Seed); for (const x of [14, 26, 38, 50]) p(x, 24, 2, M.Moonwater); },
    outcome: (g) => {
      const out = [];
      for (let x = 0; x < g.w; x++) {
        let run = [];
        for (let y = 0; y < g.h; y++) {
          const i = y * g.w + x;
          if (g.kindOf(i) === M.Stem) run.push(i);
          else { if (run.length >= 8) out.push(...run); run = []; }
        }
        if (run.length >= 8) out.push(...run);
      }
      return out;
    } },
];
