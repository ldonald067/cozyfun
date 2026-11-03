import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("claim-probe", ["materials.ts", "engine.ts"]);
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const W = 16, S = 8;
const e = createFallbackEngine(16, 16, 13);
const b = e.getCellBytes();
const put = (x, y, k, age = 0, energy = 0, flags = 0) => { const o = (y * W + x) * S; b[o] = k; b[o + 1] = 0; b[o + 2] = age; b[o + 4] = energy & 255; b[o + 5] = energy >> 8; b[o + 6] = flags; };
for (let x = 0; x < 16; x++) put(x, 10, M.Wall);
put(7, 9, M.Moss, 40, 200, F.Wet); put(8, 9, M.Soil, 16, 250, F.Wet); put(8, 8, M.Seed, 40, 200, F.Wet | F.Rooted); put(8, 7, M.Wall);
e.loadCellBytes(b);
const names = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
for (let t = 1; t <= 300; t++) {
  const before = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
  for (let i = 0; i < a.length; i += S) if (a[i] !== before[i] && (a[i] === M.Moss || before[i] === M.Seed)) { const c = i / S; console.log(`t${t} (${c % W},${Math.floor(c / W)}) ${names[before[i]]} -> ${names[a[i]]} energy ${a[i + 4] | (a[i + 5] << 8)}`); }
  if (a[(9 * W + 8) * S] === M.Moss) { console.log("claimed soil became moss at", t); break; }
}
