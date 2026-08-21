// Renderer probe: call the SHIPPED renderer as a pure function and assert the state pairs
// the design depends on, over the whole range the sim can actually produce.
//
// This exists because capture-based measurement misled a review three separate times in one
// pass, always in the same direction — it reported comfortable numbers for things that were
// invisible, and invisible numbers for things that were fine:
//
//   - a 10x10px box sampled around one 4px cell is ~85% night sky, so it read a bud and a
//     spent seed head as 5-8 redmean apart when the cells themselves were 52-66;
//   - the showcase is a LIVE scene, so an exhibit can be gone before the shutter — the
//     "wet char" row was measured at 6 and then 30 redmean from dry char while the renderer
//     was actually producing 30 and then 148;
//   - and a material measured in the wrong SHAPE lies either way: oil scores 78 from the
//     background as a solid block and 182 as the one-cell film it forms in play.
//
// `colorForCell` is a pure function of cell state. Nothing about these questions needs a
// browser, a capture, or the sim — so this asks it directly, sweeps the state space rather
// than sampling it, and reports the WORST case rather than a favourable one.
//
// It also closes a gap four reviewers found independently: the renderer mirrors three
// simulation constants, and nothing checked that the copies still agree.
//
//   node scripts/renderer-probe.mjs          # assert, print the table
//   node scripts/renderer-probe.mjs --quiet  # assert only

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");
const failures = [];
const note = (line) => { if (!quiet) console.log(line); };

// ---------------------------------------------------------------- compile the real renderer
// Same invocation the interaction audit uses, for the same reason: reimplementing the colour
// rules here would only prove the harness agrees with itself.
const rendererDir = resolve(root, ".tmp/probe-renderer");
await rm(rendererDir, { recursive: true, force: true });
await mkdir(rendererDir, { recursive: true });
const tsc = resolve(root, "app/node_modules/typescript/bin/tsc");
const compiled = spawnSync(
  process.execPath,
  [tsc, "--target", "ES2022", "--module", "CommonJS", "--moduleResolution", "Node", "--lib",
   "ES2022,DOM", "--strict", "true", "--skipLibCheck", "true", "--esModuleInterop", "true",
   "--outDir", rendererDir, "app/src/rendering/materialColor.ts", "app/src/materials.ts"],
  { cwd: root, stdio: "inherit" },
);
if (compiled.status !== 0) throw new Error("renderer probe: renderer TypeScript compile failed");
await writeFile(resolve(rendererDir, "package.json"), JSON.stringify({ type: "commonjs" }));
const require_ = createRequire(import.meta.url);
const { colorForCell } = require_(resolve(rendererDir, "rendering/materialColor.js"));
const shape = require_(resolve(rendererDir, "rendering/shapeLanguage.js"));
const { MATERIAL, CELL_FLAG } = require_(resolve(rendererDir, "materials.js"));

// ------------------------------------------------------------------ the mirrored constants
// The renderer reads three numbers that BELONG to the simulation, so that a seed head is
// drawn under exactly the condition that makes it one and ash is full exactly when the sim
// calls an ember out. Mirroring them is the right call — the alternative is a renderer that
// guesses — but a mirror with nothing checking it is a promise, not a fact. Parity only
// compares Rust with engine.ts; neither knows this third copy exists.
const rust = await readFile(resolve(root, "sim/src/lib.rs"), "utf8");
const engine = await readFile(resolve(root, "app/src/engine.ts"), "utf8");
const MIRRORED = [
  { name: "PETAL_SHED_AGE", renderer: shape.PETAL_SHED_AGE },
  { name: "POLLEN_RESERVE", renderer: shape.POLLEN_RESERVE },
  { name: "COLD_CHAR_ENERGY", renderer: shape.COLD_CHAR_ENERGY },
];
note("Simulation constants mirrored into the renderer:");
for (const { name, renderer } of MIRRORED) {
  const inRust = rust.match(new RegExp(`const ${name}: u16 = (\\d+);`))?.[1];
  const inEngine = engine.match(new RegExp(`const ${name} = (\\d+);`))?.[1];
  if (inRust === undefined) { failures.push(`${name}: not found in sim/src/lib.rs — has it been renamed?`); continue; }
  if (inEngine === undefined) { failures.push(`${name}: not found in app/src/engine.ts — has it been renamed?`); continue; }
  if (renderer === undefined) { failures.push(`${name}: not exported from app/src/rendering/shapeLanguage.ts`); continue; }
  const agree = Number(inRust) === Number(inEngine) && Number(inRust) === renderer;
  note(`  ${name.padEnd(18)} rust ${String(inRust).padStart(5)}   engine ${String(inEngine).padStart(5)}   renderer ${String(renderer).padStart(5)}   ${agree ? "agree" : "DISAGREE"}`);
  if (!agree) {
    failures.push(
      `${name} disagrees: sim=${inRust}, engine.ts=${inEngine}, renderer=${renderer}. ` +
      `The renderer draws a state under a condition the sim no longer uses — a crown that ` +
      `looks like a seed head without being eligible to sow, or ash on an ember the sim ` +
      `still calls hot. Update app/src/rendering/shapeLanguage.ts to match.`,
    );
  }
}

