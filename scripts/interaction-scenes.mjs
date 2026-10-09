// The interaction scenes, and the one runner that plays them.
//
// These used to live inside `scripts/interaction-audit.mjs`, hard-wired to the wasm engine.
// They are shared now because two more tools need exactly these scenes: `audit:drift`,
// which replays them over many seeds to separate a real effect from dice, and
// `clobber:census`, which replays them on the JS mirror with a counter attached to every
// move. A copied scene list would drift from the audit's the first time a check changed —
// and a measurement taken on scenes the audit no longer runs certifies nothing.
//
// What makes a good scene is documented at the top of the audit; read that before adding one.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "./compile-app.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

// The REAL renderer, compiled from source. Reimplementing the colour rules here would only
// prove the harness agrees with itself; visibility has to be judged on the pixels the player
// is shown. `root` compiles a different checkout's renderer, for comparing two builds.
export function loadRenderer(name, root = repoRoot) {
  const app = compileApp(name, ["rendering/materialColor.ts", "materials.ts"], { root });
  return { colorForCell: app.load("rendering/materialColor").colorForCell, materials: app.load("materials") };
}

const current = loadRenderer("audit-renderer");
export const colorForCell = current.colorForCell;

// Material ids and flag bits come from `materials.ts` itself. They were a hand-typed copy
// here — the kind of mirror this repo keeps having to add a check for — and the copy had
// already fallen behind: it had no `Bedded`.
export const M = current.materials.MATERIAL;
// Mist is steam at this energy; steam made by HEAT is born at 120-230. A check about boiling or
// quenching must count only the hot kind, or moving water alone satisfies it — review turned
// off every thermal steam source and water.boils and fire.softens still passed on mist. Read
// from the engine rather than copied, and loudly, so a rename cannot quietly zero the filter.
const mistEnergy = readFileSync(resolve(repoRoot, "app/src/engine.ts"), "utf8").match(/^const MIST_ENERGY = (\d+);$/m);
if (!mistEnergy) throw new Error("interaction-scenes: MIST_ENERGY not found in app/src/engine.ts; the thermal-steam checks need it");
export const MIST_ENERGY = Number(mistEnergy[1]);
const thermalSteam = (g, before) => g.appeared(M.Steam, before).filter((i) => g.energyAt(i) > MIST_ENERGY);
export const F = current.materials.CELL_FLAG;
// On a wellspring, a lesson learned under ice and held until the ice is gone.
const TAUGHT = current.materials.WELLSPRING_TAUGHT;
export const STRIDE = 8;

