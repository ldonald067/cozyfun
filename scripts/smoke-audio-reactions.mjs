import { compileApp } from "./compile-app.mjs";

const app = compileApp("audio-reactions-cjs", ["audio/reactions.ts", "materials.ts", "engine.ts"]);

const { detectReactionCues } = app.load("audio/reactions");

// Material ids and flags from the compiled source, never a hand-typed copy.
const { MATERIAL, CELL_FLAG } = app.load("materials");

const CELL_STRIDE = 8;
const WIDTH = 4;
const HEIGHT = 4;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeU16(cells, offset, value) {
  cells[offset] = value & 255;
  cells[offset + 1] = (value >> 8) & 255;
}

function setCell(cells, x, y, kind, { flags = 0 } = {}) {
  const idx = (y * WIDTH + x) * CELL_STRIDE;
  cells[idx] = kind;
  writeU16(cells, idx + 6, flags);
}

function expectCues(label, setup, expected) {
  const before = new Uint8Array(WIDTH * HEIGHT * CELL_STRIDE);
  const after = before.slice();
  setup(before, after);
  const actual = detectReactionCues(before, after);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} cues mismatch. expected ${expected.join(",") || "none"}, got ${actual.join(",") || "none"}`
  );
}

expectCues("water flash to steam", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Water);
  setCell(after, 1, 1, MATERIAL.Steam);
}, ["steam-flash"]);

expectCues("moved steam stays silent", (_before, after) => {
  setCell(after, 1, 1, MATERIAL.Steam);
}, []);

expectCues("seed bloom", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Seed);
  setCell(after, 1, 1, MATERIAL.Flower);
}, ["bloom"]);

// The real sim blooms by writing a Flower into the empty cell above the stalk tip.
expectCues("stalk tip bloom", (_before, after) => {
  setCell(after, 1, 1, MATERIAL.Flower);
}, ["bloom"]);

// A cut stalk's head falls a cell at a time, and each cell it lands in reads Empty -> Flower.
// Nothing bloomed: the count of flower cells did not grow.
expectCues("a falling bloom stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Flower);
  setCell(before, 1, 2, MATERIAL.Flower);
  setCell(after, 1, 2, MATERIAL.Flower);
  setCell(after, 1, 3, MATERIAL.Flower);
}, []);

expectCues("cosmic water charge", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Water);
  setCell(after, 1, 1, MATERIAL.Moonwater, { flags: CELL_FLAG.Cosmic });
}, ["cosmic-charge"]);

expectCues("cosmic life mark", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Seed);
  setCell(after, 1, 1, MATERIAL.Seed, { flags: CELL_FLAG.Cosmic });
}, ["cosmic-charge"]);

expectCues("moonwater cleans oil", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Oil);
  setCell(after, 1, 1, MATERIAL.Stardust);
}, ["cleanse"]);

expectCues("meteor impact", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Meteor);
  setCell(after, 1, 1, MATERIAL.Stone);
}, ["impact-burst"]);

// A meteor turns the moonwater round it to stardust as its own cell lands; that cell rings.
expectCues("meteor moonwater burst", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Meteor);
  setCell(after, 1, 1, MATERIAL.Stardust);
  setCell(before, 1, 2, MATERIAL.Moonwater);
  setCell(after, 1, 2, MATERIAL.Stardust);
}, ["impact-burst"]);

expectCues("sand fuses into glass", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Sand);
  setCell(after, 1, 1, MATERIAL.Glass);
}, ["vitrify"]);

expectCues("stardust snuffs fire", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Fire);
  setCell(after, 1, 1, MATERIAL.Stardust);
}, ["starfire"]);

expectCues("wood catches into ember", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Wood);
  setCell(after, 1, 1, MATERIAL.Ember);
}, ["ember-glow"]);

expectCues("water quenches ember", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Ember);
  setCell(after, 1, 1, MATERIAL.Ember, { flags: CELL_FLAG.Wet });
}, ["quench"]);

expectCues("already wet ember stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Ember, { flags: CELL_FLAG.Wet });
  setCell(after, 1, 1, MATERIAL.Ember, { flags: CELL_FLAG.Wet });
}, []);

expectCues("wall crumbles into stone", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Wall);
  setCell(after, 1, 1, MATERIAL.Stone);
}, ["crumble"]);

expectCues("steam frosts into ice", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Steam);
  setCell(after, 1, 1, MATERIAL.Ice);
}, ["frost"]);

expectCues("water freezes into ice", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Water);
  setCell(after, 1, 1, MATERIAL.Ice);
}, ["frost"]);

expectCues("meteor shatters glass to sand", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Glass);
  setCell(after, 1, 1, MATERIAL.Sand);
}, ["shatter"]);

expectCues("water erodes stone, taking the grain", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Stone);
  setCell(after, 1, 1, MATERIAL.Water);
}, ["erode"]);

// A grain settling through a pond is the same liquid -> Sand swap erosion makes at the
// water's cell. It must stay silent, which is why the cue keys on the rock half instead.
expectCues("a sand grain sinking through water stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Water);
  setCell(after, 1, 1, MATERIAL.Sand, { flags: CELL_FLAG.Wet });
}, []);

// The same reading, everywhere a cue's cells can move: a move lands the material in a cell
// that did not hold it, and the cue heard that cell as an event. A move keeps every count, so
// each of these frames, which the sim really makes, must stay silent.
expectCues("a cut stalk falling stays silent", (before, after) => {
  setCell(before, 1, 0, MATERIAL.Stem);
  setCell(before, 1, 1, MATERIAL.Stem);
  setCell(after, 1, 1, MATERIAL.Stem);
  setCell(after, 1, 2, MATERIAL.Stem);
}, []);

expectCues("a stone grain sinking through water stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Stone);
  setCell(before, 1, 2, MATERIAL.Water);
  setCell(after, 1, 1, MATERIAL.Water);
  setCell(after, 1, 2, MATERIAL.Stone);
}, []);

expectCues("a bubble rising through water stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Water);
  setCell(before, 1, 2, MATERIAL.Steam);
  setCell(after, 1, 1, MATERIAL.Steam);
  setCell(after, 1, 2, MATERIAL.Water);
}, []);

expectCues("water and moonwater mixing stay silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Water);
  setCell(before, 2, 1, MATERIAL.Moonwater);
  setCell(after, 1, 1, MATERIAL.Moonwater);
  setCell(after, 2, 1, MATERIAL.Water);
}, []);

expectCues("stardust sinking through moonwater stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Stardust);
  setCell(before, 1, 2, MATERIAL.Moonwater);
  setCell(after, 1, 1, MATERIAL.Moonwater);
  setCell(after, 1, 2, MATERIAL.Stardust);
}, []);

// Review built this one tick in the real sim: moonwater steaming off beside fire lowers its
// count and moonwater cleaning oil raises stardust's, so a count cannot vouch for the sinking
// grain. Only the steam and the cleanse are events here.
expectCues("stardust sinking while moonwater steams off and cleans oil rings no impact", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Stardust);
  setCell(before, 1, 2, MATERIAL.Moonwater);
  setCell(after, 1, 1, MATERIAL.Moonwater);
  setCell(after, 1, 2, MATERIAL.Stardust);
  setCell(before, 3, 3, MATERIAL.Moonwater);
  setCell(after, 3, 3, MATERIAL.Steam);
  setCell(before, 3, 0, MATERIAL.Oil);
  setCell(after, 3, 0, MATERIAL.Stardust);
}, ["cleanse", "steam-flash"]);

expectCues("a cosmic soil grain settling where a plain one was stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Soil, { flags: CELL_FLAG.Cosmic });
  setCell(before, 1, 2, MATERIAL.Soil);
  setCell(after, 1, 2, MATERIAL.Soil, { flags: CELL_FLAG.Cosmic });
  setCell(after, 1, 3, MATERIAL.Soil);
}, []);

expectCues("a wet soil grain settling where a dry one was stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Soil, { flags: CELL_FLAG.Wet });
  setCell(before, 1, 2, MATERIAL.Soil);
  setCell(after, 1, 2, MATERIAL.Soil, { flags: CELL_FLAG.Wet });
  setCell(after, 1, 3, MATERIAL.Soil);
}, []);

expectCues("watered moss beads with dew", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Moss);
  setCell(after, 1, 1, MATERIAL.Moss, { flags: CELL_FLAG.Wet });
}, ["dew"]);

expectCues("seed roots with a sprout", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Seed, { flags: CELL_FLAG.Wet });
  setCell(after, 1, 1, MATERIAL.Seed, { flags: CELL_FLAG.Wet | CELL_FLAG.Rooted });
}, ["sprout"]);

expectCues("watered seed beads with dew", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Seed);
  setCell(after, 1, 1, MATERIAL.Seed, { flags: CELL_FLAG.Wet });
}, ["dew"]);

expectCues("already wet moss stays silent", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Moss, { flags: CELL_FLAG.Wet });
  setCell(after, 1, 1, MATERIAL.Moss, { flags: CELL_FLAG.Wet });
}, []);

expectCues("priority order and uniqueness", (before, after) => {
  setCell(before, 0, 0, MATERIAL.Water);
  setCell(after, 0, 0, MATERIAL.Steam);
  setCell(before, 1, 0, MATERIAL.Water);
  setCell(after, 1, 0, MATERIAL.Steam);
  setCell(before, 2, 0, MATERIAL.Oil);
  setCell(after, 2, 0, MATERIAL.Stardust);
}, ["cleanse", "steam-flash"]);

// ---------------------------------------------------------------------------------------
// Every check above hands the detector a transition somebody typed. That is how the erosion
// cue went stale without anything noticing: the sim stopped producing Stone -> Sand, and the
// test kept fabricating it, so a spring wore its lip down in silence and the gate stayed
// green. This one drives the REAL sim and feeds it consecutive frames, so the cue is bound
// to what the simulation actually emits.
{
  const { createFallbackEngine } = app.load("engine");
  const W = 16, H = 16;
  const engine = createFallbackEngine(W, H, 7);
  const bytes = engine.getCellBytes();
  const put = (x, y, kind) => {
    const o = (y * W + x) * CELL_STRIDE;
    bytes[o] = kind;
    bytes[o + 1] = (x + y) & 7;
  };
  // The shaft walls are TWO cells thick: liquids side-hop two, so a one-thick wall does not
  // contain them and the water simply leaves.
  for (let y = 3; y <= 10; y++) for (const x of [6, 7, 9, 10]) put(x, y, MATERIAL.Wall);
  put(8, 10, MATERIAL.Wall);
  put(8, 9, MATERIAL.Stone);
  put(8, 8, MATERIAL.Water);
  engine.loadCellBytes(bytes);

  let heard = false;
  let previous = engine.getCellBytes().slice();
  for (let tick = 0; tick < 30000 && !heard; tick++) {
    engine.tick();
    const current = engine.getCellBytes();
    if (detectReactionCues(previous, current, W, H).includes("erode")) heard = true;
    previous = current.slice();
  }
  assert(heard, "the sim eroded stone but the detector never emitted an erode cue");
  console.log("  sim-driven: erosion in the engine reaches the erode cue");
}

// ---------------------------------------------------------------------------------------
// The moves above, played rather than typed, from painted materials. Each silent check also
// counts the raw transition the cue used to hear, so it fails as never set up if the scene
// stops making the move. On the build before cues answered to the census, every silent check
// here failed on all three seeds: 14-26 cosmic-charge firings a run mixing liquids, 44-54
// impact-bursts pouring stardust into water, 35 sprouts as a stalk fell.
{
  const { createFallbackEngine } = app.load("engine");
  const W = 48, H = 40;
  const pond = (engine, liquid, top) => {
    for (let x = 8; x <= 40; x++) for (const y of [37, 38]) engine.paint(x, y, 1, MATERIAL.Wall);
    for (let y = 20; y <= 38; y++) for (const x of [8, 9, 39, 40]) engine.paint(x, y, 1, MATERIAL.Wall);
    for (let y = top; y <= 35; y += 2) for (let x = 11; x <= 37; x += 2) engine.paint(x, y, 1, liquid);
  };
  const play = (seed, setup, pour, transition) => {
    const engine = createFallbackEngine(W, H, seed);
    setup(engine);
    const heard = new Map();
    let moves = 0;
    for (let tick = 0; tick < 400; tick++) {
      if (pour && tick < 80 && tick % 4 === 0) engine.paint(24, pour.y, 2, pour.material, pour.density);
      const before = engine.getCellBytes().slice();
      engine.tick();
      const after = engine.getCellBytes();
      for (let o = 0; o < after.length; o += CELL_STRIDE) if (before[o] === transition[0] && after[o] === transition[1]) moves++;
      for (const cue of detectReactionCues(before, after)) heard.set(cue, (heard.get(cue) ?? 0) + 1);
    }
    return { heard, moves };
  };
  for (const seed of [1, 2, 3]) {
    const mixing = play(seed, (e) => pond(e, MATERIAL.Water, 30), { y: 10, material: MATERIAL.Moonwater, density: 60 },
      [MATERIAL.Water, MATERIAL.Moonwater]);
    assert(mixing.moves > 0, `seed ${seed}: moonwater poured into a pond never mixed, so its silence proves nothing`);
    assert(!mixing.heard.has("cosmic-charge"), `seed ${seed}: moonwater mixing into water rang cosmic-charge ${mixing.heard.get("cosmic-charge")} times`);

    const dusting = play(seed, (e) => pond(e, MATERIAL.Water, 28), { y: 4, material: MATERIAL.Stardust, density: 40 },
      [MATERIAL.Moonwater, MATERIAL.Stardust]);
    assert(dusting.moves > 0, `seed ${seed}: stardust never sank through the moonwater it made, so its silence proves nothing`);
    assert(!dusting.heard.has("impact-burst"), `seed ${seed}: stardust sinking through moonwater rang impact-burst ${dusting.heard.get("impact-burst")} times`);
    assert(dusting.heard.has("cosmic-charge"), `seed ${seed}: stardust charged a pond and cosmic-charge never rang`);

    const falling = play(seed, (e) => { for (let y = 5; y < 15; y++) e.paint(24, y, 1, MATERIAL.Stem); }, null,
      [MATERIAL.Empty, MATERIAL.Stem]);
    assert(falling.moves > 0, `seed ${seed}: the unheld stalk never fell, so its silence proves nothing`);
    assert(!falling.heard.has("sprout"), `seed ${seed}: a falling stalk rang sprout ${falling.heard.get("sprout")} times`);
  }
  console.log("  sim-driven: mixing liquids, sinking stardust and a falling stalk stay silent");
}

console.log("Audio reaction smoke checks passed");
