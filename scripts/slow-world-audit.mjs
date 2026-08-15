// Slow-world audit: does an absence actually SHOW?
//
// The slow world's whole promise is that a terrarium looks different when you come
// back to it. That promise is trivially easy to ship broken — every cargo test and
// parity scenario can pass while the effect is a handful of cells nobody would ever
// notice, in colours nobody could tell apart. This gate measures the thing the
// player experiences instead: it plays a scene in, walks away for five different
// lengths of time, and compares the pixels.
//
//   node scripts/slow-world-audit.mjs
//
// Three properties are asserted, and each one is a way the feature could be a lie:
//
//   1. A day away visibly changes the scene: enough cells, in colours far enough
//      apart to see, judged by compiling the REAL renderer rather than restating
//      its colour rules here.
//   2. Longer absences change MORE than shorter ones, up to the cap. Without this a
//      curve that saturates after an hour would pass while "come back tomorrow"
//      meant nothing.
//   3. A scene with nothing alive in it comes back untouched. The slow world is
//      only allowed to move what the player left growing; walls, sand and glass are
//      not the game's to rearrange.

import { rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, ".tmp/slow-world-cjs");
await rm(outDir, { recursive: true, force: true });
const tsc = resolve(root, "app/node_modules/typescript/bin/tsc");
const compile = spawnSync(
  process.execPath,
  [tsc, "--target", "ES2022", "--module", "CommonJS", "--moduleResolution", "Node", "--lib",
   "ES2022,DOM", "--strict", "true", "--skipLibCheck", "true", "--esModuleInterop", "true",
   "--outDir", outDir, "app/src/engine.ts", "app/src/materials.ts", "app/src/slowWorld.ts",
   "app/src/rendering/materialColor.ts"],
  { cwd: root, stdio: "inherit" },
);
if (compile.status !== 0) throw new Error("slow-world audit: TypeScript compile failed");
await writeFile(resolve(outDir, "package.json"), JSON.stringify({ type: "commonjs" }));
const require = createRequire(import.meta.url);
const { createFallbackEngine } = require(resolve(outDir, "engine.js"));
// The SAME absence policy the app runs, not a copy of it. `wakeTerrarium` owns the
// step count, the tick count, and the order they are applied in, so this gate cannot
// certify a return path that production does not perform.
const FAST_FORWARD_CHUNK = 250; // matches App.tsx
const { aHeadIsOpen, catchUpRemaining, planAbsence, wakeTerrarium } = require(resolve(outDir, "slowWorld.js"));
const { colorForCell } = require(resolve(outDir, "rendering/materialColor.js"));

const STRIDE = 8;
const M = { Wall: 1, Sand: 2, Water: 3, Soil: 5, Fire: 6, Wood: 7, Seed: 11, Glass: 20 };
const KIND_NAME = ["empty", "wall", "sand", "water", "smoke", "soil", "fire", "wood", "lava",
  "stone", "moss", "seed", "fungus", "oil", "ice", "steam", "stardust", "meteor", "moonwater",
  "flower", "glass", "ember", "pollen", "stem", "rocket", "wellspring", "spark"];

// Long enough for a painted seed to grow, bloom, and spend itself, and for a lit log
// to burn down to cold char — i.e. long enough to be a scene somebody played in.
const PLAY_IN_TICKS = 2400;

