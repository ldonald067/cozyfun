// Which reaction cues fire on movement alone? For each scene, play the real JS mirror tick by
// tick, run the detector on consecutive frames, and ask of every firing whether anything the
// cue names actually happened (a net count or flag change), or whether cells only moved.
import { compileApp } from "../../scripts/compile-app.mjs";

import { resolve } from "node:path";
const BASE = process.env.BASE === "1";
const app = compileApp(BASE ? "cue-probe-base" : "cue-probe", ["audio/reactions.ts", "materials.ts", "engine.ts"],
  BASE ? { root: resolve(import.meta.dirname, "base") } : {});
const { detectReactionCues } = app.load("audio/reactions");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const { createFallbackEngine } = app.load("engine");
const S = 8;

function census(b) {
  const c = new Map();
  const add = (k) => c.set(k, (c.get(k) ?? 0) + 1);
  for (let i = 0; i < b.length; i += S) {
    const k = b[i];
    const f = b[i + 6] | (b[i + 7] << 8);
    add(`k${k}`);
    if (f & F.Wet) add(`wet${k}`);
    if (f & F.Cosmic) add(`cos${k}`);
    if (f & F.Rooted) add(`root${k}`);
    if (k === M.Wellspring && (b[i + 4] | (b[i + 5] << 8)) > 0) add("springOn");
  }
  return c;
}
const d = (a, b, key) => (b.get(key) ?? 0) - (a.get(key) ?? 0);

// What would make each cue honest: some net change the cue claims.
const HONEST = {
  "impact-burst": (a, b) => d(a, b, `k${M.Meteor}`) < 0 || d(a, b, `k${M.Rocket}`) < 0 || (d(a, b, `k${M.Moonwater}`) < 0 && d(a, b, `k${M.Stardust}`) > 0),
  cleanse: (a, b) => d(a, b, `k${M.Oil}`) < 0,
  "cosmic-charge": (a, b) => d(a, b, `k${M.Moonwater}`) > 0 || [M.Seed, M.Moss, M.Fungus, M.Flower, M.Soil].some((k) => d(a, b, `cos${k}`) > 0) || d(a, b, "springOn") > 0,
  bloom: (a, b) => d(a, b, `k${M.Flower}`) > 0,
  sprout: (a, b) => d(a, b, `k${M.Stem}`) > 0 || d(a, b, `root${M.Seed}`) > 0,
  "steam-flash": (a, b) => d(a, b, `k${M.Steam}`) > 0,
  vitrify: (a, b) => d(a, b, `k${M.Glass}`) > 0,
  shatter: (a, b) => d(a, b, `k${M.Glass}`) < 0,
  erode: (a, b) => d(a, b, `k${M.Stone}`) < 0,
  starfire: (a, b) => d(a, b, `k${M.Stardust}`) > 0,
  "ember-glow": (a, b) => d(a, b, `k${M.Ember}`) > 0,
  quench: (a, b) => d(a, b, `wet${M.Ember}`) > 0,
  crumble: (a, b) => d(a, b, `k${M.Wall}`) < 0,
  frost: (a, b) => d(a, b, `k${M.Ice}`) > 0,
  dew: (a, b) => [M.Moss, M.Soil, M.Seed].some((k) => d(a, b, `wet${k}`) > 0),
};

let W = 48, H = 40;
const box = (e, x0, x1, y0, y1) => {
  for (let x = x0; x <= x1; x++) for (const y of [y1, y1 - 1]) e.paint(x, y, 1, M.Wall);
  for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) e.paint(x, y, 1, M.Wall);
};
const fill = (e, x0, x1, y0, y1, k, density = 100) => {
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) e.paint(x, y, 1, k, density);
};

