// Scratch (2026-10-23): steam variants as find/replace copies of app/src/engine.ts (never edited).
// `live` is the WORKING TREE.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../..");
const GAS = `  private gas(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const side = this.ticks % 2 === 0 ? 1 : -1;
    for (const [dx, dy] of [[0, -1], [side, -1], [-side, -1], [side, 0], [-side, 0]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next, false)) return;
    }
  }
`;
// A candidate: hot steam (above MIST_ENERGY) may linger (move on two ticks in four), wander
// (1 in `wander` tries the diagonal first), and puff on its first move: open cells at `offs`
// around where it lands take a marked (Rooted) steam cell, odd variant, born at `age`.
const gasVariant = ({ offs = [], age = 40, wander = 0, linger = false, sway = false, swayMask = 1, ce = 0 }) => `  private gas(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const hot = cell[0] === MATERIAL.Steam && readU16(cell, 4) > MIST_ENERGY;
    // Not yet billowed (DriftEast) and not itself a puff (Rooted).
    const fresh = hot && !(readU16(cell, 6) & (CELL_FLAG.Rooted | CELL_FLAG.DriftEast));
    let at = idx;
    if (!(${linger} && hot && this.ticks % 4 >= 2)) {
      const side = this.ticks % 2 === 0 ? 1 : -1;
      // Sway: a breeze in bands of 16 rows that creep one row every 8 ticks; hot steam takes the
      // breeze's diagonal on even ticks, so a whole body leans together.
      const d = ((y + (this.ticks >> 3)) >> 4) & 1 ? 1 : -1;
      const dirs = ${sway} && hot && (this.ticks & ${swayMask}) === 0
        ? [[d, -1], [0, -1], [-d, -1], [d, 0], [-d, 0]]
        : ${wander ? `hot && this.chance(${wander})` : "false"}
        ? [[side, -1], [0, -1], [-side, -1], [side, 0], [-side, 0]]
        : [[0, -1], [side, -1], [-side, -1], [side, 0], [-side, 0]];
      for (const [dx, dy] of dirs) {
        if (this.move(idx, x + dx, y + dy, cell, old, next, false)) { at = this.index(x + dx, y + dy); break; }
      }
    }
    // Only the cell itself puffs: water may have swapped it away this tick (a bubble), and then
    // it puffs from where it is next tick instead of spraying the spot it left.
    if (!fresh || next[at] !== MATERIAL.Steam || readU16(next, at + 6) & CELL_FLAG.Rooted) return;
    const n = at / CELL_STRIDE, px = n % this.w, py = Math.floor(n / this.w);
    let puffed = false;
    for (const [ox, oy] of (${JSON.stringify(offs)} as number[][])) {
      if (!this.inBounds(px + ox, py + oy)) continue;
      const t = this.index(px + ox, py + oy);
      if (next[t] === MATERIAL.Empty && (old[t] === MATERIAL.Empty || t === idx)) {
        writeCellBytes(next, t, MATERIAL.Steam, cell[1] | 1, ${ce ? ce : 'readU16(cell, 4)'}, ${ce ? 'readU16(next, at + 2)' : age}, CELL_FLAG.Rooted);
        puffed = true;
      }
    }
    if (puffed) writeU16(next, at + 6, readU16(next, at + 6) | CELL_FLAG.DriftEast);
  }
`;
const PLUS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAMOND = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]];
// A cloud: hot steam (not a shed cell) rises on two ticks in four and, every `every` ticks of
// its age while hot, sheds one marked (Rooted) cell into the first open side or below, born at
// `age` so it lives 150 - age ticks and draws faded. Shed cells linger too, so the core and
// its halo rise together; `wander` lets them jostle.
const cloudVariant = ({ every = 4, age = 126, wander = 0, linger = true }) => `  private gas(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const hot = cell[0] === MATERIAL.Steam && readU16(cell, 4) > MIST_ENERGY;
    const core = hot && !(readU16(cell, 6) & CELL_FLAG.Rooted);
    let at = idx;
    if (!(${linger} && hot && this.ticks % 4 >= 2)) {
      const side = this.ticks % 2 === 0 ? 1 : -1;
      const dirs = ${wander ? `hot && this.chance(${wander})` : "false"}
        ? [[side, -1], [0, -1], [-side, -1], [side, 0], [-side, 0]]
        : [[0, -1], [side, -1], [-side, -1], [side, 0], [-side, 0]];
      for (const [dx, dy] of dirs) {
        if (this.move(idx, x + dx, y + dy, cell, old, next, false)) { at = this.index(x + dx, y + dy); break; }
      }
    }
    const age = readU16(cell, 2);
    if (!core || age % ${every} !== 0) return;
    const n = at / CELL_STRIDE, px = n % this.w, py = Math.floor(n / this.w);
    const s = (age / ${every}) % 2 === 0 ? 1 : -1;
    for (const [ox, oy] of [[s, 0], [-s, 0], [0, 1], [s, 1], [-s, 1]]) {
      if (!this.inBounds(px + ox, py + oy)) continue;
      const t = this.index(px + ox, py + oy);
      if (next[t] === MATERIAL.Empty && (old[t] === MATERIAL.Empty || t === idx)) {
        writeCellBytes(next, t, MATERIAL.Steam, cell[1] | 1, readU16(cell, 4), ${age}, CELL_FLAG.Rooted);
        return;
      }
    }
  }
`;
// Puff cells (Rooted steam) vanish when their energy runs out, so they can be born as bright as
// their parent and still live only energy / 2 ticks.
const EXPIRE = [["      if (kind === MATERIAL.Steam && age > 150) {", "      if (kind === MATERIAL.Steam && flags & CELL_FLAG.Rooted && energy === 0) {\n        next.fill(0, idx, idx + CELL_STRIDE);\n      } else if (kind === MATERIAL.Steam && age > 150) {"]];
// A hot ember meeting water hisses on 1 roll in 2 instead of 1 in 6 (same roll, so same stream length).
const HISS = [["            if (readU16(old, idx + 4) > 40 && this.chance(6)) {\n              writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 170);",
  "            if (readU16(old, idx + 4) > 40 && this.chance(2)) {\n              writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 170);"]];
