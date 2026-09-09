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

const W = 26, H = 14, STRIDE = 8;
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
// BLOOM_SHAPES exists in THREE places -- sim/src/lib.rs, app/src/engine.ts, and the visual
// showcase -- and only the first two are covered by parity. The showcase copy carried a
// comment asking for it to be kept in step, which is not a check: it went stale the first
// time the shapes changed and quietly exhibited heads the sim could no longer grow. Parse
// all three and compare, the same way the mirrored constants above are compared.
{
  const norm = (pairs) => pairs.map(([x, y]) => `${x},${y}`).sort().join(" ");
  const table = (text, open, pairRe, itemRe) => {
    const declAt = text.indexOf("const BLOOM_SHAPES");
    if (declAt < 0) return null;
    const from = text.indexOf(open, declAt) + open.length;
    const block = text.slice(from, text.indexOf("\n];", from));
    return [...block.matchAll(itemRe)].map((m) =>
      norm([...m[1].matchAll(pairRe)].map((q) => [Number(q[1]), Number(q[2])])));
  };
  const rustSrc = await readFile(resolve(root, "sim/src/lib.rs"), "utf8");
  const engineSrc = await readFile(resolve(root, "app/src/engine.ts"), "utf8");
  const showSrc = await readFile(resolve(root, "scripts/material-showcase.mjs"), "utf8");
  const rustShapes = table(rustSrc, "= [", /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, /&\[([^\]]*(?:\][^\]]*)*?)\],/g);
  const engineShapes = table(engineSrc, "= [", /\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g, /^\s*\[((?:\s*\[-?\d+,\s*-?\d+\],?)+)\],\s*$/gm);
  const showShapes = table(showSrc, "= [", /\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g, /^\s*\[((?:\[-?\d+,-?\d+\],?)+)\],/gm);
  const counts = [rustShapes?.length, engineShapes?.length, showShapes?.length];
  if (counts.some((n) => n !== 8)) {
    failures.push(`BLOOM_SHAPES: parsed ${counts.join("/")} shapes from sim/engine/showcase, expected 8 each. ` +
      `The tables moved and this check can no longer read them.`);
  } else {
    for (let i = 0; i < 8; i++) {
      if (rustShapes[i] !== engineShapes[i]) {
        failures.push(`BLOOM_SHAPES[${i}] differs between sim/src/lib.rs and app/src/engine.ts. ` +
          `The two engines would grow different flowers, which parity catches only if a scenario blooms that species.`);
      }
      if (rustShapes[i] !== showShapes[i]) {
        failures.push(`BLOOM_SHAPES[${i}] differs between sim/src/lib.rs and scripts/material-showcase.mjs. ` +
          `The showcase would exhibit a head the sim cannot grow -- regenerate the showcase copy from the sim.`);
      }
    }
    checks.push({ label: "BLOOM_SHAPES agree across sim, engine and showcase", floor: 8, worst: 8, detail: "" });
  }
}


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

