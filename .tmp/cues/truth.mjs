// Steam-flash against ground truth. An instrumented engine copy logs every writeCellBytes; a
// real flash is a water/moonwater/fire cell written as Steam that still holds steam after the
// tick. Moves never go through writeCellBytes (move() copies bytes), so this is independent of
// any count. Each detector is then played through a model of the controller (priority, 0.28 s
// shared throttle, per-cue cooldown, 20 ticks a second) to count what a player would hear.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";

const here = import.meta.dirname;
const instr = compileApp("cue-truth", ["audio/reactions.ts", "materials.ts", "engine.ts"], { root: resolve(here, "instr") });
const base = compileApp("cue-truth-base", ["audio/reactions.ts", "materials.ts"], { root: resolve(here, "base") });
const { createFallbackEngine } = instr.load("engine");
const { MATERIAL: M } = instr.load("materials");
const NEW = instr.load("audio/reactions").detectReactionCues;
const OLD = base.load("audio/reactions").detectReactionCues;
const S = 8;
const CUE = process.env.CUE ?? "steam-flash";
const TARGET = M[process.env.TARGET ?? "Steam"];
const SOURCES = new Set((process.env.SOURCES ?? "Water,Moonwater,Fire").split(",").map((k) => M[k]));

const PRIORITY = ["crumble", "shatter", "impact-burst", "vitrify", "starfire", "cleanse", "ember-glow", "quench", "cosmic-charge", "bloom", "sprout", "erode", "frost", "dew", CUE];
const COOLDOWN = { "impact-burst": 0.9, cleanse: 1.2, "cosmic-charge": 1.15, bloom: 1.4, "steam-flash": 1.1, vitrify: 1.1, starfire: 1.0, "ember-glow": 1.25, quench: 1.05, crumble: 1.6, frost: 1.2, dew: 1.35, shatter: 1.2, erode: 1.5, sprout: 1.3 };
function heard(perTick) {
  let lastAny = -1e9; const last = {}; const plays = {};
  perTick.forEach((cues, t) => {
    const now = t / 20;
    if (!cues.length || now - lastAny < 0.28) return;
    const cue = PRIORITY.find((c) => cues.includes(c) && !(now - (last[c] ?? -1e9) < COOLDOWN[c]));
    if (!cue) return;
    lastAny = now; last[cue] = now; plays[cue] = (plays[cue] ?? 0) + 1;
  });
  return plays[CUE] ?? 0;
}

// The candidate local test: a flash cell is a bubble when a cell within reach traded places with it.
function localSteam(b, a, W, H) {
  for (let i = 0; i < a.length; i += S) {
    if (a[i] !== M.Steam || b[i] === M.Steam || !SOURCES.has(b[i])) continue;
    const c = i / S, x = c % W, y = (c - x) / W;
    let swapped = false;
    for (let dy = -2; dy <= 2 && !swapped; dy++) for (let dx = -2; dx <= 2 && !swapped; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = (ny * W + nx) * S;
      if (b[n] === M.Steam && a[n] === b[i]) swapped = true;
    }
    if (!swapped) return true;
  }
  return false;
}

const box = (e, x0, x1, y0, y1, wall = M.Wall) => {
  for (let x = x0; x <= x1; x++) for (const y of [y1, y1 - 1]) e.paint(x, y, 1, wall);
  for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) e.paint(x, y, 1, wall);
};
const fill = (e, x0, x1, y0, y1, k) => { for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) e.paint(x, y, 1, k); };
const SCENES = process.env.CUE ? {
  "stardust into water": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 28, 35, M.Water); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 4, 2, M.Stardust, 40); } },
  "stardust over a big pond": { ticks: 800, setup: (e) => { box(e, 4, 44, 12, 38); fill(e, 7, 41, 18, 35, M.Water); }, act: (e, t) => { if (t % 20 === 0) e.paint(10 + (t % 28), 4, 1, M.Stardust, 30); } },
  "garden grows": { w: 60, h: 34, ticks: 2500, setup: (e) => {
      for (let x = 14; x <= 46; x++) e.paint(x, 28, 4, M.Soil, 55);
      for (let x = 14; x <= 46; x++) e.paint(x, 23, 4, M.Seed, 55);
      for (let x = 14; x <= 46; x += 2) e.paint(x, 17, 4, M.Water, 55);
    } },
} : {
  "boiling pour (review)": { ticks: 800, setup: (e) => { box(e, 8, 40, 14, 38, M.Glass); fill(e, 11, 37, 28, 35, M.Water); },
    act: (e, t) => { if (t % 10 === 0) e.paint(24, 8, 2, M.Lava, 50); if (t % 4 === 0) e.paint(18 + (t % 12), 8, 2, M.Water, 50); } },
  "lava under a pond": { ticks: 400, setup: (e) => { box(e, 8, 40, 14, 38); fill(e, 11, 37, 24, 33, M.Water); }, act: (e, t) => { if (t === 0) fill(e, 11, 37, 35, 35, M.Lava); } },
  "steam under a pond": { ticks: 200, setup: (e) => { box(e, 8, 40, 14, 38); fill(e, 11, 37, 24, 35, M.Water); }, act: (e, t) => { if (t === 0) e.paint(24, 35, 2, M.Steam); } },
  "water onto moonwater": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 30, 35, M.Moonwater); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 10, 2, M.Water, 60); } },
  "fire over a pond": { ticks: 300, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 30, 35, M.Water); }, act: (e, t) => { if (t < 100 && t % 5 === 0) e.paint(24, 26, 2, M.Fire, 60); } },
  "lava poured into a pond": { ticks: 600, setup: (e) => { box(e, 8, 40, 14, 38); fill(e, 11, 37, 26, 35, M.Water); }, act: (e, t) => { if (t < 200 && t % 6 === 0) e.paint(24, 6, 2, M.Lava, 50); } },
};

