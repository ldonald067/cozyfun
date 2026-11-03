import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("neg-probe", ["materials.ts", "engine.ts"]);
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M } = app.load("materials");
const W = 40, H = 30, S = 8;
const e = createFallbackEngine(W, H, 7);
const bytes = e.getCellBytes();
const put = (x, y, k, age = 0, energy = 0, flags = 0, variant = 0) => { const o = (y * W + x) * S; bytes[o] = k; bytes[o + 1] = variant; bytes[o + 2] = age & 255; bytes[o + 3] = age >> 8; bytes[o + 4] = energy & 255; bytes[o + 5] = energy >> 8; bytes[o + 6] = flags; };
for (let x = 0; x < 40; x++) { put(x, 28, M.Wall); put(x, 29, M.Wall); }
put(10, 21, M.Wall);
for (let y = 2; y < 21; y++) put(10, y, M.Flower, 30, 150, 0, 2);
for (let y = 2; y < 8; y++) put(11, y, M.Pollen, 30, 150, 0, 3);
e.loadCellBytes(bytes);
for (let t = 0; t < 300; t++) {
  const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
  for (let i = 0; i < a.length; i += S) if (a[i] === M.Seed && b[i] !== M.Seed) { const c = i / S; console.log(`tick ${t}: seed at (${c % W},${Math.floor(c / W)}) was kind ${b[i]} variant ${b[i + 1]} -> variant ${a[i + 1]}`); }
}
