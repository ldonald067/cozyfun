// Scratch (2026-10-28, HANDOFF item 3): candidate audit checks for four rules no check sees.
// Each `stat(memo)` reports what one run measured, so thresholds come from distributions.
import { M, F, STRIDE, TICKS_PER_SECOND } from "../../scripts/interaction-scenes.mjs";

const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const ageOf = (g, i) => g.cells[i * STRIDE + 2] | (g.cells[i * STRIDE + 3] << 8);
const near = (g, i, kinds) => { const [x, y] = g.xyOf(i); return AROUND.some(([dx, dy]) => kinds.includes(g.kindAt(x + dx, y + dy))); };
function steamBodies(g) {
  const seen = new Uint8Array(g.size); let biggest = 0;
  for (const start of g.all(M.Steam)) {
    if (seen[start]) continue;
    const body = [start]; seen[start] = 1;
    for (let k = 0; k < body.length; k++) {
      const [x, y] = g.xyOf(body[k]);
      for (const [dx, dy] of AROUND) {
        if (g.kindAt(x + dx, y + dy) !== M.Steam) continue;
        const j = (y + dy) * g.w + x + dx;
        if (!seen[j]) { seen[j] = 1; body.push(j); }
      }
    }
    biggest = Math.max(biggest, body.length);
  }
  return biggest;
}

