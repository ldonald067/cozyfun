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
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
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

// Read-only helpers a check's `hit` predicate uses. Deliberately coarse: a check should
// assert "the outcome exists", not re-implement the rule.
function grid(cells, w, h) {
  const u16 = (i, off) => cells[i * STRIDE + off] | (cells[i * STRIDE + off + 1] << 8);
  const api = {
    w, h,
    kindAt: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : cells[(y * w + x) * STRIDE]),
    count(kind) {
      let n = 0;
      for (let i = 0; i < w * h; i++) if (cells[i * STRIDE] === kind) n++;
      return n;
    },
    flagged(kind, flag) {
      let n = 0;
      for (let i = 0; i < w * h; i++) if (cells[i * STRIDE] === kind && u16(i, 6) & flag) n++;
      return n;
    },
    energyOf(kind) {
      let best = 0;
      for (let i = 0; i < w * h; i++) if (cells[i * STRIDE] === kind) best = Math.max(best, u16(i, 4));
      return best;
    },
  };
  return api;
}

function runCheck(check) {
  const { w, h, seed, ticks, paint, hit } = check;
  const uni = wasm.universe_new(w, h, seed);
  const brush = (x, y, r, mat, d = 100) => wasm.universe_paint(uni, x, y, r, mat, d);
  paint(brush);
  for (let x = 1; x < w; x += 3) brush(x, h - FLOOR_FROM_BOTTOM, 1, M.Wall);

  // Snapshot of the scene as painted. Every predicate gets it, so a check can say "more
  // moss than I painted" rather than "some moss exists" — and if the predicate is already
  // true before a single tick, the check is measuring the paint, not the interaction.
  const before = grid(view(uni).slice(), w, h);
  if (hit(grid(view(uni), w, h), before)) return { firstTick: 0, vacuous: true };
  // An `absent` check asserts a rule PREVENTS something (oil smothering hydration). It
  // passes by never firing, so its result is inverted at the end.

  let firstTick = -1;
  for (let t = 1; t <= ticks; t++) {
    wasm.universe_tick(uni);
    if (hit(grid(view(uni), w, h), before)) {
      firstTick = t;
      break;
    }
  }
  wasm.universe_free(uni);
  return { firstTick, vacuous: false };
}

// Every scene gets a wall floor four rows off the bottom, painted by runCheck AFTER the
// scene itself. Painting it first was a trap: a radius-3 blob near the bottom punched a
// hole straight through the floor, and the liquid under test drained away through it.
const FLOOR_FROM_BOTTOM = 4;

