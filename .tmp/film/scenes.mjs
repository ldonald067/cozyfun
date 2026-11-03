// Scratch: filmstrip scenes for the owner (2026-10-15).
import { M } from "../../scripts/interaction-scenes.mjs";

export const SCENES = {
  // A meteor falling past a powder heap on a ledge beside its path.
  "meteor-passes-fuse": { w: 48, h: 96, seed: 5003, ticks: [40, 46, 50, 53, 58, 70],
    crop: [8, 30, 44, 66], scale: 5,
    paint: (p) => {
      for (let x = 23; x <= 38; x++) p(x, 60, 1, M.Rocket);
      for (let x = 22; x <= 40; x++) p(x, 62, 0, M.Wall);
      p(19, 8, 0, M.Meteor);
    } },
  // Fireworks bursting under a ceiling beside an oil slick on a pond.
  "fireworks-light-oil": { w: 64, h: 64, seed: 5, ticks: [12, 20, 25, 30, 40, 55],
    crop: [2, 38, 61, 60], scale: 4,
    paint: (p) => {
      for (let x = 4; x <= 60; x++) p(x, 41, 0, M.Wall);
      for (let y = 51; y <= 60; y++) { p(26, y, 0, M.Wall); p(60, y, 0, M.Wall); }
      for (let x = 28; x <= 58; x++) for (let y = 55; y <= 59; y++) p(x, y, 0, M.Water);
      for (let x = 28; x <= 58; x++) p(x, 52, 0, M.Oil);
      p(17, 56, 3, M.Rocket);
    },
    act: (p, t) => { if (t === 1) p(17, 54, 0, M.Fire); } },
  // Stardust drifting onto a slick, then a flame at one end.
  "stardust-sheen": { w: 64, h: 50, seed: 7, ticks: [1, 150, 304, 310, 318, 334, 380],
    crop: [4, 20, 59, 44], scale: 4,
    paint: (p) => {
      for (let y = 32; y <= 46; y++) { p(6, y, 0, M.Wall); p(58, y, 0, M.Wall); }
      for (let x = 8; x <= 56; x++) for (let y = 41; y <= 45; y++) p(x, y, 0, M.Water);
      for (let x = 8; x <= 56; x++) p(x, 38, 0, M.Oil);
      for (const x of [16, 28, 40, 50]) p(x, 26, 1, M.Stardust);
    },
    act: (p, t) => { if (t >= 300 && t <= 303) p(9, 35, 0, M.Fire); } },
};
// 2026-10-17: the interaction audit's garden: one plant on a wide bed, watered now and then.
const garden = (p) => {
  for (let x = 4; x <= 76; x++) p(x, 36, 3, M.Soil, 55);
  p(40, 31, 1, M.Seed); p(40, 26, 3, M.Water);
};
const rain = (p, t) => { if (t % 400 === 200) for (let x = 6; x <= 74; x += 3) p(x, 20, 1, M.Water, 30); };
SCENES["garden-sows"] = { w: 80, h: 40, seed: 4102, ticks: [200, 1000, 2000, 3500, 5000, 6000], crop: [4, 12, 79, 38], scale: 4, paint: garden, act: rain };
SCENES["seed-glides"] = { w: 80, h: 40, seed: 4102, ticks: [215, 222, 236, 252, 268, 285, 900], crop: [14, 14, 44, 37], scale: 6, paint: garden, act: rain };
// Hand-placed: two sunflowers (variant 3) and a daisy (2) on bare stalks, opening from a bud.
// The second sunflower has a leaf beside the top of its stalk, as about half of plants do.
SCENES["sunflower-opens"] = { w: 60, h: 30, seed: 9, ticks: [1, 150, 300, 600], crop: [4, 8, 58, 28], scale: 6,
  paint: (p) => { for (let x = 2; x < 58; x++) p(x, 26, 0, M.Wall); },
  cells: (bytes, w) => {
    const put = (x, y, kind, variant, energy, flags, age = 20) => {
      const o = (y * w + x) * 8;
      bytes[o] = kind; bytes[o + 1] = variant; bytes[o + 2] = age; bytes[o + 3] = 0;
      bytes[o + 4] = energy & 255; bytes[o + 5] = energy >> 8; bytes[o + 6] = flags; bytes[o + 7] = 0;
    };
    for (const [cx, variant, leaf] of [[14, 3, false], [30, 3, true], [46, 2, false]]) {
      put(cx, 25, M.Soil, 0, 120, 1);
      for (let y = 19; y <= 24; y++) put(cx, y, M.Stem, variant, 20, y === 24 ? 2 : 0);
      if (leaf) put(cx - 1, 19, M.Stem, variant, 12, 0);
      put(cx, 18, M.Flower, variant, 200, 2);
    }
    return bytes;
  } };
