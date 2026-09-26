// What does the move clobber actually delete, and where?
//
// `try_move` in the sim (and `move` in its JS mirror) counts a target as free if it was
// empty at the START of the tick, so a mover can overwrite a cell that something else filled
// earlier in the same tick. That clobber is load-bearing — see "The move clobber, and the
// one place it is closed" in docs/HARNESS.md — and the water rebalance (ROADMAP Phase 20)
// exists to replace it. This is the instrument that says what it is doing today.
//
// It plays every interaction-audit scene on the JS mirror with a counter on the mover, and
// reports each overwrite by what moved, what it deleted, and where the deleted cell came
// from: a cell that MOVED IN earlier this tick, or one a REACTION created this tick. The
// first census, on 124 scenes, found water deleting water that had just flowed in 26,909
// times — 75% of every overwrite, 82% counting all liquid-on-liquid cases — concentrated in
// the wellspring and erosion scenes. That is the finding the rebalance rests on: the clobber
// is the game's hidden evaporation.
//
// The JS mirror is byte-identical to the shipped wasm (parity proves it), so what it counts
// is what production does. It runs one seed per scene: this measures VOLUME, not a change,
// and `audit:drift` is the tool for asking whether something moved.
import { CHECKS, colorForCell, jsEngine, runCheck } from "./interaction-scenes.mjs";
import { compileApp } from "./compile-app.mjs";

const app = compileApp("census-cjs", ["engine.ts", "materials.ts"]);
const { createFallbackEngine } = app.load("engine");
const { MATERIAL } = app.load("materials");
const NAME = Object.fromEntries(Object.entries(MATERIAL).map(([name, id]) => [id, name]));

// The hook reaches into the JS engine's private methods by name. If either is ever renamed
// the census must stop, not quietly count nothing and report the clobber gone.
const probe = createFallbackEngine(16, 16, 1);
const proto = Object.getPrototypeOf(probe);
for (const method of ["move", "react"]) {
  if (typeof proto[method] !== "function") {
    throw new Error(`clobber:census: the JS engine has no \`${method}\` method any more. ` +
      `This tool hooks it to count overwrites; update the hook in scripts/clobber-census.mjs.`);
  }
}

const tally = new Map();
let moves = 0, overwrites = 0, scene = "";
const { react, move } = proto;
// The bytes as apply_reactions left them, so an overwritten cell can be traced to its origin.
proto.react = function (old, next) {
  react.call(this, old, next);
  this.afterReactions = next.slice();
};
proto.move = function (idx, x, y, cell, old, next, ...rest) {
  if (!this.inBounds(x, y)) return move.call(this, idx, x, y, cell, old, next, ...rest);
  const target = this.index(x, y);
  const victim = next[target];
  const moved = move.call(this, idx, x, y, cell, old, next, ...rest);
  if (!moved) return false;
  moves++;
  // Only an overwrite of a cell that was EMPTY at the start of the tick is the clobber.
  // Passing through smoke or steam that was there all along is `try_move`'s gas rule
  // working as written, and is not counted.
  if (victim !== MATERIAL.Empty && old[target] === MATERIAL.Empty) {
    overwrites++;
    const origin = this.afterReactions && this.afterReactions[target] === victim ? "created by a reaction" : "moved in";
    const key = `${NAME[cell[0]]} over ${NAME[victim]} (${origin})`;
    const row = tally.get(key) ?? { count: 0, scenes: new Map() };
    row.count++;
    row.scenes.set(scene, (row.scenes.get(scene) ?? 0) + 1);
    tally.set(key, row);
  }
  return true;
};

const engine = jsEngine(createFallbackEngine);
for (const check of CHECKS) {
  scene = check.covers;
  runCheck(check, { engine, colorForCell });
}

if (moves === 0) {
  throw new Error("clobber:census: saw no moves at all — the hook is not attached to the mover the engine uses.");
}

const rows = [...tally].sort((a, b) => b[1].count - a[1].count);
const share = (n) => `${((100 * n) / overwrites).toFixed(1)}%`;
console.log(`\nClobber census: ${CHECKS.length} audit scenes on the JS mirror, one seed each.`);
console.log(`${moves.toLocaleString()} successful moves, ${overwrites.toLocaleString()} of them overwrote a cell filled earlier the same tick.\n`);
console.log(`${"COUNT".padStart(8)} ${"SHARE".padStart(6)}  ${"OVERWRITE".padEnd(48)} WHERE`);
for (const [key, { count, scenes }] of rows) {
  const where = [...scenes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${s} ${n}`).join(", ");
  console.log(`${count.toLocaleString().padStart(8)} ${share(count).padStart(6)}  ${key.padEnd(48)} ${where}`);
}
const liquid = (name) => ["Water", "Moonwater", "Oil"].includes(name);
const liquidOnLiquid = rows
  .filter(([key]) => { const [mover, , victim] = key.split(" "); return liquid(mover) && liquid(victim); })
  .reduce((sum, [, row]) => sum + row.count, 0);
console.log(`\nLiquid deleting liquid: ${liquidOnLiquid.toLocaleString()} (${share(liquidOnLiquid)} of all overwrites).`);