const CHECKS = [
  // ---- Hard materials -----------------------------------------------------------------
  { m: "Wall", role: "stays anchored where natural stone falls", w: 24, h: 24, seed: 1, ticks: 120,
    paint: (p) => { p(8, 8, 1, M.Wall); p(16, 8, 1, M.Stone); },
    hit: (g) => g.kindAt(8, 8) === M.Wall && g.kindAt(16, 8) !== M.Stone },
  { m: "Wall", role: "takes soot from smoke", w: 24, h: 24, seed: 2, ticks: 600,
    paint: (p) => { p(12, 18, 2, M.Wood); p(12, 16, 1, M.Fire); p(12, 10, 3, M.Wall); },
    hit: (g) => g.flagged(M.Wall, F.Scorched) > 0 },
  { m: "Stone", role: "falls when left unsupported", w: 24, h: 24, seed: 3, ticks: 120,
    paint: (p) => { p(12, 8, 2, M.Stone); },
    hit: (g) => g.kindAt(12, 8) !== M.Stone && g.count(M.Stone) > 0 },
  { m: "Stone", role: "hosts moss on damp stone", w: 30, h: 24, seed: 4, ticks: 1200,
    paint: (p) => { p(15, 18, 3, M.Stone); p(15, 14, 2, M.Water); p(10, 18, 1, M.Moss); },
    hit: (g, before) => g.count(M.Moss) > before.count(M.Moss) },
  { m: "Stone", role: "is born from lava cooling", w: 30, h: 26, seed: 5, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Lava); p(15, 12, 3, M.Water); },
    hit: (g) => g.count(M.Stone) > 0 },
  { m: "Stone", role: "erodes into sand under sustained water", w: 30, h: 26, seed: 6, ticks: 4000,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 14, 4, M.Water); },
    hit: (g) => g.count(M.Sand) > 0 },

  // ---- Powders and liquids ------------------------------------------------------------
  { m: "Sand", role: "clumps wet when watered", w: 24, h: 24, seed: 7, ticks: 300,
    paint: (p) => { p(12, 18, 3, M.Sand); p(12, 13, 2, M.Water); },
    hit: (g) => g.flagged(M.Sand, F.Wet) > 0 },
  { m: "Sand", role: "fuses into glass under lava", w: 30, h: 26, seed: 8, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Sand); p(15, 15, 2, M.Lava); },
    hit: (g) => g.count(M.Glass) > 0 },
  { m: "Water", role: "boils away to steam over sustained flame", w: 30, h: 26, seed: 9, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Wall); p(15, 16, 3, M.Water); p(15, 21, 2, M.Lava); },
    hit: (g) => g.count(M.Steam) > 0 },
  { m: "Water", role: "rinses soot from scorched stone", w: 30, h: 26, seed: 10, ticks: 2500,
    paint: (p) => { p(15, 20, 3, M.Stone); p(15, 17, 1, M.Fire); p(15, 12, 4, M.Water); },
    hit: (g) => g.count(M.Stone) > 0 && g.flagged(M.Stone, F.Scorched) === 0 && g.flagged(M.Stone, F.Wet) > 0 },
  { m: "Moonwater", role: "cleans oil into stardust", w: 30, h: 26, seed: 11, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Oil); p(15, 15, 3, M.Moonwater); },
    hit: (g) => g.count(M.Stardust) > 0 },
  { m: "Moonwater", role: "marks touched cells cosmic", w: 30, h: 26, seed: 12, ticks: 600,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 16, 3, M.Moonwater); },
    hit: (g) => g.flagged(M.Soil, F.Cosmic) > 0 || g.flagged(M.Moss, F.Cosmic) > 0 },
  { m: "Oil", role: "floats up above water", w: 30, h: 26, seed: 13, ticks: 600,
    paint: (p) => { p(15, 17, 3, M.Water); p(15, 21, 2, M.Oil); },
    hit: (g) => {
      let topOil = 99, botWater = -1;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (g.kindAt(x, y) === M.Oil) topOil = Math.min(topOil, y);
        if (g.kindAt(x, y) === M.Water) botWater = Math.max(botWater, y);
      }
      return topOil < botWater;
    } },

  // ---- Heat ---------------------------------------------------------------------------
  { m: "Fire", role: "ignites wood into ember", w: 30, h: 26, seed: 14, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 1, M.Fire); },
    hit: (g) => g.count(M.Ember) > 0 },
  { m: "Fire", role: "softens into steam against water", w: 30, h: 26, seed: 15, ticks: 400,
    // Water poured from above onto a flame, which is how a player puts a fire out. A blob
    // painted beside the fire just falls past it before anything can happen.
    paint: (p) => { p(15, 20, 1, M.Fire); p(15, 14, 2, M.Water); },
    hit: (g) => g.count(M.Steam) > 0 },
  { m: "Lava", role: "crusts into stone on its own", w: 26, h: 24, seed: 16, ticks: 3000,
    paint: (p) => { p(13, 18, 2, M.Lava); },
    hit: (g) => g.count(M.Stone) > 0 },
  { m: "Ember", role: "cools into inert char", w: 26, h: 24, seed: 17, ticks: 2000,
    paint: (p) => { p(13, 18, 3, M.Wood); p(13, 15, 1, M.Fire); },
    hit: (g) => {
      let cold = 0;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.kindAt(x, y) === M.Ember) cold++;
      return cold > 0 && g.energyOf(M.Ember) < 60;
    } },
  { m: "Ice", role: "freezes nearby water", w: 26, h: 24, seed: 18, ticks: 600,
    paint: (p) => { p(13, 18, 3, M.Water); p(13, 15, 2, M.Ice); },
    hit: (g, before) => g.count(M.Ice) > before.count(M.Ice) },
  { m: "Ice", role: "condenses steam into frost", w: 26, h: 26, seed: 19, ticks: 900,
    paint: (p) => { p(13, 20, 3, M.Water); p(13, 21, 2, M.Lava); p(13, 10, 2, M.Ice); },
    hit: (g, before) => g.count(M.Ice) > before.count(M.Ice) },
  { m: "Ice", role: "frost-stresses damp hard materials", w: 26, h: 26, seed: 20, ticks: 1500,
    // The stone has to be damp *where the ice touches it*, so the water runs across the
    // whole slab top rather than soaking one column three cells away from the ice.
    paint: (p) => { p(13, 19, 3, M.Stone); p(11, 15, 1, M.Ice); p(15, 13, 2, M.Water); },
    hit: (g) => g.flagged(M.Stone, F.Frozen) > 0 },

  // ---- Life ---------------------------------------------------------------------------
  { m: "Soil", role: "greens into moss when watered", w: 30, h: 26, seed: 21, ticks: 900,
    paint: (p) => { p(15, 20, 4, M.Soil); p(15, 14, 3, M.Water); },
    hit: (g) => g.count(M.Moss) > 0 },
  { m: "Seed", role: "germinates into a climbing stalk", w: 40, h: 34, seed: 22, ticks: 3000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    hit: (g) => g.count(M.Stem) > 0 },
  { m: "Flower", role: "opens into a multi-cell head", w: 40, h: 34, seed: 23, ticks: 4000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    hit: (g) => g.count(M.Flower) >= 4 },
  { m: "Pollen", role: "is released by a mature flower", w: 40, h: 34, seed: 24, ticks: 5000,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    hit: (g) => g.count(M.Pollen) > 0 },
  { m: "Stem", role: "unfurls side leaves as it climbs", w: 40, h: 34, seed: 25, ticks: 3500,
    paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    hit: (g) => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w - 1; x++)
        if (g.kindAt(x, y) === M.Stem && g.kindAt(x + 1, y) === M.Stem) return true;
      return false;
    } },
  { m: "Moss", role: "spreads across damp wood", w: 30, h: 26, seed: 26, ticks: 1500,
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); },
    hit: (g, before) => g.count(M.Moss) > before.count(M.Moss) },
  { m: "Moss", role: "sheds dew droplets when saturated", w: 26, h: 26, seed: 27, ticks: 1500,
    paint: (p) => { p(13, 14, 3, M.Wall); p(13, 13, 3, M.Moss); p(13, 10, 3, M.Water); },
    hit: (g) => {
      for (let y = 16; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.kindAt(x, y) === M.Water) return true;
      return false;
    } },
  { m: "Fungus", role: "rots a wet seed", w: 30, h: 26, seed: 28, ticks: 1500,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 2, M.Seed); p(19, 17, 1, M.Fungus); p(15, 13, 3, M.Water); },
    hit: (g) => g.count(M.Fungus) > 5 },
  { m: "Fungus", role: "collapses back into soil once starved", w: 24, h: 24, seed: 29, ticks: 6000,
    paint: (p) => { p(12, 18, 2, M.Wall); p(12, 16, 2, M.Fungus); },
    hit: (g) => g.count(M.Soil) > 0 },
  { m: "Oil", role: "smothers hydration so seeds cannot sprout", w: 30, h: 26, seed: 30, ticks: 2000,
    absent: true,
    paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); },
    hit: (g) => g.count(M.Stem) > 0 },

  // ---- Cosmic and festival ------------------------------------------------------------
  { m: "Stardust", role: "charges water into moonwater", w: 26, h: 24, seed: 31, ticks: 600,
    paint: (p) => { p(13, 18, 3, M.Water); p(13, 14, 2, M.Stardust); },
    hit: (g) => g.count(M.Moonwater) > 0 },
  { m: "Stardust", role: "snuffs fire into a sparkle burst", w: 26, h: 24, seed: 32, ticks: 600,
    paint: (p) => { p(13, 18, 2, M.Wood); p(13, 16, 1, M.Fire); p(13, 12, 2, M.Stardust); },
    hit: (g, before) => g.count(M.Stardust) < before.count(M.Stardust) },
  { m: "Meteor", role: "impacts into stone and fire", w: 30, h: 34, seed: 33, ticks: 900,
    paint: (p) => { p(15, 28, 3, M.Stone); p(15, 6, 1, M.Meteor); },
    hit: (g) => g.count(M.Stardust) > 0 || g.count(M.Fire) > 0 },
  { m: "Meteor", role: "sheds a spark trail as it falls", w: 30, h: 40, seed: 34, ticks: 200,
    paint: (p) => { p(15, 6, 1, M.Meteor); },
    hit: (g) => g.count(M.Spark) > 0 },
  { m: "Meteor", role: "bursts into stardust against moonwater", w: 30, h: 34, seed: 35, ticks: 900,
    paint: (p) => { p(15, 28, 4, M.Moonwater); p(15, 6, 1, M.Meteor); },
    hit: (g) => g.count(M.Stardust) > 2 },
  { m: "Rocket", role: "is lit by flame and launches", w: 30, h: 40, seed: 36, ticks: 900,
    paint: (p) => { p(15, 34, 2, M.Rocket); p(15, 32, 1, M.Fire); },
    hit: (g) => g.count(M.Spark) > 0 },
  { m: "Spark", role: "hisses into steam over water", w: 30, h: 40, seed: 37, ticks: 900,
    paint: (p) => { p(15, 34, 4, M.Water); p(15, 28, 2, M.Rocket); p(15, 26, 1, M.Fire); },
    hit: (g) => g.count(M.Steam) > 0 },
  { m: "Wellspring", role: "drinks a source and then pours it forever", w: 30, h: 26, seed: 38, ticks: 3000,
    paint: (p) => { p(15, 18, 1, M.Wellspring); p(15, 15, 1, M.Water); },
    hit: (g, before) => g.count(M.Water) > before.count(M.Water) },
  { m: "Glass", role: "shatters back to sand under meteor", w: 30, h: 34, seed: 39, ticks: 1200,
    paint: (p) => { p(15, 28, 3, M.Sand); p(15, 24, 2, M.Lava); p(15, 6, 1, M.Meteor); },
    hit: (g) => g.count(M.Glass) > 0 },
  { m: "Steam", role: "condenses onto hard surfaces", w: 26, h: 30, seed: 40, ticks: 1200,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 14, 3, M.Wall); },
    hit: (g) => g.flagged(M.Wall, F.Wet) > 0 },
  { m: "Smoke", role: "rises off open flame", w: 26, h: 30, seed: 41, ticks: 900,
    paint: (p) => { p(13, 24, 3, M.Wood); p(13, 21, 1, M.Fire); },
    hit: (g) => g.count(M.Smoke) > 0 },
];

