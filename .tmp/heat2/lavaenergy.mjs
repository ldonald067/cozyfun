import { compileApp } from "../../scripts/compile-app.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
const { createFallbackEngine } = compileApp("heat-le", ["engine.ts", "materials.ts"]).load("engine");
const W = 60, H = 40, e = createFallbackEngine(W, H, 3), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
for (let x = 2; x <= 56; x++) p(x, 36, 0, M.Stone);
for (let y = 22; y <= 36; y++) { p(4, y, 0, M.Stone); p(54, y, 0, M.Stone); }
for (let x = 8; x <= 50; x++) for (let y = 28; y <= 33; y++) p(x, y, 0, M.Lava);
for (const stop of [1, 200, 800, 2000, 4000]) { while ((e.t ?? 0) < 0) {} }
let t = 0; for (const stop of [1, 200, 800, 2000, 4000]) { while (t < stop) { t++; e.tick(); }
  const c = e.getCellBytes(), hist = {}; let n = 0; for (let i = 0; i < W * H; i++) if (c[i * 8] === M.Lava) { n++; const en = c[i * 8 + 4] | (c[i * 8 + 5] << 8); const b = en === 0 ? "0" : en < 64 ? "1-63" : en < 128 ? "64-127" : en < 200 ? "128-199" : "200+"; hist[b] = (hist[b] || 0) + 1; }
  console.log("t", stop, "lava", n, JSON.stringify(hist)); }
