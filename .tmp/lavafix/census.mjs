// Scratch: lava-quench over N seeds; per seed, lava poured vs rock at 1200 ticks, and a census of non-rock kinds.
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../review/cmpscenes.mjs";
const [root = ".", n = "32", ticks = "1200"] = process.argv.slice(2);
const engine = compileApp(`lf-${root.replace(/\W/g, "")}`, ["engine.ts", "materials.ts"], { root: resolve(root) }).load("engine").createFallbackEngine;
const name = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
const s = SCENES["lava-quench"];
for (let seed = 1; seed <= Number(n); seed++) {
  const e = engine(s.w, s.h, seed); s.paint((x, y, r, m, d = 100) => e.paint(x, y, r, m, d));
  const census = () => { const c = e.getCellBytes(), k = {}; for (let i = 0; i < c.length; i += 8) k[name[c[i]]] = (k[name[c[i]]] ?? 0) + 1; return k; };
  const a = census();
  let minRock = Infinity;
  for (let t = 0; t < Number(ticks); t++) { e.tick(); const c = census(); const r = (c.Lava ?? 0) + (c.Stone ?? 0) + (c.Sand ?? 0) + (c.Glass ?? 0); minRock = Math.min(minRock, r); }
  const b = census();
  const rock = (b.Stone ?? 0) + (b.Sand ?? 0);
  if (rock < a.Lava) console.log(seed, `lava ${a.Lava} -> stone ${b.Stone ?? 0} sand ${b.Sand ?? 0} glass ${b.Glass ?? 0} lava ${b.Lava ?? 0}; min lava+rock ${minRock}; water ${a.Water}->${b.Water ?? 0}`);
  e.dispose();
}
