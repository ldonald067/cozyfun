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
  const { w, h, seed, ticks, paint, outcome, absent } = check;
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
  { m: "Wall", role: "stays anchored where natural stone falls", w: 24, h: 24, seed: 1, ticks: 120,
    paint: (p) => { p(8, 8, 1, M.Wall); p(16, 8, 1, M.Stone); },
    outcome: (g, before) => (g.kindAt(8, 8) === M.Wall ? g.appeared(M.Stone, before) : []) },
  { m: "Wall", role: "takes soot from smoke", w: 24, h: 24, seed: 2, ticks: 600,
    paint: (p) => { p(12, 18, 2, M.Wood); p(12, 16, 1, M.Fire); p(12, 10, 3, M.Wall); },
    outcome: (g, before) => g.gained(M.Wall, F.Scorched, before) },
  { m: "Stone", role: "falls when left unsupported", w: 24, h: 24, seed: 3, ticks: 120,
    paint: (p) => { p(12, 8, 2, M.Stone); },
    outcome: (g, before) => g.appeared(M.Stone, before) },
  { m: "Stone", role: "hosts moss on damp stone", w: 30, h: 24, seed: 4, ticks: 1200,
    paint: (p) => { p(15, 18, 3, M.Stone); p(15, 14, 2, M.Water); p(10, 18, 1, M.Moss); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Stone", role: "is born from lava cooling", w: 30, h: 26, seed: 5, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Lava); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stone, before) },
  { m: "Stone", role: "erodes into sand under sustained water", w: 30, h: 26, seed: 6, ticks: 4000,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 14, 4, M.Water); },
    outcome: (g, before) => g.appeared(M.Sand, before) },

  // ---- Powders and liquids ------------------------------------------------------------
  { m: "Sand", role: "clumps wet when watered", w: 24, h: 24, seed: 7, ticks: 300,
    paint: (p) => { p(12, 18, 3, M.Sand); p(12, 13, 2, M.Water); },
    outcome: (g, before) => g.gained(M.Sand, F.Wet, before) },
  { m: "Sand", role: "fuses into glass under lava", w: 30, h: 26, seed: 8, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Sand); p(15, 15, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Glass, before) },
  { m: "Water", role: "boils away to steam over sustained flame", w: 30, h: 26, seed: 9, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Wall); p(15, 16, 3, M.Water); p(15, 21, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Steam, before) },
  { m: "Water", role: "rinses soot from scorched stone", w: 30, h: 26, seed: 10, ticks: 2500,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 17, 1, M.Fire); p(15, 12, 4, M.Water); },
    outcome: (g, before, memo) => {
      const sooty = g.all(M.Stone).filter((i) => g.hasFlag(i, F.Scorched));
      if (sooty.length) { memo.sooted = true; return []; }
      if (!memo.sooted) return [];
      return g.all(M.Stone).filter((i) => g.hasFlag(i, F.Wet));
    } },
  { m: "Moonwater", role: "cleans oil into stardust", w: 30, h: 26, seed: 11, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Oil); p(15, 15, 3, M.Moonwater); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },
  { m: "Moonwater", role: "marks touched cells cosmic", w: 30, h: 26, seed: 12, ticks: 600,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 16, 3, M.Moonwater); },
    outcome: (g, before) => [...g.gained(M.Soil, F.Cosmic, before), ...g.gained(M.Moss, F.Cosmic, before)] },
  { m: "Oil", role: "floats up above water", w: 30, h: 26, seed: 13, ticks: 600,
    paint: (p) => { p(15, 17, 3, M.Water); p(15, 21, 2, M.Oil); },
    outcome: (g, before) => {
      let botWater = -1;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.kindAt(x, y) === M.Water) botWater = Math.max(botWater, y);
      return g.appeared(M.Oil, before).filter((i) => g.xyOf(i)[1] < botWater);
    } },

  // ---- Heat ---------------------------------------------------------------------------
  { m: "Fire", role: "ignites wood into ember", w: 30, h: 26, seed: 14, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Ember, before) },
  { m: "Fire", role: "softens into steam against water", w: 30, h: 26, seed: 15, ticks: 400,
    // Water poured from above onto a flame, which is how a player puts a fire out. A blob
    // painted beside the fire just falls past it before anything can happen.
    paint: (p) => { p(15, 20, 1, M.Fire); p(15, 14, 2, M.Water); },
    outcome: (g, before) => g.appeared(M.Steam, before) },
  { m: "Lava", role: "crusts into stone on its own", w: 26, h: 24, seed: 16, ticks: 3000,
    paint: (p) => { p(13, 18, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Stone, before) },
  { m: "Ember", role: "cools into inert char", w: 26, h: 24, seed: 17, ticks: 2000,
    paint: (p) => { p(13, 18, 3, M.Wood); p(13, 15, 1, M.Fire); },
    outcome: (g) => g.all(M.Ember).filter((i) => g.energyAt(i) < 60) },
  { m: "Ice", role: "freezes nearby water", w: 26, h: 24, seed: 18, ticks: 600,
    paint: (p) => { p(13, 18, 3, M.Water); p(13, 15, 2, M.Ice); },
    outcome: (g, before) => g.appeared(M.Ice, before) },
  { m: "Ice", role: "condenses steam into frost", w: 26, h: 26, seed: 19, ticks: 900,
    paint: (p) => { p(13, 20, 3, M.Water); p(13, 21, 2, M.Lava); p(13, 10, 2, M.Ice); },
    outcome: (g, before) => g.appeared(M.Ice, before) },
  { m: "Ice", role: "frost-stresses damp hard materials", w: 26, h: 26, seed: 20, ticks: 1500,
    // The stone has to be damp *where the ice touches it*, so the water runs across the
    // whole slab top rather than soaking one column three cells away from the ice.
    paint: (p) => { p(13, 19, 3, M.Stone); p(11, 15, 1, M.Ice); p(15, 13, 2, M.Water); },
    outcome: (g, before) => g.gained(M.Stone, F.Frozen, before) },

  // ---- Life ---------------------------------------------------------------------------
  { m: "Soil", role: "greens into moss when watered", w: 30, h: 26, seed: 21, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Soil); p(15, 14, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Seed", role: "germinates into a climbing stalk", w: 40, h: 34, seed: 22, ticks: 3000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stem, before) },
  { m: "Flower", role: "opens into a multi-cell head", w: 40, h: 34, seed: 23, ticks: 4000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g) => (g.count(M.Flower) >= 4 ? g.all(M.Flower) : []) },
  { m: "Pollen", role: "is released by a mature flower", w: 40, h: 34, seed: 24, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Pollen, before) },
  { m: "Stem", role: "unfurls side leaves as it climbs", w: 40, h: 34, seed: 25, ticks: 3500,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    outcome: (g) => g.all(M.Stem).filter((i) => {
      const [x, y] = g.xyOf(i);
      return g.kindAt(x - 1, y) === M.Stem || g.kindAt(x + 1, y) === M.Stem;
    }) },
  { m: "Moss", role: "spreads across damp wood", w: 30, h: 26, seed: 26, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); },
    outcome: (g, before) => g.appeared(M.Moss, before) },
  { m: "Moss", role: "sheds dew droplets when saturated", w: 26, h: 26, seed: 27, ticks: 1500,
    paint: (p) => { p(13, 14, 3, M.Wall); p(13, 13, 3, M.Moss); p(13, 10, 3, M.Water); },
    outcome: (g) => g.all(M.Water).filter((i) => g.xyOf(i)[1] >= 16) },
  { m: "Fungus", role: "rots a wet seed", w: 30, h: 26, seed: 28, ticks: 1500,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 2, M.Seed); p(19, 17, 1, M.Fungus); p(15, 13, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Fungus, before) },
  { m: "Fungus", role: "collapses back into soil once starved", w: 24, h: 24, seed: 29, ticks: 6000,
    paint: (p) => { p(12, 18, 2, M.Wall); p(12, 16, 2, M.Fungus); },
    outcome: (g, before) => g.appeared(M.Soil, before) },
  { m: "Oil", role: "smothers hydration so seeds cannot sprout", w: 30, h: 26, seed: 30, ticks: 2000,
    absent: true,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); },
    outcome: (g, before) => g.appeared(M.Stem, before) },

  // ---- Cosmic and festival ------------------------------------------------------------
  { m: "Stardust", role: "charges water into moonwater", w: 26, h: 24, seed: 31, ticks: 600,
    paint: (p) => { p(13, 18, 3, M.Water); p(13, 14, 2, M.Stardust); },
    outcome: (g, before) => g.appeared(M.Moonwater, before) },
  { m: "Stardust", role: "snuffs fire into a sparkle burst", w: 26, h: 24, seed: 32, ticks: 600,
    paint: (p) => { p(13, 18, 2, M.Wood); p(13, 16, 1, M.Fire); p(13, 12, 2, M.Stardust); },
    outcome: (g, before) => g.vanished(M.Fire, before) },
  { m: "Meteor", role: "impacts into stone and fire", w: 30, h: 34, seed: 33, ticks: 900,
    paint: (p) => { p(15, 28, 3, M.Stone); p(15, 6, 1, M.Meteor); },
    outcome: (g, before) => [...g.appeared(M.Stardust, before), ...g.appeared(M.Fire, before)] },
  { m: "Meteor", role: "sheds a spark trail as it falls", w: 30, h: 40, seed: 34, ticks: 200,
    paint: (p) => { p(15, 6, 1, M.Meteor); },
    outcome: (g) => g.all(M.Spark) },
  { m: "Meteor", role: "bursts into stardust against moonwater", w: 30, h: 34, seed: 35, ticks: 900,
    paint: (p) => { p(15, 28, 4, M.Moonwater); p(15, 6, 1, M.Meteor); },
    outcome: (g, before) => g.appeared(M.Stardust, before) },
  { m: "Rocket", role: "is lit by flame and launches", w: 30, h: 40, seed: 36, ticks: 900,
    paint: (p) => { p(15, 34, 2, M.Rocket); p(15, 32, 1, M.Fire); },
    outcome: (g) => g.all(M.Spark) },
  { m: "Spark", role: "hisses into steam over water", w: 30, h: 40, seed: 37, ticks: 900,
    paint: (p) => { p(15, 34, 4, M.Water); p(15, 28, 2, M.Rocket); p(15, 26, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Steam, before) },
  { m: "Wellspring", role: "drinks a source and then pours it forever", w: 30, h: 26, seed: 38, ticks: 3000,
    paint: (p) => { p(15, 18, 1, M.Wellspring); p(15, 15, 1, M.Water); },
    outcome: (g, before) => g.appeared(M.Water, before) },
  { m: "Glass", role: "shatters back to sand under meteor impact", w: 30, h: 34, seed: 39, ticks: 1200,
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
  { m: "Steam", role: "condenses onto hard surfaces", w: 26, h: 30, seed: 40, ticks: 1200,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 14, 3, M.Wall); },
    outcome: (g, before) => g.gained(M.Wall, F.Wet, before) },
  { m: "Smoke", role: "rises off open flame", w: 26, h: 30, seed: 41, ticks: 900,
    paint: (p) => { p(13, 24, 3, M.Wood); p(13, 21, 1, M.Fire); },
    outcome: (g, before) => g.appeared(M.Smoke, before) },
];

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

console.log(`\nInteraction audit passed: all ${results.length} documented interactions happen from a painted`);
console.log(`scene, and every one of them is visible at play zoom.`);
