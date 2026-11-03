// Scratch: raw numbers behind the fuller-garden checks, live and sabotaged, to set thresholds.
// node .tmp/garden/thresh.mjs <none|sabotage> [seeds=32]
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKS, jsEngine, runCheck, colorForCell, M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "../halves/sabotages.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name = "none", seedArg = "32"] = process.argv.slice(2);
const root = resolve(repo, ".tmp/garden/thr-" + name);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
for (const [find, replace] of name === "none" ? [] : SABOTAGES[name]) { if (src.split(find).length !== 2) throw new Error(name); src = src.replace(find, replace); }
writeFileSync(resolve(root, "app/src/engine.ts"), src);
copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const engine = jsEngine(compileApp("thr-" + name, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine);
function plants(g) {
  const out = [];
  for (const crown of g.all(M.Flower)) {
    if (!g.hasFlag(crown, F.Rooted)) continue;
    const [x, cy] = g.xyOf(crown), v = g.cells[crown * STRIDE + 1];
    let stalk = 0, leaves = 0, head = 0;
    for (let y = cy + 1; y < g.h && g.kindAt(x, y) === M.Stem; y++) { stalk++; for (const lx of [x - 1, x + 1]) if (g.kindAt(lx, y) === M.Stem && g.kindAt(lx, y + 1) !== M.Stem) leaves++; }
    for (let y = cy - 5; y <= cy + 1; y++) for (let hx = x - 3; hx <= x + 3; hx++) if (g.kindAt(hx, y) === M.Flower && g.cells[(y * g.w + hx) * STRIDE + 1] === v) head++;
    out.push({ stalk, leaves, head, age: g.cells[crown * STRIDE + 2] | (g.cells[crown * STRIDE + 3] << 8) });
  }
  return out;
}
const find = (re) => CHECKS.find((c) => re.test(c.role));
const runs = {
  held: [find(/stays in bloom for minutes/), (pl) => pl.filter((p) => p.age >= 2400 && p.head >= 5).length],
  gap1: [find(/tall stalk with a leaf on most rows/), (pl) => pl.filter((p) => p.stalk >= 7 && p.leaves >= p.stalk - 1).length],
  gap2: [find(/tall stalk with a leaf on most rows/), (pl) => pl.filter((p) => p.stalk >= 7 && p.leaves >= p.stalk - 2).length],
  gap3: [find(/tall stalk with a leaf on most rows/), (pl) => pl.filter((p) => p.stalk >= 7 && p.leaves >= p.stalk - 3).length],
  plants: [find(/tall stalk with a leaf on most rows/), (pl) => pl.length],
};
for (const [label, [c, stat]] of Object.entries(runs)) {
  const vals = [];
  for (let k = 0; k < Number(seedArg); k++) {
    let best = 0;
    runCheck({ ...c, seed: c.seed + k * 1000, outcome: (g, b, m, prev) => { best = Math.max(best, stat(plants(g))); return c.outcome(g, b, m, prev); } }, { engine, colorForCell });
    vals.push(best);
  }
  vals.sort((a, b) => a - b);
  console.log(name.padEnd(18), label.padEnd(7), "min", vals[0], "p25", vals[vals.length >> 2], "median", vals[vals.length >> 1], "max", vals.at(-1));
}
// The cosmic check: tallest stalk column per seed.
const cos = find(/grows taller fed cosmic/), tall = [];
for (let k = 0; k < Number(seedArg); k++) {
  let best = 0;
  runCheck({ ...cos, seed: cos.seed + k * 1000, outcome: (g, b, m, prev) => {
    for (let x = 0; x < g.w; x++) { let run = 0; for (let y = 0; y < g.h; y++) { run = g.kindAt(x, y) === M.Stem ? run + 1 : 0; best = Math.max(best, run); } }
    return cos.outcome(g, b, m, prev);
  } }, { engine, colorForCell });
  tall.push(best);
}
tall.sort((a, b) => a - b);
console.log(name.padEnd(18), "cosmic tallest column: min", tall[0], "median", tall[tall.length >> 1], "max", tall.at(-1), "seeds >= 11:", tall.filter((t) => t >= 11).length);