// 2b. Char against the materials a HEARTH is built from. Check 1 asks whether a spent bed is
//     visible against the empty tray; this asks whether it is visible against the firebox
//     around it, which is the commoner adjacency of the two — nobody burns a log in mid-air.
//     Nothing checked this, and the ash treatment that fixed check 1 (52 to 296 from the
//     night) quietly broke it: a spent bed landed 29 redmean from stone, under the palette
//     floor, and a hearth is char against stone.
{
  const hearth = {
    stone: [MATERIAL.Stone, 0, 60, 0],
    wall: [MATERIAL.Wall, 0, 40, 0],
    wood: [MATERIAL.Wood, 30, 48, 0],
  };
  const surround = (spec, time) => {
    const [kind, energy, age, flags] = spec;
    const cells = board((put) => {
      for (let x = 0; x < W; x++) put(x, 6, MATERIAL.Wall);
      for (let x = 3; x < 21; x++) put(x, 5, kind, energy, age, flags, x);
    });
    const cols = [];
    for (let x = 5; x < 19; x++) cols.push(colourAt(cells, x, 5, time));
    return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
      .map((v) => Math.round(v / cols.length));
  };
  let worst = Infinity, at = null;
  for (const [name, spec] of Object.entries(hearth)) {
    for (let e = 0; e <= shape.COLD_CHAR_ENERGY; e += 5) for (const t of TIMES) {
      const d = redmean(bedMean(e, 0, t), surround(spec, t));
      if (d < worst) { worst = d; at = `${name}, energy ${e}, time ${t}`; }
    }
  }
  assertFloor("cold char vs its hearth surround", 45, worst,
    `worst at ${at}. A spent bed has to read against the firebox, not only against the night.`);
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

// 5. The wellspring's three rune states must be mutually distinguishable AT THE SIZE A
//    PLAYER PAINTS THEM. Attunement borrows every material's colour, so the states are
//    separated by BRIGHTNESS rather than hue, and no palette gate can see them.
//
//    This check used to build a five-cell plus and sample two of its arms, and reported 66.
//    That number was not wrong — a whole-block sample at radius 1 measures 68 — it was
//    simply the only size ever measured. The app's brush runs 1 to 12 and DEFAULTS TO 4, a
//    49-cell disc, and the wellspring's entire identity is an EDGE treatment: a chiselled
//    rim with lit and shadowed faces. Edge cells are 80% of a five-cell stamp, 41% of the
//    default disc, 22% at radius 8 and 13% at radius 12, so the design gets HARDER to read
//    the more of it you paint. That is why this element kept coming back: every fix was
//    real, correctly measured, and measured at the one size where the problem does not
//    exist — including by this gate.
//
//    When this check was first widened it measured 68 at radius 1, then 10 at the default
//    brush, 8 at radius 8 and 4 at radius 12 -- clearing the 45 bar only at the smallest
//    stamp a player can make. The cause was that every state treatment was applied ONLY to
//    rune cells, and runes are about one cell in five once a block is bigger than a couple of
//    stamps. The state now also washes the block's BODY (see `wellspringColor`), so it
//    survives being averaged over 197 cells, and the three pairs measure **129 / 52 / 69 /
//    56** at radius 1 / 4 / 8 / 12 -- above the bar at every size a player can paint.
//
//    The floors below sit just under those, so this cannot slide back. 45 is the design bar
//    and all four now clear it; the floors are tighter than the bar deliberately, because a
//    drift from 52 to 46 would still pass a bar-level floor while being a real regression.
{
  // Its own board: a radius-12 disc is 25 cells across, which does not fit the shared one.
  const SW = 34, SH = 34;
  const springBoard = (paint) => {
    const cells = new Uint8Array(SW * SH * STRIDE);
    const put = (x, y, kind, energy = 0, age = 0, flags = 0, variant = 0) => {
      if (x < 0 || y < 0 || x >= SW || y >= SH) return;
      const o = (y * SW + x) * STRIDE;
      cells[o] = kind; cells[o + 1] = variant & 7;
      cells[o + 2] = age & 255; cells[o + 3] = (age >> 8) & 255;
      cells[o + 4] = energy & 255; cells[o + 5] = (energy >> 8) & 255;
      cells[o + 6] = flags & 255; cells[o + 7] = (flags >> 8) & 255;
    };
    paint(put);
    return cells;
  };
  const springColourAt = (cells, x, y, time) => {
    const o = (y * SW + x) * STRIDE;
    return colorForCell({
      kind: cells[o], variant: cells[o + 1],
      age: cells[o + 2] | (cells[o + 3] << 8),
      energy: cells[o + 4] | (cells[o + 5] << 8),
      flags: cells[o + 6] | (cells[o + 7] << 8),
      time, cells, width: SW, height: SH, x, y,
    });
  };
  // The sim's brush is a Euclidean disc: dx^2 + dy^2 <= r^2, which is the 5 / 13 / 49 / 197
  // cell counts the harness doc records for radius 1 / 2 / 4 / 8.
  const disc = (r) => {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) out.push([dx, dy]);
    }
    return out;
  };
  const CX = 17, CY = 17;
  // A caveat this check cannot model and nobody should read past: attunement is PER CELL and
  // never reaches a block's interior. Each wellspring cell drinks a source touching IT, and
  // an interior cell is surrounded by its own kind forever, so a painted block ends up an
  // attuned shell around a permanently dormant heart. Measured by driving the real sim with
  // a pour landing on the crown, and stable from 200 ticks to 3,000: 5/5 cells attune at
  // radius 1, 12/13 at radius 2, 28/49 at the default brush and 60/197 at radius 8. So the
  // uniformly-attuned block below is an UPPER BOUND on what a large spring can look like,
  // exactly reachable only at radius 1-2. It is still the right thing to gate here -- this
  // file asks what the renderer does with a given cell state, and "attuned cell vs dormant
  // cell" is that question -- but the block-level claim it supports gets weaker as the brush
  // grows, and no floor here can see that.
  // `chilled` is a PER-CELL ice-neighbour test in the sim, so a big block's interior is not
  // stilled and must not be drawn as though it were -- the renderer may read state, never
  // invent it. A whole-block mean therefore averages a frosted rim into a dormant middle and
  // reports a number describing neither: it fell 112 / 13 / 10 / 4 across the four radii
  // purely because the rim is a smaller share of a bigger disc. The honest question is
  // whether a frosted rim reads as frosted, so pairs involving `chilled` are sampled on the
  // cells the sim actually stills -- the ones touching ice -- with the other state sampled on
  // that same cell set. Pairs that do not involve chill stay whole-block, because attunement
  // really is on every cell.
  const blockMean = (kind, r, time, rimOnly = false) => {
    const offsets = disc(r);
    const inBlock = new Set(offsets.map(([dx, dy]) => `${CX + dx},${CY + dy}`));
    const cells = springBoard((put) => {
      const energy = kind === "attuned" ? MATERIAL.Water : 0;
      for (const [dx, dy] of offsets) {
        put(CX + dx, CY + dy, MATERIAL.Wellspring, energy, 40, 0, (CX + dx) & 7);
      }
      // Ice RINGED right around the block, which is the most favourable fixture the chilled
      // state can get: `hasNearbyKind` is per-cell, so only cells touching ice read chilled
      // and a large block is mostly interior no matter how much ice you pile on.
      if (kind === "chilled") {
        for (const [dx, dy] of offsets) {
          for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = CX + dx + ax, ny = CY + dy + ay;
            if (!inBlock.has(`${nx},${ny}`)) put(nx, ny, MATERIAL.Ice, 0, 200, 0, nx & 7);
          }
        }
      }
    });
    const sampled = rimOnly
      ? offsets.filter(([dx, dy]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([ax, ay]) => !inBlock.has(`${CX + dx + ax},${CY + dy + ay}`)))
      : offsets;
    const cols = sampled.map(([dx, dy]) => springColourAt(cells, CX + dx, CY + dy, time));
    return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
      .map((v) => Math.round(v / cols.length));
  };

  // Today's measured worst-pair per radius, less a point of slack for arithmetic drift.
  const RATCHET = { 1: 120, 4: 48, 8: 64, 12: 52 };
  for (const r of [1, 4, 8, 12]) {
    let worst = Infinity, at = null;
    for (const [a, b] of [["dormant", "attuned"], ["dormant", "chilled"], ["attuned", "chilled"]]) {
      const rimOnly = a === "chilled" || b === "chilled";
      for (const t of TIMES) {
        const d = redmean(blockMean(a, r, t, rimOnly), blockMean(b, r, t, rimOnly));
        if (d < worst) { worst = d; at = `${a} vs ${b}, time ${t}`; }
      }
    }
    const label = r === 4 ? `wellspring rune states, radius ${r} (the DEFAULT brush)`
                          : `wellspring rune states, radius ${r}`;
    assertFloor(label, RATCHET[r], worst,
      `worst at ${at}. Sleeping, remembering and listening have to be three different blocks, ` +
      `and at radius ${r} they are ${worst} apart against a design bar of 45. This floor is a ` +
      `ratchet holding today's value, not the bar.`);
  }
}

