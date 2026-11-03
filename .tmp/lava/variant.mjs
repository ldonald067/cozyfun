// Scratch (2026-10-21): engine variants for the lava/oil self-deletion question. The repo's
// engine.ts is never edited; each variant is a find/replace copy compiled on its own.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const GUARD = "    if (waterLike(movingCell[0]) && waterLike(next[target])) return false;\n";
const keep = (kind) => GUARD + `    if (movingCell[0] === MATERIAL.${kind} && next[target] === MATERIAL.${kind}) return false;\n`;
export const VARIANTS = {
  live: [],
  "lava-kept": [[GUARD, keep("Lava")]],
  "oil-kept": [[GUARD, keep("Oil")]],
};
const knob = (n, d) => `Number((globalThis as any).process?.env?.${n} ?? ${d})`;
// Lava kept, and a pool cools from within too, LAVA_DEEP times slower than at its edges.
const DEEP = [["        if (hotNeighbors < 3 && this.chance(8)) {", `        if (this.chance(hotNeighbors < 3 ? 8 : ${knob("LAVA_DEEP", 24)})) {`]];
// Oil kept, and a cell with open air above evaporates, one tick in OIL_FADE.
const FADE = [["      return;\n    }\n    // A sheen spreads through its slick; see the oil arm in lib.rs.",
  `      return;\n    }\n    if (y > 0 && old[this.index(x, y - 1)] === MATERIAL.Empty && this.chance(${knob("OIL_FADE", 1200)})) {\n      next.fill(0, idx, idx + CELL_STRIDE);\n      return;\n    }\n    // A sheen spreads through its slick; see the oil arm in lib.rs.`]];
VARIANTS["lava-fix"] = [...VARIANTS["lava-kept"], ...DEEP];
VARIANTS["oil-fix"] = [...VARIANTS["oil-kept"], ...FADE];
VARIANTS["both-fix"] = [...VARIANTS["lava-fix"], ...FADE, [GUARD.replace("\n", "") + "\n    if (movingCell[0] === MATERIAL.Lava", "X"]].slice(0, 3);
VARIANTS["both-fix"] = [[GUARD, keep("Lava") + `    if (movingCell[0] === MATERIAL.Oil && next[target] === MATERIAL.Oil) return false;\n`], ...DEEP, ...FADE];
const repo = resolve(import.meta.dirname, "../..");
export function build(name, extra = []) {
  const root = resolve(repo, ".tmp/lava/root-" + name);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
  for (const [f, r] of [...VARIANTS[name], ...extra]) {
    if (src.split(f).length !== 2) throw new Error(`${name}: no single match for ${f.slice(0, 60)}`);
    src = src.replace(f, r);
  }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
  const app = compileApp("lava-" + name, ["engine.ts", "materials.ts"], { root });
  return { create: app.load("engine").createFallbackEngine, M: app.load("materials").MATERIAL, root };
}

// Tamed: kept, but a moving cell vanishes one move in N, as moving water throws mist.
const LAVA_TAME = [["        if (waterLike(cell[0]) && this.chance(MIST_ODDS)) {",
  `        if (cell[0] === MATERIAL.Lava && this.chance(${knob("LAVA_ODDS", 450)})) {\n          const landed = this.index(x + dx, y + dy);\n          next.fill(0, landed, landed + CELL_STRIDE);\n        }\n        if (waterLike(cell[0]) && this.chance(MIST_ODDS)) {`]];
const OIL_TAME = [["    for (const [dx, dy] of dirs) {\n      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;\n    }\n  }\n",
  `    for (const [dx, dy] of dirs) {\n      if (this.move(idx, x + dx, y + dy, cell, old, next)) {\n        if (this.chance(${knob("OIL_ODDS", 450)})) {\n          const landed = this.index(x + dx, y + dy);\n          next.fill(0, landed, landed + CELL_STRIDE);\n        }\n        return;\n      }\n    }\n  }\n`]];
VARIANTS["lava-tamed"] = [...VARIANTS["lava-kept"], ...DEEP, ...LAVA_TAME];
VARIANTS["oil-tamed"] = [...VARIANTS["oil-kept"], ...OIL_TAME];

// The two candidates together: lava kept and cooling from within, oil kept and tamed at 1 in 50.
VARIANTS["candidate"] = [[GUARD, keep("Lava") + `    if (movingCell[0] === MATERIAL.Oil && next[target] === MATERIAL.Oil) return false;\n`], ...DEEP, ...OIL_TAME];
