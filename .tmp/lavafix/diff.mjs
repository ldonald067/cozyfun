// Scratch: at the tick lava+rock drops, the census difference and every in-place change from a rock kind (lava excepted) to another kind.
import { CHECKS, jsEngine, M } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const c = CHECKS.find((k) => k.role === "a quench keeps every cell of the pour as rock");
const engine = jsEngine(compileApp("lavafix-tree", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const name = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
const ROCK = [M.Lava, M.Stone, M.Sand, M.Glass];
for (const seed of process.argv.slice(2).map(Number)) {
  const u = engine.create(c.w, c.h, seed);
  c.paint((x, y, r, m, d = 100) => u.paint(x, y, r, m, d));
  for (let x = 1; x < c.w; x += 3) u.paint(x, c.h - 4, 1, M.Wall, 100);
  const kinds = () => { const v = u.view(); return Array.from({ length: c.w * c.h }, (_, i) => v[i * 8]); };
  const census = (a) => { const k = {}; for (const q of a) k[name[q]] = (k[name[q]] ?? 0) + 1; return k; };
  let prev = kinds();
  for (let t = 1; t <= c.ticks; t++) {
    u.tick(); const now = kinds();
    const n = (a) => a.filter((q) => ROCK.includes(q)).length;
    if (n(now) < n(prev)) {
      const a = census(prev), b = census(now), d = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[k] ?? 0) !== (b[k] ?? 0)) d[k] = (b[k] ?? 0) - (a[k] ?? 0);
      console.log(`seed ${seed} tick ${t}:`, JSON.stringify(d));
      for (let i = 0; i < now.length; i++) if (prev[i] !== now[i] && ROCK.includes(prev[i]) && prev[i] !== M.Lava) console.log(`  ${i % c.w},${(i / c.w) | 0}: ${name[prev[i]]} -> ${name[now[i]]}`);
      break;
    }
    prev = now;
  }
  u.free();
}
