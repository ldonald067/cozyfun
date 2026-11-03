// Scratch: what the build actually drew, by state, on a pour and on the settled pond. Classifies
// by the pixel: how far each water cell's colour swings over a full cycle of the clock.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M, redmeanDistance as rd } from "../../scripts/interaction-scenes.mjs";
const { createFallbackEngine } = compileApp("water-c", ["engine.ts", "materials.ts"]).load("engine");
const build = loadRenderer("water-c-new").colorForCell;
const W = 96, H = 56;
for (const seed of [11, 12, 13]) {
  const e = createFallbackEngine(W, H, seed), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
  for (let x = 4; x <= 40; x++) p(x, 20, 0, M.Wall); for (let y = 15; y <= 20; y++) p(4, y, 0, M.Wall);
  for (let x = 30; x <= 90; x++) p(x, 52, 0, M.Wall); for (let y = 36; y <= 52; y++) { p(30, y, 0, M.Wall); p(90, y, 0, M.Wall); }
  for (let t = 1; t <= 1600; t++) {
    if (t <= 480 && t % 3 === 0) p(12, 8, 1, M.Water); e.tick();
    if (t !== 470 && t !== 1600) continue;
    const c = e.getCellBytes(), W8 = (x, y) => (y * W + x) * 8, col = (x, y, time) => build({ kind: c[W8(x, y)], variant: c[W8(x, y) + 1], age: 0, energy: c[W8(x, y) + 4] | (c[W8(x, y) + 5] << 8), flags: c[W8(x, y) + 6], time, cells: c, width: W, height: H, x, y });
    const kindAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : c[W8(x, y)]);
    let air = 0, thread = 0, top = 0, body = 0, swAir = 0, swBody = 0, swTop = 0, foam = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (kindAt(x, y) !== M.Water) continue;
      const a = col(x, y, 1000); let sw = 0; for (let ms = 60; ms < 4000; ms += 60) sw = Math.max(sw, rd(a, col(x, y, 1000 + ms)));
      const lum = a[0] * .3 + a[1] * .6 + a[2] * .1; let minL = lum; for (let ms = 60; ms < 4000; ms += 60) { const q = col(x, y, 1000 + ms); minL = Math.min(minL, q[0] * .3 + q[1] * .6 + q[2] * .1); }
      if (minL > 215) foam++;
      if (kindAt(x, y + 1) === M.Empty) { air++; swAir += sw; }
      else if (kindAt(x - 1, y) !== M.Water && kindAt(x + 1, y) !== M.Water && kindAt(x, y + 1) === M.Water) { thread++; swAir += sw; }
      else if (kindAt(x, y - 1) !== M.Water) { top++; swTop += sw; } else { body++; swBody += sw; }
    }
    console.log(`seed ${seed} t ${t}: air ${air} thread ${thread} surface ${top} body ${body} foam ${foam}; mean swing falling ${(swAir / Math.max(1, air + thread)).toFixed(0)} surface ${(swTop / Math.max(1, top)).toFixed(0)} body ${(swBody / Math.max(1, body)).toFixed(0)}`);
  }
}
