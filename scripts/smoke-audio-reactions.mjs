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
    "app/src/materials.ts"
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

expectCues("water erodes stone to sand", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Stone);
  setCell(after, 1, 1, MATERIAL.Sand);
}, ["erode"]);

expectCues("watered moss beads with dew", (before, after) => {
  setCell(before, 1, 1, MATERIAL.Moss);
  setCell(after, 1, 1, MATERIAL.Moss, { flags: CELL_FLAG.Wet });
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

console.log("Audio reaction smoke checks passed");