const log = (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); };
function steamInBodies(g, n) {
  const seen = new Uint8Array(g.size), out = [];
  for (const start of g.all(M.Steam)) {
    if (seen[start]) continue;
    const body = [start]; seen[start] = 1;
    for (let k = 0; k < body.length; k++) {
      const [x, y] = g.xyOf(body[k]);
      for (const [dx, dy] of AROUND) {
        if (g.kindAt(x + dx, y + dy) !== M.Steam) continue;
        const j = (y + dy) * g.w + x + dx;
        if (!seen[j]) { seen[j] = 1; body.push(j); }
      }
    }
    if (body.length >= n) out.push(...body);
  }
  return out;
}
export const CANDIDATES = {
  cosmicPollenCheck: { covers: "flower.pollen", w: 60, h: 34, seed: 99, ticks: 3000,
    paint: (p) => {
      for (let y = 6; y <= 29; y++) p(30, y, 0, M.Wall);
      p(15, 28, 4, M.Soil); p(15, 23, 3, M.Seed); p(15, 18, 3, M.Water);
      p(45, 28, 4, M.Soil); p(45, 23, 3, M.Seed); p(45, 18, 3, M.Moonwater);
    },
    outcome: (g, before, memo, prev) => {
      memo.puffs ??= [0, 0]; memo.open ??= [0, 0];
      for (const i of prev.all(M.Flower)) {
        if (prev.energyAt(i) <= 41 || ageOf(prev, i) < 24) continue;
        const [x, y] = prev.xyOf(i);
        if (AROUND.some(([dx, dy]) => prev.kindAt(x + dx, y + dy) === M.Empty)) memo.open[x < 30 ? 0 : 1]++;
      }
      for (const i of g.all(M.Pollen)) if (ageOf(g, i) === 0 && !g.hasFlag(i, F.Rooted)) memo.puffs[g.xyOf(i)[0] < 30 ? 0 : 1]++;
      if (memo.puffs[0] < 20 || memo.puffs[1] < 20) return [];
      const [plain, moonlit] = memo.puffs.map((n, k) => n / memo.open[k]);
      if (moonlit < 1.5 * plain) return [];
      return g.all(M.Pollen).filter((i) => g.xyOf(i)[0] > 30 && !g.hasFlag(i, F.Rooted));
    },
    stat: (m) => ({ ratio: +((m.puffs[1] / m.open[1]) / (m.puffs[0] / m.open[0])).toFixed(2), puffs: m.puffs.join("/") }) },
  crackCheck: { covers: "ember.glows", w: 30, h: 26, seed: 137, ticks: 900, paint: log,
    outcome: (g, before, memo) => {
      memo.t = (memo.t ?? 0) + 1;
      memo.lit ??= new Map();
      const out = [];
      for (let i = 0; i < g.size; i++) {
        if (g.kindOf(i) !== M.Ember) { memo.lit.delete(i); continue; }
        if (!memo.lit.has(i)) memo.lit.set(i, memo.t);
        if (memo.t - memo.lit.get(i) < 20 * TICKS_PER_SECOND || g.energyAt(i) < 60) continue;
        if (!near(g, i, [M.Fire, M.Lava, M.Meteor])) out.push(i);
      }
      return out;
    } },
  hissCloud: { covers: "ember.quenched", w: 30, h: 26, seed: 110, ticks: 600, paint: log,
    act: (p, t) => { if (t === 40) p(15, 13, 4, M.Water); },
    outcome: (g) => steamInBodies(g, 80) },
  // The doused log, measured three ways at once: biggest cloud, and hisses (water that was
  // beside a hot ember last tick, with no flame, lava or steam beside it, and is steam now).
  hiss: { covers: "ember.quenched", w: 30, h: 26, seed: 110, ticks: 600, paint: log,
    act: (p, t) => { if (t === 40) p(15, 13, 4, M.Water); },
    outcome: (g, before, memo, prev) => {
      memo.peak = Math.max(memo.peak ?? 0, steamBodies(g));
      const n = g.count(M.Steam);
      memo.total = Math.max(memo.total ?? 0, n);
      memo.sum = (memo.sum ?? 0) + n;
      memo.hiss ??= new Set();
      for (const i of g.all(M.Steam)) {
        if (prev.kindOf(i) !== M.Water) continue;
        const [x, y] = g.xyOf(i);
        let hot = false, other = false;
        for (const [dx, dy] of AROUND) {
          const k = prev.kindAt(x + dx, y + dy), j = (y + dy) * g.w + x + dx;
          if (k === M.Ember && prev.energyAt(j) > 40) hot = true;
          if (k === M.Fire || k === M.Lava || k === M.Steam) other = true;
        }
        if (hot && !other) memo.hiss.add(i);
      }
      return [];
    },
    stat: (m) => ({ peak: m.peak, total: m.total, sum: m.sum, hiss: m.hiss.size }) },

  // Two gardens, one watered with water and one with moonwater, a wall between them. A puff is
  // pollen born this tick (age 0) and not a shed petal; it is counted against the head cells
  // that could have puffed last tick (budget over POLLEN_RESERVE, past 24 ticks, an open face).
  cosmicPollen: { covers: "flower.pollen", w: 60, h: 34, seed: 99, ticks: 3000,
    paint: (p) => {
      for (let y = 6; y <= 29; y++) p(30, y, 0, M.Wall);
      p(15, 28, 4, M.Soil); p(15, 23, 3, M.Seed); p(15, 18, 3, M.Water);
      p(45, 28, 4, M.Soil); p(45, 23, 3, M.Seed); p(45, 18, 3, M.Moonwater);
    },
    outcome: (g, before, memo, prev) => {
      memo.puffs ??= [0, 0]; memo.open ??= [0, 0];
      for (const i of prev.all(M.Flower)) {
        if (prev.energyAt(i) <= 41 || ageOf(prev, i) < 24) continue;
        const [x, y] = prev.xyOf(i);
        if (AROUND.some(([dx, dy]) => prev.kindAt(x + dx, y + dy) === M.Empty)) memo.open[x < 30 ? 0 : 1]++;
      }
      for (const i of g.all(M.Pollen)) if (ageOf(g, i) === 0 && !g.hasFlag(i, F.Rooted)) memo.puffs[g.xyOf(i)[0] < 30 ? 0 : 1]++;
      return [];
    },
    stat: (m) => {
      const r = m.puffs.map((n, k) => (m.open[k] ? (1000 * n) / m.open[k] : 0));
      return { puffs: m.puffs.join("/"), open: m.open.join("/"), perMille: r.map((v) => v.toFixed(2)).join("/"), ratio: r[0] ? +(r[1] / r[0]).toFixed(2) : 0 };
    } },

  // The burnt log: for each cell, how long after it caught it last glowed (energy >= 60, no
  // flame, lava or meteor beside it). The longest is what a player sees as the crack's length.
  crack: { covers: "ember.glows", w: 30, h: 26, seed: 137, ticks: 900, paint: log,
    outcome: (g, before, memo) => {
      memo.t = (memo.t ?? 0) + 1; memo.lit ??= new Map(); memo.longest ??= 0; memo.at20 ??= 0;
      for (let i = 0; i < g.size; i++) {
        if (g.kindOf(i) !== M.Ember) { memo.lit.delete(i); continue; }
        if (!memo.lit.has(i)) memo.lit.set(i, memo.t);
        if (g.energyAt(i) < 60 || near(g, i, [M.Fire, M.Lava, M.Meteor])) continue;
        const s = (memo.t - memo.lit.get(i)) / TICKS_PER_SECOND;
        memo.longest = Math.max(memo.longest, s);
      }
      return [];
    },
    stat: (m) => ({ longest: +m.longest.toFixed(1) }) },

  // A soaked wall bar, frosted by a dab of ice on its top, then lava set against its far end.
  // A thaw is a painted wall cell, frosted last tick and touching lava, unfrosted now (still
  // wall) or cracked to stone.
  lavaThaw: { covers: "lava.scorches", w: 40, h: 30, seed: 87, ticks: 900,
    paint: (p) => { for (let x = 8; x <= 26; x++) p(x, 20, 0, M.Wall); },
    act: (p, t) => {
      if (t === 1) p(17, 15, 3, M.Water, 60);
      if (t === 60) p(20, 17, 1, M.Ice);
      // The eraser dragged along the bar's top: a stroke of radius-1 dabs a row above it.
      if (t === 200) { p(17, 14, 3, M.Empty); for (let x = 10; x <= 24; x++) p(x, 17, 1, M.Empty); }
      if (t === 210) p(17, 13, 2, M.Lava, 55);
    },
    outcome: (g, before, memo, prev) => {
      memo.thawed ??= new Set(); memo.frosted ??= 0;
      memo.frosted = Math.max(memo.frosted, g.all(M.Wall).filter((i) => g.hasFlag(i, F.Frozen)).length);
      for (let i = 0; i < g.size; i++) {
        if (before.kindOf(i) !== M.Wall || prev.kindOf(i) !== M.Wall || !prev.hasFlag(i, F.Frozen)) continue;
        if (!near(prev, i, [M.Lava])) continue;
        // Lava's thaw adds its heat (72) to the brick, or cracks a frost-stressed one to stone;
        // the hearth only clears the flag, and a brick thawing on its own has run out of energy.
        const warmed = g.kindOf(i) === M.Wall && !g.hasFlag(i, F.Frozen) && g.energyAt(i) >= prev.energyAt(i) + 60;
        if (warmed || g.kindOf(i) === M.Stone) { memo.thawed.add(i); memo.against ??= prev; }
      }
      return [...memo.thawed].filter((i) => (g.kindOf(i) === M.Wall && !g.hasFlag(i, F.Frozen)) || g.kindOf(i) === M.Stone);
    },
    stat: (m) => ({ frosted: m.frosted, thawed: m.thawed.size }) },
};
