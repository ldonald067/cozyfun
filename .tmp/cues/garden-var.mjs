// The audit's own scene (its floor and paint order), across seeds, for an engine variant dir.
import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const dir = process.argv[2];
const app = compileApp("gv-" + dir.replace(/\W/g, ""), ["materials.ts", "engine.ts"], { root: resolve(dir) });
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const W = 80, H = 40, S = 8, N = Number(process.argv[3] ?? 16);
const fl = (c, i) => c[i + 6] | (c[i + 7] << 8);
let pass = 0, motesAll = 0, pollAll = 0;
for (let k = 0; k < N; k++) {
  const e = createFallbackEngine(W, H, 102 + k * 1000);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 4; x <= 76; x++) p(x, 36, 3, M.Soil, 55);
  p(40, 31, 1, M.Seed); p(40, 26, 3, M.Water);
  for (let x = 1; x < W; x += 3) p(x, H - 2, 1, M.Wall);
  const landed = new Set(); let sown = 0, motes = 0, poll = 0;
  for (let t = 1; t <= 6000 && !sown; t++) {
    if (t % 400 === 200) for (let x = 6; x <= 74; x += 3) p(x, 20, 1, M.Water, 30);
    const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
    for (let i = 0; i < a.length; i += S) {
      if (a[i] === M.Pollen && b[i] !== M.Pollen && b[i] === M.Empty) motes++;
      if (b[i] === M.Pollen && a[i] === M.Seed) poll++;
      if (b[i] === M.Seed && a[i] === M.Seed && fl(b, i) & F.Windborne && !(fl(a, i) & F.Windborne)) landed.add(i);
      if (b[i] === M.Seed && a[i] === M.Stem && landed.has(i)) sown++;
    }
  }
  if (sown) pass++; motesAll += motes; pollAll += poll;
}
console.log(`${dir}: sown on ${pass}/${N}; pollinated ${pollAll} of ~${motesAll} mote moves-in (rough)`);
