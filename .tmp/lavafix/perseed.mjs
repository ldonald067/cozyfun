// Scratch: rock kept per lava cell poured at 1200 ticks, per seed, for the lava-quench scene on one engine root.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../review/cmpscenes.mjs";
const [root = ".", n = "32"] = process.argv.slice(2);
const engine = compileApp(`lps-${root.replace(/\W/g, "")}`, ["engine.ts", "materials.ts"], { root: resolve(root) }).load("engine").createFallbackEngine;
const s = SCENES["lava-quench"], out = [];
for (let seed = 1; seed <= Number(n); seed++) {
  const e = engine(s.w, s.h, seed); s.paint((x, y, r, m, d = 100) => e.paint(x, y, r, m, d));
  for (let t = 0; t < 1200; t++) e.tick();
  const c = e.getCellBytes(); let rock = 0; for (let i = 0; i < c.length; i += 8) if (c[i] === M.Stone || c[i] === M.Sand) rock++;
  out.push([seed, rock]); e.dispose();
}
out.sort((a, b) => a[1] - b[1]);
console.log(out.map(([s, r]) => `${s}:${r}`).join(" "));
