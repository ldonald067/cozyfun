// Scratch: play the "keeps every cell" check on the tree over N seeds; at the first tick lava+rock drops, print the
// kinds around every cell lava left (prev lava, now not lava/rock), before and after.
import { CHECKS, jsEngine, M } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const c = CHECKS.find((k) => k.role === "a quench keeps every cell of the pour as rock");
const engine = jsEngine(compileApp("lavafix-tree", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const name = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k[0] + (k[1] ?? "")]));
const ROCK = [M.Lava, M.Stone, M.Sand, M.Glass];
for (let k = 0; k < Number(process.argv[2] ?? 32); k++) {
  const u = engine.create(c.w, c.h, c.seed + k * 1000);
  c.paint((x, y, r, m, d = 100) => u.paint(x, y, r, m, d));
  for (let x = 1; x < c.w; x += 3) u.paint(x, c.h - 4, 1, M.Wall, 100);
  const kinds = () => { const v = u.view(); return Array.from({ length: c.w * c.h }, (_, i) => v[i * 8]); };
  const count = (a) => a.filter((q) => ROCK.includes(q)).length;
  let prev = kinds(); const n0 = prev.filter((q) => q === M.Lava).length;
  for (let t = 1; t <= c.ticks; t++) {
    u.tick(); const now = kinds();
    if (count(now) < count(prev)) {
      console.log(`seed ${c.seed + k * 1000} tick ${t}: ${count(prev)} -> ${count(now)} (painted ${n0})`);
      for (let i = 0; i < now.length; i++) if (prev[i] === M.Lava && !ROCK.includes(now[i])) {
        const x = i % c.w, y = (i / c.w) | 0;
        const win = (a) => [-2, -1, 0, 1, 2].map((dy) => [-3, -2, -1, 0, 1, 2, 3].map((dx) => (name[a[(y + dy) * c.w + x + dx]] ?? "--").padEnd(2)).join(" "));
        const a = win(prev), b = win(now);
        console.log(`  cell ${x},${y}: prev | now`); for (let r = 0; r < 5; r++) console.log(`   ${a[r]}   |   ${b[r]}`);
      }
      break;
    }
    prev = now;
  }
  u.free();
}