const SCENES = {
  "stems in air": { ticks: 120, setup: (e) => { for (let y = 5; y < 15; y++) e.paint(24, y, 1, M.Stem); } },
  "stardust onto moonwater": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 26, 35, M.Moonwater); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 4, 2, M.Stardust, 40); } },
  "stardust onto oil": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 26, 35, M.Oil); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 4, 2, M.Stardust, 40); } },
  "water onto moonwater": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 30, 35, M.Moonwater); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 10, 2, M.Water, 60); } },
  "moonwater onto water": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 30, 35, M.Water); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 10, 2, M.Moonwater, 60); } },
  "sand onto water": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 28, 35, M.Water); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 4, 2, M.Sand, 40); } },
  "stone onto water": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 28, 35, M.Water); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 4, 2, M.Stone, 40); } },
  "ice onto water": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 28, 35, M.Water); }, act: (e, t) => { if (t < 40 && t % 4 === 0) e.paint(24, 4, 2, M.Ice, 40); } },
  "glass in air": { ticks: 200, setup: (e) => { box(e, 8, 40, 20, 38); e.paint(24, 6, 3, M.Glass); } },
  "stardust onto fire": { ticks: 300, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 32, 35, M.Wood); e.paint(24, 31, 2, M.Fire); }, act: (e, t) => { if (t > 20 && t < 120 && t % 4 === 0) e.paint(24, 4, 2, M.Stardust, 40); } },
  "soil into water then soil": { ticks: 500, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 32, 35, M.Water); }, act: (e, t) => { if (t < 160 && t % 4 === 0) e.paint(24, 4, 2, M.Soil, 40); } },
  "seeds onto stardust-dusted seeds": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); }, act: (e, t) => { if (t < 120 && t % 6 === 0) e.paint(24, 4, 2, t % 12 ? M.Seed : M.Stardust, 40); } },
  "meteor in open air": { ticks: 200, setup: (e) => { box(e, 2, 46, 30, 39); e.paint(24, 2, 1, M.Meteor); } },
  "rocket launch": { ticks: 300, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 20, 28, 34, 35, M.Rocket); e.paint(24, 33, 1, M.Fire); } },
  "steam under a pond": { ticks: 200, setup: (e) => { box(e, 8, 40, 14, 38); fill(e, 11, 37, 24, 35, M.Water); }, act: (e, t) => { if (t === 0) e.paint(24, 35, 2, M.Steam); } },
  "wet sand onto dry sand": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 34, 35, M.Water); }, act: (e, t) => { if (t < 160 && t % 4 === 0) e.paint(24, 4, 2, M.Sand, 40); } },
  // Scenes where the event is REAL, to see what a gate would mute.
  "REAL garden grows then is cut": { w: 60, h: 34, ticks: 2900, from: 2300, setup: (e) => {
      for (let x = 14; x <= 46; x++) e.paint(x, 28, 4, M.Soil, 55);
      for (let x = 14; x <= 46; x++) e.paint(x, 23, 4, M.Seed, 55);
      for (let x = 14; x <= 46; x += 2) e.paint(x, 17, 4, M.Water, 55);
    }, act: (e, t) => { if (t === 2500) for (let x = 14; x <= 46; x++) e.paint(x, 18, 1, M.Empty); } },
  "REAL garden grows (no cut)": { w: 60, h: 34, ticks: 2500, setup: (e) => {
      for (let x = 14; x <= 46; x++) e.paint(x, 28, 4, M.Soil, 55);
      for (let x = 14; x <= 46; x++) e.paint(x, 23, 4, M.Seed, 55);
      for (let x = 14; x <= 46; x += 2) e.paint(x, 17, 4, M.Water, 55);
    } },
  "REAL lava under a pond": { ticks: 400, setup: (e) => { box(e, 8, 40, 14, 38); fill(e, 11, 37, 24, 33, M.Water); }, act: (e, t) => { if (t === 0) fill(e, 11, 37, 35, 35, M.Lava); } },
  "REAL stardust into water": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 28, 35, M.Water); }, act: (e, t) => { if (t < 80 && t % 4 === 0) e.paint(24, 4, 2, M.Stardust, 40); } },
  "REAL watering moss": { ticks: 400, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 34, 35, M.Moss); }, act: (e, t) => { if (t > 20 && t < 200 && t % 6 === 0) e.paint(16 + (t % 18), 10, 2, M.Water, 40); } },
  "REAL fire over a pond": { ticks: 300, setup: (e) => { box(e, 8, 40, 20, 38); fill(e, 11, 37, 30, 35, M.Water); }, act: (e, t) => { if (t < 100 && t % 5 === 0) e.paint(24, 26, 2, M.Fire, 60); } },
  "smoke and steam in a jar": { ticks: 300, setup: (e) => { box(e, 8, 40, 10, 38); fill(e, 11, 37, 30, 35, M.Water); e.paint(24, 28, 3, M.Smoke); e.paint(18, 28, 3, M.Steam); } },
};

const COOLDOWN_S = { "impact-burst": 0.9, cleanse: 1.2, "cosmic-charge": 1.15, bloom: 1.4, "steam-flash": 1.1, vitrify: 1.1, starfire: 1.0, "ember-glow": 1.25, quench: 1.05, crumble: 1.6, frost: 1.2, dew: 1.35, shatter: 1.2, erode: 1.5, sprout: 1.3 };
const PRIORITY = ["crumble", "shatter", "impact-burst", "vitrify", "starfire", "cleanse", "ember-glow", "quench", "cosmic-charge", "bloom", "sprout", "erode", "frost", "dew", "steam-flash"];
const seeds = Number(process.argv[2] ?? 8);
const only = process.argv[3]?.split(",");
for (const [name, scene] of Object.entries(SCENES)) {
  if (only && !only.some((o) => name.includes(o))) continue;
  const tally = {};
  for (let seed = 1; seed <= seeds; seed++) {
    W = scene.w ?? 48; H = scene.h ?? 40;
    const e = createFallbackEngine(W, H, seed);
    const lastPlay = {};
    const perTick = [];
    scene.setup(e);
    for (let t = 0; t < scene.ticks; t++) {
      scene.act?.(e, t);
      const before = e.getCellBytes().slice();
      e.tick();
      const after = e.getCellBytes().slice();
      const cues = detectReactionCues(before, after);
      perTick.push(t >= (scene.from ?? 0) ? cues : []);
      if (cues.length && t >= (scene.from ?? 0)) {
        const a = census(before), b = census(after);
        for (const cue of cues) {
          const r = (tally[cue] ??= { fired: 0, moveOnly: 0 });
          r.fired++;

          if (!HONEST[cue](a, b)) r.moveOnly++;
        }
      }
    }
    // The controller: one cue a tick by priority, 0.28 s shared throttle, per-cue cooldown.
    let lastAny = -1e9; const last = {};
    perTick.forEach((cues, t) => {
      const now = t / 20;
      if (!cues.length || now - lastAny < 0.28) return;
      const cue = PRIORITY.find((c) => cues.includes(c) && !(now - (last[c] ?? -1e9) < COOLDOWN_S[c]));
      if (!cue) return;
      lastAny = now; last[cue] = now;
      (tally[cue] ??= { fired: 0, moveOnly: 0 }).plays = (tally[cue].plays ?? 0) + 1;
    });
  }
  const line = Object.entries(tally).map(([c, r]) => `${c} ${r.fired}/${r.plays ?? 0}p${r.moveOnly ? ` (${r.moveOnly}?)` : ""}`).join(", ");
  console.log(`${name.padEnd(34)} ${line || "-"}`);
}
