// Scratch: real pours, every brush size: how much airborne water draws darker than the 85 floor?
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const { createFallbackEngine } = compileApp("water-ad", ["engine.ts", "materials.ts"]).load("engine");
const { colorForCell } = loadRenderer("water-ad-r");
const W = 120, H = 90, lum = ([r, g, b]) => r * .3 + g * .59 + b * .11;
const run = (label, setup, pour) => { for (const seed of [1, 2, 3]) {
  const e = createFallbackEngine(W, H, seed), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  setup(p); let air = 0, dark = 0, worst = 999;
  for (let t = 1; t <= 500; t++) { pour(p, t); e.tick();
    if (t < 80 || t % 10) continue;
    const c = e.getCellBytes(), k = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : c[(y * W + x) * 8]);
    for (let y = 2; y < 66; y++) for (let x = 2; x < W - 2; x++) {
      if (k(x, y) !== M.Water) continue;
      // Airborne: open air somewhere under it in this column, before anything solid.
      let yy = y + 1; while (k(x, yy) === M.Water) yy++; if (k(x, yy) !== M.Empty) continue;
      let open = false; for (let d = yy; d < yy + 3; d++) if (k(x, d) === M.Empty) open = true; if (!open) continue;
      air++; const o = (y * W + x) * 8; const l = lum(colorForCell({ kind: M.Water, variant: c[o + 1], age: 0, energy: c[o + 4] | (c[o + 5] << 8), flags: 0, time: 0, cells: c, width: W, height: H, x, y }));
      if (l < 85) dark++; worst = Math.min(worst, l);
    } }
  console.log(label.padEnd(26), `seed ${seed}: airborne ${air}, under 85: ${dark} (${(100 * dark / Math.max(1, air)).toFixed(2)}%), darkest ${worst.toFixed(0)}`);
} };
const floor = (p) => { for (let x = 4; x <= 116; x++) p(x, 84, 0, M.Wall); };
for (const r of [1, 4, 8, 12]) run(`held brush r${r} d55`, floor, (p, t) => { if (t % 3 === 0) p(60, 8, r, M.Water, 55); });
run("swept brush r4 d55", floor, (p, t) => { p(30 + (t * 2) % 60, 8, 4, M.Water, 55); });
run("wellspring on water", (p) => { floor(p); for (let x = 56; x <= 64; x++) for (let y = 6; y <= 8; y++) p(x, y, 0, M.Wellspring); }, (p, t) => { if (t < 30) p(60, 3, 1, M.Water, 100); });