// Perceptual-ish colour distance, matching scripts/material-contrast.mjs so "how different
// do these look" means the same thing in both gates.
export function redmeanDistance([r1, g1, b1], [r2, g2, b2]) {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

// How many sim ticks a player sees per second. A tick is NOT a frame: `App.tsx` ticks at most
// once per animation frame, and only once SIM_TICK_MS has passed since the last tick, so on a
// 60 Hz display a tick lands every ceil(SIM_TICK_MS / 16.7ms) frames. Every seconds figure a
// harness prints goes through this. It was a hard-coded 60 here for as long as the audit
// existed, so every duration quoted from it read three times too short — measured in the
// shipped bundle on 2026-09-29 at 20.2 ticks/s and 60.2 frames/s.
const simTickMs = readFileSync(resolve(repoRoot, "app/src/App.tsx"), "utf8").match(/^const SIM_TICK_MS = (\d+);$/m);
if (!simTickMs) throw new Error("interaction-scenes: SIM_TICK_MS not found in app/src/App.tsx; the audit cannot turn ticks into seconds without it");
export const TICKS_PER_SECOND = 60 / Math.ceil(Number(simTickMs[1]) / (1000 / 60));

// What "visible" means, in units the player experiences. A cell is 4 screen pixels at the
// shipped 220x140 grid, so a one-cell outcome is a 4x4 speck and a 10-tick one is half a second.
export const MIN_CELLS = 4;      // measured over the outcome's whole life, not at one instant
export const MIN_TICKS = 30;     // about 1.5 s of play on a 60 Hz display, not the 0.5 s once written here
export const MIN_CONTRAST = 24;  // below this the outcome is the same colour as what it replaced

// Engines, as the runner sees them: create a board, paint it, tick it, read its bytes.
export function wasmEngine(exports) {
  return {
    create(w, h, seed) {
      const uni = exports.universe_new(w, h, seed);
      return {
        paint: (x, y, r, mat, d) => exports.universe_paint(uni, x, y, r, mat, d),
        tick: () => exports.universe_tick(uni),
        view: () => new Uint8Array(exports.memory.buffer, exports.universe_cells_ptr(uni), exports.universe_cells_byte_len(uni)),
        free: () => exports.universe_free(uni),
      };
    },
  };
}

/** The shipped wasm build of a checkout — this one unless `root` says otherwise. */
export async function loadWasmEngine(root = repoRoot) {
  const bytes = readFileSync(resolve(root, "app/public/sim/cozy_sandbox_sim.wasm"));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return wasmEngine(instance.exports);
}

/** The JS mirror. `create` also hands back the engine itself, so a tool can hook it. */
export function jsEngine(createFallbackEngine) {
  return {
    create(w, h, seed) {
      const engine = createFallbackEngine(w, h, seed);
      return {
        engine,
        paint: (x, y, r, mat, d) => engine.paint(x, y, r, mat, d),
        tick: () => engine.tick(),
        view: () => engine.getCellBytes(),
        free: () => engine.dispose(),
      };
    },
  };
}


// A check's `outcome` returns the CELL INDICES that are the interaction, not a boolean.
// That buys two things at once: an empty list means "has not happened yet", and a non-empty
// one can be measured — how many cells, for how long, and how different they look from what
// they replaced. Most helpers are phrased against the `before` snapshot, so a check counts
// what the rule produced rather than what the scene was painted with.
export function grid(cells, w, h) {
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
function renderedColor(colorForCell, g, i) {
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
function medianContrast(colorForCell, now, before, indices) {
  if (!indices.length) return 0;
  const d = indices.map((i) => redmeanDistance(renderedColor(colorForCell, now, i), renderedColor(colorForCell, before, i)));
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
}

/**
 * The audit's verdict on one run of one check — the ONE definition of "passes", shared by
 * `interaction:audit` and `audit:drift` so the two can never disagree about it. `r` is a
 * `runCheck` result spread over its check (so `ticks` and `absent` are present).
 *
 *   vacuous      the predicate was already true on the painted scene
 *   unreachable  it never happened — or, for an `absent` check, it happened
 *   faint        it happened but missed a visibility floor; `why` names each one missed
 */
export function auditVerdict(r) {
  if (r.vacuous) return { kind: "vacuous", why: ["true before any tick"] };
  if (r.absent) return r.firstTick < 0 ? { kind: "pass", why: [] } : { kind: "unreachable", why: [`leaked at tick ${r.firstTick}`] };
  if (r.firstTick < 0) return { kind: "unreachable", why: [`never happened in ${r.ticks} ticks`] };
  const why = [];
  if (r.spreadCells < MIN_CELLS) why.push(`${r.spreadCells} cells < ${MIN_CELLS}`);
  if (r.visibleTicks < MIN_TICKS) why.push(`shown ${r.visibleTicks} ticks < ${MIN_TICKS}`);
  if (r.contrast < MIN_CONTRAST) why.push(`contrast ${Math.round(r.contrast)} < ${MIN_CONTRAST}`);
  return why.length ? { kind: "faint", why } : { kind: "pass", why: [] };
}

/**
 * Play one check's scene on `engine` and measure its outcome through `colorForCell`.
 * Both are parameters so the same scenes can be run on the shipped build (the audit), on the
 * JS mirror with hooks attached (the clobber census), or on another checkout's build (the
 * drift comparison) — without a second copy of any scene.
 */
export function runCheck(check, { engine, colorForCell }) {
  const { w, h, seed, ticks, paint, act, outcome, absent } = check;
  const uni = engine.create(w, h, seed);
  const view = () => uni.view();
  const brush = (x, y, r, mat, d = 100) => uni.paint(x, y, r, mat, d);
  paint(brush);
  for (let x = 1; x < w; x += 3) brush(x, h - FLOOR_FROM_BOTTOM, 1, M.Wall);

  // The scene exactly as painted. Every helper is phrased against it, so a check reports
  // what the rule produced, never what the brush put down.
  const before = grid(view().slice(), w, h);
  const memo = {};
  let prev = before;
  if (outcome(grid(view(), w, h), before, memo, prev).length) {
    uni.free();
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
    uni.tick();
    const now = grid(view(), w, h);
    // `prev` is last tick, for rules whose outcome is a transition rather than a state:
    // "was glass, is sand now" is exact where "there is sand" is drowned out by the bed.
    const cellsHit = outcome(now, before, memo, prev);
    prev = grid(view().slice(), w, h);
    if (!cellsHit.length) continue;
    if (firstTick < 0) firstTick = t;
    visibleTicks++;
    for (const i of cellsHit) touched.add(i);
    if (cellsHit.length > peakCells) {
      peakCells = cellsHit.length;
      peakIndices = cellsHit;
      peakSnapshot = grid(view().slice(), w, h);
    }
  }
  // Contrast is against the scene as painted, unless the check set `memo.against` to a grid
  // of its own. An outcome that UNDOES an intermediate state — soot rinsed off a rock that was
  // painted clean — would otherwise be scored as clean stone against clean stone, when what
  // the player sees is black turning clean.
  const contrast = peakSnapshot ? medianContrast(colorForCell, peakSnapshot, memo.against ?? before, peakIndices) : 0;
  uni.free();
  return { firstTick, vacuous: false, peakCells, spreadCells: touched.size, visibleTicks, contrast, absent };
}

// Every scene gets a wall floor four rows off the bottom, painted by runCheck AFTER the
// scene itself. Painting it first was a trap: a radius-3 blob near the bottom punched a
// hole straight through the floor, and the liquid under test drained away through it.
export const FLOOR_FROM_BOTTOM = 4;

// The rocket launch fixture three scenes share: a default-brush pile with a default-brush flame
// dropped on its top. See `rocket.climbs`.
const launchFixture = (p) => { p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire); };


// The flame stem.burns sweeps over its garden. Its witness skips stalks under these strokes,
// because a stalk the brush painted over did not catch.
const STEM_FLAMES = Array.from({ length: 9 }, (_, k) => [14 + 4 * k, 14]);

export const CHECKS = [
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
  // "Sustained water" means a stream, and the game has exactly one endless source, so this
  // paints one: a wellspring above a stone mound, pouring over it. A finite blob of water
  // pools in the first hollow it wears and then stops flowing — which is the rule working,
  // not failing, but it makes a poor exhibit for a clause about SUSTAINED water.
  { m: "Stone", covers: "stone.erodes", role: "erodes into sand under sustained water", w: 220, h: 140, seed: 6, ticks: 4000,
    // The real board, because a spring's pool scales with the board. Since water stopped
    // deleting itself (ROADMAP Phase 20) a spring in a 30x26 box fills the box to its own
    // height inside 400 ticks and the rock is under a lake before it can wear — the old
    // board had only ever worked because the move clobber kept the stream thin. A
    // default-brush boulder with a spring pouring onto it is the scene a player makes.
    paint: (p) => {
      for (const [x, y] of [[110, 128], [104, 130], [116, 130], [110, 122]]) p(x, y, 4, M.Stone);
      p(110, 100, 1, M.Wellspring); p(110, 97, 1, M.Water);
    },
    outcome: (g, before) => g.appeared(M.Sand, before) },

  // ---- Powders and liquids ------------------------------------------------------------
  { m: "Sand", covers: "sand.clumps", role: "clumps wet when watered", w: 24, h: 24, seed: 7, ticks: 300,
    paint: (p) => { p(12, 18, 3, M.Sand); p(12, 13, 2, M.Water); },
    outcome: (g, before) => g.gained(M.Sand, F.Wet, before) },
  { m: "Sand", covers: "sand.vitrifies", role: "fuses into glass under lava", w: 30, h: 26, seed: 8, ticks: 900,
    paint: (p) => { p(15, 20, 3, M.Sand); p(15, 15, 2, M.Lava); },
    outcome: (g, before) => g.appeared(M.Glass, before) },
  { m: "Sand", covers: "sand.settles", role: "sinks through a pond to the bed", w: 30, h: 28, seed: 132, ticks: 600,
    // Poured onto a walled pond from above, the way a player makes a lake bed. The outcome is
    // sand with water above it in its own column — sand that got UNDER the surface, which a
    // grain resting on top of the pond can never satisfy.
    paint: (p) => {
      for (let y = 18; y <= 25; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Water);
      p(15, 8, 3, M.Sand);
      for (let x = 6; x <= 24; x++) p(x, 26, 1, M.Wall);
      for (let y = 12; y <= 26; y++) { p(7, y, 1, M.Wall); p(23, y, 1, M.Wall); }
    },
    outcome: (g) => g.all(M.Sand).filter((i) => {
      const [x, y] = g.xyOf(i);
      for (let ay = y - 1; ay >= 0; ay--) {
        const above = g.kindAt(x, ay);
        if (above === M.Water) return true;
        if (above !== M.Sand) return false;
      }
      return false;
    }) },
  { m: "Water", covers: "water.boils", role: "boils away to steam over sustained flame", w: 30, h: 26, seed: 9, ticks: 2000,
    paint: (p) => { p(15, 20, 3, M.Wall); p(15, 16, 3, M.Water); p(15, 21, 2, M.Lava); },
    outcome: thermalSteam },
  { m: "Water", covers: "water.flows", role: "throws a faint mist where it moves", w: 40, h: 34, seed: 133, ticks: 600,
    // The owner's call for ROADMAP Phase 20 was that the water sink be VISIBLE: moving water
    // throws mist rather than silently vanishing. A pour into a walled basin with no heat
    // anywhere, so every wisp counted is spray — and it has to clear the same floors as any
    // other interaction, or "visible" is a claim nobody checked.
    paint: (p) => { for (let y = 16; y <= 29; y++) { p(6, y, 1, M.Wall); p(33, y, 1, M.Wall); } },
    act: (p, t) => { if (t < 90 && t % 3 === 0) p(20, 6, 4, M.Water); },
    outcome: (g, before, memo) => {
      memo.wisps ??= new Set();
      for (const i of g.appeared(M.Steam, before)) memo.wisps.add(i);
      return [...memo.wisps].filter((i) => g.kindOf(i) === M.Steam);
    } },
  { m: "Water", covers: "water.rinses", role: "rinses soot from scorched stone", w: 40, h: 34, seed: 10, ticks: 2200,
    // Burn beside the rock first, THEN wash it — the order a player uses. Soot is smoke
    // touching dry stone, and smoke rises straight up, so it blackens a face it climbs past:
    // a stone pillar dragged up beside a log fire, not a mound with a flame at its side.
    //
    // The mound is what this used to be, with a one-cell dab of fire, and it sooted ONE stone
    // cell at most — none at all on 4 seeds of 32, which failed. The witness then counted every
    // wet stone cell once that speck was gone, so it scored the pour wetting the rock, not
    // soot coming off it. The pillar soots 12 cells up its face on every seed, and the pour
    // on its top runs down the face and rinses nearly all of them.
    //
    // The witness is stone that was sooty and is now clean and wet, and it is measured against
    // the scene on the last tick before anything washed off, because black turning clean is
    // what a player sees. Against the rock as painted, it would score clean against clean.
    paint: (p) => { for (let y = 25; y >= 12; y--) p(24, y, 4, M.Stone); p(15, 26, 3, M.Wood); p(15, 20, 4, M.Fire, 55); },
    act: (p, t) => { if (t === 700) p(24, 4, 4, M.Water, 55); },
    outcome: (g, before, memo) => {
      memo.sooty ??= new Set();
      memo.rinsed ??= new Set();
      for (const i of g.all(M.Stone)) if (g.hasFlag(i, F.Scorched)) memo.sooty.add(i);
      for (const i of memo.sooty) {
        if (g.kindOf(i) === M.Stone && !g.hasFlag(i, F.Scorched) && g.hasFlag(i, F.Wet)) memo.rinsed.add(i);
      }
      if (!memo.rinsed.size) memo.against = grid(g.cells.slice(), g.w, g.h);
      return [...memo.rinsed].filter((i) => g.kindOf(i) === M.Stone && !g.hasFlag(i, F.Scorched));
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
    // A flame at the default brush on a log. A one-cell dab caught on tick 1-3 or never: it
    // burns out so fast that on 4 seeds of 32 it missed the log entirely. The brush catches on
    // 32 of 32 with at least 32 ember cells; wood.burns below is the same scene, and moved the
    // same way.
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 13, 4, M.Fire, 55); },
    outcome: (g, before) => g.appeared(M.Ember, before) },
  { m: "Fire", covers: "fire.softens", role: "softens into steam against water", w: 30, h: 26, seed: 15, ticks: 400,
    // Water poured from above onto a flame, which is how a player puts a fire out. A blob
    // painted beside the fire just falls past it before anything can happen. At the default
    // brush, the pour half a second after the flame: a one-cell dab under a small blob made
    // 2 cells of steam on 1 seed of 32; this makes at least 53 on all 32.
    paint: (p) => { p(15, 20, 4, M.Fire, 55); },
    act: (p, t) => { if (t === 10) p(15, 11, 4, M.Water, 55); },
    outcome: thermalSteam },
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
  { m: "Ice", covers: "ice.stresses", role: "frost-stresses damp hard materials", w: 40, h: 30, seed: 20, ticks: 1500,
    // A rock, a pour over it, then ice against its flank — one gesture after another, at the
    // default brush and the app's own water density, the way a player switches materials.
    //
    // The ice has to TOUCH the rock, and for a long time it did not. It was painted one cell
    // clear of the flank, and frost reached the stone only because the pour froze into a bridge
    // across the gap — so the scene passed only while the ice was already waiting for the water.
    // Painted a second after the pour (water at tick 20, ice at 40), that layout froze nothing
    // on 32 seeds of 32. Printing the board is what showed the gap; the comment here claimed the
    // ice was against the flank.
    //
    // Painted touching, it no longer matters which comes first: pour then ice passes 32 of 32
    // with at least 6 frosted cells, still 32 of 32 with the ice seven seconds late (stone
    // stays wet until its dampness drains), and ice then pour passes 32 of 32 with at least 4.
    //
    // Only the pour makes it happen. Dry masonry used to frost just the same — it fell through
    // to the generic freeze, whose energy the next tick read as dampness — so this scene passed
    // 32 of 32 with no water at all, and "damp" in the clause meant nothing. The check below is
    // this exact scene without the pour, and it must stay bare.
    paint: (p) => { p(20, 21, 4, M.Stone); },
    act: (p, t) => { if (t === 20) p(20, 12, 4, M.Water, 55); if (t === 60) p(13, 21, 4, M.Ice); },
    outcome: (g, before) => g.gained(M.Stone, F.Frozen, before) },
  { m: "Ice", covers: "ice.stresses", role: "leaves dry stone and wall bare", w: 40, h: 30, seed: 20, ticks: 1500,
    absent: true,
    // The scene above, gesture for gesture, without the pour — so it cannot pass merely because
    // the ice never reached anything. The ice touches the rock and the dry floor bricks under it.
    paint: (p) => { p(20, 21, 4, M.Stone); },
    act: (p, t) => { if (t === 60) p(13, 21, 4, M.Ice); },
    outcome: (g, before) => [...g.gained(M.Stone, F.Frozen, before), ...g.gained(M.Wall, F.Frozen, before)] },

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
  { m: "Stem", covers: "stem.climbs", role: "unfurls side leaves as it climbs", w: 60, h: 34, seed: 25, ticks: 3500,
    // A generous watering. A stalk's height is fixed by the seed's energy when it germinates,
    // and since puddles on open ground dry as mist (ROADMAP Phase 20) a thin pour leaves the
    // bed's top dry too soon: a short stalk and no leaves on 5 seeds of 8. Watering again
    // later does not help — the height is already decided.
    //
    // A dragged BED, not one stamp — "paint a bed, not a plot" (docs/HARNESS.md). Leaves come
    // one per stalk or none, plants keep six cells apart, and a single seed stamp holds two or
    // three plants, so the old scene lived or died on whether one of them leafed: one leaf in
    // the whole scene on 6 seeds of 32. Stamping the seeds at the default brush did not help
    // (23 of 32), because a stamp is still one plot. A player's planter watered once grows a
    // median of 13 plants and 12 leaves on the play board; this bed, at the app's density,
    // passes 32 of 32 with at least 4 leaves. (The witness counts each leaf together with the
    // stalk cell it clings to, so the audit reports that as 8 cells.)
    paint: (p) => {
      for (let x = 14; x <= 46; x++) p(x, 28, 4, M.Soil, 55);
      for (let x = 14; x <= 46; x++) p(x, 23, 4, M.Seed, 55);
      for (let x = 14; x <= 46; x += 2) p(x, 17, 4, M.Water, 55);
    },
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
  { m: "Meteor", covers: "meteor.trail", role: "sheds a spark trail as it falls", w: 40, h: 140, seed: 34, ticks: 250,
    // The real board's height, and a meteor at the default brush. On a 40-row board the rock
    // hits bottom almost at once, so the trail was on screen 29 ticks on 1 seed of 32, and a
    // default-brush meteor there sat at exactly the 30-tick floor. Falling the height of the
    // tray it trails for at least 129 ticks on all 32. Only a meteor makes sparks here.
    paint: (p) => { p(20, 6, 4, M.Meteor, 55); },
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
    paint: (p) => { p(8, 20, 3, M.Soil); p(8, 16, 2, M.Water); p(8, 20, 1, M.Moss); for (let y = 14; y < 22; y += 2) p(17, y, 1, M.Wall); p(24, 20, 3, M.Soil); },
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
    // Water standing on stone NOW. It used to remember every cell that had ever held water over
    // stone and count it while it held any water: 3% of what it counted over 32 seeds was water
    // with no stone left under it.
    outcome: (g) => g.all(M.Water).filter((i) => {
      const [x, y] = g.xyOf(i);
      return g.kindAt(x, y + 1) === M.Stone;
    }) },
  { m: "Stone", covers: "stone.weathers", role: "condenses steam harder than sealed wall", w: 26, h: 30, seed: 57, ticks: 1500,
    paint: (p) => { p(13, 24, 3, M.Water); p(13, 25, 2, M.Lava); p(13, 14, 3, M.Stone); },
    outcome: (g, before) => g.gained(M.Stone, F.Wet, before) },

  { m: "Sand", covers: "sand.pours", role: "pours fast as dry powder, two cells per tick", w: 26, h: 64, seed: 58, ticks: 120,
    // Painted at row 6 with radius 1, so the lowest grain starts at row 7. The witness is sand
    // below row 7 + 1.5t after t ticks: a pour keeping up a pace no one-cell fall can.
    //
    // It used to be any sand that had reached row 9, counted while it stayed sand. A fall of
    // one cell a tick gets there two ticks later and stays, so with the two-cell drop taken
    // out of the sim it still passed 32 of 32. Its first fix, sand below row 7 + t, was fooled
    // the same way by review: a lead gained in the first ticks lasts the whole fall, and with
    // the drop allowed only for three ticks it passed 32 of 32 too. At 1.5 a tick that is 0 of
    // 32. The pace needs room to show, and 64 rows is under half the app's 140-row world; it
    // is on screen at least 34 ticks, so this is a thin pass by nature, not by staging.
    paint: (p) => { p(13, 6, 1, M.Sand); },
    outcome: (g, before, memo) => {
      memo.t = (memo.t ?? -1) + 1; // called once before the first tick, then once a tick
      return g.all(M.Sand).filter((i) => g.xyOf(i)[1] > 7 + 1.5 * memo.t);
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
    // A pond, lava dropped into it a second later, and ice held over the steam — at the default
    // brush. The old scene was a small pool and a small ice dab: the lava quenches in about 60
    // ticks, so the steam comes as one brief narrow burst, and most of it rose past the dab,
    // which caught 2-3 cells on 4 seeds of 32. This catches at least 13 on all 32.
    //
    // The witness is ice that was STEAM the tick before. Counting any new ice also took water
    // that splashed up and froze: 6 of 707 cells over 32 seeds here.
    paint: (p) => { p(13, 23, 4, M.Water, 55); p(13, 12, 4, M.Ice); },
    act: (p, t) => { if (t === 20) p(13, 23, 4, M.Lava, 55); },
    outcome: (g, before, memo, prev) => {
      memo.frost ??= new Set();
      for (const i of g.appeared(M.Ice, before)) if (prev.kindOf(i) === M.Steam) memo.frost.add(i);
      return [...memo.frost].filter((i) => g.kindOf(i) === M.Ice);
    } },
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
    // Steam hotter than mist. Petrichor vents its wisp at energy 90 and moving water throws
    // spray at MIST_ENERGY, and nothing in this scene is hot, so nothing else makes steam.
    // It used to count every steam cell, and the sprinkle's own spray was most of it: it
    // passed 32 of 32 with the soil painted as stone, with no soil at all, and with the water
    // arriving before the soil had a dry spell to break. Now 32 of 32 as staged, and 0 of 32
    // for each of those.
    outcome: (g) => g.all(M.Steam).filter((i) => g.energyAt(i) > MIST_ENERGY) },
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
    // Lit at the default brush, for the reason given at fire.ignites: a dab missed the log on
    // 4 seeds of 32.
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 13, 4, M.Fire, 55); },
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
    // Wood that was wet last tick and is dry and scorched now, counted while it stays dry and
    // scorched: water can wet it again without clearing the scorch, and that is not the outcome.
    // Heat scorches only WET wood, so the transition is the drying itself; smoke soots only dry
    // wood and cannot make it.
    //
    // This used to count any wood ever scorched while it was wood or ember. It passed 32 of 32
    // with the water left out, three quarters of its count was ember, and what scorch it found
    // on dry wood was smoke. Honestly witnessed it failed this check's own seed, because only
    // the flame dried wet wood: a burning log is mostly ember, and ember lit wet wood straight
    // through (434 wet cells over 32 seeds, against 180 dried first). Since embers dry wet fuel
    // too (2026-10-07, the owner's call after a filmstrip), none skip the step: 32 of 32 on the
    // usual seeds (81 + k*1000), on screen at least 54 ticks, and 0 of 32 without the water or
    // without the flame. Review tried seeds 1-32 as well: 29, the other three scorching fewer
    // than 4 cells. Counting scorched wood the pool had wet again read 1,195 ticks; that was
    // leftovers.
    outcome: (g, before, memo, prev) => {
      memo.dried ??= new Set();
      for (const i of g.all(M.Wood)) {
        if (g.hasFlag(i, F.Scorched) && !g.hasFlag(i, F.Wet) && prev.kindOf(i) === M.Wood && prev.hasFlag(i, F.Wet)) memo.dried.add(i);
      }
      return [...memo.dried].filter((i) => g.kindOf(i) === M.Wood && g.hasFlag(i, F.Scorched) && !g.hasFlag(i, F.Wet));
    } },
  { m: "Fire", covers: "fire.dries", role: "the embers it leaves dry wet fuel the same way", w: 30, h: 26, seed: 138, ticks: 1500,
    // The check above counts wood dried by flame and by ember together, so it passed 10 of 32
    // with ember drying taken out of the JS mirror. This is its scene, counting only wood dried
    // with no flame, lava or meteor beside it last tick: an ember did it. And only wood not
    // already scorched: a warm hearth brick clears the wet from wood the pool wet again, and
    // that leftover scorch let one seed pass with ember drying taken out. 29 of 32, a median of
    // 14 cells; on the other three the embers dry 0, 1 and 0 cells. 0 of 32 with ember drying
    // taken out, without the water, or without the flame.
    paint: (p) => { p(15, 20, 6, M.Wood); p(15, 13, 4, M.Water); },
    act: (p, t) => { if (t === 300) { p(22, 20, 1, M.Fire); p(8, 20, 1, M.Fire); } },
    outcome: (g, before, memo, prev) => {
      memo.dried ??= new Set();
      memo.t = (memo.t ?? -1) + 1; // called once before the first tick, then once a tick
      // The flames land on tick 300 after `prev` was taken, so `prev` cannot see what they
      // dry on that tick; it credited 60 of 470 cells over 32 seeds to embers.
      if (memo.t === 300) return [...memo.dried].filter((i) => g.kindOf(i) === M.Wood && g.hasFlag(i, F.Scorched) && !g.hasFlag(i, F.Wet));
      for (const i of g.all(M.Wood)) {
        if (!g.hasFlag(i, F.Scorched) || g.hasFlag(i, F.Wet) || prev.kindOf(i) !== M.Wood || !prev.hasFlag(i, F.Wet)) continue;
        if (prev.hasFlag(i, F.Scorched)) continue;
        const [x, y] = g.xyOf(i);
        let flame = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const k = prev.kindAt(x + dx, y + dy);
          if (k === M.Fire || k === M.Lava || k === M.Meteor) flame = true;
        }
        if (!flame) memo.dried.add(i);
      }
      return [...memo.dried].filter((i) => g.kindOf(i) === M.Wood && g.hasFlag(i, F.Scorched) && !g.hasFlag(i, F.Wet));
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
  { m: "Lava", covers: "lava.scorches", role: "dries, scorches and thaws its neighbours", w: 50, h: 34, seed: 87, ticks: 1500,
    // A wall watered, then lava set beside it five seconds later, at the default brush. Lava
    // dries a wet neighbour it touches and leaves it scorched; the witness is cells that were
    // PAINTED as wall and gained the scorch, never anything the lava itself became.
    //
    // Most of that scorch lands on the scene's wall FLOOR, not the slab: the pour runs off the
    // slab and spreads thin across the floor, and the lava flows over the wet bricks. Review
    // measured it: the slab alone gives 0-3 cells and passes no seed, the floor gives the rest.
    // So this is lava meeting masonry that still has water spread on it, which is what scorches
    // in play; a floor a player builds is that surface. A tray deep enough to hold a pool did
    // worse (25-28 of 32), because a pool quenches the lava instead.
    //
    // This used to be a rock, a water splash and lava, counting any stone that gained the
    // scorch. Over 32 seeds, 123 of the 205 cells it counted were lava quenched into scorched
    // stone, which is lava.quenched; counting the painted rock alone it failed on every seed,
    // at 2-3 cells. Lava rarely scorches stone in play: the water that wets the rock boils
    // against the lava and crusts it into a stone wall between them, and once the pour has
    // run off, a rock dries before the lava arrives. Here the scorch is plainly visible: a
    // median of about 12 cells at contrast 130 or more, 31 of 32 seeds, and 31-32 with the
    // lava at tick 60, 140 or 200, so the timing is not tuned. The low seed is real rather
    // than staging: how much wet surface the lava reaches depends on where the pour ran.
    paint: (p) => { p(25, 25, 4, M.Wall); },
    act: (p, t) => { if (t === 20) p(25, 16, 4, M.Water, 55); if (t === 100) p(16, 25, 4, M.Lava, 55); },
    outcome: (g, before) => g.gained(M.Wall, F.Scorched, before).filter((i) => before.kindOf(i) === M.Wall) },

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
  { m: "Moss", covers: "moss.dries", role: "dries and scorches before burning", w: 60, h: 30, seed: 92, ticks: 900,
    // The moss has to be WET first: measured on a dry mat, fire skips straight to burning
    // and the scorch step the docs describe never happens at all.
    //
    // A soaked carpet lit from one end, soon after watering. The scorch is a moving front —
    // each cell holds it for only ~20 ticks before it burns — so it is seen on a strip the
    // fire has to travel, not on a mound it eats in thirty ticks.
    //
    // Carpet and flame are painted at the DEFAULT brush, which is what a player does. The scene
    // used a two-cell strip lit by a one-cell flame at its far edge, where the watering pools,
    // and it was a coin flip: on 5 seeds of 32 the flame went out before the fire caught,
    // leaving 2 scorched cells against a floor of 4. The rule was never in doubt — on the play
    // board a watered default-brush carpet lit the same way scorches 124-129 cells on every
    // seed — so the scene was measuring the fixture. At the default brush: 32 of 32, at least
    // 52 cells each.
    paint: (p) => { for (let x = 10; x <= 50; x++) p(x, 22, 4, M.Moss); for (let x = 10; x <= 50; x += 2) p(x, 12, 1, M.Water); },
    act: (p, t) => { if (t === 150) p(10, 15, 4, M.Fire); },
    // Moss that is scorched NOW. This used to remember every cell ever scorched and keep
    // counting it while it held moss — and moss the fire did not finish recovers once the
    // standing water re-wets it, so 25,546 of 33,543 counted cell-ticks over 32 seeds were
    // moss that was no longer scorched, reported as a median of 744 ticks on screen. The
    // moving front is what a player sees, and it is on screen 65-85 ticks.
    outcome: (g) => g.all(M.Moss).filter((i) => g.hasFlag(i, F.Scorched)) },
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
    // A segment DROPPING: stem in a cell that had none, with stem above it the tick before,
    // counted while it lies where it landed. It used to count every stalk cell that appeared
    // once any stem existed (its `memo.cut` turned true at the first sprout, not at the cut),
    // so it measured the plant growing, and passed 32 of 32 with the cut left out. Now 0 of 32
    // without the cut and 30 of 32 with it: on two seeds the stalk grows from the soil beside
    // the seed pile and stands wholly below the cut, which takes its tip and leaves nothing
    // above to fall.
    outcome: (g, before, memo, prev) => {
      memo.fallen ??= new Set();
      for (const i of g.all(M.Stem)) if (i >= g.w && prev.kindOf(i) !== M.Stem && prev.kindOf(i - g.w) === M.Stem) memo.fallen.add(i);
      return [...memo.fallen].filter((i) => g.kindOf(i) === M.Stem);
    } },
  { m: "Stem", covers: "stem.footing", role: "a severed stalk's bloom comes down with it", w: 60, h: 34, seed: 106, ticks: 3500,
    // The garden stem.burns grows (a dragged seed bed, generously watered), cut along the
    // stalks' bases with an eraser stroke once it has bloomed. The check above watches the
    // stalk fall; this one watches the bloom, because a bloom had no footing rule at all and
    // hung in the air for about two minutes after its stalk went. Here, not the one-plant
    // scene above: one watering grows a 1-5 cell head that drops about three rows, and that
    // passed 15 of 32 for being small, not for hanging.
    //
    // The witness is a bloom cell DROPPING once the cut is made: a flower where there was
    // none, under the bottom of a run of flower cells whose top has emptied, so the run moved
    // down. A petal unfurling under another petal moves nothing above it, and late blooms
    // still do that past the cut. 32 of 32; 0 of 32 without the cut, and 0 of 32 on the
    // build before blooms had footing.
    paint: (p) => {
      for (let x = 14; x <= 46; x++) p(x, 28, 4, M.Soil, 55);
      for (let x = 14; x <= 46; x++) p(x, 23, 4, M.Seed, 55);
      for (let x = 14; x <= 46; x += 2) p(x, 17, 4, M.Water, 55);
    },
    act: (p, t) => { if (t === 2500) for (let x = 14; x <= 46; x++) p(x, 18, 1, M.Empty); },
    outcome: (g, before, memo, prev) => {
      memo.t = (memo.t ?? -1) + 1; // called once before the first tick, then once a tick
      memo.down ??= new Set();
      if (memo.t >= 2500) {
        for (const i of g.all(M.Flower)) {
          if (i < g.w || prev.kindOf(i) === M.Flower || prev.kindOf(i - g.w) !== M.Flower) continue;
          let top = i - g.w;
          while (top >= g.w && prev.kindOf(top - g.w) === M.Flower) top -= g.w;
          if (g.kindOf(top) !== M.Flower) memo.down.add(i);
        }
      }
      return [...memo.down].filter((i) => g.kindOf(i) === M.Flower);
    } },
  { m: "Stem", covers: "stem.burns", role: "burns like living growth", w: 60, h: 34, seed: 106, ticks: 3500,
    // The garden stem.climbs grows (a dragged seed bed, generously watered), then a flame
    // swept over it at the default brush.
    //
    // Measured as a stalk CATCHING, not as the scorch flag: scorch is the step heat takes on
    // WET growth, and a stalk standing a while is dry enough to skip it. And never a stalk
    // the flame's own brush painted over: that is paint, not burning. The old scene dabbed
    // small flames among one planter's plants for 700 ticks and counted those too; without
    // them it passed 7 of 32. Honestly witnessed, with the garden at the app's density, this
    // passed 32 of 32, on screen at least 33 ticks: a burning cell turns to smoke at 1 in 18 a
    // tick, so fire here is a flare, and a stalk fire is about that long. Since a bloom falls
    // with its burnt stalk (2026-10-08) it is 31 of 32: the falling heads change every roll
    // after the burn, and seed #6's flare lasts 28 ticks. The rest did not weaken (median 114
    // ticks on screen, against 111), so the scene is left as it is.
    paint: (p) => {
      for (let x = 14; x <= 46; x++) p(x, 28, 4, M.Soil, 55);
      for (let x = 14; x <= 46; x++) p(x, 23, 4, M.Seed, 55);
      for (let x = 14; x <= 46; x += 2) p(x, 17, 4, M.Water, 55);
    },
    act: (p, t) => { if (t === 2500) for (const [x, y] of STEM_FLAMES) p(x, y, 4, M.Fire, 55); },
    outcome: (g, before, memo, prev) => {
      memo.burnt ??= new Set();
      for (let i = 0; i < g.size; i++) {
        if (prev.kindOf(i) !== M.Stem) continue;
        const [x, y] = g.xyOf(i);
        if (STEM_FLAMES.some(([fx, fy]) => (x - fx) ** 2 + (y - fy) ** 2 <= 16)) continue;
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
    // Ember that is hot NOW. Remembering every ember once hot and counting it while it was
    // ember at all counted cooled char: 97% of its cell-ticks over 32 seeds. This witnesses the
    // glow only: with ember ignition taken out of the sim it still passes 28 of 32, because the
    // painted flame lights enough of the log itself. The next check witnesses the spread.
    outcome: (g) => g.all(M.Ember).filter((i) => g.energyAt(i) > 150) },
  { m: "Ember", covers: "ember.glows", role: "an ember lights the wood beside it", w: 30, h: 26, seed: 135, ticks: 600,
    // The glow check's own scene. The witness is wood that caught last tick with no flame,
    // lava or meteor anywhere beside it, so only an ember can have lit it, counted while it is
    // still a live ember (the sim's COLD_CHAR_ENERGY, 30). Most of the log catches this way, in
    // under 50 ticks. 32 of 32, 25 cells or more; 0 of 32 with ember ignition taken out of the
    // JS mirror, where the glow check above still passes 28.
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); },
    outcome: (g, before, memo, prev) => {
      memo.caught ??= new Set();
      for (let i = 0; i < g.size; i++) {
        if (g.kindOf(i) !== M.Ember || prev.kindOf(i) !== M.Wood) continue;
        const [x, y] = g.xyOf(i);
        let flame = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const k = prev.kindAt(x + dx, y + dy);
          if (k === M.Fire || k === M.Lava || k === M.Meteor) flame = true;
        }
        if (!flame) memo.caught.add(i);
      }
      return [...memo.caught].filter((i) => g.kindOf(i) === M.Ember && g.energyAt(i) >= 30);
    } },
  { m: "Ember", covers: "ember.quenched", role: "running water washes cold char away", w: 30, h: 26, seed: 136, ticks: 900,
    // A log burnt out, then water poured over its cold char. The whole log is cold char by tick
    // 150; the pour starts at 200, above the log so the brush paints over none of it. The
    // witness is a cell that was cold char last tick and is not ember now, counted while it
    // stays so. Ember never moves and nothing else in a tick removes it, so that is the wash.
    // Its contrast is against the tick before the first wash, not the painted wood. 32 of 32,
    // thin by nature (5 cells at the least, 10 at the median: the pour runs off the log), every
    // counted cell water at the end; 0 of 32 without the pour or with the wash taken out.
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); },
    act: (p, t) => { if (t >= 200 && t < 260 && t % 4 === 0) p(15, 8, 3, M.Water); },
    outcome: (g, before, memo, prev) => {
      memo.washed ??= new Set();
      for (let i = 0; i < g.size; i++) {
        if (prev.kindOf(i) !== M.Ember || prev.energyAt(i) >= 30 || g.kindOf(i) === M.Ember) continue;
        memo.washed.add(i);
        memo.against ??= prev;
      }
      return [...memo.washed].filter((i) => g.kindOf(i) !== M.Ember);
    } },
  { m: "Ember", covers: "ember.quenched", role: "quenches wet under water", w: 30, h: 26, seed: 110, ticks: 4000,
    // Water poured on the log two seconds after it is lit, while it still burns. A log this
    // size catches all at once and is cold char five to seven seconds later, and this used to
    // pour at 75 seconds: it witnessed cold char getting wet, never a quench, and review found
    // it passed 32 of 32 with the quench taken out of the sim.
    //
    // The witness is a live ember (energy at least the sim's COLD_CHAR_ENERGY, 30) that turned
    // wet and lost 20 or more energy in one tick, counted while it stays wet. The quench takes
    // 120 at once; natural cooling never takes 20, and "any drop" passed 32 of 32 on cooling
    // alone with the quench sabotaged. Its contrast is against the tick before the first
    // quench, not the painted wood. 32 of 32 as staged; 0 of 32 with the pour at 75 s, and 0
    // of 32 with the quench sabotaged. The clause's second half, running water washing cold
    // char away, is the check above.
    paint: (p) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); },
    act: (p, t) => { if (t === 40) p(15, 13, 4, M.Water); },
    outcome: (g, before, memo, prev) => {
      memo.quenched ??= new Set();
      for (const i of g.all(M.Ember)) {
        if (!g.hasFlag(i, F.Wet) || prev.kindOf(i) !== M.Ember || prev.hasFlag(i, F.Wet)) continue;
        if (prev.energyAt(i) < 30 || prev.energyAt(i) - g.energyAt(i) < 20) continue;
        memo.quenched.add(i);
        memo.against ??= prev;
      }
      return [...memo.quenched].filter((i) => g.kindOf(i) === M.Ember && g.hasFlag(i, F.Wet));
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
    // 31 of 32: one seed sows 3 grains in five minutes against a median of 45. The ring is
    // slow by design; at 9000 ticks that seed reaches 4. Lengthening the window would change
    // the question this check asks, so it is left.
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
    // Left as it is at 31 of 32, on purpose. The short seed shows its fire for 27 ticks, and
    // that is how long oil burns: a burning cell turns to smoke at 1 in 18 a tick, so a pool
    // this size flares for about a second and a half. Re-staging did not help. A settled
    // default-brush pool sheets thin across the floor's bumps into separate puddles (14-23
    // of 32), and oil poured onto a burning log flares just as briefly (27-30). A flame
    // painted ONTO a settled pool would also count the oil it painted over as catching.
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
    // A tall sky, because that is where a meteor is seen: in a 34-row scene it is on screen
    // for 24 ticks, barely a second, and the fall itself never registers.
    paint: (p) => { p(15, 5, 1, M.Meteor); },
    // Its descent, measured from below the row it was painted on — the whole fall is what
    // the player watches, but counting the painted cell itself would be measuring the brush.
    outcome: (g, before, memo) => {
      memo.fell ??= new Set();
      for (const i of g.all(M.Meteor)) if (g.xyOf(i)[1] > 7) memo.fell.add(i);
      return [...memo.fell].filter((i) => g.kindOf(i) === M.Meteor);
    } },
  { m: "Meteor", covers: "meteor.shocked", role: "is shocked into scorched stone by water", w: 30, h: 34, seed: 120, ticks: 900,
    // A pond, then a meteor dropped into it, at the default brush. The witness is the stone
    // each SHOCK makes: a meteor cell turning straight into scorched stone, which is what the
    // water does to it, followed as that stone sinks (it only moves down or diagonally down).
    //
    // It used to count any scorched stone. With that witness, this scene without its pond
    // passed 12 of 32 (the old one-cell meteor, 1 of 32): a meteor landing on something
    // solid makes plain stone, and its own fire ring's smoke soots it. A first fix counted all
    // new stone once any shock had happened, and review found that crediting stone the
    // meteor's own cells made by landing on each other in mid-air, before any water. Now: 32
    // of 32, at least 15 cells, and 0 of 32 with no pond. The scorch itself is brief: the
    // stone sinks through water the impact has stirred, which rinses it, so it stays past the
    // floor on 26 of 32 seeds and is gone within a second on the rest.
    paint: (p) => { p(15, 28, 4, M.Water, 55); },
    act: (p, t) => { if (t === 20) p(15, 6, 4, M.Meteor, 55); },
    outcome: (g, before, memo, prev) => {
      memo.tracked ??= new Set();
      const next = new Set();
      for (const i of memo.tracked) {
        if (g.kindOf(i) === M.Stone) { next.add(i); continue; }
        for (const j of [i + g.w, i + g.w - 1, i + g.w + 1]) {
          if (j < g.size && g.kindOf(j) === M.Stone && prev.kindOf(j) !== M.Stone && !next.has(j)) { next.add(j); break; }
        }
      }
      for (const i of g.all(M.Stone)) if (prev.kindOf(i) === M.Meteor && g.hasFlag(i, F.Scorched)) next.add(i);
      memo.tracked = next;
      return [...next];
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
    // The launch fixture this and the next two scenes share: a pile at the DEFAULT brush with a
    // default-brush flame dropped on its top, which is what a player paints. It used to be a
    // radius-2 pile of about nine grains with a one-cell flame, and on that `rocket.climbs`
    // passed on 8 seeds of 32 before rockets could shove through their own charge and 23 after.
    // At the default brush it is 11 and 32, so the size is not what makes it pass.
    paint: (p) => launchFixture(p),
    outcome: (g, before, memo) => {
      memo.high ??= new Set();
      for (const i of [...g.all(M.Rocket), ...g.all(M.Spark)]) if (g.xyOf(i)[1] < 24) memo.high.add(i);
      return [...memo.high].filter((i) => g.kindOf(i) === M.Rocket || g.kindOf(i) === M.Spark);
    } },
  { m: "Rocket", covers: "rocket.fuses", role: "a lit line of powder burns its length", w: 80, h: 30, seed: 134, ticks: 400,
    // A line dragged along the floor with a flame dropped on its left end, which is how a
    // player lays a fuse. The outcome is lit grain more than 24 cells from the flame: the
    // light has to travel along the line to get there, one grain lighting the next.
    paint: (p) => { for (let x = 6; x <= 70; x++) p(x, 24, 1, M.Rocket); p(6, 22, 1, M.Fire); },
    outcome: (g) => g.all(M.Rocket).filter((i) => g.energyAt(i) > 0 && g.xyOf(i)[0] > 30) },
  { m: "Rocket", covers: "rocket.bursts", role: "bursts into a firework shell of sparks and stardust", w: 30, h: 44, seed: 124, ticks: 900,
    paint: (p) => launchFixture(p),
    outcome: (g, before) => g.appeared(M.Stardust, before) },

  { m: "Spark", covers: "spark.flies", role: "flies outward from a burst then droops and fades", w: 30, h: 44, seed: 125, ticks: 900,
    paint: (p) => launchFixture(p),
    outcome: (g, before, memo) => {
      memo.flung ??= new Set();
      for (const i of g.all(M.Spark)) if (Math.abs(g.xyOf(i)[0] - 15) > 3) memo.flung.add(i);
      return [...memo.flung].filter((i) => g.kindOf(i) === M.Spark);
    } },
  { m: "Spark", covers: "spark.lights", role: "lights rocket powder it reaches in flight", w: 60, h: 44, seed: 126, ticks: 1200,
    // Three default-brush charges on the floor of a room, the middle one lit. The ROOF is what
    // makes this reachable now. A lit charge goes up whole (`try_thrust`) and bursts some 25
    // cells up, and outward sparks never come back down that far — so in open air a second
    // charge catches on 2 seeds of 32. Under a Wall ceiling the rockets burst against it and
    // the sparks reach the floor: 32 of 32 with the roof at y=28, 30 or 32 alike.
    paint: (p) => {
      p(30, 37, 4, M.Rocket); p(15, 37, 4, M.Rocket); p(45, 37, 4, M.Rocket);
      for (let x = 1; x < 59; x++) p(x, 30, 1, M.Wall);
      p(30, 33, 2, M.Fire);
    },
    // A far charge that has caught, and once one has, the sparks thrown out over it — what is
    // lit NOW, with no cell remembered. An earlier version remembered every cell a lit grain had
    // touched and kept counting it while it held any rocket grain at all, so a far pile that
    // caught and burst in place scored its leftover UNLIT powder for the rest of the run: 1,193
    // ticks "on screen" on most seeds, where the honest reading was about 34. The sparks wait
    // for the catch because the lit charge's own shell reaches this far too: adversarial review
    // took both far piles out and still passed seed 8126 on sparks alone.
    outcome: (g, before, memo) => {
      const caught = g.all(M.Rocket).filter((i) => g.energyAt(i) > 0 && Math.abs(g.xyOf(i)[0] - 30) > 8);
      if (caught.length) memo.caught = true;
      return memo.caught ? [...caught, ...g.all(M.Spark).filter((i) => Math.abs(g.xyOf(i)[0] - 30) > 10)] : [];
    } },

  { m: "Wellspring", covers: "wellspring.drinks", role: "drinks the identity of the first source that touches it", w: 30, h: 26, seed: 130, ticks: 900,
    // A dormant spring stores nothing; once it has drunk, it carries the remembered
    // material's id as its energy, so a non-zero reading is the attunement itself.
    paint: (p) => { p(15, 19, 1, M.Wellspring); p(15, 15, 1, M.Water); },
    outcome: (g) => g.all(M.Wellspring).filter((i) => g.energyAt(i) > 0) },
  { m: "Wellspring", covers: "wellspring.blocks", role: "blocks flow like sealed construction while dormant", w: 30, h: 26, seed: 127, ticks: 400,
    // Stone dropped on the springs, because a dormant spring drinks the first source that
    // touches it, and sand, water, soil and oil are all sources. This used to drop sand, which
    // woke both springs on the first grain: of what it counted over 32 seeds, 128 cell-ticks
    // were sand on a dormant spring and 76,160 sand on one attuned to sand, which pushes its
    // own sand up through the pile. Stone is no source, so the spring stays dormant under it.
    // The witness is stone resting on a spring that is still dormant now. The next check is the
    // clause's other half, an attuned spring between pours.
    paint: (p) => { p(13, 19, 1, M.Wellspring); p(17, 19, 1, M.Wellspring); p(9, 19, 2, M.Wall); p(21, 19, 2, M.Wall); p(15, 8, 4, M.Stone); },
    outcome: (g) => g.all(M.Stone).filter((i) => {
      const [x, y] = g.xyOf(i);
      return g.kindAt(x, y + 1) === M.Wellspring && g.energyAt((y + 1) * g.w + x) === 0;
    }) },
  { m: "Wellspring", covers: "wellspring.blocks", role: "blocks flow between pours once attuned", w: 30, h: 26, seed: 137, ticks: 600,
    // The dormant scene, with a splash of water first: both springs drink it and pour water.
    // Stone dropped on them sinks through their pool, and a spring pours only into open air
    // or through its own material, so stone resting on one holds while it pours its other
    // faces. The witness is stone resting on a spring attuned NOW. 32 of 32, 6 cells; 0 of 32
    // with the springs painted as Wall, without the water, or with a grain let fall through an
    // attuned spring in the JS mirror (the dormant check above still passes all 32).
    paint: (p) => { p(13, 19, 1, M.Wellspring); p(17, 19, 1, M.Wellspring); p(9, 19, 2, M.Wall); p(21, 19, 2, M.Wall); p(15, 16, 1, M.Water); },
    act: (p, t) => { if (t === 100) p(15, 8, 4, M.Stone); },
    outcome: (g) => g.all(M.Stone).filter((i) => {
      const [x, y] = g.xyOf(i);
      return g.kindAt(x, y + 1) === M.Wellspring && g.energyAt((y + 1) * g.w + x) !== 0;
    }) },
  { m: "Wellspring", covers: "wellspring.stilled", role: "is stilled by nearby ice", w: 30, h: 26, seed: 128, ticks: 3000,
    absent: true,
    paint: (p) => { p(15, 19, 1, M.Wellspring); p(15, 16, 1, M.Water); p(11, 19, 2, M.Ice); p(19, 19, 2, M.Ice); },
    act: (p, t) => { if (t % 300 === 0) { p(11, 19, 2, M.Ice); p(19, 19, 2, M.Ice); } },
    outcome: (g, before) => g.appeared(M.Water, before).filter((i) => g.xyOf(i)[1] > 20) },
  { m: "Wellspring", covers: "wellspring.reattune", role: "re-drinks a new source while held under that chill", w: 60, h: 40, seed: 129, ticks: 1500,
    // A spring painted at the default brush and taught water, ice set beside it, then sand
    // dropped on top. The witness is spring cells HOLDING sand as a lesson, once they had
    // remembered water, measured against the last tick before any did: the listening frost
    // turning into the learned look, which is what a player sees.
    //
    // The old witness was "sand that appeared", and the scene's own sand dabs appear: it passed
    // 32 of 32 with the wellspring painted as plain Wall. Witnessed honestly it failed on every
    // seed, because the rule itself failed in play — a chilled spring drank its own pool the
    // tick after the sand, so the lesson faded. See `learn_or_adopt` in sim/src/lib.rs.
    paint: (p) => { p(30, 28, 4, M.Wellspring); },
    act: (p, t) => {
      if (t === 20) p(30, 18, 4, M.Water, 55);
      if (t === 120) p(21, 28, 4, M.Ice);
      if (t === 160) p(30, 18, 4, M.Sand, 55);
    },
    outcome: (g, before, memo) => {
      const springs = g.all(M.Wellspring);
      if (springs.some((i) => g.energyAt(i) === M.Water)) memo.knewWater = true;
      const learned = memo.knewWater ? springs.filter((i) => g.energyAt(i) === M.Sand && g.hasFlag(i, TAUGHT)) : [];
      if (!learned.length) memo.against = grid(g.cells.slice(), g.w, g.h);
      return learned;
    } },
];
