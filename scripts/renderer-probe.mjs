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
import { rm, readFile } from "node:fs/promises";
import { compileApp } from "./compile-app.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");
const failures = [];
const note = (line) => { if (!quiet) console.log(line); };

// ---------------------------------------------------------------- compile the real renderer
// Same invocation the interaction audit uses, for the same reason: reimplementing the colour
// rules here would only prove the harness agrees with itself.
const app = compileApp("probe-renderer", ["rendering/materialColor.ts", "materials.ts"]);
const { colorForCell } = app.load("rendering/materialColor");
const shape = app.load("rendering/shapeLanguage");
const { MATERIAL, CELL_FLAG, WELLSPRING_TAUGHT } = app.load("materials");

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

// The fabric check's fixture mirrors `variant_for` so it assigns variants the way paint()
// does — and a fixture that invents its own variant pattern invents texture the game never
// draws, which is exactly what the first version did. That makes this a FOURTH copy of a
// simulation rule, and the section above exists because a mirror with nothing checking it is
// a promise rather than a fact. So check it: if the sim's hash coefficients ever change, the
// fabric fixture stops reflecting reality and would go on reporting comfortable numbers.
const VARIANT_COEFFS = [73856093, 19349663, 83492791];
const VARIANT_MODULUS = 8;
{
  const fn = rust.match(/fn variant_for[\s\S]*?\n    \}/)?.[0];
  if (!fn) {
    failures.push("variant_for: not found in sim/src/lib.rs — has it been renamed? " +
      "scripts/renderer-probe.mjs mirrors its coefficients for the soil/wood fabric fixture.");
  } else {
    const coeffs = [...fn.matchAll(/wrapping_mul\((\d+)\)/g)].map((m) => Number(m[1]));
    const modulus = Number(fn.match(/%\s*(\d+)\)?\s*as u8/)?.[1]);
    const agree = coeffs.length === VARIANT_COEFFS.length
      && coeffs.every((c, i) => c === VARIANT_COEFFS[i])
      && modulus === VARIANT_MODULUS;
    note(`  ${"variant_for".padEnd(18)} rust [${coeffs.join(", ")}] % ${modulus}   probe [${VARIANT_COEFFS.join(", ")}] % ${VARIANT_MODULUS}   ${agree ? "agree" : "DISAGREE"}`);
    if (!agree) {
      failures.push(
        `variant_for disagrees: sim has [${coeffs.join(", ")}] % ${modulus}, this probe ` +
        `mirrors [${VARIANT_COEFFS.join(", ")}] % ${VARIANT_MODULUS}. The soil/wood fabric ` +
        `fixture would be measuring a texture the game does not draw. Update VARIANT_COEFFS.`,
      );
    }
  }
}

// ------------------------------------------------------------------------ rendered distance
const NIGHT = [9, 14, 20]; // the tray's own background, #091018
const redmean = ([r1, g1, b1], [r2, g2, b2]) => {
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.round(Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db));
};

const W = 26, H = 14, STRIDE = 8;
// ONE board factory, because three separate checks have now needed their own size and each
// hand-rolled this same twenty lines first. "Size the fixture to the thing being measured"
// is the most expensive lesson in docs/HARNESS.md — a factory is what stops the next check
// paying for it in copy-paste as well.
function grid(w, h) {
  const board = (paint) => {
    const cells = new Uint8Array(w * h * STRIDE);
    const put = (x, y, kind, energy = 0, age = 0, flags = 0, variant = 0) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const o = (y * w + x) * STRIDE;
      cells[o] = kind; cells[o + 1] = variant & 7;
      cells[o + 2] = age & 255; cells[o + 3] = (age >> 8) & 255;
      cells[o + 4] = energy & 255; cells[o + 5] = (energy >> 8) & 255;
      cells[o + 6] = flags & 255; cells[o + 7] = (flags >> 8) & 255;
    };
    paint(put);
    return cells;
  };
  const colourAt = (cells, x, y, time) => {
    const o = (y * w + x) * STRIDE;
    return colorForCell({
      kind: cells[o], variant: cells[o + 1],
      age: cells[o + 2] | (cells[o + 3] << 8),
      energy: cells[o + 4] | (cells[o + 5] << 8),
      flags: cells[o + 6] | (cells[o + 7] << 8),
      time, cells, width: w, height: h, x, y,
    });
  };
  return { width: w, height: h, board, colourAt };
}
const { board, colourAt } = grid(W, H);

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
// The heads the sim grows, read ONCE out of the engine: the shape check just below holds
// them to the sim and the showcase, and the flower checks further down build their heads
// from them.
const engineSrc = await readFile(resolve(root, "app/src/engine.ts"), "utf8");
const ENGINE_BLOOM_SHAPES = (() => {
  const declAt = engineSrc.indexOf("const BLOOM_SHAPES");
  if (declAt < 0) return [];
  const block = engineSrc.slice(engineSrc.indexOf("= [", declAt) + 3, engineSrc.indexOf("\n];", declAt));
  return [...block.matchAll(/^\s*\[((?:\s*\[-?\d+,\s*-?\d+\],?)+)\],\s*$/gm)]
    .map((m) => [...m[1].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)].map((q) => [Number(q[1]), Number(q[2])]));
})();

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
  const showSrc = await readFile(resolve(root, "scripts/material-showcase.mjs"), "utf8");
  const rustShapes = table(rustSrc, "= [", /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, /&\[([^\]]*(?:\][^\]]*)*?)\],/g);
  const engineShapes = ENGINE_BLOOM_SHAPES.length ? ENGINE_BLOOM_SHAPES.map(norm) : null;
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

