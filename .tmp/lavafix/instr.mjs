// Scratch: replay the leaking seeds on the instrumented engine; print what wrote over lava on the tick lava+rock dropped.
import { resolve } from "node:path";
import { CHECKS, jsEngine, M } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const c = CHECKS.find((k) => k.role === "a quench keeps every cell of the pour as rock");
const engine = jsEngine(compileApp("lavafix-instr", ["engine.ts", "materials.ts"], { root: resolve(".tmp/lavafix/instr") }).load("engine").createFallbackEngine);
const ROCK = [M.Lava, M.Stone, M.Sand, M.Glass];
for (const seed of process.argv.slice(2).map(Number)) {
  const u = engine.create(c.w, c.h, seed);
  c.paint((x, y, r, m, d = 100) => u.paint(x, y, r, m, d));
  for (let x = 1; x < c.w; x += 3) u.paint(x, c.h - 4, 1, M.Wall, 100);
  const count = () => { const v = u.view(); let n = 0; for (let i = 0; i < v.length; i += 8) if (ROCK.includes(v[i])) n++; return n; };
  let before = count();
  for (let t = 1; t <= c.ticks; t++) {
    globalThis.__hits = []; globalThis.__watch = true;
    u.tick(); globalThis.__watch = false;
    const now = count();
    if (now < before) { console.log(`seed ${seed} tick ${t}: ${before} -> ${now}`); console.log(globalThis.__hits.join("\n---\n") || "  (no write over lava seen)"); break; }
    before = now;
  }
  u.free();
}