// ------------------------------------------------------------------------ rendered distance
const NIGHT = [9, 14, 20]; // the tray's own background, #091018
const redmean = ([r1, g1, b1], [r2, g2, b2]) => {
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.round(Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db));
};

const W = 24, H = 10, STRIDE = 8;
function board(paint) {
  const cells = new Uint8Array(W * H * STRIDE);
  const put = (x, y, kind, energy = 0, age = 0, flags = 0, variant = 0) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * STRIDE;
    cells[o] = kind; cells[o + 1] = variant & 7;
    cells[o + 2] = age & 255; cells[o + 3] = (age >> 8) & 255;
    cells[o + 4] = energy & 255; cells[o + 5] = (energy >> 8) & 255;
    cells[o + 6] = flags & 255; cells[o + 7] = (flags >> 8) & 255;
  };
  paint(put);
  return cells;
}
const colourAt = (cells, x, y, time) => {
  const o = (y * W + x) * STRIDE;
  return colorForCell({
    kind: cells[o], variant: cells[o + 1],
    age: cells[o + 2] | (cells[o + 3] << 8),
    energy: cells[o + 4] | (cells[o + 5] << 8),
    flags: cells[o + 6] | (cells[o + 7] << 8),
    time, cells, width: W, height: H, x, y,
  });
};
// Sweep time across a full slow-pulse period. Several of these states animate, and the worst
// phase is the one that decides whether a cue reads — not the phase that happened to be 0.
const TIMES = [0, 700, 1400, 2100, 2800, 3500, 4200, 4900];

// A one-cell-deep ember bed on a wall floor: the shape a burnt log actually leaves, and the
// shape where every cell is air-facing, which is where the ash treatment lands.
const charBed = (energy, flags) => board((put) => {
  for (let x = 0; x < W; x++) put(x, 6, MATERIAL.Wall);
  for (let x = 3; x < 21; x++) put(x, 5, MATERIAL.Ember, energy, 200, flags, x);
});
const bedMean = (energy, flags, time) => {
  const cells = charBed(energy, flags);
  const cols = [];
  for (let x = 5; x < 19; x++) cols.push(colourAt(cells, x, 5, time));
  return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
    .map((v) => Math.round(v / cols.length));
};

// A plant's crown alone on its stalk: a bud and the seed head it becomes are both exactly
// this, one lone rooted Flower cell, which is why they were the same picture.
const crown = (variant, energy, age) => board((put) => {
  for (let x = 0; x < W; x++) put(x, 8, MATERIAL.Wall);
  put(12, 7, MATERIAL.Soil, 120, 40, CELL_FLAG.Wet);
  for (let i = 2; i <= 5; i++) put(12, 8 - i, MATERIAL.Stem, 20, 50, i === 2 ? CELL_FLAG.Rooted : 0, variant);
  put(12, 2, MATERIAL.Flower, energy, age, CELL_FLAG.Rooted, variant);
});
const crownColour = (variant, energy, age, time) => colourAt(crown(variant, energy, age), 12, 2, time);

