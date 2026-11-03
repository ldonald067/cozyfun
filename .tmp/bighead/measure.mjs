// Scratch: are the mock's heads distinct in shape, and does any tone vanish into the night?
// node .tmp/bighead/measure.mjs [root=.tmp/bighead/m-big]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const names = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
const redmean = ([r1, g1, b1], [r2, g2, b2]) => { const r = (r1 + r2) / 2; return Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2); };
const roots = { today: repo, mock: resolve(repo, process.argv[2] ?? ".tmp/bighead/m-big") };
const wash = compileApp("bhm-wash", ["rendering/nightWash.ts", "materials.ts"]).load("rendering/nightWash");
const sky = [];
for (let y = 0; y < 140; y += 3) for (let x = 0; x < 220; x += 3) sky.push(wash.washAt(x, y));
for (const [label, root] of Object.entries(roots)) {
  const shapes = compileApp(`bhm-${label}`, ["engine.ts", "materials.ts"], { root }).load("engine").BLOOM_SHAPES;
  const sets = shapes.map((s) => new Set(["0,0", ...s.map(([x, y]) => `${x},${y}`)]));
  // Shape overlap, aligned at the crown: shared cells over all cells (1 = identical).
  const pairs = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
    const inter = [...sets[a]].filter((k) => sets[b].has(k)).length;
    pairs.push([inter / (sets[a].size + sets[b].size - inter), names[a], names[b]]);
  }
  pairs.sort((p, q) => q[0] - p[0]);
  console.log(`\n${label}: most alike shapes (overlap, 1 = identical)`);
  for (const [o, a, b] of pairs.slice(0, 6)) console.log(`  ${o.toFixed(2)}  ${a} / ${b}`);
  if (label !== "mock") continue;
  // Each head drawn open on a stalk, every cell's colour against the night: the share of a
  // head's cells within 60 redmean of some sky colour, i.e. cells that sink into the night.
  const color = loadRenderer("bhm-r", root).colorForCell;
  const W = 21, H = 16;
  console.log(`\n${label}: cells within 60 of the darkest part of the sky they could sit on`);
  for (let v = 0; v < 8; v++) {
    const cells = new Uint8Array(W * H * STRIDE);
    const put = (x, y, kind, energy, flags) => { const o = (y * W + x) * STRIDE; cells[o] = kind; cells[o + 1] = v; cells[o + 2] = 144; cells[o + 3] = 1; cells[o + 4] = energy; cells[o + 6] = flags; };
    const cx = 10, cy = 12;
    put(cx, cy + 1, M.Stem, 20, 0); put(cx, cy + 2, M.Stem, 20, 0); put(cx, cy + 3, M.Stem, 20, F.Rooted);
    put(cx, cy, M.Flower, 180, F.Rooted);
    for (const [dx, dy] of shapes[v]) put(cx + dx, cy + dy, M.Flower, 150, 0);
    let sunk = 0, n = 0, worst = Infinity, worstAt = "";
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * STRIDE;
      if (cells[o] !== M.Flower) continue;
      const c = color({ kind: cells[o], variant: v, age: 400, energy: cells[o + 4], flags: cells[o + 6], time: 20000, cells, width: W, height: H, x, y });
      const d = Math.min(...sky.map((s) => redmean(c, s)));
      n++; if (d < 60) sunk++;
      if (d < worst) { worst = d; worstAt = `(${x - cx},${y - cy}) rgb ${c.slice(0, 3).map(Math.round)}`; }
    }
    console.log(`  ${names[v].padEnd(10)} ${String(sunk).padStart(3)} of ${n} cells sink; worst ${worst.toFixed(0)} at ${worstAt}`);
  }
}