// The renderer's FLOWER_REACH is each species' head as a bounding box, so a petal is only
// claimed by a crown it could have grown from. It mirrors the same shapes, so check it.
{
  const box = (cells) => [Math.min(...cells.map((c) => c[0])), Math.max(...cells.map((c) => c[0])),
    Math.min(...cells.map((c) => c[1])), Math.max(...cells.map((c) => c[1]))];
  const reach = shape.FLOWER_REACH ?? [];
  const bad = ENGINE_BLOOM_SHAPES.map((cells, i) => JSON.stringify(box(cells)) === JSON.stringify(reach[i] ? [...reach[i]] : null) ? -1 : i)
    .filter((i) => i >= 0);
  if (ENGINE_BLOOM_SHAPES.length !== 8 || bad.length) {
    failures.push(`FLOWER_REACH in app/src/rendering/shapeLanguage.ts disagrees with BLOOM_SHAPES for species ${bad.join(", ")}. ` +
      `A petal would be claimed by the wrong crown, or by none.`);
  } else {
    checks.push({ label: "FLOWER_REACH matches the heads the sim grows", floor: 8, worst: 8, detail: "" });
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
  const { board: springBoard, colourAt: springColourAt } = grid(SW, SH);
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

  // A fourth state: a chilled spring that has LEARNED a new material and holds it until the
  // ice is gone (WELLSPRING_TAUGHT). It has to read apart from LISTENING, or a player cannot
  // tell the lesson took, and apart from DORMANT, or it reads as a spring that forgot
  // everything. It is deliberately close to ATTUNED — the same memory under a light rime — so
  // that pair is not gated. Every attunable material, because the tint is the material's.
  // Rim cells only, like every chill pair above.
  const SOURCES = [MATERIAL.Sand, MATERIAL.Water, MATERIAL.Soil, MATERIAL.Fire, MATERIAL.Lava, MATERIAL.Oil,
    MATERIAL.Seed, MATERIAL.Stardust, MATERIAL.Meteor, MATERIAL.Moonwater, MATERIAL.Rocket];
  const rimMean = (r, energy, flags, ice, time) => {
    const offsets = disc(r);
    const inBlock = new Set(offsets.map(([dx, dy]) => `${CX + dx},${CY + dy}`));
    const cells = springBoard((put) => {
      for (const [dx, dy] of offsets) put(CX + dx, CY + dy, MATERIAL.Wellspring, energy, 40, flags, (CX + dx) & 7);
      if (!ice) return;
      for (const [dx, dy] of offsets) {
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = CX + dx + ax, ny = CY + dy + ay;
          if (!inBlock.has(`${nx},${ny}`)) put(nx, ny, MATERIAL.Ice, 0, 200, 0, nx & 7);
        }
      }
    });
    const rim = offsets.filter(([dx, dy]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([ax, ay]) => !inBlock.has(`${CX + dx + ax},${CY + dy + ay}`)));
    const cols = rim.map(([dx, dy]) => springColourAt(cells, CX + dx, CY + dy, time));
    return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map((v) => v / cols.length);
  };
  // Measured worst per radius when the state was added (2026-10-01), less a point of slack.
  const LEARNED_RATCHET = { 1: 75, 4: 90, 8: 87, 12: 85 };
  for (const r of [1, 4, 8, 12]) {
    let worst = Infinity, at = null;
    for (const source of SOURCES) {
      for (const t of TIMES) {
        const learned = rimMean(r, source, WELLSPRING_TAUGHT, true, t);
        for (const [name, other] of [["listening", rimMean(r, source, 0, true, t)], ["dormant", rimMean(r, 0, 0, false, t)]]) {
          const d = redmean(learned, other);
          if (d < worst) { worst = d; at = `learned vs ${name}, material ${source}, time ${t}`; }
        }
      }
    }
    assertFloor(`wellspring learned state, radius ${r}`, LEARNED_RATCHET[r], Math.round(worst),
      `worst at ${at}. A spring that learned under the ice must not look like one still listening ` +
      `or one that forgot; design bar 45, floor is a ratchet on today's value.`);
  }
}