SCENES["sunflower-close"] = { ...SCENES["sunflower-opens"], ticks: [300, 600], crop: [9, 12, 35, 21], scale: 14 };
// 2026-10-17 batch B: a meteor dropped on a firework charge (old: plain shells; new: star shells).
SCENES["meteor-fireworks"] = { w: 48, h: 80, seed: 3, ticks: [20, 30, 45, 60, 90, 140], crop: [4, 20, 44, 77], scale: 4,
  paint: (p) => {
    for (let x = 4; x <= 44; x++) { p(x, 76, 0, M.Wall); }
    for (let x = 18; x <= 30; x += 2) for (let y = 72; y <= 74; y += 2) p(x, y, 0, M.Rocket);
  },
  act: (p, t) => { if (t === 1) p(24, 40, 0, M.Meteor); } };
// Batch B: moss on a plank, a one-cell gap, a second plank; the left end watered.
SCENES["moss-gap"] = { w: 40, h: 30, seed: 162, ticks: [60, 200, 400, 700, 1100], crop: [0, 8, 34, 22], scale: 7,
  paint: (p) => {
    for (let x = 2; x <= 8; x++) p(x, 18, 0, M.Wood);
    for (let x = 12; x <= 30; x++) p(x, 18, 0, M.Wood);
    p(3, 16, 0, M.Moss);
  },
  act: (p, t) => { if (t < 300 && t % 12 === 0) p(5, 10, 0, M.Water); } };
// Batch C: the audit's lava-thaw scene and its hot-water basin.
SCENES["lava-thaw"] = { w: 50, h: 30, seed: 163, ticks: [290, 330, 360, 400, 460, 600], crop: [8, 10, 44, 27], scale: 5,
  paint: (p) => {
    for (let x = 4; x <= 46; x++) p(x, 25, 1, M.Wall);
    for (let x = 6; x <= 44; x++) p(x, 23, 0, M.Moss);
    p(30, 20, 2, M.Ice);
  },
  act: (p, t) => { if (t >= 300 && t < 340 && t % 4 === 0) p(20, 15, 1, M.Lava, 60); } };
SCENES["hot-melt"] = { w: 30, h: 26, seed: 164, ticks: [40, 80, 120, 180, 260, 400], crop: [5, 10, 25, 23], scale: 7,
  paint: (p) => {
    for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall);
    for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); }
    for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice);
  },
  act: (p, t) => { if (t >= 20 && t < 200 && t % 4 === 0) p(15, 12, 3, M.Fire); } };
SCENES["star-shell-close"] = { ...SCENES["meteor-fireworks"], ticks: [44, 50, 56, 62], crop: [8, 22, 40, 52], scale: 7 };
SCENES["stardust-sheen-close"] = { ...SCENES["stardust-sheen"], ticks: [150, 304, 308, 313, 320, 330], crop: [6, 24, 36, 41], scale: 7 };

// 2026-10-19, the owner's flower batch (renderer only). Heads are placed with the sim's own
// shapes, read out of the engine so this cannot drift from what the sim grows.
import { readFileSync } from "node:fs";
// Each build plants its OWN shapes (2026-10-22, the tulip and bluebell reshapes): film.mjs
// passes the build's root, so the base row is not handed heads its engine cannot hold.
const shapeCache = new Map();
const shapesOf = (root) => {
  const file = root ? new URL("app/src/engine.ts", "file://" + root.replace(/\/?$/, "/")) : new URL("../../app/src/engine.ts", import.meta.url);
  if (shapeCache.has(String(file))) return shapeCache.get(String(file));
  const engineText = readFileSync(file, "utf8");
  const shapeAt = engineText.indexOf("const BLOOM_SHAPES");
  const shapes = [...engineText.slice(engineText.indexOf("= [", shapeAt) + 3, engineText.indexOf("\n];", shapeAt))
    .matchAll(/^\s*\[((?:\s*\[-?\d+,\s*-?\d+\],?)+)\],\s*$/gm)]
    .map((m) => [...m[1].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)].map((q) => [Number(q[1]), Number(q[2])]));
  shapeCache.set(String(file), shapes);
  return shapes;
};
const F = { Wet: 1, Rooted: 2, Cosmic: 4, Frozen: 8, Scorched: 16 };
const planter = (w, plants) => (bytes, root) => {
  const SHAPES = shapesOf(root);
  const put = (x, y, kind, variant, energy, flags, age = 20) => {
    const o = (y * w + x) * 8;
    bytes[o] = kind; bytes[o + 1] = variant; bytes[o + 2] = age & 255; bytes[o + 3] = age >> 8;
    bytes[o + 4] = energy & 255; bytes[o + 5] = energy >> 8; bytes[o + 6] = flags; bytes[o + 7] = 0;
  };
  for (const { x, base, variant, flags = 0, leaf = 1 } of plants) {
    put(x, base, M.Soil, 0, 120, F.Wet);
    for (let i = 1; i <= 5; i++) put(x, base - i, M.Stem, variant, 20, (i === 1 ? F.Rooted : 0) | flags);
    put(x + leaf, base - 2, M.Stem, variant, 12, flags);
    put(x - leaf, base - 4, M.Stem, variant, 12, flags);
    const cy = base - 6;
    put(x, cy, M.Flower, variant, 95, F.Rooted | flags, 200);
    for (const [dx, dy] of SHAPES[variant]) put(x + dx, cy + dy, M.Flower, variant, 90, flags, 180);
  }
  return bytes;
};
const shelf = (rows, w) => (p) => { for (const y of rows) for (let x = 1; x < w - 1; x++) p(x, y, 0, M.Wall); };
SCENES["flowers-species"] = { w: 76, h: 20, seed: 11, ticks: [2], crop: [1, 3, 74, 18], scale: 8,
  paint: shelf([18], 76),
  cells: (b, w, root) => planter(w, [0, 1, 2, 3, 4, 5, 6, 7].map((v) => ({ x: 6 + v * 9, base: 17, variant: v })))(b, root) };
