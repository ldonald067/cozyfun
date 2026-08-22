import { rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, ".tmp/audio-reactions-cjs");
const tsc = resolve(root, "app/node_modules/typescript/bin/tsc");

await rm(outDir, { recursive: true, force: true });

const compile = spawnSync(
  process.execPath,
  [
    tsc,
    "--target",
    "ES2022",
    "--module",
    "CommonJS",
    "--moduleResolution",
    "Node",
    "--lib",
    "ES2022,DOM",
    "--strict",
    "true",
    "--skipLibCheck",
    "true",
    "--esModuleInterop",
    "true",
    "--outDir",
    outDir,
    "app/src/audio/reactions.ts",
    "app/src/materials.ts",
    "app/src/engine.ts"
  ],
  { cwd: root, stdio: "inherit" }
);

if (compile.status !== 0) {
  throw new Error("Audio reaction TypeScript compile failed");
}

await writeFile(resolve(outDir, "package.json"), JSON.stringify({ type: "commonjs" }));

const require = createRequire(import.meta.url);
const { detectReactionCues } = require(resolve(outDir, "audio/reactions.js"));

const MATERIAL = {
  Empty: 0,
  Wall: 1,
  Sand: 2,
  Water: 3,
  Fire: 6,
  Wood: 7,
  Stone: 9,
  Moss: 10,
  Seed: 11,
  Oil: 13,
  Ice: 14,
  Steam: 15,
  Stardust: 16,
  Meteor: 17,
  Moonwater: 18,
  Flower: 19,
  Glass: 20,
  Ember: 21
};

const CELL_FLAG = {
  Wet: 1 << 0,
  Rooted: 1 << 1,
  Cosmic: 1 << 2
};

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

expectCues("meteor moonwater burst", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Moonwater);
  setCell(after, 1, 1, MATERIAL.Stardust);
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
  const { createFallbackEngine } = require(resolve(outDir, "engine.js"));
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

console.log("Audio reaction smoke checks passed");