// 6. The eight bloom species must stay mutually distinguishable. A third of the garden's
//    variety once went to one hue — slots 0, 6 and 7 were three blues — and nothing stops
//    that happening again by accident. Measured on PETAL CELLS, not on a box around the head:
//    a box is mostly night sky and compresses every pair toward zero.
{
  // The heads the sim actually grows, read out of the engine (the first check above holds
  // the engine to the sim). This was a hand-kept copy of the old five-wide heads and went
  // stale when they widened to seven, so the gate measured flowers nobody can grow; once
  // petals are drawn by where they sit in a head, a stale shape is a wrong answer.
  const BLOOM_SHAPES = ENGINE_BLOOM_SHAPES;
  if (BLOOM_SHAPES.length !== 8) failures.push(`bloom species: read ${BLOOM_SHAPES.length} shapes from app/src/engine.ts, expected 8.`);
  // A planted head: its crown at `at`, on a stalk down to a soil cell on the wall floor.
  // `flags` go on every cell of the head, crown included, the way a state lands on a whole
  // plant; the petals carry `energy`, which a head drains through as it fades.
  const plantedHead = (variant, flags, [cx, cy], energy, crown = [95, 200], petalAge = 180) => board((put) => {
    for (let x = 0; x < W; x++) put(x, 12, MATERIAL.Wall, 0, 40, 0, x);
    put(cx, 11, MATERIAL.Soil, 120, 40, CELL_FLAG.Wet);
    for (let y = cy + 1; y <= 10; y++) put(cx, y, MATERIAL.Stem, 20, 50, y === 10 ? CELL_FLAG.Rooted : 0, variant);
    put(cx, cy, MATERIAL.Flower, crown[0], crown[1], CELL_FLAG.Rooted | flags, variant);
    for (const [dx, dy] of BLOOM_SHAPES[variant]) put(cx + dx, cy + dy, MATERIAL.Flower, energy, petalAge, flags, variant);
  });
  // Swept rather than pinned (review): a head at one place and one energy measured 28 for
  // dew where another placement measured 19, and a fading head's heart 95 where a fresh one
  // measured 159. Every flower check below takes its worst over these placements, and the
  // heart and weather checks over the energies a head drains through before it sheds.
  const POSITIONS = [[13, 6], [9, 6], [16, 7], [11, 7]];
  const ENERGIES = [90, 60, 40];
  // `pick` chooses which petals to average, by their offset from the crown.
  const headMean = (variant, time, flags = 0, pick = () => true, at = POSITIONS[0], energy = 90) => {
    const cells = plantedHead(variant, flags, at, energy);
    const petals = BLOOM_SHAPES[variant].filter(([dx, dy]) => pick(dx, dy)).map(([dx, dy]) => [at[0] + dx, at[1] + dy]);
    const cols = petals.map(([x, y]) => colourAt(cells, x, y, time));
    return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
      .map((v) => Math.round(v / cols.length));
  };
  const NAMES = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
  const speciesPairs = (label, floor, flags, why) => {
    let worst = Infinity, at = null;
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) for (const t of TIMES) for (const p of POSITIONS) {
      const d = redmean(headMean(a, t, flags, undefined, p), headMean(b, t, flags, undefined, p));
      if (d < worst) { worst = d; at = `${NAMES[a]} vs ${NAMES[b]}, time ${t}, crown at ${p}`; }
    }
    assertFloor(label, floor, worst, `worst at ${at}. ${why}`);
  };
  speciesPairs("bloom species, worst of all 28 pairs", 60, 0,
    "Two species a player cannot tell apart is variety that is not there.");

  // 6b. What each species is known by, and what weather does to a head (the owner's flower
  //     batch, 2026-10-18). A petal is now drawn by where it sits, so a head has a HEART —
  //     the ring round its crown — that has to read against the rest of its petals: a
  //     poppy's black blotch, a sunflower's seed disc, a daisy's wide gold eye, a
  //     cornflower's violet, a cosmos's deep magenta. Only those five carry a heart; a
  //     tulip, lavender and bluebell hold their petals above the crown.
  {
    const ring1 = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    let worst = Infinity, at = null;
    for (const v of [0, 1, 2, 3, 7]) for (const t of TIMES) for (const p of POSITIONS) for (const e of ENERGIES) {
      const d = redmean(headMean(v, t, 0, ring1, p, e), headMean(v, t, 0, (dx, dy) => !ring1(dx, dy), p, e));
      if (d < worst) { worst = d; at = `${NAMES[v]}, time ${t}, crown at ${p}, petal energy ${e}`; }
    }
    assertFloor("a bloom's heart vs the rest of its petals", 120, worst,
      `worst at ${at}. The heart is the mark each species is known by; flattened, the head is a blob.`);
  }
  //     Each state is drawn as what it is — dew on the rim, frost in from the edges, char
  //     with an ember line, moonlight silvering the plant's own colours — and each has to
  //     stay well clear of the same head without it, in every species. Measured before and
  //     after the batch, worst over species, placement and petal energy (whole-head petal
  //     mean): heart 5 -> 132, frozen 31 -> 62, scorched 157 -> 102, moonlit 73 -> 57.
  //     Scorched and moonlit fell on purpose: each used to turn the whole head one colour,
  //     which a mean rewards, and now each is drawn at the rim over a head that keeps its
  //     species. Floors are ratchets just under today's swept values.
  for (const [label, flag, floor] of [["frozen", CELL_FLAG.Frozen, 55],
    ["scorched", CELL_FLAG.Scorched, 95], ["moonlit", CELL_FLAG.Cosmic, 50]]) {
    let worst = Infinity, at = null;
    for (let v = 0; v < 8; v++) for (const t of TIMES) for (const p of POSITIONS) for (const e of ENERGIES) {
      const d = redmean(headMean(v, t, 0, undefined, p, e), headMean(v, t, flag, undefined, p, e));
      if (d < worst) { worst = d; at = `${NAMES[v]}, time ${t}, crown at ${p}, petal energy ${e}`; }
    }
    assertFloor(`a ${label} head vs the same head without it`, floor, worst,
      `worst at ${at}. A state a player cannot see on the flower is a state the flower does not have.`);
  }
  //     Wet is beads of dew, a few bright points over a slightly deepened head, and a
  //     whole-head mean cannot see points: swept, it measured 14 before the batch and 15
  //     after, while the beads plainly show in a filmstrip. So this asks what the cue is —
  //     does the head carry a bead you can see — as the brightest cell's change, at its
  //     worst over every species, placement and energy.
  {
    let worst = Infinity, at = null;
    for (let v = 0; v < 8; v++) for (const t of TIMES) for (const p of POSITIONS) for (const e of ENERGIES) {
      const dry = plantedHead(v, 0, p, e), wet = plantedHead(v, CELL_FLAG.Wet, p, e);
      let bead = 0;
      for (const [dx, dy] of BLOOM_SHAPES[v]) {
        bead = Math.max(bead, redmean(colourAt(dry, p[0] + dx, p[1] + dy, t), colourAt(wet, p[0] + dx, p[1] + dy, t)));
      }
      if (bead < worst) { worst = bead; at = `${NAMES[v]}, time ${t}, crown at ${p}, petal energy ${e}`; }
    }
    assertFloor("a wet head shows a bead of dew (brightest cell)", 90, worst,
      `worst at ${at}. Dew a player cannot find on the head is not dew.`);
  }
  //     Moonlight used to swap every species for one lilac palette, so all eight moonlit
  //     heads were the same flower (worst pair 0). It silvers the plant's own colours now,
  //     and a moonlit garden has to keep its variety: worst pair 40, cornflower and bluebell.
  speciesPairs("moonlit bloom species, worst of all 28 pairs", 35, CELL_FLAG.Cosmic,
    "Moonlight that makes every species the same flower erases the garden.");

  //     The crown is the cell that changes stage, so a living centre has to read against the
  //     seed head it becomes, with its last petals still on, as a head almost always keeps
  //     one. Review found the first pass's poppy 25 apart and its sunflower 12 while the
  //     seed-head check above, which compares against the petal colour, passed at 168.
  {
    let worst = Infinity, at = null;
    for (let v = 0; v < 8; v++) for (const t of TIMES) for (const p of POSITIONS) {
      const open = colourAt(plantedHead(v, 0, p, 45, [95, 200], 1300), p[0], p[1], t);
      const spent = colourAt(plantedHead(v, 0, p, 45, [0, 4000], 1300), p[0], p[1], t);
      const d = redmean(open, spent);
      if (d < worst) { worst = d; at = `${NAMES[v]}, time ${t}, crown at ${p}`; }
    }
    assertFloor("an open crown vs the seed head it becomes, petals still on", 45, worst,
      `worst at ${at}. The end of a plant's life has to read on the cell where it happens.`);
  }
}

