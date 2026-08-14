// Interaction reachability audit.
//
// Every other gate in this repo asks "does the rule work?". This one asks the question
// that actually matters to a player: "does the rule ever HAPPEN?"
//
// Those are not the same question, and the difference has shipped a broken feature before.
// `rooted_seed_grows_a_stalk_that_blooms` passed for months while no player had ever seen a
// flower, because the test hand-placed a wet, rooted seed on soil — the one state the game
// could not actually reach. A cargo test proves a rule is correct given its preconditions.
// Nothing proved the preconditions were reachable by painting materials in the tray.
//
// So every check here starts from PAINTED MATERIALS, the way a player starts, and asserts
// the documented outcome appears within a plausible number of ticks. A check that fails is
// not necessarily a broken rule — it is a rule the player cannot get to.
//
// Adding a check: keep the scene something a person would plausibly paint. Do not reach in
// and set flags or energy; that is exactly the shortcut that hid the flower bug.
import { readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

// The REAL renderer, compiled to CommonJS the same way the parity harness compiles the
// engine. Reimplementing the colour rules here would only prove this file agrees with
// itself; visibility has to be judged on the pixels the player is actually shown.
const rendererDir = resolve(root, ".tmp/audit-renderer");
await rm(rendererDir, { recursive: true, force: true });
const tsc = resolve(root, "app/node_modules/typescript/bin/tsc");
const compiled = spawnSync(
  process.execPath,
  [tsc, "--target", "ES2022", "--module", "CommonJS", "--moduleResolution", "Node", "--lib",
   "ES2022,DOM", "--strict", "true", "--skipLibCheck", "true", "--esModuleInterop", "true",
   "--outDir", rendererDir, "app/src/rendering/materialColor.ts", "app/src/materials.ts"],
  { cwd: root, stdio: "inherit" },
);
if (compiled.status !== 0) throw new Error("interaction audit: renderer TypeScript compile failed");
await writeFile(resolve(rendererDir, "package.json"), JSON.stringify({ type: "commonjs" }));
const { colorForCell } = createRequire(import.meta.url)(resolve(rendererDir, "rendering/materialColor.js"));

// Perceptual-ish colour distance, matching scripts/material-contrast.mjs so "how different
// do these look" means the same thing in both gates.
function redmeanDistance([r1, g1, b1], [r2, g2, b2]) {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

// What "visible" means, in units the player experiences. A cell is 4 screen pixels at the
// shipped 220x140 grid, so a one-cell outcome is a 4x4 speck and a 10-tick one is 0.16s.
const MIN_CELLS = 4;      // measured over the outcome's whole life, not at one instant
const MIN_TICKS = 30;     // half a second at 60fps
const MIN_CONTRAST = 24;  // below this the outcome is the same colour as what it replaced
const wasmBytes = await readFile(resolve(root, "app/public/sim/cozy_sandbox_sim.wasm"));
const { instance } = await WebAssembly.instantiate(wasmBytes, {});
const wasm = instance.exports;
const STRIDE = 8;

const M = {
  Empty: 0, Wall: 1, Sand: 2, Water: 3, Smoke: 4, Soil: 5, Fire: 6, Wood: 7, Lava: 8,
  Stone: 9, Moss: 10, Seed: 11, Fungus: 12, Oil: 13, Ice: 14, Steam: 15, Stardust: 16,
  Meteor: 17, Moonwater: 18, Flower: 19, Glass: 20, Ember: 21, Pollen: 22, Stem: 23,
  Rocket: 24, Wellspring: 25, Spark: 26,
};
const F = { Wet: 1, Rooted: 2, Cosmic: 4, Frozen: 8, Scorched: 16 };

function view(uni) {
  const ptr = wasm.universe_cells_ptr(uni);
  const len = wasm.universe_cells_byte_len(uni);
  return new Uint8Array(wasm.memory.buffer, ptr, len);
}

// A check's `outcome` returns the CELL INDICES that are the interaction, not a boolean.
// That buys two things at once: an empty list means "has not happened yet", and a non-empty
// one can be measured — how many cells, for how long, and how different they look from what
// they replaced. Most helpers are phrased against the `before` snapshot, so a check counts
// what the rule produced rather than what the scene was painted with.
function grid(cells, w, h) {
  const u16 = (i, off) => cells[i * STRIDE + off] | (cells[i * STRIDE + off + 1] << 8);
  const kindOf = (i) => cells[i * STRIDE];
  const isFlagged = (i, flag) => (u16(i, 6) & flag) !== 0;
  const size = w * h;
  const collect = (pred) => {
    const out = [];
    for (let i = 0; i < size; i++) if (pred(i)) out.push(i);
    return out;
  };
  return {
    w, h, cells, size,
    kindOf, energyAt: (i) => u16(i, 4), hasFlag: isFlagged,
    kindAt: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : cells[(y * w + x) * STRIDE]),
    xyOf: (i) => [i % w, Math.floor(i / w)],
    count: (kind) => collect((i) => kindOf(i) === kind).length,
    all: (kind) => collect((i) => kindOf(i) === kind),
    // Cells that BECAME this kind — never the ones the scene was painted with.
    appeared: (kind, before) => collect((i) => kindOf(i) === kind && before.kindOf(i) !== kind),
    // Cells that STOPPED being this kind; their colour change is still what the player sees.
    vanished: (kind, before) => collect((i) => kindOf(i) !== kind && before.kindOf(i) === kind),
    gained: (kind, flag, before) =>
      collect((i) => kindOf(i) === kind && isFlagged(i, flag) && !(before.kindOf(i) === kind && before.hasFlag(i, flag))),
    lost: (kind, flag, before) =>
      collect((i) => kindOf(i) === kind && !isFlagged(i, flag) && before.kindOf(i) === kind && before.hasFlag(i, flag)),
  };
}

// The colour the player actually sees for one cell, from the shipped renderer. `time` is
// pinned so an animated material is sampled at the same phase before and after — otherwise
// a fire's own flicker would masquerade as the interaction's contrast.
function renderedColor(g, i) {
  const [x, y] = g.xyOf(i);
  const o = i * STRIDE;
  return colorForCell({
    kind: g.cells[o], variant: g.cells[o + 1],
    age: g.cells[o + 2] | (g.cells[o + 3] << 8),
    energy: g.cells[o + 4] | (g.cells[o + 5] << 8),
    flags: g.cells[o + 6] | (g.cells[o + 7] << 8),
    time: 0, cells: g.cells, width: g.w, height: g.h, x, y,
  });
}

// Median, not max: one freak cell should not carry a whole interaction's contrast score.
function medianContrast(now, before, indices) {
  if (!indices.length) return 0;
  const d = indices.map((i) => redmeanDistance(renderedColor(now, i), renderedColor(before, i)));
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
}

function runCheck(check) {
  const { w, h, seed, ticks, paint, act, outcome, absent } = check;
  const uni = wasm.universe_new(w, h, seed);
  const brush = (x, y, r, mat, d = 100) => wasm.universe_paint(uni, x, y, r, mat, d);
  paint(brush);
  for (let x = 1; x < w; x += 3) brush(x, h - FLOOR_FROM_BOTTOM, 1, M.Wall);

  // The scene exactly as painted. Every helper is phrased against it, so a check reports
  // what the rule produced, never what the brush put down.
  const before = grid(view(uni).slice(), w, h);
  const memo = {};
  let prev = before;
  if (outcome(grid(view(uni), w, h), before, memo, prev).length) {
    wasm.universe_free(uni);
    return { firstTick: 0, vacuous: true };
  }

  let firstTick = -1, peakCells = 0, visibleTicks = 0, peakSnapshot = null, peakIndices = [];
  // Every cell the outcome has ever occupied. A gradual rule — a fungus mat turning back to
  // soil one cell at a time — is plainly visible over its life while never exceeding one
  // cell at any instant, so peak alone would call it invisible.
  const touched = new Set();
  // Watched for the check's whole duration, not a fixed window after it first fires. A
  // capped window scored slow rules — stone erosion, a fungus mat reverting — as invisible
  // purely because they were still going when the stopwatch ran out. Each check's `ticks`
  // is therefore the honest question: is this visible within a session this long?
  for (let t = 1; t <= ticks; t++) {
    // Some claims are about what the player does *later* — erasing a block, lifting the ice
    // off a wellspring. `act` is that second gesture, mid-run.
    if (act) act(brush, t);
    wasm.universe_tick(uni);
    const now = grid(view(uni), w, h);
    // `prev` is last tick, for rules whose outcome is a transition rather than a state:
    // "was glass, is sand now" is exact where "there is sand" is drowned out by the bed.
    const cellsHit = outcome(now, before, memo, prev);
    prev = grid(view(uni).slice(), w, h);
    if (!cellsHit.length) continue;
    if (firstTick < 0) firstTick = t;
    visibleTicks++;
    for (const i of cellsHit) touched.add(i);
    if (cellsHit.length > peakCells) {
      peakCells = cellsHit.length;
      peakIndices = cellsHit;
      peakSnapshot = grid(view(uni).slice(), w, h);
    }
  }
  const contrast = peakSnapshot ? medianContrast(peakSnapshot, before, peakIndices) : 0;
  wasm.universe_free(uni);
  return { firstTick, vacuous: false, peakCells, spreadCells: touched.size, visibleTicks, contrast, absent };
}

// Every scene gets a wall floor four rows off the bottom, painted by runCheck AFTER the
// scene itself. Painting it first was a trap: a radius-3 blob near the bottom punched a
// hole straight through the floor, and the liquid under test drained away through it.
const FLOOR_FROM_BOTTOM = 4;


const CHECKS = [
  // ---- Hard materials -----------------------------------------------------------------
  { m: "Wall", covers: "wall.anchored", role: "stays anchored where natural stone falls", w: 24, h: 24, seed: 1, ticks: 120,
    paint: (p) => { p(8, 8, 1, M.Wall); p(16, 8, 1, M.Stone); },
    outcome: (g, before) => (g.kindAt(8, 8) === M.Wall ? g.appeared(M.Stone, before) : []) },
  { m: "Wall", covers: "wall.stains", role: "takes soot from smoke", w: 24, h: 24, seed: 2, ticks: 600,
    paint: (p) => { p(12, 18, 2, M.Wood); p(12, 16, 1, M.Fire); p(12, 10, 3, M.Wall); },
    outcome: (g, before) => g.gained(M.Wall, F.Scorched, before) },
  { m: "Stone", covers: "stone.slumps", role: "falls when left unsupported", w: 24, h: 24, seed: 3, ticks: 120,
    paint: (p) => { p(12, 8, 2, M.Stone); },
    outcome: (g, before) => g.appeared(M.Stone, before) },
  { m: "Stone", covers: "stone.hosts", role: "hosts moss on damp stone", w: 30, h: 24, seed: 4, ticks: 1200,
    paint: (p) => { p(15, 18, 3, M.Stone); p(15, 14, 2, M.Water); p(10, 18, 1, M.Moss); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Stone", covers: "stone.born", role: "is born from lava cooling", w: 30, h: 26, seed: 5, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Lava); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stone, before) },
  { m: "Stone", covers: "stone.erodes", role: "erodes into sand under sustained water", w: 30, h: 26, seed: 6, ticks: 4000,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 14, 4, M.Water); },
    outcome: (g, before) => g.appeared(M.Sand, before) },

  // ---- Powders and liquids ------------------------------------------------------------
  { m: "Sand", covers: "sand.clumps", role: "clumps wet when watered", w: 24, h: 24, seed: 7, ticks: 300,
    paint: (p) => { p(12, 18, 3, M.Sand); p(12, 13, 2, M.Water); },
    outcome: (g, before) => g.gained(M.Sand, F.Wet, before) },
  { m: "Sand", covers: "sand.vitrifies", role: "fuses into glass under lava", w: 30, h: 26, seed: 8, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Sand); p(15, 15, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Glass, before) },
  { m: "Water", covers: "water.boils", role: "boils away to steam over sustained flame", w: 30, h: 26, seed: 9, ticks: 2000,
    // A pot on a grate with a flame held under it. The previous scene put LAVA under the
    // water, which the water quenches within ten ticks — there was never a sustained flame,
    // and the check passed on the flash of steam thrown off by the quench, which is
    // `water.quenches`, a different clause. It only came to light when an unrelated fix
    // stopped that flash landing.
    //
    // `act` is the sustaining: a player keeping a fire lit under a vessel. A single painted
    // fire burns out long before the water reaches boiling — measured, one cell boils.
    paint: (p) => {
      for (const x of [10, 13, 16, 19, 21]) p(x, 20, 1, M.Wall);
      p(9, 18, 2, M.Wall); p(21, 18, 2, M.Wall);
      p(15, 18, 3, M.Water);
    },
    act: (p, t) => { if (t % 40 === 1 && t < 1200) p(15, 21, 1, M.Fire); },
    // Steam that was HOT WATER an instant ago. `appeared(Steam)` cannot tell boiling from
    // a fire softening into steam against the water, or from a quench flash; requiring the
    // cell to have been water above simmer is what makes this clause and no other.
    outcome: (g, before, memo, prev) => {
      memo.boiled ??= new Set();
      for (const i of g.all(M.Steam)) {
        if (prev.kindOf(i) === M.Water && prev.energyAt(i) > 150) memo.boiled.add(i);
      }
      return [...memo.boiled];
    } },
  { m: "Water", covers: "water.rinses", role: "rinses soot from scorched stone", w: 30, h: 26, seed: 10, ticks: 2500,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 17, 1, M.Fire); p(15, 12, 4, M.Water); },
    outcome: (g, before, memo) => {
      const sooty = g.all(M.Stone).filter((i) => g.hasFlag(i, F.Scorched));
      if (sooty.length) { memo.sooted = true; return []; }
      if (!memo.sooted) return [];
      return g.all(M.Stone).filter((i) => g.hasFlag(i, F.Wet));
    } },
  { m: "Moonwater", covers: "moonwater.cleans", role: "cleans oil into stardust", w: 30, h: 26, seed: 11, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Oil); p(15, 15, 3, M.Moonwater); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },
  { m: "Moonwater", covers: "moonwater.marks", role: "marks touched cells cosmic", w: 30, h: 26, seed: 12, ticks: 600,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 16, 3, M.Moonwater); },
    outcome: (g, before) => [...g.gained(M.Soil, F.Cosmic, before), ...g.gained(M.Moss, F.Cosmic, before)] },
  { m: "Oil", covers: "oil.floats", role: "floats up above water", w: 30, h: 26, seed: 13, ticks: 600,
    paint: (p) => { p(15, 17, 3, M.Water); p(15, 21, 2, M.Oil); },
    outcome: (g, before) => {
      let botWater = -1;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.kindAt(x, y) === M.Water) botWater = Math.max(botWater, y);
      return g.appeared(M.Oil, before).filter((i) => g.xyOf(i)[1] < botWater);
    } },

  // ---- Heat ---------------------------------------------------------------------------
  { m: "Fire", covers: "fire.ignites", role: "ignites wood into ember", w: 30, h: 26, seed: 14, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Ember, before) },
  { m: "Fire", covers: "fire.softens", role: "softens into steam against water", w: 30, h: 26, seed: 15, ticks: 400,
    // Water poured from above onto a flame, which is how a player puts a fire out. A blob
    // painted beside the fire just falls past it before anything can happen.
    paint: (p) => { p(15, 20, 1, M.Fire); p(15, 14, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Steam, before) },
  { m: "Lava", covers: "lava.cools", role: "crusts into stone on its own", w: 26, h: 24, seed: 16, ticks: 3000,
    paint: (p) => { p(13, 18, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Stone, before) },
  { m: "Ember", covers: "ember.cools", role: "cools into inert char", w: 26, h: 24, seed: 17, ticks: 2000,
    paint: (p) => { p(13, 18, 3, M.Wood); p(13, 15, 1, M.Fire); },
    outcome: (g) => g.all(M.Ember).filter((i) => g.energyAt(i) < 60) },
  { m: "Ice", covers: "ice.freezes", role: "freezes nearby water", w: 26, h: 24, seed: 18, ticks: 600,
    paint: (p) => { p(13, 18, 3, M.Water); p(13, 15, 2, M.Ice); },
    outcome: (g, before) => g.appeared(M.Ice, before) },
  { m: "Ice", covers: "ice.condenses", role: "condenses steam into frost", w: 26, h: 26, seed: 19, ticks: 900,
    paint: (p) => { p(13, 20, 3, M.Water); p(13, 21, 2, M.Lava); p(13, 10, 2, M.Ice); },
    outcome: (g, before) => g.appeared(M.Ice, before) },
  { m: "Ice", covers: "ice.stresses", role: "frost-stresses damp hard materials", w: 26, h: 26, seed: 20, ticks: 1500,
    // The stone has to be damp *where the ice touches it*, so the water runs across the
    // whole slab top rather than soaking one column three cells away from the ice.
    paint: (p) => { p(13, 19, 3, M.Stone); p(11, 15, 1, M.Ice); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.gained(M.Stone, F.Frozen, before) },

  // ---- Life ---------------------------------------------------------------------------
  { m: "Soil", covers: "soil.greens", role: "greens into moss when watered", w: 30, h: 26, seed: 21, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Soil); p(15, 14, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Seed", covers: "seed.germinates", role: "germinates into a climbing stalk", w: 40, h: 34, seed: 22, ticks: 3000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stem, before) },
  { m: "Flower", covers: "flower.opens", role: "opens into a multi-cell head", w: 40, h: 34, seed: 23, ticks: 4000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g) => (g.count(M.Flower) >= 4 ? g.all(M.Flower) : []) },
  { m: "Pollen", covers: "pollen.drifts", role: "is released by a mature flower", w: 40, h: 34, seed: 24, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Pollen, before) },
  { m: "Stem", covers: "stem.climbs", role: "unfurls side leaves as it climbs", w: 40, h: 34, seed: 25, ticks: 3500,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g) => g.all(M.Stem).filter((i) => {
      const [x, y] = g.xyOf(i);
      return g.kindAt(x - 1, y) === M.Stem || g.kindAt(x + 1, y) === M.Stem;
    }) },
  { m: "Moss", covers: "moss.spreads", role: "spreads across damp wood", w: 30, h: 26, seed: 26, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Moss", covers: "moss.dew", role: "sheds dew droplets when saturated", w: 26, h: 26, seed: 27, ticks: 1500,
    paint: (p) => { p(13, 14, 3, M.Wall); p(13, 13, 3, M.Moss); p(13, 10, 3, M.Water); },
    outcome: (g) => g.all(M.Water).filter((i) => g.xyOf(i)[1] >= 16) },
  { m: "Fungus", covers: "fungus.rots", role: "rots a wet seed", w: 30, h: 26, seed: 28, ticks: 1500,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 2, M.Seed); p(19, 17, 1, M.Fungus); p(15, 13, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Fungus", covers: "fungus.collapses", role: "collapses back into soil once starved", w: 24, h: 24, seed: 29, ticks: 6000,
    paint: (p) => { p(12, 18, 2, M.Wall); p(12, 16, 2, M.Fungus); },
    outcome: (g, before) => g.appeared(M.Soil, before) },
  { m: "Oil", covers: "oil.smothers", role: "smothers hydration so seeds cannot sprout", w: 30, h: 26, seed: 30, ticks: 2000,
    absent: true,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stem, before) },

  // ---- Cosmic and festival ------------------------------------------------------------
  { m: "Stardust", covers: "stardust.charges", role: "charges water into moonwater", w: 26, h: 24, seed: 31, ticks: 600,
    paint: (p) => { p(13, 18, 3, M.Water); p(13, 14, 2, M.Stardust); },
    outcome: (g, before) => g.appeared(M.Moonwater, before) },
  { m: "Stardust", covers: "stardust.snuffs", role: "snuffs fire into a sparkle burst", w: 26, h: 24, seed: 32, ticks: 600,
    paint: (p) => { p(13, 18, 2, M.Wood); p(13, 16, 1, M.Fire); p(13, 12, 2, M.Stardust); },
    outcome: (g, before) => g.vanished(M.Fire, before) },
  { m: "Meteor", covers: "meteor.impacts", role: "impacts into stone and fire", w: 30, h: 34, seed: 33, ticks: 900,
    paint: (p) => { p(15, 28, 3, M.Stone); p(15, 6, 1, M.Meteor); },
    outcome: (g, before) => [...g.appeared(M.Stardust, before), ...g.appeared(M.Fire, before)] },
  { m: "Meteor", covers: "meteor.trail", role: "sheds a spark trail as it falls", w: 30, h: 40, seed: 34, ticks: 200,
    paint: (p) => { p(15, 6, 1, M.Meteor); },
    outcome: (g) => g.all(M.Spark) },
  { m: "Meteor", covers: "meteor.bursts", role: "bursts into stardust against moonwater", w: 30, h: 34, seed: 35, ticks: 900,
    paint: (p) => { p(15, 28, 4, M.Moonwater); p(15, 6, 1, M.Meteor); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },
  { m: "Rocket", covers: "rocket.lights", role: "is lit by flame and launches", w: 30, h: 40, seed: 36, ticks: 900,
    paint: (p) => { p(15, 34, 2, M.Rocket); p(15, 32, 1, M.Fire); },
    outcome: (g) => g.all(M.Spark) },
  { m: "Spark", covers: "spark.hisses", role: "hisses into steam over water", w: 30, h: 40, seed: 37, ticks: 900,
    paint: (p) => { p(15, 34, 4, M.Water); p(15, 28, 2, M.Rocket); p(15, 26, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Steam, before) },
  { m: "Wellspring", covers: "wellspring.pours", role: "drinks a source and then pours it forever", w: 30, h: 26, seed: 38, ticks: 3000,
    paint: (p) => { p(15, 18, 1, M.Wellspring); p(15, 15, 1, M.Water); },
    outcome: (g, before) => g.appeared(M.Water, before) },
  { m: "Glass", covers: "glass.shatters", role: "shatters back to sand under meteor impact", w: 30, h: 34, seed: 39, ticks: 1200,
    // The pane is painted directly here, which is the one composition in this file that a
    // player could not do from the tray. It is deliberate: reaching glass at all is proved
    // by its own check above ("Sand fuses into glass under lava"), so re-deriving it here
    // would only test that rule twice and leave this one measuring a two-cell chip. Every
    // route that grows the pane in-scene fails for a timing reason — the meteor reaches a
    // lava pool about a dozen ticks before any sand beside it has fused, and a meteor's own
    // vitrify only makes two or three cells.
    paint: (p) => { p(15, 26, 4, M.Glass); p(15, 3, 1, M.Meteor); },
    // Sticky: a transition exists for one tick, but what the player looks at is the wreckage
    // it leaves. Scoring the instant would call every conversion rule invisible.
    outcome: (g, before, memo, prev) => {
      memo.shattered ??= new Set();
      for (const i of g.all(M.Sand)) if (prev.kindOf(i) === M.Glass) memo.shattered.add(i);
      return [...memo.shattered].filter((i) => g.kindOf(i) === M.Sand);
    } },
  { m: "Steam", covers: "steam.condenses", role: "condenses onto hard surfaces", w: 26, h: 30, seed: 40, ticks: 1200,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 14, 3, M.Wall); },
    outcome: (g, before) => g.gained(M.Wall, F.Wet, before) },
  { m: "Smoke", covers: "smoke.rises", role: "rises off open flame", w: 26, h: 30, seed: 41, ticks: 900,
    paint: (p) => { p(13, 24, 3, M.Wood); p(13, 21, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Smoke, before) },
  // ---- Coverage completion: the remaining documented roles ------------------------------
  // Written against docs/MATERIAL_AUDIT.md clause by clause, so `npm run material:audit`'s
  // matrix and this gate cannot drift apart. Grouped by material, in matrix order.

  { m: "Eraser", covers: "eraser.clears", role: "clears cells without adding state", w: 24, h: 24, seed: 50, ticks: 200,
    // A wall, because it is the one material that cannot move on its own: if it leaves its
    // cell, the eraser is the only thing that can have done it.
    paint: (p) => { p(12, 12, 2, M.Wall); },
    act: (p, t) => { if (t === 60) p(12, 12, 2, M.Empty); },
    outcome: (g, before) => g.vanished(M.Wall, before) },

  { m: "Wall", covers: "wall.blocks", role: "blocks flow as sealed construction", w: 30, h: 26, seed: 51, ticks: 400,
    paint: (p) => { p(15, 18, 3, M.Wall); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Water, before).filter((i) => {
      const [x, y] = g.xyOf(i);
      return g.kindAt(x, y + 1) === M.Wall;
    }) },
  { m: "Wall", covers: "wall.resists", role: "resists casual moss crossing", w: 34, h: 26, seed: 52, ticks: 2500,
    absent: true,
    // Moss and its water on the left, a sealed wall down the middle. Nothing should appear
    // on the far side; moss crosses damp stone happily, which is the contrast being drawn.
    //
    // The water is deliberately a SMALL pour. The clause is about *casual* crossing, and
    // wall does admit moss that is strongly fed — so an over-watered bed is not a test of
    // this claim, it is a test of the exception to it. At radius 2 the bed soaked the wall
    // and the moss crossed at tick 469, correctly. At radius 1 the carpet still reaches
    // ~30 cells and never crosses in 2500 ticks.
    paint: (p) => { p(8, 20, 3, M.Soil); p(8, 16, 1, M.Water); p(8, 20, 1, M.Moss); for (let y = 14; y < 22; y += 2) p(17, y, 1, M.Wall); p(24, 20, 3, M.Soil); },
    outcome: (g) => g.all(M.Moss).filter((i) => g.xyOf(i)[0] > 18) },
  { m: "Wall", covers: "wall.stains", role: "takes damp and frost stains", w: 30, h: 26, seed: 53, ticks: 1500,
    paint: (p) => { p(15, 19, 3, M.Wall); p(15, 15, 2, M.Water); p(19, 15, 1, M.Ice); },
    outcome: (g, before) => [...g.gained(M.Wall, F.Wet, before), ...g.gained(M.Wall, F.Frozen, before)] },
  { m: "Wall", covers: "wall.hearth", role: "hearth masonry dries its damp nook", w: 30, h: 26, seed: 54, ticks: 3000,
    // A masonry column with a soaked stone face on one side and the flame on the OTHER,
    // out of the fire's own reach, so anything that dries can only have been dried by the
    // wall. The flame is kept alive by `act`; a single painted fire burns out in ~20 ticks.
    paint: (p) => {
      for (const y of [14, 16, 18, 20]) p(16, y, 0, M.Wall);
      for (const y of [15, 17, 19]) p(14, y, 1, M.Stone);
      p(14, 12, 2, M.Water);
    },
    act: (p, t) => { if (t % 30 === 1 && t < 2500) { p(18, 16, 1, M.Fire); p(18, 20, 1, M.Fire); } },
    // Stone that lost the wet flag WHILE STILL HOLDING moisture. That qualifier is the
    // whole check: wet flags also clear on their own once a cell's energy drains, so the
    // previous predicate — "was wet, is dry now" — scored identically with the fire taken
    // out of the scene entirely. It measured stone drying out, not masonry drying it.
    // Only the hearth clears the flag without draining what is behind it.
    outcome: (g, before, memo) => {
      memo.damp ??= new Set();
      for (const i of g.all(M.Stone)) if (g.hasFlag(i, F.Wet)) memo.damp.add(i);
      return [...memo.damp].filter((i) => g.kindOf(i) === M.Stone && !g.hasFlag(i, F.Wet) && g.energyAt(i) > 0);
    } },
  { m: "Wall", covers: "wall.crumbles", role: "freeze-thaw stress crumbles it into stone", w: 30, h: 26, seed: 55, ticks: 30000,
    // Stress accrues per cycle and the wall only crumbles once it is carrying a lot of it,
    // so the scene has to keep the masonry DAMP and cycle it: a static ice/fire pairing
    // thaws once and stops. This is a player leaving a wet wall out through many frosts.
    paint: (p) => { p(15, 20, 4, M.Wall); },
    act: (p, t) => {
      if (t % 200 === 20) p(15, 15, 3, M.Water);
      if (t % 200 === 90) { p(10, 20, 1, M.Ice); p(20, 20, 1, M.Ice); }
      if (t % 200 === 150) { p(10, 20, 1, M.Fire); p(20, 20, 1, M.Fire); }
    },
    outcome: (g, before) => g.appeared(M.Stone, before) },

  { m: "Stone", covers: "stone.blocks", role: "blocks flow as natural hard substrate", w: 30, h: 26, seed: 56, ticks: 400,
    // A stone basin, so the pooling persists instead of the water sluicing off a slab. The
    // water starts clear of the stone: painted onto it, the check would be true before a tick.
    paint: (p) => { p(15, 19, 3, M.Stone); p(9, 16, 2, M.Stone); p(21, 16, 2, M.Stone); p(15, 8, 3, M.Water); },
    outcome: (g, before, memo) => {
      memo.held ??= new Set();
      for (const i of g.all(M.Water)) {
        const [x, y] = g.xyOf(i);
        if (g.kindAt(x, y + 1) === M.Stone) memo.held.add(i);
      }
      return [...memo.held].filter((i) => g.kindOf(i) === M.Water);
    } },
  { m: "Stone", covers: "stone.weathers", role: "condenses steam harder than sealed wall", w: 26, h: 30, seed: 57, ticks: 1500,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 14, 3, M.Stone); },
    outcome: (g, before) => g.gained(M.Stone, F.Wet, before) },

  { m: "Sand", covers: "sand.pours", role: "pours fast as dry powder, two cells per tick", w: 26, h: 30, seed: 58, ticks: 60,
    // Painted at row 6 with radius 1, so the lowest grain starts at row 7. Anything at row 9
    // after a single tick can only have moved two cells in that tick.
    paint: (p) => { p(13, 6, 1, M.Sand); },
    outcome: (g, before, memo) => {
      memo.deep ??= new Set();
      for (const i of g.all(M.Sand)) if (g.xyOf(i)[1] >= 9) memo.deep.add(i);
      return [...memo.deep].filter((i) => g.kindOf(i) === M.Sand);
    } },
  { m: "Sand", covers: "sand.drains", role: "drains dry back to loose grains", w: 26, h: 26, seed: 59, ticks: 3000,
    paint: (p) => { p(13, 19, 3, M.Sand); p(13, 15, 1, M.Water); },
    outcome: (g, before, memo) => {
      memo.wet ??= new Set();
      for (const i of g.all(M.Sand)) if (g.hasFlag(i, F.Wet)) memo.wet.add(i);
      return [...memo.wet].filter((i) => g.kindOf(i) === M.Sand && !g.hasFlag(i, F.Wet));
    } },

  { m: "Water", covers: "water.flows", role: "flows and pools sideways", w: 34, h: 26, seed: 60, ticks: 400,
    paint: (p) => { p(17, 12, 4, M.Water); },
    outcome: (g, before, memo) => {
      memo.spread ??= new Set();
      for (const i of g.appeared(M.Water, before)) if (Math.abs(g.xyOf(i)[0] - 17) > 4) memo.spread.add(i);
      return [...memo.spread].filter((i) => g.kindOf(i) === M.Water);
    } },
  { m: "Water", covers: "water.hydrates", role: "hydrates soil and life", w: 30, h: 26, seed: 61, ticks: 600,
    paint: (p) => { p(15, 19, 3, M.Soil); p(15, 15, 2, M.Water); },
    // Sticky: damp soil greens into moss, so the flag itself is fleeting even though the
    // hydration plainly happened and is what drives everything downstream.
    outcome: (g, before, memo) => {
      memo.damp ??= new Set();
      for (const i of g.all(M.Soil)) if (g.hasFlag(i, F.Wet)) memo.damp.add(i);
      return [...memo.damp].filter((i) => g.kindOf(i) === M.Soil || g.kindOf(i) === M.Moss);
    } },
  { m: "Water", covers: "water.quenches", role: "quenches lava into scorched stone", w: 30, h: 26, seed: 62, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Lava); p(15, 14, 4, M.Water); },
    outcome: (g) => g.all(M.Stone).filter((i) => g.hasFlag(i, F.Scorched)) },
  { m: "Water", covers: "water.oilblocked", role: "is blocked from feeding life by oil", w: 30, h: 26, seed: 63, ticks: 2000,
    absent: true,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.gained(M.Soil, F.Cosmic, before) },

  { m: "Moonwater", covers: "moonwater.moves", role: "supercharges growth like water", w: 40, h: 34, seed: 64, ticks: 3000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Moonwater); },
    outcome: (g, before) => g.appeared(M.Stem, before) },
  { m: "Moonwater", covers: "moonwater.bursts", role: "bursts meteor contact into stardust", w: 30, h: 34, seed: 65, ticks: 900,
    paint: (p) => { p(15, 28, 4, M.Moonwater); p(15, 5, 1, M.Meteor); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },
  { m: "Moonwater", covers: "moonwater.freezes", role: "freezes into cosmic ice", w: 26, h: 26, seed: 66, ticks: 900,
    // Ice set into the pool rather than perched above it, so there is real contact area.
    paint: (p) => { p(13, 20, 4, M.Moonwater); p(9, 19, 1, M.Ice); p(17, 19, 1, M.Ice); },
    outcome: (g, before) => g.appeared(M.Ice, before) },

  { m: "Smoke", covers: "smoke.soots", role: "soots hard surfaces", w: 26, h: 30, seed: 67, ticks: 1200,
    paint: (p) => { p(13, 24, 2, M.Wood); p(13, 22, 1, M.Fire); p(13, 15, 3, M.Stone); },
    outcome: (g, before) => g.gained(M.Stone, F.Scorched, before) },

  { m: "Steam", covers: "steam.rises", role: "rises and fades", w: 26, h: 30, seed: 68, ticks: 1200,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); },
    outcome: (g, before, memo) => {
      memo.high ??= new Set();
      for (const i of g.all(M.Steam)) if (g.xyOf(i)[1] < 18) memo.high.add(i);
      return [...memo.high].filter((i) => g.kindOf(i) === M.Steam);
    } },
  { m: "Steam", covers: "steam.frosts", role: "frosts into ice near ice", w: 26, h: 30, seed: 69, ticks: 1500,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 16, 2, M.Ice); },
    outcome: (g, before) => g.appeared(M.Ice, before) },
  { m: "Soil", covers: "soil.falls", role: "falls as organic substrate", w: 26, h: 26, seed: 70, ticks: 300,
    paint: (p) => { p(13, 8, 2, M.Soil); },
    outcome: (g, before) => g.appeared(M.Soil, before) },
  { m: "Soil", covers: "soil.greens", role: "ground under a rooted seed still germinates", w: 40, h: 34, seed: 71, ticks: 3000,
    // The observable consequence of the claim: if moss took the claimed ground, this bed
    // would carpet over and nothing would ever sprout — which is what it used to do.
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stem, before) },
  { m: "Soil", covers: "soil.breathes", role: "breathes a petrichor mist when watered after a dry spell", w: 30, h: 26, seed: 72, ticks: 2000,
    // A soil pocket walled into stone so it sits still and dries out, then a splash arrives
    // long after. The mist only comes off soil that is both old and bone dry.
    // A whole bed left to dry out, then watered — which is what a player does. One soil
    // cell breathes one wisp for one tick; a bed breathes visibly.
    paint: (p) => { p(15, 19, 6, M.Soil); },
    // A sprinkle, not a downpour: the brush has a density control and a solid column of
    // water lands on the vents and drowns the wisps it just released.
    act: (p, t) => { if (t >= 800 && t < 860 && t % 6 === 0) p(15, 11, 5, M.Water, 12); },
    outcome: (g, before, memo) => {
      memo.mist ??= new Set();
      for (const i of g.all(M.Steam)) memo.mist.add(i);
      return [...memo.mist].filter((i) => g.kindOf(i) === M.Steam);
    } },
  { m: "Soil", covers: "soil.roots", role: "roots wet seeds for blooming", w: 30, h: 26, seed: 73, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 14, 2, M.Water); },
    outcome: (g, before) => g.gained(M.Seed, F.Rooted, before) },
  { m: "Soil", covers: "soil.feeds", role: "feeds fungus decomposition", w: 30, h: 26, seed: 74, ticks: 2500,
    paint: (p) => { p(15, 20, 4, M.Soil); p(15, 16, 1, M.Fungus); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Soil", covers: "soil.reborn", role: "is reborn where a starved fungus collapses", w: 24, h: 24, seed: 75, ticks: 6000,
    paint: (p) => { p(12, 18, 2, M.Wall); p(12, 16, 2, M.Fungus); },
    outcome: (g, before) => g.appeared(M.Soil, before) },

  { m: "Wood", covers: "wood.burns", role: "burns through the ember arc instead of vanishing", w: 30, h: 26, seed: 76, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Ember, before) },
  { m: "Wood", covers: "wood.steams", role: "vents steam while wet before igniting", w: 30, h: 26, seed: 77, ticks: 1500,
    // The flame beside the soaked log, not stacked three cells above it with the water in
    // between — the water simply drowned the fire before either could touch the wood.
    paint: (p) => { p(15, 20, 3, M.Wood); p(15, 16, 2, M.Water); },
    act: (p, t) => { if (t === 300) p(20, 20, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Steam, before) },
  { m: "Wood", covers: "wood.hosts", role: "hosts moss spread", w: 30, h: 26, seed: 78, ticks: 2000,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Wood", covers: "wood.feeds", role: "feeds fungus digestion", w: 30, h: 26, seed: 79, ticks: 2500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fungus); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },

  { m: "Fire", covers: "fire.ignites", role: "ignites fuel with per-material burn odds", w: 30, h: 26, seed: 80, ticks: 600,
    paint: (p) => { p(15, 20, 3, M.Oil); p(15, 16, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Fire, before) },
  { m: "Fire", covers: "fire.dries", role: "dries and scorches wet cells first", w: 30, h: 26, seed: 81, ticks: 1500,
    paint: (p) => { p(15, 20, 6, M.Wood); p(15, 13, 4, M.Water); },
    act: (p, t) => { if (t === 300) { p(22, 20, 1, M.Fire); p(8, 20, 1, M.Fire); } },
    // Sticky: scorch is the step before ignition, so it is gone again moments later.
    outcome: (g, before, memo) => {
      memo.charred ??= new Set();
      for (const i of g.all(M.Wood)) if (g.hasFlag(i, F.Scorched)) memo.charred.add(i);
      return [...memo.charred].filter((i) => g.kindOf(i) === M.Wood || g.kindOf(i) === M.Ember);
    } },
  { m: "Fire", covers: "fire.thaws", role: "thaws frozen cells", w: 30, h: 26, seed: 82, ticks: 3000,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 1, M.Water); },
    act: (p, t) => { if (t === 200) p(15, 17, 1, M.Ice); if (t === 1400) p(15, 16, 2, M.Fire); },
    outcome: (g, before, memo) => {
      memo.frozen ??= new Set();
      for (const i of g.all(M.Stone)) if (g.hasFlag(i, F.Frozen)) memo.frozen.add(i);
      return [...memo.frozen].filter((i) => g.kindOf(i) === M.Stone && !g.hasFlag(i, F.Frozen));
    } },
  { m: "Fire", covers: "fire.vitrifies", role: "vitrifies dry sand while young and hot", w: 30, h: 26, seed: 83, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Sand); p(15, 16, 2, M.Fire); },
    outcome: (g, before) => g.appeared(M.Glass, before) },

  { m: "Lava", covers: "lava.flows", role: "flows slowly and ignites fuel", w: 30, h: 26, seed: 84, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Wood); p(15, 15, 2, M.Lava); },
    // Wood ignites into ember rather than bare flame, so ignition is either of the two.
    outcome: (g, before) => [...g.appeared(M.Fire, before), ...g.appeared(M.Ember, before)] },
  { m: "Lava", covers: "lava.quenched", role: "is quenched by water into scorched stone", w: 30, h: 26, seed: 85, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Lava); p(15, 14, 4, M.Water); },
    outcome: (g) => g.all(M.Stone).filter((i) => g.hasFlag(i, F.Scorched)) },
  { m: "Lava", covers: "lava.vitrifies", role: "vitrifies dry sand into glass", w: 30, h: 26, seed: 86, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Sand); p(15, 15, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Glass, before) },
  { m: "Lava", covers: "lava.scorches", role: "dries, scorches and thaws its neighbours", w: 30, h: 26, seed: 87, ticks: 1200,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 2, M.Water); p(20, 20, 2, M.Lava); },
    outcome: (g, before) => g.gained(M.Stone, F.Scorched, before) },

  { m: "Ice", covers: "ice.pauses", role: "pauses life in frozen dormancy", w: 30, h: 26, seed: 88, ticks: 2500,
    absent: true,
    // Ice set right on the seed bed. Perched two cells up it never chilled the seed, which
    // germinated on schedule and made this read as a leak rather than a scene fault.
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 1, M.Water); p(15, 16, 1, M.Ice); },
    outcome: (g, before) => g.appeared(M.Stem, before) },
  { m: "Ice", covers: "ice.melts", role: "melts back to water near heat", w: 26, h: 26, seed: 89, ticks: 1200,
    paint: (p) => { p(13, 19, 3, M.Ice); p(13, 15, 2, M.Fire); },
    outcome: (g, before) => g.appeared(M.Water, before) },

  { m: "Moss", covers: "moss.colonizes", role: "colonizes damp stone slowly", w: 30, h: 26, seed: 90, ticks: 2500,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 2, M.Water); p(10, 20, 1, M.Moss); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Moss", covers: "moss.overtaken", role: "is overtaken by fungus when old or wet", w: 30, h: 26, seed: 91, ticks: 3000,
    paint: (p) => { p(15, 20, 4, M.Moss); p(15, 16, 1, M.Fungus); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Moss", covers: "moss.dries", role: "dries and scorches before burning", w: 30, h: 26, seed: 92, ticks: 900,
    // The moss has to be WET first: measured on a dry mat, fire skips straight to burning
    // and the scorch step the docs describe never happens at all.
    paint: (p) => { p(15, 20, 4, M.Moss); p(15, 15, 2, M.Water); },
    act: (p, t) => { if (t === 400) p(20, 20, 1, M.Fire); },
    // Sticky, for the same reason as wood: scorch is a step on the way to burning.
    outcome: (g, before, memo) => {
      memo.charred ??= new Set();
      for (const i of g.all(M.Moss)) if (g.hasFlag(i, F.Scorched)) memo.charred.add(i);
      return [...memo.charred].filter((i) => g.kindOf(i) === M.Moss);
    } },
  { m: "Seed", covers: "seed.roots", role: "roots on soil, and on other rooted seeds through a bed", w: 40, h: 34, seed: 93, ticks: 1500,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.gained(M.Seed, F.Rooted, before) },
  { m: "Seed", covers: "seed.germinates", role: "never sprouts in the shadow of a neighbouring plant", w: 40, h: 34, seed: 94, ticks: 4000,
    absent: true,
    // Two plant BASES closer together than the spacing rule allows. A base is a rooted stalk
    // cell, which is exactly what germination produces, so crowding shows up here and
    // nowhere else. (This predicate used to end in `.slice(0, 0)` and could never fire —
    // a check that always passes, in the one file whose whole purpose is catching those.)
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g) => {
      const bases = g.all(M.Stem).filter((i) => g.hasFlag(i, F.Rooted));
      return bases.filter((i) => {
        const [x, y] = g.xyOf(i);
        return bases.some((j) => {
          if (j === i) return false;
          const [bx, by] = g.xyOf(j);
          return Math.abs(bx - x) < 5 && Math.abs(by - y) < 5;
        });
      });
    } },
  { m: "Seed", covers: "seed.settles", role: "settles into the carpet when it lands wet on moss", w: 30, h: 26, seed: 95, ticks: 2500,
    paint: (p) => { p(15, 20, 4, M.Moss); p(15, 16, 2, M.Seed); p(15, 13, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Seed", covers: "seed.rots", role: "rots into fungus under decay pressure", w: 30, h: 26, seed: 96, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 2, M.Seed); p(19, 17, 1, M.Fungus); p(15, 13, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Seed", covers: "seed.dormant", role: "waits dormant when frozen", w: 30, h: 26, seed: 97, ticks: 2500,
    absent: true,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 1, M.Water); p(15, 16, 1, M.Ice); },
    outcome: (g, before) => g.appeared(M.Stem, before) },
  { m: "Seed", covers: "seed.smothered", role: "is smothered by an oil coating", w: 30, h: 26, seed: 98, ticks: 2000,
    absent: true,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stem, before) },

  { m: "Flower", covers: "flower.pollen", role: "puffs pollen from the head's open rim", w: 40, h: 34, seed: 99, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Pollen, before) },
  { m: "Flower", covers: "flower.wilts", role: "sheds spent petals, leaving the crown as a seed head", w: 40, h: 40, seed: 100, ticks: 9000,
    paint: (p) => { p(20, 34, 4, M.Soil); p(20, 29, 3, M.Seed); p(20, 24, 3, M.Water); },
    outcome: (g, before, memo) => {
      memo.peak = Math.max(memo.peak ?? 0, g.count(M.Flower));
      return memo.peak >= 5 && g.count(M.Flower) < memo.peak ? g.all(M.Flower) : [];
    } },

  { m: "Pollen", covers: "pollen.drifts", role: "drifts down and settles where it lands", w: 40, h: 34, seed: 101, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before, memo) => {
      memo.low ??= new Set();
      for (const i of g.all(M.Pollen)) if (g.xyOf(i)[1] > 26) memo.low.add(i);
      return [...memo.low].filter((i) => g.kindOf(i) === M.Pollen);
    } },
  { m: "Pollen", covers: "pollen.seeds", role: "takes root as a seed on damp soil", w: 40, h: 34, seed: 102, ticks: 9000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Seed, before) },
  { m: "Pollen", covers: "pollen.fades", role: "lives out a full drift before fading", w: 40, h: 34, seed: 103, ticks: 6000,
    // Measured as the aged mote still on screen, not the hole it leaves: an empty cell has
    // no colour to compare against an empty baseline, so a disappearance always scores zero
    // contrast. What a player actually sees is the mote drifting out its life.
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g) => g.all(M.Pollen).filter((i) => g.energyAt(i) < 120) },

  { m: "Stem", covers: "stem.climbs", role: "climbs from a rooted seed and blooms at its tip", w: 40, h: 34, seed: 104, ticks: 4000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Flower, before) },
  { m: "Stem", covers: "stem.footing", role: "collapses whole when the stalk is severed", w: 40, h: 34, seed: 105, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    // Cut across the whole column the stalk could be standing in, since where it grew is
    // up to the sim, then watch the segments above the cut come down.
    // Sever the BASE only. Clearing the whole band erased the stalk outright, and then the
    // predicate had no fallen segments left to count — it measured a wipe, not a collapse.
    act: (p, t) => { if (t === 2500) for (let x = 16; x <= 24; x++) p(x, 22, 1, M.Empty); },
    outcome: (g, before, memo) => {
      if (!memo.cut) { memo.cut = g.count(M.Stem) > 0; return []; }
      memo.fallen ??= new Set();
      for (const i of g.appeared(M.Stem, before)) memo.fallen.add(i);
      return [...memo.fallen].filter((i) => g.kindOf(i) === M.Stem);
    } },
  { m: "Stem", covers: "stem.burns", role: "burns like living growth", w: 40, h: 34, seed: 106, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    // A broad sweep: which column the bed sprouts in is the sim's choice and moves with the
    // seed, so a flame aimed at one guessed cell simply misses.
    act: (p, t) => { if (t >= 2500 && t < 3200 && t % 10 === 0) for (let x = 14; x <= 26; x += 2) for (const y of [17, 20]) p(x, y, 1, M.Fire); },
    // Measured as the stalk catching, not as the scorch flag: scorch is the step heat takes
    // on WET growth, and a stalk that has been standing a while is dry enough to skip it.
    outcome: (g, before, memo, prev) => {
      memo.burnt ??= new Set();
      for (let i = 0; i < g.size; i++) {
        if (prev.kindOf(i) !== M.Stem) continue;
        if (g.kindOf(i) === M.Fire || g.kindOf(i) === M.Ember) memo.burnt.add(i);
      }
      return [...memo.burnt].filter((i) => g.kindOf(i) === M.Fire || g.kindOf(i) === M.Ember);
    } },

  { m: "Glass", covers: "glass.forms", role: "forms as a pane where strong heat fuses dry sand", w: 30, h: 26, seed: 107, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Sand); p(15, 15, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Glass, before) },
  { m: "Glass", covers: "glass.beads", role: "beads steam back into water so a terrarium cycles", w: 26, h: 30, seed: 108, ticks: 2500,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 16, 4, M.Glass); },
    outcome: (g, before) => g.gained(M.Glass, F.Wet, before) },

  { m: "Ember", covers: "ember.glows", role: "glows hot and weakly spreads fire", w: 30, h: 26, seed: 109, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); },
    outcome: (g, before, memo) => {
      memo.hot ??= new Set();
      for (const i of g.all(M.Ember)) if (g.energyAt(i) > 150) memo.hot.add(i);
      return [...memo.hot].filter((i) => g.kindOf(i) === M.Ember);
    } },
  { m: "Ember", covers: "ember.quenched", role: "quenches wet under water and washes cold char away", w: 30, h: 26, seed: 110, ticks: 4000,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); },
    act: (p, t) => { if (t === 1500) p(15, 13, 4, M.Water); },
    outcome: (g, before, memo) => {
      memo.doused ??= new Set();
      for (const i of g.all(M.Ember)) if (g.hasFlag(i, F.Wet)) memo.doused.add(i);
      return [...memo.doused].filter((i) => g.kindOf(i) === M.Ember);
    } },

  { m: "Fungus", covers: "fungus.overtakes", role: "overtakes old or wet moss", w: 30, h: 26, seed: 111, ticks: 3000,
    paint: (p) => { p(15, 20, 4, M.Moss); p(15, 16, 1, M.Fungus); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Fungus", covers: "fungus.digests", role: "digests wood and soil", w: 30, h: 26, seed: 112, ticks: 3000,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fungus); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Fungus", covers: "fungus.cosmic", role: "charges cosmic near stardust and moonwater", w: 30, h: 26, seed: 113, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Fungus); p(15, 16, 2, M.Moonwater); },
    outcome: (g, before) => g.gained(M.Fungus, F.Cosmic, before) },
  { m: "Fungus", covers: "fungus.fairyring", role: "sows a stardust grain as a charged fairy ring", w: 30, h: 26, seed: 114, ticks: 6000,
    paint: (p) => { p(15, 20, 6, M.Soil); p(15, 15, 4, M.Fungus); p(15, 10, 4, M.Moonwater); },
    outcome: (g, before, memo) => {
      memo.grains ??= new Set();
      for (const i of g.appeared(M.Stardust, before)) memo.grains.add(i);
      return [...memo.grains].filter((i) => g.kindOf(i) === M.Stardust);
    } },

  { m: "Oil", covers: "oil.floats", role: "sheets sideways when supported", w: 34, h: 26, seed: 115, ticks: 900,
    paint: (p) => { p(17, 19, 3, M.Wall); p(17, 15, 2, M.Oil); },
    outcome: (g, before, memo) => {
      memo.sheet ??= new Set();
      for (const i of g.appeared(M.Oil, before)) if (Math.abs(g.xyOf(i)[0] - 17) > 3) memo.sheet.add(i);
      return [...memo.sheet].filter((i) => g.kindOf(i) === M.Oil);
    } },
  { m: "Oil", covers: "oil.ignites", role: "ignites readily near heat", w: 30, h: 26, seed: 131, ticks: 600,
    paint: (p) => { p(15, 20, 3, M.Oil); p(15, 16, 1, M.Fire); },
    outcome: (g, before, memo, prev) => {
      memo.caught ??= new Set();
      for (let i = 0; i < g.size; i++) if (prev.kindOf(i) === M.Oil && g.kindOf(i) === M.Fire) memo.caught.add(i);
      return [...memo.caught].filter((i) => g.kindOf(i) === M.Fire);
    } },
  { m: "Oil", covers: "oil.cleaned", role: "is cleaned into stardust by moonwater", w: 30, h: 26, seed: 116, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Oil); p(15, 15, 3, M.Moonwater); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },

  { m: "Stardust", covers: "stardust.energizes", role: "energizes life and soil with cosmic marks", w: 30, h: 26, seed: 117, ticks: 1200,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 16, 2, M.Stardust); },
    outcome: (g, before) => [...g.gained(M.Soil, F.Cosmic, before), ...g.gained(M.Moss, F.Cosmic, before)] },
  { m: "Stardust", covers: "stardust.etches", role: "etches constellation marks onto stone and wall", w: 30, h: 26, seed: 118, ticks: 1500,
    paint: (p) => { p(15, 19, 3, M.Stone); p(15, 15, 2, M.Stardust); },
    outcome: (g, before) => g.gained(M.Stone, F.Cosmic, before) },

  { m: "Meteor", covers: "meteor.falls", role: "falls as impact heat", w: 30, h: 64, seed: 119, ticks: 300,
    // A tall sky, because that is where a meteor is seen: in a short scene it is on screen
    // for barely a third of a second and the fall itself never registers.
    paint: (p) => { p(15, 5, 1, M.Meteor); },
    // Its descent, measured from below the row it was painted on — the whole fall is what
    // the player watches, but counting the painted cell itself would be measuring the brush.
    outcome: (g, before, memo) => {
      memo.fell ??= new Set();
      for (const i of g.all(M.Meteor)) if (g.xyOf(i)[1] > 7) memo.fell.add(i);
      return [...memo.fell].filter((i) => g.kindOf(i) === M.Meteor);
    } },
  { m: "Meteor", covers: "meteor.shocked", role: "is shocked into scorched stone by water", w: 30, h: 34, seed: 120, ticks: 900,
    paint: (p) => { p(15, 28, 4, M.Water); p(15, 5, 1, M.Meteor); },
    outcome: (g, before, memo) => {
      memo.shocked ??= new Set();
      for (const i of g.all(M.Stone)) if (g.hasFlag(i, F.Scorched)) memo.shocked.add(i);
      return [...memo.shocked].filter((i) => g.kindOf(i) === M.Stone);
    } },
  { m: "Meteor", covers: "meteor.vitrifies", role: "vitrifies nearby sand on impact", w: 30, h: 34, seed: 121, ticks: 900,
    paint: (p) => { p(15, 28, 6, M.Sand); p(15, 5, 1, M.Meteor); p(21, 5, 1, M.Meteor); p(9, 5, 1, M.Meteor); },
    outcome: (g, before, memo) => {
      memo.fused ??= new Set();
      for (const i of g.appeared(M.Glass, before)) memo.fused.add(i);
      return [...memo.fused].filter((i) => g.kindOf(i) === M.Glass);
    } },

  { m: "Rocket", covers: "rocket.falls", role: "falls and piles as inert powder", w: 30, h: 34, seed: 122, ticks: 400,
    paint: (p) => { p(15, 10, 3, M.Rocket); },
    outcome: (g, before) => g.appeared(M.Rocket, before) },
  { m: "Rocket", covers: "rocket.climbs", role: "a lit grain climbs fast with a glittering trail", w: 30, h: 44, seed: 123, ticks: 900,
    paint: (p) => { p(15, 38, 2, M.Rocket); p(15, 36, 1, M.Fire); },
    outcome: (g, before, memo) => {
      memo.high ??= new Set();
      for (const i of [...g.all(M.Rocket), ...g.all(M.Spark)]) if (g.xyOf(i)[1] < 24) memo.high.add(i);
      return [...memo.high].filter((i) => g.kindOf(i) === M.Rocket || g.kindOf(i) === M.Spark);
    } },
  { m: "Rocket", covers: "rocket.bursts", role: "bursts into a firework shell of sparks and stardust", w: 30, h: 44, seed: 124, ticks: 900,
    paint: (p) => { p(15, 38, 2, M.Rocket); p(15, 36, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },

  { m: "Spark", covers: "spark.flies", role: "flies outward from a burst then droops and fades", w: 30, h: 44, seed: 125, ticks: 900,
    paint: (p) => { p(15, 38, 2, M.Rocket); p(15, 36, 1, M.Fire); },
    outcome: (g, before, memo) => {
      memo.flung ??= new Set();
      for (const i of g.all(M.Spark)) if (Math.abs(g.xyOf(i)[0] - 15) > 3) memo.flung.add(i);
      return [...memo.flung].filter((i) => g.kindOf(i) === M.Spark);
    } },
  { m: "Spark", covers: "spark.lights", role: "lights rocket powder it reaches in flight", w: 34, h: 44, seed: 126, ticks: 1200,
    paint: (p) => { p(17, 38, 2, M.Rocket); p(17, 36, 1, M.Fire); p(8, 30, 2, M.Rocket); p(26, 30, 2, M.Rocket); },
    outcome: (g, before, memo) => {
      // A far-off charge that has caught: inert powder sits at energy 0, so a lit one is
      // the proof. Counting the powder itself would be true before a single tick.
      memo.lit ??= new Set();
      for (const i of g.all(M.Rocket)) if (g.energyAt(i) > 0 && Math.abs(g.xyOf(i)[0] - 17) > 5) memo.lit.add(i);
      for (const i of g.all(M.Spark)) if (Math.abs(g.xyOf(i)[0] - 17) > 7) memo.lit.add(i);
      return [...memo.lit].filter((i) => g.kindOf(i) === M.Rocket || g.kindOf(i) === M.Spark);
    } },

  { m: "Wellspring", covers: "wellspring.drinks", role: "drinks the identity of the first source that touches it", w: 30, h: 26, seed: 130, ticks: 900,
    // A dormant spring stores nothing; once it has drunk, it carries the remembered
    // material's id as its energy, so a non-zero reading is the attunement itself.
    paint: (p) => { p(15, 19, 1, M.Wellspring); p(15, 15, 1, M.Water); },
    outcome: (g) => g.all(M.Wellspring).filter((i) => g.energyAt(i) > 0) },
  { m: "Wellspring", covers: "wellspring.blocks", role: "blocks flow like sealed construction while dormant", w: 30, h: 26, seed: 127, ticks: 400,
    paint: (p) => { p(13, 19, 1, M.Wellspring); p(17, 19, 1, M.Wellspring); p(9, 19, 2, M.Wall); p(21, 19, 2, M.Wall); p(15, 8, 4, M.Sand); },
    outcome: (g, before, memo) => {
      memo.held ??= new Set();
      for (const i of g.all(M.Sand)) {
        const [x, y] = g.xyOf(i);
        if (g.kindAt(x, y + 1) === M.Wellspring) memo.held.add(i);
      }
      return [...memo.held].filter((i) => g.kindOf(i) === M.Sand);
    } },
  { m: "Wellspring", covers: "wellspring.stilled", role: "is stilled by nearby ice", w: 30, h: 26, seed: 128, ticks: 3000,
    absent: true,
    paint: (p) => { p(15, 19, 1, M.Wellspring); p(15, 16, 1, M.Water); p(11, 19, 2, M.Ice); p(19, 19, 2, M.Ice); },
    act: (p, t) => { if (t % 300 === 0) { p(11, 19, 2, M.Ice); p(19, 19, 2, M.Ice); } },
    outcome: (g, before) => g.appeared(M.Water, before).filter((i) => g.xyOf(i)[1] > 20) },
  { m: "Wellspring", covers: "wellspring.reattune", role: "re-drinks a new source while held under that chill", w: 30, h: 26, seed: 129, ticks: 8000,
    paint: (p) => { p(15, 19, 1, M.Wellspring); p(15, 16, 1, M.Water); },
    act: (p, t) => {
      if (t > 600 && t % 200 === 0) { p(11, 19, 2, M.Ice); p(19, 19, 2, M.Ice); }
      if (t >= 1500 && t < 3000 && t % 60 === 0) p(15, 16, 1, M.Sand);
    },
    outcome: (g, before, memo) => {
      memo.poured ??= new Set();
      for (const i of g.appeared(M.Sand, before)) memo.poured.add(i);
      return [...memo.poured].filter((i) => g.kindOf(i) === M.Sand);
    } },
];

// Coverage is enforced against docs/MATERIAL_AUDIT.md, clause by clause. Each role there
// carries a stable `[material.slug]` id and each check names the id it covers, so the
// binding survives rewording — which a count, or matching on the prose, would not.
//
// What this catches: a clause added with no check, a clause deleted while a check still
// claims it, a typo'd id. What it does NOT catch: a clause reworded into a *different*
// promise while keeping its id. Identity is stable by design, which is exactly why it
// cannot notice meaning changing underneath it — that one still needs a human reading the
// diff. Binding on the prose instead would catch it, at the cost of breaking on every typo.
const matrixLines = (await readFile(resolve(root, "docs/MATERIAL_AUDIT.md"), "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim());
const documented = new Map();
let inMatrix = false;
for (const line of matrixLines) {
  if (line.startsWith("| Material | Interaction roles")) { inMatrix = true; continue; }
  if (!inMatrix) continue;
  if (!line.startsWith("|")) break;
  if (/^\|[-\s|]+\|$/.test(line)) continue;
  const cols = line.slice(1, -1).split("|").map((c) => c.trim());
  if (cols.length < 2 || !cols[0] || cols[0] === "Material") continue;
  for (const clause of cols[1].split(";")) {
    const tag = clause.trim().match(/^\[([a-z0-9.]+)\]\s*(.+)$/i);
    if (!tag) {
      console.error(`\nInteraction audit FAILED: an interaction role in docs/MATERIAL_AUDIT.md has no\n` +
        `stable id. Every clause must start with one, e.g. "[wall.blocks] Blocks flow...":\n  ${cols[0]}: ${clause.trim().slice(0, 80)}`);
      process.exit(1);
    }
    if (documented.has(tag[1])) {
      console.error(`\nInteraction audit FAILED: duplicate role id "${tag[1]}" in docs/MATERIAL_AUDIT.md.`);
      process.exit(1);
    }
    documented.set(tag[1], { material: cols[0], text: tag[2] });
  }
}

const claimed = new Set(CHECKS.map((c) => c.covers));
const unknown = CHECKS.filter((c) => !documented.has(c.covers));
const uncovered = [...documented].filter(([id]) => !claimed.has(id));
const misfiled = CHECKS.filter((c) => documented.get(c.covers) && documented.get(c.covers).material !== c.m);
if (unknown.length || uncovered.length || misfiled.length) {
  const parts = [];
  if (uncovered.length)
    parts.push(`Documented roles with no check:\n` +
      uncovered.map(([id, d]) => `  - ${id} (${d.material}): ${d.text.slice(0, 70)}`).join("\n"));
  if (unknown.length)
    parts.push(`Checks naming a role id that is not in the matrix — renamed or deleted?\n` +
      unknown.map((c) => `  - ${c.covers} (claimed by ${c.m}: ${c.role})`).join("\n"));
  if (misfiled.length)
    parts.push(`Checks bound to another material's role:\n` +
      misfiled.map((c) => `  - ${c.m} check claims ${c.covers}, which belongs to ${documented.get(c.covers).material}`).join("\n"));
  console.error(`\nInteraction audit FAILED: the matrix and this gate disagree.\n\n${parts.join("\n\n")}\n\n` +
    `Every clause in that matrix is a promise to the player. Add a check, fix the id, or if\n` +
    `the promise is not real any more, take the clause out of the matrix.`);
  process.exit(1);
}

const results = CHECKS.map((c) => ({ ...c, ...runCheck(c) }));
const vacuous = results.filter((r) => r.vacuous);
const unreachable = results.filter((r) => !r.vacuous && (r.absent ? r.firstTick >= 0 : r.firstTick < 0));
const seen = results.filter((r) => !r.vacuous && !r.absent && r.firstTick >= 0);
// Visibility is judged only on interactions that actually happened; an unreachable one has
// a more basic problem, and an `absent` one is supposed to leave nothing behind.
const invisible = seen.filter(
  (r) => r.spreadCells < MIN_CELLS || r.visibleTicks < MIN_TICKS || r.contrast < MIN_CONTRAST,
);

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(`\n${pad("MATERIAL", 11)} ${pad("INTERACTION", 44)} ${lpad("TICK", 6)} ${lpad("CELLS", 6)} ${lpad("SHOWN", 6)} ${lpad("CONTRAST", 9)}`);
console.log("-".repeat(86));
for (const r of results) {
  if (r.vacuous) { console.log(`${pad(r.m, 11)} ${pad(r.role, 44)}    VACUOUS (true before any tick)`); continue; }
  if (r.absent) {
    console.log(`${pad(r.m, 11)} ${pad(r.role, 44)}    ${r.firstTick < 0 ? `prevented for ${r.ticks} ticks` : `LEAKED at tick ${r.firstTick}`}`);
    continue;
  }
  if (r.firstTick < 0) { console.log(`${pad(r.m, 11)} ${pad(r.role, 44)}    NEVER`); continue; }
  const flag = r.spreadCells < MIN_CELLS || r.visibleTicks < MIN_TICKS || r.contrast < MIN_CONTRAST ? "  <- faint" : "";
  console.log(
    `${pad(r.m, 11)} ${pad(r.role, 44)} ${lpad(r.firstTick, 6)} ${lpad(r.spreadCells, 6)} ${lpad(r.visibleTicks, 6)} ${lpad(r.contrast.toFixed(0), 9)}${flag}`,
  );
}
console.log("-".repeat(86));
console.log(`CELLS = cells the outcome ever occupied. SHOWN = ticks on screen. CONTRAST = median`);
console.log(`colour distance from what it replaced, through the real renderer. Floors: ${MIN_CELLS} cells,`);
console.log(`${MIN_TICKS} ticks (${(MIN_TICKS / 60).toFixed(2)}s at 60fps), ${MIN_CONTRAST} contrast.`);

if (vacuous.length) {
  console.error(
    `\nInteraction audit FAILED: ${vacuous.length} check(s) were already true before the first\n` +
      `tick, so they are measuring the painted scene rather than the interaction:\n` +
      vacuous.map((r) => `  - ${r.m}: ${r.role}`).join("\n"),
  );
  process.exit(1);
}

if (unreachable.length) {
  console.error(
    `\nInteraction audit FAILED: ${unreachable.length} documented interaction(s) never happened\n` +
      `from a painted scene:\n` +
      unreachable.map((r) => `  - ${r.m}: ${r.role} (${r.absent ? `leaked at tick ${r.firstTick}` : `gave up after ${r.ticks} ticks`})`).join("\n") +
      `\n\nA rule can pass its unit test and still be unreachable in play: the test hand-places\n` +
      `the state, the player has to get there by painting. Fix the rule's reachability, or if\n` +
      `the scene is genuinely wrong, fix the scene — but do not delete the check.`,
  );
  process.exit(1);
}

if (invisible.length) {
  console.error(
    `\nInteraction audit FAILED: ${invisible.length} interaction(s) happen but are too faint to\n` +
      `notice at four screen pixels per cell:\n` +
      invisible
        .map((r) => {
          const why = [];
          if (r.spreadCells < MIN_CELLS) why.push(`touches only ${r.spreadCells} cell(s) in its whole life`);
          if (r.visibleTicks < MIN_TICKS) why.push(`on screen ${r.visibleTicks} tick(s) = ${(r.visibleTicks / 60).toFixed(2)}s`);
          if (r.contrast < MIN_CONTRAST) why.push(`contrast ${r.contrast.toFixed(0)} vs what it replaced`);
          return `  - ${r.m}: ${r.role} — ${why.join(", ")}`;
        })
        .join("\n") +
      `\n\nFiring is not the same as being seen. Give the outcome more cells, more time on\n` +
      `screen, or a colour that separates it from what it replaced.`,
  );
  process.exit(1);
}

console.log(`\nInteraction audit passed: ${results.length} checks bound to all ${documented.size} role ids`);
console.log(`documented in docs/MATERIAL_AUDIT.md. Every one happens from a painted scene, and`);
console.log(`every one is visible at play zoom.`);