// 6. The eight bloom species must stay mutually distinguishable. A third of the garden's
//    variety once went to one hue — slots 0, 6 and 7 were three blues — and nothing stops
//    that happening again by accident. Measured on PETAL CELLS, not on a box around the head:
//    a box is mostly night sky and compresses every pair toward zero.
{
  const BLOOM_SHAPES = [
    [[0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[-2,0],[2,0],[-2,-1],[2,-1],[-1,-2],[1,-2],[-1,1],[1,1]],
    [[0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[-2,0],[2,0],[-2,1],[2,1]],
    [[0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[-2,0],[2,0],[0,-2],[-1,1],[1,1]],
    [[0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[-2,0],[2,0],[-2,-1],[2,-1],[0,-2],[-1,-2],[1,-2],[-1,1],[1,1],[-2,-2],[2,-2],[0,-3]],
    [[0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[-2,-1],[2,-1],[-2,-2],[0,-2],[2,-2]],
    [[0,-1],[-1,-2],[1,-2],[0,-3],[-1,-4],[1,-4],[0,-5]],
    [[0,-1],[0,-2],[-1,-1],[1,-2],[-2,0],[2,-1]],
    [[0,-1],[-1,0],[1,0],[-1,-1],[1,-1]],
  ];
  const headMean = (variant, time) => {
    const petals = [];
    const cells = board((put) => {
      for (let x = 0; x < W; x++) put(x, 12, MATERIAL.Wall, 0, 40, 0, x);
      put(13, 11, MATERIAL.Soil, 120, 40, CELL_FLAG.Wet);
      for (let i = 2; i <= 5; i++) put(13, 12 - i, MATERIAL.Stem, 20, 50, i === 2 ? CELL_FLAG.Rooted : 0, variant);
      put(13, 6, MATERIAL.Flower, 95, 200, CELL_FLAG.Rooted, variant);
      for (const [dx, dy] of BLOOM_SHAPES[variant]) {
        put(13 + dx, 6 + dy, MATERIAL.Flower, 90, 180, 0, variant);
        petals.push([13 + dx, 6 + dy]);
      }
    });
    const cols = petals.map(([x, y]) => colourAt(cells, x, y, time));
    return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
      .map((v) => Math.round(v / cols.length));
  };
  const NAMES = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
  let worst = Infinity, at = null;
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) for (const t of TIMES) {
    const d = redmean(headMean(a, t), headMean(b, t));
    if (d < worst) { worst = d; at = `${NAMES[a]} vs ${NAMES[b]}, time ${t}`; }
  }
  assertFloor("bloom species, worst of all 28 pairs", 60, worst,
    `worst at ${at}. Two species a player cannot tell apart is variety that is not there.`);
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