// 8. A METEOR IN FLIGHT must not read as the fire it creates, as the sparks it sheds, or as
//    the stardust it bursts into. This is the pair set nothing was checking, and the gap had
//    a shape worth remembering: `interaction:audit` scores each outcome's contrast against
//    WHAT IT REPLACED, so a meteor measured 537 against the night sky and passed everything,
//    while sitting a median of 53 from FIRE across its whole state range.
//
//    **The first version of this check was itself the problem, and an adversarial review
//    found it three ways at once.** It pinned the rock at ONE position and ONE variant, and
//    swept spark energies starting at 120. All three of those were wrong:
//
//      - `hash % 11` gates a glint, and at the pinned cell it never fired. Sweeping position
//        and variant so it does dropped the score from 183 to 55.
//      - `leave_meteor_trail` spawns its sparks at ENERGY 90, below the lowest energy swept —
//        so the gate could not see the one spark state a meteor is guaranteed to be beside.
//        Adding it, and the decay below it, took the score to 34.
//      - and the treatment those two exposed was a real REGRESSION, not a fixture artefact:
//        driving the engine for real (220x140, seed 1107, paint(110,10,4,Meteor,55), four
//        ticks) the worst meteor/spark pair in an ordinary shower measured 29, against 79
//        for the warm rock that preceded it.
//
//    So sweep the shape AND the state on both sides of a pair. A floor measured through a
//    pinned fixture is a floor on the fixture, not on the design. This one is 70, set from
//    the swept worst case of 78 rather than from the 148 the pinned one reported.
{
  // `under` is what the rock is falling THROUGH. Empty is the obvious case; Smoke and Steam
  // are the ones a plain `=== Empty` test got wrong, because `update_meteor` moves with
  // `try_move(..., can_sink_through_gas = true)` and sinks through both — a rock descending
  // through its own impact smoke is airborne and used to render the hot crust. Meteor is the
  // interior of a painted mass, which is 82% of a default-brush stamp.
  const rock = (x, y, variant, age, under = MATERIAL.Empty, capped = false) => board((put) => {
    for (let i = 0; i < W; i++) put(i, H - 1, MATERIAL.Wall);   // a floor well clear of the rock
    put(x, y, MATERIAL.Meteor, 255, age, 0, variant);
    if (under !== MATERIAL.Empty) put(x, y + 1, under, 80, 20, 0, variant);
    // `capped` puts more rock ABOVE the sampled cell, which is the interior of a painted
    // mass and the ONLY geometry where a leading-face treatment keyed on "meteor above"
    // fires. Without it this gate passed with the regressing hot nose restored -- the
    // vacuity test caught that, which is the entire reason to run one.
    if (capped) put(x, y - 1, MATERIAL.Meteor, 255, age, 0, variant);
  });
  const fireOnFuel = (energy, age) => board((put) => {
    for (let i = 0; i < W; i++) put(i, 8, MATERIAL.Wall);
    for (let i = 10; i <= 14; i++) { put(i, 7, MATERIAL.Wood, 0, 40); put(i, 6, MATERIAL.Fire, energy, age, 0, i); }
  });
  const lone = (kind, x, y, energy, age, variant, flags = 0) => board((put) => {
    for (let i = 0; i < W; i++) put(i, H - 1, MATERIAL.Wall);
    put(x, y, kind, energy, age, flags, variant);
    if (kind === MATERIAL.Stardust) put(x + 2, y - 2, kind, energy, age, 0, variant);
  });

  // Sample the rock across POSITION and VARIANT, so the hash-gated branches actually fire.
  const CELLS = [[12, 4], [5, 7], [2, 11], [19, 3], [8, 9]];
  const SHAPES = [
    [MATERIAL.Empty, false, "air"],
    [MATERIAL.Smoke, false, "smoke"],
    [MATERIAL.Steam, false, "steam"],
    [MATERIAL.Meteor, true, "the interior of its own mass"],
    [MATERIAL.Empty, true, "the leading face of a mass"],
  ];
  const rocks = [];
  for (const [x, y] of CELLS) for (const v of [0, 1, 2, 3, 4, 5, 6, 7])
    for (const age of [0, 4, 8, 12]) for (const [u, cap, un] of SHAPES) for (const t of TIMES)
      rocks.push({ c: colourAt(rock(x, y, v, age, u, cap), x, y, t), tag: `rock (${x},${y}) v${v} a${age} at ${un} t${t}` });

  const rivals = [];
  for (const e of [180, 210, 230, 255]) for (const a of [0, 6, 20, 45]) for (const t of TIMES)
    rivals.push({ name: "fire", c: colourAt(fireOnFuel(e, a), 12, 6, t) });
  // Spark energies include the 90 a meteor TRAIL spawns at and the decay below it, not only
  // the bright burst range -- the trail is the spark a meteor is always next to.
  for (const [x, y] of CELLS) for (const e of [40, 60, 90, 120, 190, 255]) for (const a of [0, 4, 8, 15, 20])
    for (const v of [0, 1, 2, 3]) for (const t of TIMES)
      rivals.push({ name: `spark v${v} e${e}`, c: colourAt(lone(MATERIAL.Spark, x, y, e, a, v), x, y, t) });
  // A star shell's sparks are thrown over the meteor that lit them, so they are rivals too.
  for (const [x, y] of CELLS) for (const e of [40, 60, 120, 190, 255]) for (const a of [0, 4, 8, 15, 20])
    for (const v of [0, 1, 2, 3]) for (const t of TIMES)
      rivals.push({ name: `star spark v${v} e${e}`, c: colourAt(lone(MATERIAL.Spark, x, y, e, a, v, CELL_FLAG.Cosmic), x, y, t) });
  for (const [x, y] of CELLS) for (const e of [0, 60, 120]) for (const a of [0, 40, 200])
    for (const v of [0, 1, 2, 3]) for (const t of TIMES)
      rivals.push({ name: "stardust", c: colourAt(lone(MATERIAL.Stardust, x, y, e, a, v), x, y, t) });
  rivals.push({ name: "the night sky", c: NIGHT });

  let worst = Infinity, at = null;
  for (const r of rocks) for (const v of rivals) {
    const d = redmean(r.c, v.c);
    if (d < worst) { worst = d; at = `${r.tag} vs ${v.name}`; }
  }
  assertFloor("meteor in flight vs fire, its own sparks and stardust", 70, worst,
    `worst at ${at}. A meteor is the only dark-and-cold thing in a roster where every other ` +
    `hot or cosmic material is a light source, and that luminance gap is what carries it. ` +
    `It therefore cannot afford a bright glint of ANY hue: a spark can be gold, rose, mint, ` +
    `sky or white-hot at birth, so a gold twinkle scored 55 here and recolouring it cold ` +
    `scored 10 by walking into the sky spark. If this fails, something re-warmed, ` +
    `re-brightened, or re-decorated the rock.`);
}

