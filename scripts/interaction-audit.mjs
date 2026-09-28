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
import {
  CHECKS, MIN_CELLS, MIN_CONTRAST, MIN_TICKS, auditVerdict, colorForCell, loadWasmEngine, runCheck,
} from "./interaction-scenes.mjs";

const root = resolve(import.meta.dirname, "..");
// The shipped engine: the audit judges what players run, so it plays the wasm build.
const engine = await loadWasmEngine();

// Coverage is enforced against docs/MATERIAL_AUDIT.md, clause by clause. Each role there
// carries a stable `[material.slug]` id and each check names the id it covers, so the
// binding survives rewording — which a count, or matching on the prose, would not.
//
// What this catches: a clause added with no check, a clause deleted while a check still
// claims it, a typo'd id. What it does NOT catch: a clause reworded into a *different*
// promise while keeping its id. Identity is stable by design, which is exactly why it
// cannot notice meaning changing underneath it — that one still needs a human reading the
// diff. Binding on the prose instead would catch it, at the cost of breaking on every typo.
const matrixLines = (await readFile(resolve(root, "docs/MATERIAL_AUDIT.md"), "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim());
const documented = new Map();
let inMatrix = false;
for (const line of matrixLines) {
  if (line.startsWith("| Material | Interaction roles")) { inMatrix = true; continue; }
  if (!inMatrix) continue;
  if (!line.startsWith("|")) break;
  if (/^\|[-\s|]+\|$/.test(line)) continue;
  const cols = line.slice(1, -1).split("|").map((c) => c.trim());
  if (cols.length < 2 || !cols[0] || cols[0] === "Material") continue;
  for (const clause of cols[1].split(";")) {
    const tag = clause.trim().match(/^\[([a-z0-9.]+)\]\s*(.+)$/i);
    if (!tag) {
      console.error(`\nInteraction audit FAILED: an interaction role in docs/MATERIAL_AUDIT.md has no\n` +
        `stable id. Every clause must start with one, e.g. "[wall.blocks] Blocks flow...":\n  ${cols[0]}: ${clause.trim().slice(0, 80)}`);
      process.exit(1);
    }
    if (documented.has(tag[1])) {
      console.error(`\nInteraction audit FAILED: duplicate role id "${tag[1]}" in docs/MATERIAL_AUDIT.md.`);
      process.exit(1);
    }
    documented.set(tag[1], { material: cols[0], text: tag[2] });
  }
}

const claimed = new Set(CHECKS.map((c) => c.covers));
const unknown = CHECKS.filter((c) => !documented.has(c.covers));
const uncovered = [...documented].filter(([id]) => !claimed.has(id));
const misfiled = CHECKS.filter((c) => documented.get(c.covers) && documented.get(c.covers).material !== c.m);
if (unknown.length || uncovered.length || misfiled.length) {
  const parts = [];
  if (uncovered.length)
    parts.push(`Documented roles with no check:\n` +
      uncovered.map(([id, d]) => `  - ${id} (${d.material}): ${d.text.slice(0, 70)}`).join("\n"));
  if (unknown.length)
    parts.push(`Checks naming a role id that is not in the matrix — renamed or deleted?\n` +
      unknown.map((c) => `  - ${c.covers} (claimed by ${c.m}: ${c.role})`).join("\n"));
  if (misfiled.length)
    parts.push(`Checks bound to another material's role:\n` +
      misfiled.map((c) => `  - ${c.m} check claims ${c.covers}, which belongs to ${documented.get(c.covers).material}`).join("\n"));
  console.error(`\nInteraction audit FAILED: the matrix and this gate disagree.\n\n${parts.join("\n\n")}\n\n` +
    `Every clause in that matrix is a promise to the player. Add a check, fix the id, or if\n` +
    `the promise is not real any more, take the clause out of the matrix.`);
  process.exit(1);
}

// Classified by `auditVerdict`, which `audit:drift` shares, so "passes" means one thing.
// Visibility is judged only on interactions that actually happened; an unreachable one has
// a more basic problem, and an `absent` one is supposed to leave nothing behind.
const results = CHECKS.map((c) => {
  const r = { ...c, ...runCheck(c, { engine, colorForCell }) };
  return { ...r, verdict: auditVerdict(r).kind };
});
const vacuous = results.filter((r) => r.verdict === "vacuous");
const unreachable = results.filter((r) => r.verdict === "unreachable");
const invisible = results.filter((r) => r.verdict === "faint");

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
  const flag = r.verdict === "faint" ? "  <- faint" : "";
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

console.log(`\nInteraction audit passed: ${results.length} checks bound to all ${documented.size} role ids`);
console.log(`documented in docs/MATERIAL_AUDIT.md. Every one happens from a painted scene, and`);
console.log(`every one is visible at play zoom.`);
