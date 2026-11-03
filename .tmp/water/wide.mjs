// Scratch: a pour at the app's default brush. Of the water cells truly airborne (open sky under
// them, above the pond), how many get the streak branch; and does foam show where they land?
import { compileApp } from "../../scripts/compile-app.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
const { createFallbackEngine } = compileApp("water-w", ["engine.ts", "materials.ts"]).load("engine");
const [R, DENS] = [Number(process.argv[2] ?? 4), Number(process.argv[3] ?? 35)];
const W = 96, H = 56;
for (const seed of [1, 2, 3]) {
  const e = createFallbackEngine(W, H, seed), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  for (let x = 10; x <= 86; x++) p(x, 52, 0, M.Wall); for (let y = 30; y <= 52; y++) { p(10, y, 0, M.Wall); p(86, y, 0, M.Wall); }
  let tot = 0, streak = 0, wideRun = 0;
  for (let t = 1; t <= 300; t++) {
    if (t % 3 === 0) p(48, 8, R, M.Water, DENS); e.tick();
    if (t < 120 || t % 20) continue;
    const c = e.getCellBytes(), k = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : c[(y * W + x) * 8]);
    // Pond top: the highest row with water in a full run across the middle.
    for (let y = 2; y < 30; y++) for (let x = 12; x < 85; x++) {
      if (k(x, y) !== M.Water) continue; tot++;
      const l = k(x - 1, y) === M.Water, r = k(x + 1, y) === M.Water, below = k(x, y + 1), above = k(x, y - 1);
      const open = (k(x - 1, y) === M.Empty && !r) || (k(x + 1, y) === M.Empty && !l);
      if (below === M.Empty || (!l && !r && above === M.Water && below === M.Water && open)) streak++; else if (l || r) wideRun++;
    }
  }
  console.log(`seed ${seed} r${R} d${DENS}: airborne ${tot}, drawn as falling ${(100 * streak / tot).toFixed(0)}%, side-by-side with water and supported by water ${(100 * wideRun / tot).toFixed(0)}%`);
}