const checks = [];
function assertFloor(label, floor, worst, detail) {
  checks.push({ label, floor, worst, detail });
  if (worst < floor) failures.push(`${label}: worst case ${worst}, floor ${floor}. ${detail}`);
}

// 1. A burnt-out hearth must be findable against the empty tray. Cold char measured 52 from
//    the night before it grew an ash skin — under the neighbourhood of the 45 palette floor,
//    while every other element in the roster sits 185-578 from the night.
{
  let worst = Infinity, at = null;
  for (let e = 0; e <= shape.COLD_CHAR_ENERGY; e++) for (const t of TIMES) {
    const d = redmean(bedMean(e, 0, t), NIGHT);
    if (d < worst) { worst = d; at = `energy ${e}, time ${t}`; }
  }
  assertFloor("cold char vs the empty tray", 120, worst,
    `worst at ${at}. A hearth that burns out must read as spent, not erased.`);
}

// 2. `ember.quenched` documents that wet char reads apart from dry char. It has to survive
//    the ash treatment, which is why ash is suppressed on a soaked bed.
{
  let worst = Infinity, at = null;
  for (let e = 0; e <= shape.COLD_CHAR_ENERGY; e++) for (const t of TIMES) {
    const d = redmean(bedMean(e, 0, t), bedMean(e, CELL_FLAG.Wet, t));
    if (d < worst) { worst = d; at = `energy ${e}, time ${t}`; }
  }
  assertFloor("wet char vs dry char", 45, worst,
    `worst at ${at}. Quenching a hearth is a look somebody chose; it has to be visible.`);
}

// 3. The two ends of a plant's life. A bud says wait for it; a seed head says this one is
//    over and will sow while you are away. They are both one lone rooted Flower cell, and
//    they rendered 52-66 apart — barely over the distance the contrast gate demands between
//    two different MATERIALS — until the seed head got a branch of its own.
{
  let worst = Infinity, at = null;
  for (let v = 0; v < 8; v++) for (const t of TIMES) {
    const bud = crownColour(v, 90, 20, t);
    for (const age of [shape.PETAL_SHED_AGE + 1, shape.PETAL_SHED_AGE + 400, 4000]) {
      for (const energy of [0, shape.POLLEN_RESERVE - 1]) {
        const d = redmean(bud, crownColour(v, energy, age, t));
        if (d < worst) { worst = d; at = `species ${v}, spent energy ${energy} age ${age}, time ${t}`; }
      }
    }
  }
  assertFloor("bud vs the seed head it becomes", 45, worst,
    `worst at ${at}. A returning player reads a garden off this pair.`);
}

// 4. A seed head carries NO species hue: every plant's ending is the same dry husk, which
//    is what makes it read as an ending rather than as a ninth flower colour. Tested as
//    "a husk never resembles its own flower" rather than "all husks are identical" — the
//    husk has speckle, and one cell per finished plant gleams on a ripe pip, so identical
//    they are not. What must never come back is the SPECIES in them.
{
  let worst = Infinity, at = null;
  for (const t of TIMES) for (let v = 0; v < 8; v++) {
    const d = redmean(crownColour(v, 0, 4000, t), shape.SPECIES[v].light);
    if (d < worst) { worst = d; at = `species ${v}, time ${t}`; }
  }
  assertFloor("seed head vs its own flower's hue", 60, worst,
    `worst at ${at}. A husk that resembles its own bloom is a ninth flower colour, not an ending.`);
}

if (!quiet) {
  console.log("\nRendered state pairs, worst case over a full energy/age/species/time sweep:");
  for (const c of checks) {
    const verdict = c.floor === null ? `(cap 24)` : `(floor ${c.floor})`;
    console.log(`  ${String(c.worst).padStart(4)}  ${verdict.padEnd(12)} ${c.label}`);
  }
  console.log("\nDistances are redmean through the real renderer, against the #091018 tray.");
}

if (failures.length) {
  console.error(`\nRenderer probe FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nRenderer probe passed: ${MIRRORED.length} mirrored constants agree across sim, engine and renderer, and ${checks.length} rendered state pairs clear their floors.`);