// 9. SOIL AND WOOD MUST NOT WEAR THE SAME FABRIC. This gate is about texture rather than
//    colour, which is the point: the two softest substrates are the closest pair in the
//    group by colour (p10 29 redmean, under the 45 floor), so the only thing that can
//    separate them is the pattern — and for a long time the pattern was identical too.
//
//    The cause was upstream of the renderer. `variant_for` in the sim reads like a hash and
//    is a LINEAR FORM — (x*73856093 + y*19349663 + ...) % 8 — and a linear form mod 8 is
//    constant along a diagonal. `materialColor` picks `palette[variant % length]`, so every
//    material with a multi-entry palette got free diagonal stripes. Soil measured 3.06x
//    anisotropic along NW-SE and wood 2.69x along the SAME axis, out of two four-entry
//    palettes of overlapping browns. A wooden trough holding a soil bed read as one mass.
//
//    **This check has its own board, and the size is the whole point.** It first ran on the
//    probe's shared 26x14 fixture and scored 134 against a floor of 115 — which looked like
//    17% of headroom and was an artefact of the board. Soil's bedding repeats every eight
//    rows, so a 14-row fixture sees under two cycles and overstates the anisotropy badly.
//    Measured across sizes:
//
//        26x14 -> 134     56x32 -> 116     96x56  -> 113
//        40x24 -> 118     72x40 -> 114     220x140 -> 114
//
//    The real grid is 220x140 (`WORLD_WIDTH`/`WORLD_HEIGHT` in App.tsx), where the score is
//    **114 — below the floor the gate was asserting**. It converges by 72x40, which
//    reproduces the play-grid number exactly for a twelfth of the cost, so that is the board.
//    The floor is 105, set from the converged 114 rather than from the small-board 134.
//
//    The gate asks two things: that each material still HAS structure, so neither collapses
//    into the per-cell noise Stone is, and that their smoothest axes DIFFER. Note the
//    measure must consider DIAGONALS — an h-versus-v test is blind to diagonal banding,
//    because a diagonal steps equally both ways, and it reported both of these as isotropic
//    while a render showed the stripes plainly.
{
  const FW = 72, FH = 40;
  const { board: fabricBoard, colourAt: fabricColourAt } = grid(FW, FH);
  const AXES = { horizontal: [1, 0], vertical: [0, 1], "diagonal NW-SE": [1, 1], "diagonal NE-SW": [1, -1] };
  const fabric = (kind, energy, age) => {
    const cells = fabricBoard((put) => {
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        // Mirror the sim's own variant assignment: a fixture that invents its own variant
        // pattern invents texture the game never draws. The first version of this
        // measurement did exactly that and flipped Sand's reading when it was corrected.
        const variant = (Math.imul(x, VARIANT_COEFFS[0]) + Math.imul(y, VARIANT_COEFFS[1])
          + Math.imul(kind, VARIANT_COEFFS[2])) >>> 0;
        put(x, y, kind, energy, age, 0, variant % VARIANT_MODULUS);
      }
    });
    const sample = (x, y, time) => fabricColourAt(cells, x, y, time);
    const step = {};
    for (const [name, [dx, dy]] of Object.entries(AXES)) {
      let total = 0, n = 0;
      for (const t of TIMES) for (let y = 2; y < FH - 2; y++) for (let x = 2; x < FW - 2; x++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
        total += redmean(sample(x, y, t), sample(nx, ny, t)); n++;
      }
      step[name] = total / n;
    }
    const ranked = Object.entries(step).sort((a, b) => a[1] - b[1]);
    return { along: ranked[0][0], ratio: ranked[ranked.length - 1][1] / ranked[0][1] };
  };
  const soil = fabric(MATERIAL.Soil, 0, 40);
  const wood = fabric(MATERIAL.Wood, 0, 40);
  const differ = soil.along !== wood.along;
  // Scored as the weaker of the two structures, and zero outright if they share an axis --
  // two materials can each be beautifully textured and still be one material on screen.
  const worst = differ ? Math.round(Math.min(soil.ratio, wood.ratio) * 100) : 0;
  assertFloor("soil and wood wear different fabrics", 105, worst,
    `soil runs along ${soil.along} (${soil.ratio.toFixed(2)}x), wood along ${wood.along} ` +
    `(${wood.ratio.toFixed(2)}x)${differ ? "" : " -- SAME AXIS, scored 0"}. Score is the weaker ` +
    `of the two anisotropies x100, or 0 when they share an axis. Colour cannot save this pair: ` +
    `they sit at p10 29 redmean, under the palette floor. Measured on a ${FW}x${FH} board, ` +
    `which is where this number converges to what the 220x140 play grid reports.`);
}