export const VARIANTS = {
  live: [],
  linger: [[GAS, gasVariant({ linger: true })]],
  bar: [[GAS, gasVariant({ offs: [[-1, 0], [1, 0]] })]],
  plus: [[GAS, gasVariant({ offs: PLUS })]],
  "plus-wander": [[GAS, gasVariant({ offs: PLUS, wander: 3 })]],
  "plus-linger": [[GAS, gasVariant({ offs: PLUS, linger: true })]],
  hiss: HISS,
  // Sabotage: a puff goes through the condensation loop again (it wets, as before review).
  "sab-puffwets": [["    if (readU16(old, idx + 6) & PUFF) {\n      if (iceNearby && next[idx] === MATERIAL.Steam)", "    if (readU16(old, idx + 6) & PUFF && iceNearby) {\n      if (iceNearby && next[idx] === MATERIAL.Steam)"]],
  // ...and no puff is placed beside ice.
  "puff-ice-both": [["    if (iceNearby && !puff && this.chance(5)) {", "    if (iceNearby && puff) {\n      next.fill(0, idx, idx + CELL_STRIDE);\n      return;\n    }\n    if (iceNearby && !puff && this.chance(5)) {"],
    ["      if (next[target] === MATERIAL.Empty && (old[target] === MATERIAL.Empty || target === idx)) {\n        writeCellBytes(next, target, MATERIAL.Steam, cell[1] | 1, PUFF_ENERGY",
     "      if (this.neighbors(px + ox, py + oy).some((n) => old[n] === MATERIAL.Ice)) continue;\n      if (next[target] === MATERIAL.Empty && (old[target] === MATERIAL.Empty || target === idx)) {\n        writeCellBytes(next, target, MATERIAL.Steam, cell[1] | 1, PUFF_ENERGY"]],
  // A puff that touches ice vanishes, freeing the ice's face for wisps that frost.
  "puff-melts-at-ice": [["    if (iceNearby && !puff && this.chance(5)) {", "    if (iceNearby && puff) {\n      next.fill(0, idx, idx + CELL_STRIDE);\n      return;\n    }\n    if (iceNearby && !puff && this.chance(5)) {"]],
  // Sabotages of the working tree: no billow, and the ember's old 1-in-6 hiss.
  "sab-nobillow": [["    if (cell[0] === MATERIAL.Steam) this.billow(idx, at, cell, old, next);\n", ""]],
  "sab-hiss6": [["            if (readU16(old, idx + 4) > 40 && this.chance(2)) {", "            if (readU16(old, idx + 4) > 40 && this.chance(6)) {"]],
  // The working tree with every mist throw counted.
  "count-mist": [["          writeCellBytes(next, this.index(x + dx, y + dy), MATERIAL.Steam, cell[1] | 1, MIST_ENERGY);",
    "          writeCellBytes(next, this.index(x + dx, y + dy), MATERIAL.Steam, cell[1] | 1, MIST_ENERGY);\n          (globalThis as any).__mist = ((globalThis as any).__mist ?? 0) + 1;"]],
  "dia80": [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: DIAMOND, ce: 80 })]],
  "dia120": [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: DIAMOND, ce: 120 })]],
  "dia80-sway4": [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: DIAMOND, ce: 80, sway: true, swayMask: 3 })]],
  puffE: [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: PLUS, ce: 80 })]],
  "puffE-wander": [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: PLUS, ce: 80, wander: 3 })]],
  "puffE-sway": [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: PLUS, ce: 80, sway: true })]],
  "puffE-sway4": [...HISS, ...EXPIRE, [GAS, gasVariant({ offs: PLUS, ce: 80, sway: true, swayMask: 3 })]],
  "sway-hiss": [...HISS, [GAS, gasVariant({ sway: true })]],
  "plus-sway": [...HISS, [GAS, gasVariant({ offs: PLUS, age: 100, sway: true })]],
  "plus-a60-sway": [...HISS, [GAS, gasVariant({ offs: PLUS, age: 60, sway: true })]],
  "bar-sway": [...HISS, [GAS, gasVariant({ offs: [[-1, 0], [1, 0]], age: 60, sway: true })]],
  "cloud": [...HISS, [GAS, cloudVariant({})]],
  "cloud-w": [...HISS, [GAS, cloudVariant({ wander: 3 })]],
  "cloud-3": [...HISS, [GAS, cloudVariant({ every: 3, age: 120, wander: 3 })]],
  "bar-a100": [[GAS, gasVariant({ offs: [[-1, 0], [1, 0]], age: 100 })]],
  "plus-a100": [[GAS, gasVariant({ offs: PLUS, age: 100 })]],
  "plus-a110": [[GAS, gasVariant({ offs: PLUS, age: 110 })]],
  "plus-a100-hiss": [...HISS, [GAS, gasVariant({ offs: PLUS, age: 100 })]],
  "plus-a100-wander-hiss": [...HISS, [GAS, gasVariant({ offs: PLUS, age: 100, wander: 3 })]],
  "plus-hiss": [...HISS, [GAS, gasVariant({ offs: PLUS })]],
  "plus-wander-hiss": [...HISS, [GAS, gasVariant({ offs: PLUS, wander: 3 })]],
};
export function build(name, variants = VARIANTS) {
  const root = resolve(repo, ".tmp/steam/root-" + name);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
  for (const [f, r] of variants[name]) {
    if (src.split(f).length !== 2) throw new Error(`${name}: no single match for ${f.slice(0, 70)}`);
    src = src.replace(f, r);
  }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
  const app = compileApp("steam-" + name, ["engine.ts", "materials.ts"], { root });
  return { create: app.load("engine").createFallbackEngine, M: app.load("materials").MATERIAL, root };
}