// Perceptual-ish colour distance, matching material-contrast.mjs and interaction-audit.mjs
// so "how different do these look" means one thing across every gate.
function redmeanDistance([r1, g1, b1], [r2, g2, b2]) {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

const MIN_CONTRAST = 24; // below this a changed cell is the same colour as before
const MIN_CHANGED_CELLS_AFTER_A_DAY = 20;

const W = 96, H = 48, SEED = 20260810;

/** A scene somebody built: a garden bed, a hearth, and things that must not move. */
function paintScene(p) {
  for (let x = 0; x < W; x++) p(x, H - 3, 1, M.Wall);
  // Garden: a wide soil bed under a painted seed, watered from above.
  for (let x = 4; x <= 43; x++) p(x, H - 4, 1, M.Soil);
  p(24, H - 5, 1, M.Seed);
  for (let x = 20; x <= 28; x++) p(x, H - 8, 1, M.Water);
  // Hearth: a log pile, lit. By the time the scene is played in this is cold char.
  for (let x = 52; x <= 68; x++) p(x, H - 4, 1, M.Wood);
  p(54, H - 5, 1, M.Fire);
  p(64, H - 5, 1, M.Fire);
  // Inert: a sand pile and a glass pane, well clear of everything living.
  for (let y = H - 8; y < H - 4; y++) for (let x = 76; x <= 90; x++) p(x, y, 1, M.Sand);
  for (let x = 76; x <= 90; x++) p(x, H - 12, 1, M.Glass);
}

function freshEngine() {
  const engine = createFallbackEngine(W, H, SEED);
  paintScene((x, y, r, mat, d = 100) => engine.paint(x, y, r, mat, d));
  return engine;
}

const played = freshEngine();
for (let t = 0; t < PLAY_IN_TICKS; t++) played.tick();
// ...and then waters the bed one last time before closing the tab. This is not a
// convenience: a seed only comes up in ground that is still damp, so a garden left
// dry cannot spread no matter what a spent head sows. That is the intended shape of
// the rule — a tended garden travels, an abandoned one holds still — but it means a
// gate measured on a bone-dry scene would understate the feature to the point of
// looking broken. It was, in fact, measured that way first: scattered seeds sat as
// inert grains for 4,000 ticks and the whole arm read as clutter.
// Poured from high above, deliberately: `paint` lays down a 3x3 blob at radius 1, and
// a pour at bed height wrote water straight through the plant that the whole scatter
// arm depends on. From up here the water is still falling when the slow steps run, so
// it also cannot block the open cells a seed needs to land in.
for (let x = 8; x <= 40; x++) played.paint(x, 10, 1, M.Water);
const playedIn = played.getCellBytes();
played.dispose();

/** Restore the played-in scene, be away for `secondsAway`, and come back. */
function visitAfter(secondsAway) {
  const engine = createFallbackEngine(W, H, SEED);
  if (!engine.loadCellBytes(playedIn)) throw new Error("slow-world audit: could not restore the scene");
  const plan = wakeTerrarium(engine, secondsAway);
  // The board the instant the slow world is done and before a single ordinary tick.
  // Only here can the "it touched nothing I did not leave alive" claim be checked
  // exactly, because catch-up ticks legitimately move things afterwards.
  const afterSlowSteps = engine.getCellBytes();
  // The app does not simply run catchUpTicks: it stops the invisible fast-forward once a
  // head is open, so the player arrives on the rising action. Replayed here in the same
  // chunks for the same reason wakeTerrarium is shared — a gate that spent a budget the app
  // does not spend would be certifying a return path nobody performs.
  let owed = plan.catchUpTicks;
  while (owed > 0) {
    const chunk = Math.min(FAST_FORWARD_CHUNK, owed);
    for (let t = 0; t < chunk; t++) engine.tick();
    owed = catchUpRemaining(engine.getCellBytes(), owed - chunk, W);
  }
  const cells = engine.getCellBytes();
  engine.dispose();
  return { steps: plan.slowSteps, afterSlowSteps, cells };
}

function cellAt(cells, i) {
  const o = i * STRIDE;
  return {
    kind: cells[o],
    variant: cells[o + 1],
    age: cells[o + 2] + cells[o + 3] * 256,
    energy: cells[o + 4] + cells[o + 5] * 256,
    flags: cells[o + 6] + cells[o + 7] * 256,
  };
}

/** Cells whose KIND differs, and how far apart they look through the real renderer. */
function compare(baseline, visit) {
  const distances = [];
  for (let i = 0; i < W * H; i++) {
    const a = cellAt(baseline, i);
    const b = cellAt(visit, i);
    if (a.kind === b.kind) continue;
    const x = i % W, y = Math.floor(i / W);
    // Colour the same cell both ways at a fixed time so the comparison is of the
    // materials, not of where each one happens to sit in its own animation.
    const before = colorForCell({ ...a, time: 0, cells: baseline, width: W, height: H, x, y });
    const after = colorForCell({ ...b, time: 0, cells: visit, width: W, height: H, x, y });
    distances.push({ i, x, y, from: a.kind, to: b.kind, distance: redmeanDistance(before, after) });
  }
  const visible = distances.filter((d) => d.distance >= MIN_CONTRAST);
  const median = visible.length
    ? visible.map((d) => d.distance).sort((a, b) => a - b)[Math.floor(visible.length / 2)]
    : 0;
  // NOT `cells`: `visitAfter` already returns a `cells` byte array, and spreading both
  // into one result object silently shadowed the bytes with this list.
  return { changed: distances.length, visible: visible.length, median, visibleCells: visible };
}

const ABSENCES = [
  { label: "an hour", seconds: 3600 },
  { label: "half a day", seconds: 12 * 3600 },
  { label: "a day", seconds: 24 * 3600 },
  { label: "two days", seconds: 48 * 3600 },
  { label: "a week", seconds: 7 * 24 * 3600 },
];

// The baseline is the same absence WITHOUT the slow world, so what is measured is the
// slow world's own contribution and not the tick catch-up's.
//
// It is not a perfectly clean control and the report says so: a slow step consumes
// engine RNG, so the two branches enter catch-up with different RNG state and a few
// cells differ purely from the divergent trajectory. That noise floor is MEASURED, not
// assumed — deleting both slow-world writes while keeping every `chance()` roll leaves
// 5 changed cells and 0 new plant columns, against the floors of 20 and 1 below. The
// signal sits well clear of the noise, and the assertions fail hard without the rules.
const control = createFallbackEngine(W, H, SEED);
control.loadCellBytes(playedIn);
for (let t = 0; t < planAbsence(24 * 3600).catchUpTicks; t++) control.tick();
const baseline = control.getCellBytes();
control.dispose();

console.log(`Slow-world audit: a ${W}x${H} scene played in for ${PLAY_IN_TICKS} ticks, then left alone.\n`);
console.log("  absence      steps   cells changed   visibly   median contrast");

const results = [];
for (const absence of ABSENCES) {
  const visit = visitAfter(absence.seconds);
  const diff = compare(baseline, visit.cells);
  results.push({ ...absence, ...visit, ...diff });
  console.log(
    `  ${absence.label.padEnd(12)} ${String(visit.steps).padStart(4)}   ` +
      `${String(diff.changed).padStart(11)}   ${String(diff.visible).padStart(7)}   ` +
      `${diff.median.toFixed(1).padStart(15)}`,
  );
}

const failures = [];

// 1. A day away has to be worth coming back to.
const day = results.find((r) => r.label === "a day");
if (day.visible < MIN_CHANGED_CELLS_AFTER_A_DAY) {
  failures.push(
    `a day away changed only ${day.visible} cells visibly (floor ${MIN_CHANGED_CELLS_AFTER_A_DAY}).\n` +
      `    The slow world is running but nobody would notice it. Either its odds are too low\n` +
      `    or its rules touch too little of a real scene.`,
  );
}

// 2. Longer absences have to mean more, or "come back tomorrow" is a lie.
const hour = results.find((r) => r.label === "an hour");
if (day.visible <= hour.visible) {
  failures.push(
    `a day away (${day.visible} cells) is no more visible than an hour away (${hour.visible}).\n` +
      `    The absence curve has flattened, so the game no longer rewards actually being away.`,
  );
}

// 3. The garden has to have MOVED, not merely gained specks. A scattered seed that
//    never comes up is clutter; the payoff is a plant standing somewhere no plant
//    stood before, and that is what this measures.
function plantColumns(cells) {
  const columns = new Set();
  for (let i = 0; i < W * H; i++) {
    const kind = cells[i * STRIDE];
    if (kind === KIND_NAME.indexOf("stem") || kind === KIND_NAME.indexOf("flower")) {
      columns.add(i % W);
    }
  }
  return columns;
}
const before = plantColumns(baseline);
const grown = [...plantColumns(day.cells)].filter((column) => !before.has(column));
if (!grown.length) {
  failures.push(
    `after a day away the garden stands in exactly the same columns it started in.\n` +
      `    Seeds may be scattering, but none of them came up, so the scene gained specks\n` +
      `    rather than plants. Check that a sown seed lands on ground that can root it.`,
  );
}

// 3b. You arrive while the garden is IN FLOWER. The catch-up saturates at the same length
//     a bloom takes end to end, so before the wake learned to stop early, a player who had
//     been away over an hour reliably arrived AFTER the flowering: measured against the
//     live deployment, two or three Flower cells, which are spent crowns and read as
//     sticks. Every other assertion here passed happily through that — the scene had
//     changed, in new columns, by plenty of cells. It was just changed into stalks.
//
//     Counting Flower cells does NOT work here and the first version of this check was
//     wrong for that reason: a spent crown is still a Flower cell, so four scattered sticks
//     scored as a bloom and the check passed with the rule sabotaged. An open head is a
//     crown ringed by petals, which is an adjacency question, and `aHeadIsOpen` is imported
//     rather than restated so the gate measures the app's own predicate.
if (!aHeadIsOpen(day.cells, W)) {
  failures.push(
    `a day away ends with no OPEN bloom: there may be flower cells, but none of them is a\n` +
      `    crown ringed by petals, so the player arrives to a garden that has already bloomed\n` +
      `    and shed. The wake is meant to stop its invisible fast-forward once a head opens —\n` +
      `    see catchUpRemaining in app/src/slowWorld.ts.`,
  );
}

// 4. What the player did not leave living must come back untouched — and that is a
//    BYTE claim, not a colour one. Comparing rendered differences after catch-up could
//    only ever show that no *visible kind change* landed there; age, energy, flags and
//    variant would all slip through, and the catch-up ticks are entitled to move things
//    anyway. So this compares the raw bytes of the board immediately after the slow
//    steps against the board that went in. The sand pile and glass pane occupy x >= 76.
const trespass = [];
for (let i = 0; i < W * H; i++) {
  if (i % W < 76) continue;
  for (let b = 0; b < STRIDE; b++) {
    if (playedIn[i * STRIDE + b] !== day.afterSlowSteps[i * STRIDE + b]) {
      trespass.push({ x: i % W, y: Math.floor(i / W), byte: b });
      break;
    }
  }
}
if (trespass.length) {
  const { x, y, byte } = trespass[0];
  failures.push(
    `the slow world altered ${trespass.length} cells in the inert zone, first at (${x},${y}) byte ${byte}.\n` +
      `    Walls, sand and glass are not the game's to rearrange while the player is gone.`,
  );
}

// What actually changed, so a future reader can see whether the number above is one
// rule carrying the whole feature or several pulling together.
const transitions = new Map();
for (const cell of day.visibleCells) {
  const key = `${KIND_NAME[cell.from] ?? cell.from} -> ${KIND_NAME[cell.to] ?? cell.to}`;
  transitions.set(key, (transitions.get(key) ?? 0) + 1);
}
console.log("\n  after a day, the visible changes are:");
for (const [key, count] of [...transitions].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(count).padStart(3)}  ${key}`);
}

if (failures.length) {
  console.error("\nSlow-world audit FAILED:\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  `\nSlow-world audit passed: a day away visibly changes ${day.visible} cells at median ` +
    `contrast ${day.median.toFixed(1)} (against ${hour.visible} for an hour), grows the garden into ` +
    `${grown.length} new column${grown.length === 1 ? "" : "s"}, and leaves the inert zone alone.`,
);
