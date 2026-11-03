import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("garden-trace", ["materials.ts", "engine.ts"]);
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const W = 80, H = 40, S = 8;
const fl = (c, i) => c[i + 6] | (c[i + 7] << 8);
const e = createFallbackEngine(W, H, 1);
for (let x = 4; x <= 76; x++) e.paint(x, 36, 3, M.Soil, 55);
e.paint(40, 31, 1, M.Seed); e.paint(40, 26, 3, M.Water);
let traced = 0;
const live = new Map(); // idx -> path
for (let t = 0; t < 3000 && traced < 6; t++) {
  if (t % 400 === 200) for (let x = 6; x <= 74; x += 3) e.paint(x, 20, 1, M.Water, 30);
  const b = e.getCellBytes().slice();
  e.tick();
  const a = e.getCellBytes();
  const next = new Map();
  for (let i = 0; i < a.length; i += S) {
    if (a[i] !== M.Seed || !(fl(a, i) & F.Windborne)) continue;
    const c = i / S, x = c % W, y = (c - x) / W;
    // find where it came from: same cell or a neighbour that was a windborne seed
    let path = null;
    for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, -1]]) {
      const j = ((y + dy) * W + (x + dx)) * S;
      if (live.has(j)) { path = live.get(j); live.delete(j); break; }
    }
    if (!path) path = [`born ${t} at (${x},${y}) from ${b[i] === M.Pollen ? "pollen" : b[i]}`];
    const last = path[path.length - 1];
    const here = `(${x},${y})${fl(a, i) & F.DriftEast ? "E" : "W"}`;
    if (!last.endsWith(here)) path.push(here);
    next.set(i, path);
  }
  for (const [j, path] of live) { // ended: landed or moved away untracked
    const c = j / S, x = c % W, y = (c - x) / W;
    console.log(path.join(" ") + ` -> landed on ${a[j + W * S]} below; kind now ${a[j]}`);
    traced++;
  }
  live.clear();
  for (const [k, v] of next) live.set(k, v);
}
// crop of the plant
const a = e.getCellBytes();
const ch = { [M.Empty]: ".", [M.Soil]: "s", [M.Moss]: "m", [M.Seed]: "o", [M.Stem]: "|", [M.Flower]: "*", [M.Pollen]: "'", [M.Water]: "~" };
for (let y = 14; y < 38; y++) { let row = ""; for (let x = 26; x < 56; x++) row += ch[a[(y * W + x) * S]] ?? "?"; console.log(row); }