const results = CHECKS.map((c) => ({ ...c, ...runCheck(c) }));
const vacuous = results.filter((r) => r.vacuous);
const failed = results.filter((r) => (r.absent ? r.firstTick >= 0 : r.firstTick < 0));
const slow = results.filter((r) => !r.absent && r.firstTick > 1800);

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad("MATERIAL", 12)} ${pad("INTERACTION", 46)} FIRST SEEN`);
console.log("-".repeat(76));
for (const r of results) {
  const when = r.vacuous ? "VACUOUS (true before any tick)"
    : r.absent ? (r.firstTick < 0 ? `prevented for ${r.ticks} ticks` : `LEAKED at tick ${r.firstTick}`)
    : r.firstTick < 0 ? "NEVER"
    : `tick ${r.firstTick}${r.firstTick > 1800 ? "  (slow)" : ""}`;
  console.log(`${pad(r.m, 12)} ${pad(r.role, 46)} ${when}`);
}
console.log("-".repeat(76));

if (vacuous.length) {
  console.error(
    `\nInteraction audit FAILED: ${vacuous.length} check(s) were already true before the first\n` +
      `tick, so they are measuring the painted scene rather than the interaction:\n` +
      vacuous.map((r) => `  - ${r.m}: ${r.role}`).join("\n") +
      `\n\nTighten the predicate to compare against the \`before\` snapshot.`,
  );
  process.exit(1);
}

if (failed.length) {
  console.error(
    `\nInteraction audit FAILED: ${failed.length} of ${results.length} documented interactions ` +
      `never happened from a painted scene.\n` +
      failed.map((r) => `  - ${r.m}: ${r.role} (${r.absent ? `leaked at tick ${r.firstTick}` : `gave up after ${r.ticks} ticks`})`).join("\n") +
      `\n\nA rule can pass its unit test and still be unreachable in play: the test hand-places\n` +
      `the state, the player has to get there by painting. Fix the rule's reachability, or if\n` +
      `the scene is genuinely wrong, fix the scene — but do not delete the check.`,
  );
  process.exit(1);
}
console.log(
  `Interaction audit passed: all ${results.length} documented interactions happen from a painted scene` +
    (slow.length ? `, though ${slow.length} take over 1800 ticks (30s at 60fps): ${slow.map((r) => r.m + "/" + r.role).join(", ")}` : "") +
    ".",
);