const seeds = Number(process.argv[2] ?? 4);
let W = 48, H = 40;
console.log("scene".padEnd(26), "truthTicks | old hit/false | new hit/false/missed | local hit/false/missed | heard: truth old new local");
for (const [name, sc] of Object.entries(SCENES)) {
  const r = { T: 0, oh: 0, of: 0, nh: 0, nf: 0, nm: 0, lh: 0, lf: 0, lm: 0, pT: 0, pO: 0, pN: 0, pL: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    W = sc.w ?? 48; H = sc.h ?? 40;
    const e = createFallbackEngine(W, H, seed);
    sc.setup(e);
    const lists = { T: [], O: [], N: [], L: [] };
    for (let t = 0; t < sc.ticks; t++) {
      sc.act?.(e, t);
      const b = e.getCellBytes().slice();
      globalThis.__writes = [];
      e.tick();
      const a = e.getCellBytes();
      const w = globalThis.__writes; globalThis.__writes = undefined;
      let truth = false;
      for (let k = 0; k < w.length && !truth; k += 2) {
        const i = w[k];
        if (w[k + 1] === TARGET && a[i] === TARGET && SOURCES.has(b[i])) truth = true;
      }
      const oc = OLD(b, a), nc = NEW(b, a);
      const o = oc.includes(CUE), n = nc.includes(CUE), l = localSteam(b, a, W, H);
      const rest = nc.filter((c) => c !== CUE);
      lists.T.push(truth ? [...rest, CUE] : rest);
      lists.O.push(oc); lists.N.push(nc);
      lists.L.push(l ? [...rest, CUE] : rest);
      r.T += truth;
      r.oh += o && truth; r.of += o && !truth;
      r.nh += n && truth; r.nf += n && !truth; r.nm += !n && truth;
      r.lh += l && truth; r.lf += l && !truth; r.lm += !l && truth;
    }
    r.pT += heard(lists.T); r.pO += heard(lists.O); r.pN += heard(lists.N); r.pL += heard(lists.L);
  }
  console.log(name.padEnd(26), String(r.T).padStart(5), "|", `${r.oh}/${r.of}`.padStart(9), "|", `${r.nh}/${r.nf}/${r.nm}`.padStart(14), "|", `${r.lh}/${r.lf}/${r.lm}`.padStart(14), "|", r.pT, r.pO, r.pN, r.pL);
}

// The reviewers' cosmic-soil repro: a cosmic grain over a plain one, falling.
{
  const e = createFallbackEngine(12, 10, 1);
  const bytes = e.getCellBytes();
  const put = (x, y, flags) => { const o = (y * 12 + x) * S; bytes[o] = M.Soil; bytes[o + 4] = 100; bytes[o + 6] = flags; };
  put(5, 2, 4); put(5, 3, 0);
  e.loadCellBytes(bytes);
  let oldRang = 0, newRang = 0;
  for (let t = 0; t < 12; t++) { const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes(); oldRang += OLD(b, a).includes("cosmic-charge"); newRang += NEW(b, a).includes("cosmic-charge"); }
  console.log(`cosmic soil falling: old rang ${oldRang}, new rang ${newRang}`);
}
