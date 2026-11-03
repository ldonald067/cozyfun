// Scratch: raw numbers behind the big-head checks, live and sabotaged. node .tmp/bighead/thresh.mjs <none|sabotage> [seeds=32]
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKS, jsEngine, runCheck, colorForCell, M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "../halves/sabotages.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name = "none", seedArg = "32"] = process.argv.slice(2);
const root = resolve(repo, ".tmp/bighead/thr-" + name);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
for (const [find, replace] of name === "none" ? [] : SABOTAGES[name]) { if (src.split(find).length !== 2) throw new Error(name + ": " + find.slice(0, 60)); src = src.replace(find, replace); }
writeFileSync(resolve(root, "app/src/engine.ts"), src);
copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const engine = jsEngine(compileApp("bhthr-" + name, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine);
function heads(g) {
  const out = [];
  for (const crown of g.all(M.Flower)) {
    if (!g.hasFlag(crown, F.Rooted)) continue;
    const [x, cy] = g.xyOf(crown), v = g.cells[crown * STRIDE + 1];
    let head = 0;
    for (let y = cy - 10; y <= cy; y++) for (let hx = x - 6; hx <= x + 6; hx++) if (g.kindAt(hx, y) === M.Flower && g.cells[(y * g.w + hx) * STRIDE + 1] === v) head++;
    out.push({ head, age: g.cells[crown * STRIDE + 2] | (g.cells[crown * STRIDE + 3] << 8) });
  }
  return out;
}
const find = (re) => CHECKS.find((c) => re.test(c.role));
const runs = {
  held: [find(/stays in bloom for minutes/), (h) => h.filter((p) => p.age >= 2400 && p.head >= 20).length],
  late: [find(/blooms again in a second wave/), (h, t) => h.filter((p) => p.head >= 20 && p.age <= t - 3600).length],
};
for (const [label, [c, stat]] of Object.entries(runs)) {
  const vals = [];
  for (let k = 0; k < Number(seedArg); k++) {
    let best = 0, t = -1;
    runCheck({ ...c, seed: c.seed + k * 1000, outcome: (g, b, m, prev) => { t++; best = Math.max(best, stat(heads(g), t)); return c.outcome(g, b, m, prev); } }, { engine, colorForCell });
    vals.push(best);
  }
  vals.sort((a, b) => a - b);
  console.log(name.padEnd(14), label.padEnd(5), "min", vals[0], "p25", vals[vals.length >> 2], "median", vals[vals.length >> 1], "max", vals.at(-1));
}