// 10. SANDSTONE. Stone laid down as sediment, which the slow world makes when a flooded sand
//     bed compacts. Three claims, gated separately because they fail in different ways.
//
//     COLOUR is measured on cells that TOUCH, in the geometry each neighbour has in play, and
//     scored as the p10 of those pairs. This check used to compare the MEAN colour of two
//     separate fields and called the result p10: it reported 86 while the pairs a player can
//     actually see were never measured at all. Adversarial review caught it. A mean hides
//     exactly the thing a bedded rock is made of — its darkest and palest strata — and a pair
//     of cells that never touch says nothing about a boundary.
//
//     Against the SAND it forms from, colour is all that separates it: sand is stratified
//     too (1.59x) and the lake's loose floor sits directly on the rock. That floor always
//     touches the water, so it is WET — the first palette was tuned against dry sand and put
//     the real boundary at p10 33. Measured through the engine on the audit's lake over 100
//     seeds, that boundary is now p10 76; this fixture reproduces it at 73.
//
//     Against LAVA ROCK and WALL, colour alone does not carry it, and that is measured rather
//     than assumed: touching pairs sit at p10 44 and 47. Their means are far apart, but lava
//     rock's pale block lines and wall's lit courses both land on sandstone's buff. What
//     separates those pairs is TEXTURE — strata against isotropic blocks — which the check
//     after this one gates. So this floor only holds the line where it stands today.
//
//     TEXTURE. The rock's whole identity is being LAYERED, which is the one thing that tells
//     it from the granular stone lava cools into (1.08x, isotropic). A first version jittered
//     each cell's stratum independently and came out LESS stratified than the loose sand it
//     formed from — v/h 1.26 against sand's 1.59. The seam now drifts by 8-column runs.
{
  const { board: ssBoard, colourAt: ssColourAt, width: SW, height: SH } = grid(72, 40);
  const variantAt = (x, y, kind) => ((Math.imul(x, VARIANT_COEFFS[0]) + Math.imul(y, VARIANT_COEFFS[1])
    + Math.imul(kind, VARIANT_COEFFS[2])) >>> 0) % VARIANT_MODULUS;
  // `put` with the sim's own variant, so the fixture draws the palette pattern the game does.
  const scene = (paint) => ssBoard((put) => paint((x, y, kind, energy, age, flags) =>
    put(x, y, kind, energy, age, flags, variantAt(x, y, kind))));
  const ROCK = [MATERIAL.Stone, 0, 90, CELL_FLAG.Bedded];
  const isRock = (cells, i) => cells[i * STRIDE] === MATERIAL.Stone && cells[i * STRIDE + 6] & CELL_FLAG.Bedded;
  // p10 over every sandstone/neighbour pair that shares an edge, across the whole time sweep.
  const touchingP10 = (cells, isOther) => {
    const d = [];
    for (const t of TIMES) for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      if (!isRock(cells, y * SW + x)) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (!isOther(cells, (y + dy) * SW + x + dx)) continue;
        d.push(redmean(ssColourAt(cells, x, y, t), ssColourAt(cells, x + dx, y + dy, t)));
      }
    }
    d.sort((a, b) => a - b);
    return d[Math.floor(d.length * 0.1)];
  };
  const kindIs = (kind) => (cells, i) => cells[i * STRIDE] === kind && !isRock(cells, i);
  // Beside it: the neighbour fills the left third and a band across the top, so the rock
  // meets it on both a vertical and a horizontal face.
  const beside = (kind, energy, age) => scene((put) => {
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (x < 24 || y < 12) put(x, y, kind, energy, age, 0);
      else put(x, y, ...ROCK);
    }
  });
  const worstOf = (pairs) => pairs
    .map(([name, cells, isOther]) => [name, touchingP10(cells, isOther)])
    .reduce((a, b) => (b[1] < a[1] ? b : a));

  const [sandAt, sandWorst] = worstOf([
    // The lake: water over a wet sand floor one to three cells deep (ragged by column run),
    // sandstone under it. On the real lake the rock at that boundary is dry, so it is here.
    ["the wet sand floor of a lake", scene((put) => {
      for (let x = 0; x < SW; x++) {
        const floor = 12 + (((x >> 3) * 5) % 3);
        for (let y = 0; y < SH; y++) {
          if (y < 10) put(x, y, MATERIAL.Water, 0, 0, 0);
          else if (y <= floor) put(x, y, MATERIAL.Sand, 0, 40, CELL_FLAG.Wet);
          else put(x, y, ...ROCK);
        }
      }
    }), kindIs(MATERIAL.Sand)],
    // At 1-in-8 odds a day leaves about one grain in eight loose inside the rock.
    ["dry grains left loose inside the bed", scene((put) => {
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        if (((Math.imul(x, 2654435761) ^ Math.imul(y, 40503)) >>> 0) % 8 === 0) put(x, y, MATERIAL.Sand, 0, 40, 0);
        else put(x, y, ...ROCK);
      }
    }), kindIs(MATERIAL.Sand)],
    ["a dry dune beside it", beside(MATERIAL.Sand, 0, 40), kindIs(MATERIAL.Sand)],
  ]);
  assertFloor("sandstone vs the sand it forms from (touching p10)", 65, sandWorst,
    `worst against ${sandAt}. Sand is stratified too, so COLOUR is all that separates the two, ` +
    `and the lake's loose floor sits directly on the rock. Measure the floor WET: it always ` +
    `touches the water, and a dry-sand reading once hid a real p10 of 33.`);

  const [groundAt, groundWorst] = worstOf([
    ["soil", beside(MATERIAL.Soil, 0, 40), kindIs(MATERIAL.Soil)],
    ["the stone lava cools into", beside(MATERIAL.Stone, 0, 90), kindIs(MATERIAL.Stone)],
    ["the wall a basin is built from", beside(MATERIAL.Wall, 0, 20000), kindIs(MATERIAL.Wall)],
  ]);
  assertFloor("sandstone vs the ground around it (touching p10)", 40, groundWorst,
    `worst against ${groundAt}. Lava rock and wall share sandstone's pale tones at their lit ` +
    `edges, so strata — gated next — carry those two pairs. This floor holds today's p10; ` +
    `do not lower it to make a palette change pass.`);

  const sandstone = scene((put) => {
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) put(x, y, ...ROCK);
  });
  const AX = { horizontal: [1, 0], vertical: [0, 1], "diagonal NW-SE": [1, 1], "diagonal NE-SW": [1, -1] };
  const step = {};
  for (const [name, [dx, dy]] of Object.entries(AX)) {
    let total = 0, n = 0;
    for (const t of TIMES) for (let y = 2; y < 38; y++) for (let x = 2; x < 70; x++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= 72 || ny >= 40) continue;
      total += redmean(ssColourAt(sandstone, x, y, t), ssColourAt(sandstone, nx, ny, t)); n++;
    }
    step[name] = total / n;
  }
  const ranked = Object.entries(step).sort((a, b) => a[1] - b[1]);
  const along = ranked[0][0], ratio = ranked[ranked.length - 1][1] / ranked[0][1];
  assertFloor("sandstone is laid in beds", 300, along === "horizontal" ? Math.round(ratio * 100) : 0,
    `sandstone runs along ${along} at ${ratio.toFixed(2)}x. Its identity is being LAYERED — the ` +
    `stone lava cools into is isotropic at about 1.08x — so strata must run horizontally and ` +
    `strongly. Scored x100, and 0 if they stop being horizontal. If this fails, check the seam ` +
    `still drifts by column runs: per-cell jitter made the rock less layered than sand.`);
}

