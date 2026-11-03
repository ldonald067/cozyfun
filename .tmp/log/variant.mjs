// Scratch (2026-10-28): burning-log variants as find/replace copies of app/src/engine.ts (never
// edited). `live` is the WORKING TREE. Each smoulder variant slows only the ember's 90-and-below
// band (the glowing cracks); above 90 (where it lights neighbours) it drains as today.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../..");
const SLOWED = "const slowed = (kind === MATERIAL.Flower && age % BLOOM_CLOCK !== 0) || (kind === MATERIAL.Water && this.ticks % WATER_CHILL !== 0);";
const smoulder = (n, top = 90) => [[SLOWED, SLOWED.replace(");", `) || (kind === MATERIAL.Ember && readU16(next, idx + 4) <= ${top} && this.ticks % ${n} !== 0);`)]];
const arc = (n) => [[SLOWED, SLOWED.replace(");", `) || (kind === MATERIAL.Ember && this.ticks % ${n} !== 0);`)]];
// Cracks: only one ember in `share` (by the cell's own variant, so no roll) slows, by `n`; the
// rest of the log goes dark as today, leaving glowing seams in the char.
const cracks = (n, mask = 3) => [[SLOWED, SLOWED.replace(");", `) || (kind === MATERIAL.Ember && (next[idx + 1] & ${mask}) === 0 && readU16(next, idx + 4) <= 90 && this.ticks % ${n} !== 0);`)]];
// Held cracks: a crack cell slows only between `lo` and 90, where it still shows heat, then
// ashes over at today's pace. `sel` picks crack cells from the cell's position (no roll).
// speck: a scattered quarter. seam: horizontal runs along the grain, broken every 4 columns.
const POS = "const ci = idx / CELL_STRIDE, cx = ci % this.w, cy = (ci - cx) / this.w;";
const SEL = {
  speck: "(Math.imul((Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263)) ^ ((Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263)) >>> 15), 1274126177) >>> 30) === 0",
  seam: "(cy + ((Math.imul(cx >> 2, 374761393) >>> 0) % 3)) % 3 === 0",
};
const held = (sel, n, lo = 60) => [[SLOWED, POS + " " + SLOWED.replace(");", `) || (kind === MATERIAL.Ember && readU16(next, idx + 4) <= 90 && readU16(next, idx + 4) >= ${lo} && (${SEL[sel]}) && this.ticks % ${n} !== 0);`)]];
export const VARIANTS = {
  "sab-nocrack": [["          this.ticks % EMBER_CRACK_CLOCK !== 0 &&", "          false &&"]],
  seam32: held("seam", 32, 66), speck16: held("speck", 16), seam16: held("seam", 16), seam24: held("seam", 24),
  c8: cracks(8), c16: cracks(16), c12h: cracks(12, 1),
  live: [],
  s2: smoulder(2), s3: smoulder(3), s4: smoulder(4), s6: smoulder(6),
  arc2: arc(2),
};
export function build(name) {
  const root = resolve(repo, ".tmp/log/root-" + name);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  // Candidates patch main's engine (they predate the built rule); live and sab-* the working tree.
  let src = name === "live" || name.startsWith("sab-")
    ? readFileSync(resolve(repo, "app/src/engine.ts"), "utf8")
    : execSync("git show main:app/src/engine.ts", { cwd: repo, encoding: "utf8" });
  for (const [f, r] of VARIANTS[name]) {
    if (src.split(f).length !== 2) throw new Error(`${name}: no single match for ${f.slice(0, 70)}`);
    src = src.replace(f, r);
  }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
  const app = compileApp("log-" + name, ["engine.ts", "materials.ts"], { root });
  return { create: app.load("engine").createFallbackEngine, M: app.load("materials").MATERIAL, root };
}