SCENES["flowers-states"] = { w: 52, h: 34, seed: 11, ticks: [1], crop: [1, 3, 50, 32], scale: 8,
  paint: shelf([17, 32], 52),
  cells: (b, w, root) => planter(w, [1, 2].flatMap((v, row) => [0, F.Wet, F.Frozen, F.Scorched, F.Cosmic]
    .map((flags, i) => ({ x: 6 + i * 10, base: 16 + row * 15, variant: v, flags }))))(b, root) };
// A real garden from painted materials only: a soil bed, a row of seeds, a watering, rain.
const meadow = (p) => {
  for (let x = 4; x <= 92; x++) p(x, 44, 3, M.Soil, 55);
  for (let x = 10; x <= 86; x += 8) p(x, 39, 0, M.Seed);
  for (let x = 8; x <= 88; x += 4) p(x, 34, 1, M.Water);
};
SCENES["garden-life"] = { w: 96, h: 48, seed: 4107, ticks: [250, 500, 900, 1400, 2200, 3200], crop: [4, 18, 92, 44], scale: 4,
  paint: meadow, act: rain };

// 2026-10-20, the heat batch (items 6 and 7): the same scenes as .tmp/heat/scenes.mjs.
import { SCENES as HEAT } from "../heat/scenes.mjs";
const heat = (name, ticks, crop, scale) => {
  const h = HEAT[name];
  return { w: h.w, h: h.h, seed: h.seed, ticks, crop, scale, paint: (p) => h.paint(p, M), act: h.act && ((p, t) => h.act(p, t, M)) };
};
SCENES["heat-slab"] = heat("slab", [20, 60, 100, 150, 200, 320], [5, 8, 25, 21], 7);
SCENES["heat-puddle"] = heat("puddle", [10, 50, 100, 150, 200, 420], [8, 14, 31, 26], 6);
SCENES["heat-thaw"] = heat("thaw", [298, 320, 350, 400, 500, 700], [8, 12, 44, 25], 4);
SCENES["heat-lava-ice"] = heat("ice-wall", [20, 60, 120, 200, 320], [6, 8, 43, 24], 4);

// 2026-10-22, the outline and the tulip/bluebell reshapes: a bud of each opening on its stalk.
SCENES["reshape-opening"] = { w: 30, h: 22, seed: 4646, ticks: [40, 120, 240, 400, 700, 1100], crop: [3, 5, 26, 18], scale: 7,
  paint: shelf([19], 30),
  cells: (b, w) => {
    const put = (x, y, kind, variant, energy, flags, age = 20) => {
      const o = (y * w + x) * 8;
      b[o] = kind; b[o + 1] = variant; b[o + 2] = age & 255; b[o + 3] = age >> 8;
      b[o + 4] = energy & 255; b[o + 5] = energy >> 8; b[o + 6] = flags; b[o + 7] = 0;
    };
    for (const [x, variant] of [[9, 4], [19, 6]]) {
      put(x, 18, M.Soil, 0, 120, F.Wet);
      for (let y = 13; y <= 17; y++) put(x, y, M.Stem, variant, 20, y === 17 ? F.Rooted : 0);
      put(x, 12, M.Flower, variant, 200, F.Rooted);
    }
    return b;
  } };

// 2026-10-28, HANDOFF item 2: petals a painted meadow sheds, base (pollen-gold) above the build
// (each in its flower's colour). A bluebell and a cornflower letting go, x 66-92.
SCENES["petals-fall"] = { w: 96, h: 48, seed: 4107, ticks: [1380, 1395, 1410, 1425, 1440, 1470, 1500], crop: [64, 24, 92, 44], scale: 7,
  paint: meadow, act: rain };
// The same meadow's tulip (x 20) letting go, 1320-1700.
SCENES["petals-tulip"] = { w: 96, h: 48, seed: 4107, ticks: [1300, 1340, 1380, 1440, 1520, 1620, 1690], crop: [6, 24, 34, 44], scale: 7,
  paint: meadow, act: rain };
// Tighter: the bluebell and cornflower shedding, for the owner's sheet.
SCENES["petals-close"] = { w: 96, h: 48, seed: 4107, ticks: [1395, 1410, 1425, 1440, 1470], crop: [66, 27, 91, 42], scale: 11,
  paint: meadow, act: rain };
