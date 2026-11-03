// Batch 3 candidate witnesses. node .tmp/halves/try.mjs .tmp/halves/c-b3.mjs <seeds> <sabotage,...>
import { M, F, STRIDE, grid } from "../../scripts/interaction-scenes.mjs";

// Cells that turned from `from` into `to` on one tick, counted while they stay `to`.
const turned = (from, to, extra = () => true) => (g, before, memo, prev) => {
  memo.turned ??= new Set();
  for (let i = 0; i < g.size; i++) if (g.kindOf(i) === to && prev.kindOf(i) === from && extra(g, i, prev)) memo.turned.add(i);
  return [...memo.turned].filter((i) => g.kindOf(i) === to);
};
// Stardust grains that BECAME stardust from `from` (where `where` allows), followed as they
// drift: stardust never rests, it wanders a cell every other tick in any direction but straight up.
const followed = (from, where = () => true) => (g, before, memo, prev) => {
  memo.grains ??= new Set();
  const now = new Set();
  for (const i of memo.grains) {
    if (g.kindOf(i) === M.Stardust && prev.kindOf(i) === M.Stardust) { now.add(i); continue; }
    const [x, y] = g.xyOf(i);
    for (const [dx, dy] of [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
      const j = (y + dy) * g.w + x + dx;
      if (g.kindAt(x + dx, y + dy) === M.Stardust && prev.kindOf(j) !== M.Stardust && !now.has(j)) { now.add(j); break; }
    }
  }
  for (let i = 0; i < g.size; i++) if (g.kindOf(i) === M.Stardust && prev.kindOf(i) === from && where(g, i, prev)) now.add(i);
  memo.grains = now;
  return [...now];
};
// The same grid with one flag cleared everywhere: "what would this look like without it".
const without = (g, flag) => {
  const c = g.cells.slice();
  for (let i = 0; i < g.size; i++) {
    const v = c[i * STRIDE + 6] | (c[i * STRIDE + 7] << 8);
    const n = v & ~flag;
    c[i * STRIDE + 6] = n & 255; c[i * STRIDE + 7] = n >> 8;
  }
  return grid(c, g.w, g.h);
};

// Which sabotages each candidate is scored against.
export const AGAINST = {
  "meteor lands as stardust": ["meteor-never-stardust"], "meteor stardust r1": ["meteor-never-stardust"],
  "stardust etches wall": ["stardust-skips-wall"], "stardust charges fungus": ["stardust-skips-fungus"],
  "fungus digests soil": ["fungus-skips-soil"], "water rinses wall": ["wall-never-rinses"],
  "stalk climbs through water": ["no-growth-through-water"], "cosmic pollen seeds cosmic": ["pollen-seed-plain"],
  "rocket bursts on ceiling": ["ceiling-fizzles"], "stone pillar holds": ["stone-slips"],
  "lava lights a fuse": ["lava-never-lights-rocket"], "ember lights a fuse": ["ember-never-lights-rocket"],
  "meteor lights a fuse": ["meteor-never-lights-rocket"], "meteor on a slab": ["meteor-never-stardust"], "meteor stardust followed": ["meteor-never-stardust"],
};

export const CANDIDATES = [
  { label: "meteor lands as stardust", w: 30, h: 34, seed: 150, ticks: 900,
    paint: (p) => { p(15, 28, 3, M.Stone); p(15, 8, 3, M.Meteor); },
    outcome: turned(M.Meteor, M.Stardust) },
  { label: "meteor stardust r1", w: 30, h: 34, seed: 150, ticks: 900,
    paint: (p) => { p(15, 28, 3, M.Stone); p(15, 6, 1, M.Meteor); },
    outcome: turned(M.Meteor, M.Stardust) },

  { label: "stardust etches wall", w: 30, h: 26, seed: 151, ticks: 1500,
    paint: (p) => { p(15, 19, 3, M.Wall); p(15, 15, 2, M.Stardust); },
    outcome: (g, before) => g.gained(M.Wall, F.Cosmic, before) },

  { label: "stardust charges fungus", w: 30, h: 26, seed: 152, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Fungus); p(15, 16, 2, M.Stardust); },
    outcome: (g, before) => g.gained(M.Fungus, F.Cosmic, before) },

  { label: "fungus digests soil", w: 30, h: 26, seed: 153, ticks: 3000,
    paint: (p) => { p(15, 20, 4, M.Soil); p(15, 15, 1, M.Fungus); },
    outcome: turned(M.Soil, M.Fungus) },

  { label: "water rinses wall", w: 40, h: 34, seed: 154, ticks: 2200,
    paint: (p) => { for (let y = 25; y >= 12; y--) p(24, y, 4, M.Wall); p(15, 26, 3, M.Wood); p(15, 20, 4, M.Fire, 55); },
    act: (p, t) => { if (t === 700) p(24, 4, 4, M.Water, 55); },
    outcome: (g, before, memo) => {
      memo.sooty ??= new Set();
      memo.rinsed ??= new Set();
      for (const i of g.all(M.Wall)) if (g.hasFlag(i, F.Scorched)) memo.sooty.add(i);
      for (const i of memo.sooty) if (g.kindOf(i) === M.Wall && !g.hasFlag(i, F.Scorched)) memo.rinsed.add(i);
      if (!memo.rinsed.size) memo.against = grid(g.cells.slice(), g.w, g.h);
      return [...memo.rinsed].filter((i) => g.kindOf(i) === M.Wall && !g.hasFlag(i, F.Scorched));
    } },

  { label: "stalk climbs through water", w: 40, h: 40, seed: 155, ticks: 3000,
    paint: (p) => {
      for (let y = 12; y <= 34; y++) { p(10, y, 1, M.Wall); p(30, y, 1, M.Wall); }
      for (let x = 12; x <= 28; x++) p(x, 33, 1, M.Soil);
      for (let x = 12; x <= 28; x++) p(x, 30, 1, M.Seed);
      for (const x of [14, 20, 26]) p(x, 16, 3, M.Water);
    },
    outcome: turned(M.Water, M.Stem) },

  { label: "cosmic pollen seeds cosmic", w: 40, h: 34, seed: 156, ticks: 9000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Moonwater); },
    outcome: (g, before, memo, prev) => {
      memo.against = without(g, F.Cosmic);
      return turned(M.Pollen, M.Seed, (g2, i) => g2.hasFlag(i, F.Cosmic))(g, before, memo, prev).filter((i) => g.hasFlag(i, F.Cosmic));
    } },

  { label: "rocket bursts on ceiling", w: 30, h: 44, seed: 157, ticks: 900,
    paint: (p) => { for (let x = 4; x <= 26; x++) p(x, 22, 1, M.Wall); p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire); },
    // The stardust a burst under the ceiling leaves, followed as it drifts down.
    outcome: followed(M.Rocket, (g, i) => g.xyOf(i)[1] > 22 && g.xyOf(i)[1] <= 26) },

  { label: "stone pillar holds", w: 24, h: 30, seed: 158, ticks: 600, absent: true,
    paint: (p) => { for (let y = 8; y <= 25; y++) for (let x = 11; x <= 13; x++) p(x, y, 1, M.Stone); },
    outcome: (g, before) => g.appeared(M.Stone, before) },

  { label: "lava lights a fuse", w: 30, h: 40, seed: 159, ticks: 900,
    paint: (p) => { p(15, 34, 2, M.Rocket); p(15, 31, 1, M.Lava); },
    outcome: (g) => g.all(M.Spark) },
  { label: "ember lights a fuse", w: 50, h: 40, seed: 160, ticks: 1500,
    paint: (p) => { for (let x = 28; x <= 40; x++) p(x, 33, 2, M.Wood); p(43, 33, 2, M.Rocket); },
    act: (p, t) => { if (t <= 60 && t % 4 === 1) p(28, 29, 1, M.Fire); },
    outcome: (g) => g.all(M.Spark) },
  { label: "meteor lights a fuse", w: 30, h: 60, seed: 161, ticks: 900,
    paint: (p) => { p(15, 52, 3, M.Rocket); p(15, 8, 1, M.Meteor); },
    outcome: (g) => g.all(M.Spark).filter((i) => g.energyAt(i) > 90) },
  { label: "meteor on a slab", w: 30, h: 34, seed: 150, ticks: 900,
    paint: (p) => { for (let x = 6; x <= 24; x++) p(x, 28, 1, M.Stone); p(15, 8, 3, M.Meteor); },
    outcome: turned(M.Meteor, M.Stardust) },
  { label: "meteor stardust followed", w: 30, h: 34, seed: 150, ticks: 900,
    paint: (p) => { p(15, 28, 3, M.Stone); p(15, 8, 3, M.Meteor); },
    // A meteor that stopped here, not one that moved on while a drifting grain stepped in.
    outcome: followed(M.Meteor, (g, i, prev) => {
      const [x, y] = g.xyOf(i);
      return ![-1, 0, 1].some((dx) => g.kindAt(x + dx, y + 1) === M.Meteor && prev.kindOf((y + 1) * g.w + x + dx) !== M.Meteor);
    }) },
];
// Actor- and precondition-away variants of the candidates above.
const get = (l) => CANDIDATES.find((c) => c.label === l);
CANDIDATES.push(
  { ...get("water rinses wall"), label: "rinse wall, no pour", act: undefined },
  { ...get("rocket bursts on ceiling"), label: "ceiling burst, no ceiling", paint: (p) => { p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire); } },
  { ...get("ember lights a fuse"), label: "ember fuse, no wood", paint: (p) => { p(43, 33, 2, M.Rocket); } },
  { ...get("stalk climbs through water"), label: "stalk, no water", paint: (p) => {
    for (let y = 12; y <= 34; y++) { p(10, y, 1, M.Wall); p(30, y, 1, M.Wall); }
    for (let x = 12; x <= 28; x++) p(x, 33, 1, M.Soil);
    for (let x = 12; x <= 28; x++) p(x, 30, 1, M.Seed);
  } },
);