// A SHEENED slick (stardust's cosmic flag on oil) must read apart from plain oil in every
// contact a slick can make, and its flame apart from plain fire. The first measurement of the
// sheen, 155 at the least, was taken on an open pond; review found 134 against moss, and this
// sweep found 30 under the heat, life and frost tints, which were applied after the sheen and
// washed it out. The sheen goes last now. Floors set from the swept worst cases: 95 and 188.
{
  const NEAR = [MATERIAL.Empty, MATERIAL.Oil, MATERIAL.Water, MATERIAL.Moss, MATERIAL.Seed, MATERIAL.Wall, MATERIAL.Fire];
  const SLOW = [...TIMES, 6300, 9100];
  let worst = Infinity, at = null;
  for (const above of NEAR) for (const below of NEAR) for (const side of NEAR) for (const v of [0, 3, 7])
    for (const e of [36, 120]) for (const frozen of [0, CELL_FLAG.Frozen]) {
      const slick = (sheen) => board((put) => {
        for (let x = 8; x <= 16; x++) put(x, 6, MATERIAL.Oil, e, 20, sheen | frozen, v);
        put(12, 5, above, 60, 20, 0, v);
        put(12, 7, below, 60, 20, 0, v);
        put(13, 6, side, 60, 20, side === MATERIAL.Oil ? sheen | frozen : 0, v);
      });
      const plain = slick(0), sheened = slick(CELL_FLAG.Cosmic);
      for (const t of SLOW) {
        const d = redmean(colourAt(plain, 12, 6, t), colourAt(sheened, 12, 6, t));
        if (d < worst) { worst = d; at = `above ${above}, below ${below}, side ${side}, variant ${v}, energy ${e}, frozen ${!!frozen}, time ${t}`; }
      }
    }
  assertFloor("a sheened slick vs plain oil, in every contact", 85, Math.round(worst),
    `worst at ${at}. Stardust's sheen is a discovery a player bumps into; a sheen the slick's ` +
    `own contact tints wash out is not there to find. Keep it the last treatment oil gets.`);

  // A burning sheen flickers through the four firework hues, and one of them is gold, close to
  // fire's own colour, so a cell is near plain fire a quarter of the time by design. What must
  // hold is that every cell shows a colour somewhere in its flicker: the worst cell's best phase.
  let worstFlame = Infinity, flameAt = null;
  for (const e of [60, 150, 240]) for (const age of [0, 20, 60]) for (const v of [0, 1, 2, 3, 4, 5, 6, 7])
    for (const [x, y] of [[12, 6], [5, 9], [19, 3]]) {
      const flame = (sheen) => board((put) => {
        for (let i = 0; i < W; i++) put(i, 12, MATERIAL.Wall);
        put(x, y, MATERIAL.Fire, e, age, sheen, v);
        put(x, y + 1, MATERIAL.Oil, 36, 0, sheen);
      });
      const plain = flame(0), cosmic = flame(CELL_FLAG.Cosmic);
      let best = 0;
      for (let t = 0; t < 4000; t += 100) best = Math.max(best, redmean(colourAt(plain, x, y, t), colourAt(cosmic, x, y, t)));
      if (best < worstFlame) { worstFlame = best; flameAt = `energy ${e}, age ${age}, variant ${v}, at (${x},${y})`; }
    }
  assertFloor("a burning sheen's flame vs plain fire, best phase of the worst cell", 170, Math.round(worstFlame),
    `worst at ${flameAt}. A sheened slick burns "like a firework"; a flame cell that never leaves ` +
    `fire's own colour is a promise the picture does not keep. Tint it after the white-hot fleck.`);
}

// 11. A STAR SPARK MUST READ APART FROM A PLAIN ONE. A rocket a meteor lit throws a star shell
//     (FLAG_COSMIC on its sparks), which the owner asked to have a colour of its own: in the
//     firework hues a meteor-lit volley looked like a flame-lit one until it landed. Judged past
//     the birth flash (age 3 and over), where both are white-hot by design, and at the WORST
//     moment of each pair, swept every 10 ms. Both twinkle, and a gate at the best moment
//     passed a silver palette at 190 that came within 17 of a blinking plain spark (review).
{
  let worst = Infinity, at = null;
  for (const e of [40, 90, 155, 235]) for (const a of [3, 6, 10, 15]) for (const sv of [0, 1, 2, 3]) {
    const star = board((put) => put(12, 4, MATERIAL.Spark, e, a, CELL_FLAG.Cosmic, sv));
    for (const pe of [40, 155, 235]) for (const pa of [3, 10]) for (const pv of [0, 1, 2, 3]) {
      const plain = board((put) => put(12, 4, MATERIAL.Spark, pe, pa, 0, pv));
      for (let t = 0; t < 1000; t += 10) {
        const d = redmean(colourAt(star, 12, 4, t), colourAt(plain, 12, 4, t));
        if (d < worst) { worst = d; at = `star e${e} a${a} v${sv} vs plain e${pe} a${pa} v${pv}, t${t}`; }
      }
    }
  }
  assertFloor("a star shell's spark vs every plain spark, past the birth flash, worst moment", 70, Math.round(worst),
    `worst at ${at}. A meteor-lit shell must not read as a flame-lit one in the air at any moment: ` +
    `keep the star palette off white and off gold, rose, mint and sky, which a plain spark blinks between.`);
}

// 12. A THIN OIL SLICK MUST SHOW ON THE SOIL IT LIES ON. Poured oil rests as a sheet one cell
//     deep (2026-10-21), and in real pours on soil that sheet sat within the 45 floor of the
//     soil under it on 491 of 696 cells: the slick that smothers a garden was the one slick you
//     could not find. Each slick cell is judged against the NEAREST colour anywhere in the bed,
//     not only the cell under it, because soil's beds vary and matching any of them is enough to
//     vanish. Swept over ground energy and flags, oil variant, energy, frost and time; on stone
//     the same film would land on the grey (159 of 696 cells under 45, against 51), which is why
//     it is not applied there. Three tiers, because the ground's own state cues fight the film:
//     ordinary soil, dry to wet, went 8 -> 87. Frozen and cosmic soil are tinted toward ice and
//     starlight too, and a frozen slick on frozen wet soil is the worst case, 29 (the tier was 6):
//     oil's frost tint comes after the film, and both cells are drawn as frost, which is true.
//     Review found that tier missing from the first version of this gate. Char's ash: 22 -> 65.
{
  const ORDINARY = [0, CELL_FLAG.Wet];
  const EVERY = [...ORDINARY, CELL_FLAG.Frozen, CELL_FLAG.Wet | CELL_FLAG.Frozen, CELL_FLAG.Cosmic, CELL_FLAG.Wet | CELL_FLAG.Cosmic];
  const GROUNDS = [
    ["ordinary soil, dry to wet", MATERIAL.Soil, [0, 40, 120], ORDINARY, 75],
    ["soil in every state the sim gives it (frozen, cosmic)", MATERIAL.Soil, [0, 40, 120], EVERY, 25],
    ["char's ash, in every state", MATERIAL.Ember, [0, 12, shape.COLD_CHAR_ENERGY], EVERY, 55],
  ];
  for (const [name, ground, energies, flagSets, floor] of GROUNDS) {
    let worst = Infinity, at = null;
    for (const ge of energies) for (const gf of flagSets) for (let ov = 0; ov < 8; ov++) for (const oe of [0, 36]) for (const frozen of [0, CELL_FLAG.Frozen]) {
      const cells = board((put) => {
        for (let y = 7; y <= 12; y++) for (let x = 0; x < W; x++) put(x, y, ground, ge, 200, gf, x * 3 + y);
        for (let x = 3; x <= 22; x++) put(x, 6, MATERIAL.Oil, oe, 20, frozen, ov + x);
      });
      for (const t of TIMES) {
        const bed = [];
        for (let y = 7; y <= 11; y++) for (let x = 2; x <= 23; x++) bed.push(colourAt(cells, x, y, t));
        for (let x = 5; x <= 20; x++) {
          const slick = colourAt(cells, x, 6, t);
          const d = Math.min(...bed.map((b) => redmean(slick, b)));
          if (d < worst) { worst = d; at = `ground energy ${ge} flags ${gf}, oil variant ${ov}, energy ${oe}, frozen ${!!frozen}, x ${x}, time ${t}`; }
        }
      }
    }
    assertFloor(`a one-deep oil slick lying on ${name}`, floor, worst,
      `worst at ${at}. Oil's smothering is an absence, seeds that never come up, and when the slick ` +
      `that causes it cannot be seen the garden just looks broken. Keep the film on a sheet lying on it.`);
  }
}

