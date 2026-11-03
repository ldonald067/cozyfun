// Batch 4, round 2. node .tmp/halves/try-map.mjs .tmp/halves/c-b4b.mjs <seeds> [label]
import { M, MIST_ENERGY, grid } from "../../scripts/interaction-scenes.mjs";

// Cells of `kind` born this tick where `where` allows, followed by identity (variant, age+1).
const drifting = (kind, born, offsets) => (g, before, memo, prev) => {
  memo.grains ??= new Map();
  const variant = (i) => g.cells[i * 8 + 1];
  const age = (i) => g.cells[i * 8 + 2] | (g.cells[i * 8 + 3] << 8);
  const now = new Map();
  for (const [i, grain] of memo.grains) {
    const [x, y] = g.xyOf(i);
    for (const [dx, dy] of offsets) {
      const j = (y + dy) * g.w + x + dx;
      if (g.kindAt(x + dx, y + dy) !== kind || now.has(j)) continue;
      if (variant(j) === grain.variant && age(j) === grain.age + 1) { now.set(j, { variant: grain.variant, age: grain.age + 1 }); break; }
    }
  }
  for (let i = 0; i < g.size; i++) {
    if (g.kindOf(i) === kind && age(i) === 0 && prev.kindOf(i) !== kind && born(g, i, prev)) now.set(i, { variant: variant(i), age: 0 });
  }
  memo.grains = now;
  return [...now.keys()];
};
const ALL8 = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const STARDUST = [[0, 0], [0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]];

// A petrichor wisp born anywhere but straight above a soil cell.
const sidewaysWisp = drifting(M.Steam, (g, i, prev) => {
  const [x, y] = g.xyOf(i);
  return g.energyAt(i) > MIST_ENERGY && prev.kindAt(x, y + 1) !== M.Soil && g.kindAt(x, y + 1) !== M.Soil;
}, ALL8);

const newWaterAfter = (from) => (g, before, memo) => {
  memo.t = (memo.t ?? 0) + 1;
  if (memo.t < from) return [];
  if (memo.t === from) { memo.base = grid(g.cells.slice(), g.w, g.h); memo.against = memo.base; memo.count = g.count(M.Water); return []; }
  if (g.count(M.Water) <= memo.count) return [];
  return g.all(M.Water).filter((i) => memo.base.kindOf(i) !== M.Water);
};

const ICE = [[17, 14], [23, 14], [20, 11], [20, 17]];
const THAW = [...ICE, [18, 12], [22, 12], [18, 16], [22, 16]];

export const AGAINST = {
  "spring resumes": ["spring-stays-stilled"],
  "spring through pool": ["spring-bare-face-only"],
  "soil downpour sideways": ["soil-vents-up-only"],
  "soil lidded sideways": ["soil-vents-up-only"],
  "fuse gap shelf": ["fuse-jumps-gap"],
  "burst chains": ["burst-never-chains"],
  "meteor trail first": ["trail-never-lights"],
};

export const CANDIDATES = [
  { label: "spring resumes", w: 40, h: 34, seed: 161, ticks: 1500,
    paint: (p) => { p(20, 14, 1, M.Wellspring); p(20, 10, 0, M.Water); },
    act: (p, t) => {
      if (t === 4) for (const [x, y] of ICE) p(x, y, 1, M.Ice);
      if (t === 500) for (const [x, y] of THAW) p(x, y, 1, M.Empty);
    },
    outcome: newWaterAfter(500) },
  { label: "spring through pool", w: 40, h: 34, seed: 162, ticks: 2500,
    paint: (p) => {
      for (let y = 12; y <= 29; y++) { p(15, y, 0, M.Wall); p(25, y, 0, M.Wall); }
      p(20, 26, 0, M.Water); p(20, 28, 1, M.Wellspring);
    },
    outcome: (g) => g.all(M.Water).filter((i) => g.xyOf(i)[1] <= 23) },
  { label: "soil downpour sideways", w: 30, h: 26, seed: 165, ticks: 2000,
    paint: (p) => { p(15, 19, 6, M.Soil); },
    act: (p, t) => { if (t >= 800 && t < 830 && t % 3 === 0) p(15, 11, 5, M.Water); },
    outcome: sidewaysWisp },
  { label: "soil lidded sideways", w: 40, h: 26, seed: 164, ticks: 2000,
    paint: (p) => {
      for (let x = 8; x <= 24; x++) p(x, 14, 0, M.Wall);
      for (let y = 14; y <= 21; y++) p(8, y, 0, M.Wall);
      for (let x = 10; x <= 22; x++) for (let y = 16; y <= 20; y++) p(x, y, 0, M.Soil);
    },
    act: (p, t) => { if (t >= 800 && t < 860 && t % 6 === 0) p(32, 12, 3, M.Water, 40); },
    outcome: sidewaysWisp },
  { label: "fuse gap shelf", w: 80, h: 30, seed: 167, ticks: 600, absent: true,
    // Two lines on a wall shelf, one air cell between their middle rows, lit at the left end.
    paint: (p) => {
      for (let x = 6; x <= 36; x++) p(x, 18, 1, M.Rocket);
      for (let x = 40; x <= 70; x++) p(x, 18, 1, M.Rocket);
      for (let x = 4; x <= 72; x++) p(x, 20, 0, M.Wall);
      p(6, 15, 1, M.Fire);
    },
    outcome: (g) => g.all(M.Rocket).filter((i) => g.energyAt(i) > 0 && g.xyOf(i)[0] >= 39) },
  { label: "burst chains", w: 40, h: 44, seed: 168, ticks: 900,
    paint: (p) => {
      for (let x = 4; x <= 34; x++) p(x, 22, 1, M.Wall);
      for (let x = 25; x <= 33; x++) p(x, 25, 1, M.Rocket);
      for (let x = 24; x <= 34; x++) p(x, 27, 0, M.Wall);
      p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire);
    },
    outcome: drifting(M.Stardust, (g, i, prev) => prev.kindOf(i) === M.Rocket && g.xyOf(i)[0] >= 23, STARDUST) },
  { label: "meteor trail first", w: 30, h: 60, seed: 170, ticks: 300,
    // A meteor shower onto a powder heap. Lit powder before any meteor has stopped.
    paint: (p) => { p(15, 52, 4, M.Rocket); p(15, 8, 3, M.Meteor); },
    outcome: (g, before, memo) => {
      if (memo.impacted) return [];
      if (g.appeared(M.Fire, before).length || g.appeared(M.Stone, before).length || g.appeared(M.Stardust, before).length) { memo.impacted = true; return []; }
      return g.all(M.Rocket).filter((i) => g.energyAt(i) > 0);
    } },
];
