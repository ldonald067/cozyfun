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


const SPRING = [[20, 13], [19, 14], [20, 14], [21, 14], [20, 15]];
const plus = (x, y) => [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
// Every eraser dab in the box around the spring that does not touch the spring itself.
const THAW = [];
for (let y = 10; y <= 18; y++) for (let x = 16; x <= 24; x++) {
  if (!plus(x, y).some(([a, b]) => SPRING.some(([c, d]) => a === c && b === d))) THAW.push([x, y]);
}
const ICE = [[17, 14], [23, 14], [20, 11], [20, 17]];

// Petrichor wisps vented anywhere but straight up, counted where they were born while they
// stay there as mist (a wisp born under a pour sits in the water).
const sidewaysSticky = (g, before, memo, prev) => {
  memo.born ??= new Set();
  const age = (i) => g.cells[i * 8 + 2] | (g.cells[i * 8 + 3] << 8);
  for (let i = 0; i < g.size; i++) {
    if (g.kindOf(i) !== M.Steam || age(i) !== 0 || prev.kindOf(i) === M.Steam || g.energyAt(i) <= MIST_ENERGY) continue;
    const [x, y] = g.xyOf(i);
    if (prev.kindAt(x, y + 1) !== M.Soil) memo.born.add(i);
  }
  return [...memo.born].filter((i) => g.kindOf(i) === M.Steam && g.energyAt(i) > MIST_ENERGY);
};

const burst = (shelf) => ({ label: "burst chains " + shelf, w: 40, h: 44, seed: 168, ticks: 900,
  paint: (p) => {
    for (let x = 4; x <= 36; x++) p(x, 22, 1, M.Wall);
    for (let x = shelf + 1; x <= shelf + 9; x++) p(x, 25, 1, M.Rocket);
    for (let x = shelf; x <= shelf + 10; x++) p(x, 27, 0, M.Wall);
    p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire);
  },
  outcome: drifting(M.Stardust, (g, i, prev) => prev.kindOf(i) === M.Rocket && g.xyOf(i)[0] >= shelf, STARDUST) });

export const AGAINST = {
  "spring resumes": ["spring-stays-stilled"],
  "spring through pool 24": ["spring-bare-face-only"],
  "soil downpour sticky": ["soil-vents-up-only"],
  "fuse gap tall": ["fuse-jumps-gap"],
  "burst chains 21": ["burst-never-chains"],
  "burst chains 22": ["burst-never-chains"], "burst chains 20": ["burst-never-chains"], "burst chains 19": ["burst-never-chains"],
};

export const CANDIDATES = [
  { label: "spring resumes", w: 40, h: 34, seed: 161, ticks: 1500,
    paint: (p) => { p(20, 14, 1, M.Wellspring); p(20, 10, 0, M.Water); },
    act: (p, t) => {
      if (t === 4) for (const [x, y] of ICE) p(x, y, 1, M.Ice);
      if (t === 500) for (const [x, y] of THAW) p(x, y, 1, M.Empty);
    },
    outcome: newWaterAfter(500) },
  { label: "spring through pool 24", w: 40, h: 34, seed: 162, ticks: 2500,
    paint: (p) => {
      for (let y = 12; y <= 29; y++) { p(15, y, 0, M.Wall); p(25, y, 0, M.Wall); }
      p(20, 26, 0, M.Water); p(20, 28, 1, M.Wellspring);
    },
    outcome: (g) => g.all(M.Water).filter((i) => g.xyOf(i)[1] <= 24) },
  { label: "soil downpour sticky", w: 30, h: 26, seed: 165, ticks: 2000,
    paint: (p) => { p(15, 19, 6, M.Soil); },
    act: (p, t) => { if (t >= 800 && t < 830 && t % 3 === 0) p(15, 11, 5, M.Water); },
    outcome: sidewaysSticky },
  { label: "fuse gap tall", w: 80, h: 70, seed: 167, ticks: 600, absent: true,
    paint: (p) => {
      for (let x = 6; x <= 36; x++) p(x, 58, 1, M.Rocket);
      for (let x = 40; x <= 70; x++) p(x, 58, 1, M.Rocket);
      for (let x = 4; x <= 72; x++) p(x, 60, 0, M.Wall);
      p(6, 55, 1, M.Fire);
    },
    outcome: (g) => g.all(M.Rocket).filter((i) => g.energyAt(i) > 0 && g.xyOf(i)[0] >= 39) },
  burst(21), burst(22), burst(20), burst(19),
];