// 13. A HEAD'S OUTLINE. Open air touching a petal is drawn in a deep shade of the plant's own
//     colour (the owner's pick from the design canvas, 2026-10-22), so a head reads as a drawn
//     shape with an edge: a petal is one cell, so the tones a reference sheet ramps through
//     inside each petal cannot exist here, and the edge is the part of that depth that can.
//     It is drawn on EMPTY cells, which no flower check above looks at, so it gets its own
//     three questions, each swept over species, placement, petal energy, state and time:
//       - does the ring show against the night it is drawn on? Charred is left out on
//         purpose: a burnt head has no lit edge, and its ring goes into the dark;
//       - does it stay an EDGE, darker than the head it outlines, rather than reading as one
//         more petal that changes the head's shape? Against the head's mean, not the petal it
//         touches: a poppy's blotch and a sunflower's disc reach the rim, and a ring is the
//         plant's colour deepened, not darker than its darkest mark (measured, -25 per petal).
//       - is it absent round a bud and a seed head? Each is one cell on a stalk, and they read
//         apart from each other only at that cell (check 3), so a ring must not dress either.
{
  const POSITIONS = [[13, 6], [9, 6], [16, 7], [11, 7]];
  const head = (variant, flags, [cx, cy], energy, petals, crown) => board((put) => {
    for (let x = 0; x < W; x++) put(x, 12, MATERIAL.Wall, 0, 40, 0, x);
    put(cx, 11, MATERIAL.Soil, 120, 40, CELL_FLAG.Wet);
    for (let y = cy + 1; y <= 10; y++) put(cx, y, MATERIAL.Stem, 20, 50, y === 10 ? CELL_FLAG.Rooted : 0, variant);
    put(cx, cy, MATERIAL.Flower, crown[0], crown[1], CELL_FLAG.Rooted | flags, variant);
    if (petals) for (const [dx, dy] of ENGINE_BLOOM_SHAPES[variant]) put(cx + dx, cy + dy, MATERIAL.Flower, energy, 180, flags, variant);
  });
  const kindAt = (cells, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : cells[(y * W + x) * STRIDE]);
  const rooted = (cells, x, y) => (cells[(y * W + x) * STRIDE + 6] & CELL_FLAG.Rooted) !== 0;
  const CARDINAL = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // Each empty cell beside a flower cell, with the flower cell it touches.
  const besideFlowers = (cells, petalsOnly) => {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (kindAt(cells, x, y) !== MATERIAL.Empty) continue;
      const by = CARDINAL.map(([dx, dy]) => [x + dx, y + dy])
        .find(([nx, ny]) => kindAt(cells, nx, ny) === MATERIAL.Flower && !(petalsOnly && rooted(cells, nx, ny)));
      if (by) out.push([x, y, by]);
    }
    return out;
  };
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Every mix of the four flags a head can carry at once, except charred without frost (its
  // ring goes dark on purpose). Review found single flags were not enough: frost on a charred
  // petal drew pale while its ring stayed black, 20 from the night.
  const STATES = [];
  for (let m = 0; m < 16; m++) {
    const flags = [CELL_FLAG.Wet, CELL_FLAG.Frozen, CELL_FLAG.Cosmic, CELL_FLAG.Scorched].filter((_, i) => m & (1 << i));
    if (m & 8 && !(m & 2)) continue;
    STATES.push([["wet", "frozen", "moonlit", "charred"].filter((_, i) => m & (1 << i)).join("+") || "plain", flags.reduce((a, f) => a | f, 0)]);
  }
  let night = Infinity, nightAt = null, edge = Infinity, edgeAt = null;
  for (let v = 0; v < 8; v++) for (const [state, flags] of STATES) for (const p of POSITIONS) for (const e of [90, 60, 40]) {
    const cells = head(v, flags, p, e, true, [95, 200]);
    for (const t of TIMES) {
      const petals = ENGINE_BLOOM_SHAPES[v].map(([dx, dy]) => luma(colourAt(cells, p[0] + dx, p[1] + dy, t)));
      const headLuma = petals.reduce((a, b) => a + b, 0) / petals.length;
      for (const [x, y] of besideFlowers(cells, true)) {
        const ring = colourAt(cells, x, y, t);
        const d = redmean(ring, NIGHT);
        if (d < night) { night = d; nightAt = `species ${v}, ${state}, crown at ${p}, petal energy ${e}, cell (${x},${y})`; }
        const step = Math.round(headLuma - luma(ring));
        if (step < edge) { edge = step; edgeAt = `species ${v}, ${state}, crown at ${p}, petal energy ${e}, ring (${x},${y})`; }
      }
    }
  }
  assertFloor("a head's outline against the night it is drawn on", 110, night,
    `worst at ${nightAt}. An outline the night swallows draws no edge at all.`);
  assertFloor("a head's outline is darker than the head it edges (luminance)", 40, edge,
    `worst at ${edgeAt}. A ring as bright as its petal reads as one more petal, and the head changes shape.`);
  let bare = 0, bareAt = null;
  for (let v = 0; v < 8; v++) for (const p of POSITIONS) for (const [stage, crown] of [["bud", [90, 20]], ["seed head", [0, 1400]]]) {
    const cells = head(v, 0, p, 0, false, crown);
    for (const t of TIMES) for (const [x, y] of besideFlowers(cells, false)) {
      const d = redmean(colourAt(cells, x, y, t), NIGHT);
      if (d > bare) { bare = d; bareAt = `species ${v}, ${stage}, crown at ${p}, cell (${x},${y})`; }
    }
  }
  if (bare > 0) {
    failures.push(`the air round a bud or a seed head is drawn ${bare} off the night, at ${bareAt}. ` +
      `Only petals are outlined: a ring would dress the two ends of a plant's life alike.`);
  } else {
    checks.push({ label: "no outline round a bud or a seed head (cells off the night: none)", floor: 0, worst: 0, detail: "" });
  }
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
console.log(`\nRenderer probe passed: ${MIRRORED.length + 1} simulation rules are mirrored faithfully (${MIRRORED.length} constants plus variant_for), and ${checks.length} rendered state pairs clear their floors.`);
