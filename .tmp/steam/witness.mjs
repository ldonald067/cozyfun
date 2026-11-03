// Scratch (2026-10-23): candidate audit witnesses for the billow. Per build and seed: the
// biggest 8-connected steam body seen, and ticks with a body of at least N cells.
// node .tmp/steam/witness.mjs <scene> <N> [seeds]   (builds: HEAD, tree, sab-nobillow, sab-hiss6)
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { build } from "./variant.mjs";
const [sname, nArg, seedsArg = "16"] = process.argv.slice(2);
const N = Number(nArg), seeds = Number(seedsArg);
const SC = {
  // A wall cup of water on a floor, a flame held to its surface for 15 s.
  kettle: { w: 40, h: 34, seed: 171, ticks: 400,
    paint: (p, M) => { for (let x = 10; x <= 30; x++) p(x, 30, 0, M.Wall); for (let y = 23; y <= 29; y++) { p(10, y, 0, M.Wall); p(30, y, 0, M.Wall); } p(20, 27, 3, M.Water); p(15, 27, 2, M.Water); p(25, 27, 2, M.Water); },
    act: (p, t, M) => { if (t < 300 && t % 4 === 0) p(20, 23, 2, M.Fire, 55); } },
  // The ember.quenched scene: a log lit, water poured two seconds later.
  ember: { w: 30, h: 26, seed: 110, ticks: 600,
    paint: (p, M) => { p(15, 20, 4, M.Wood); p(15, 16, 1, M.Fire); },
    act: (p, t, M) => { if (t === 40) p(15, 13, 4, M.Water); } },
};
const sc = SC[sname];
const builds = { HEAD: compileApp("steam-w-head", ["engine.ts", "materials.ts"], { root: resolve(import.meta.dirname, "base") }) };
const engines = { HEAD: { create: builds.HEAD.load("engine").createFallbackEngine, M: builds.HEAD.load("materials").MATERIAL } };
for (const v of ["live", "sab-nobillow", "sab-hiss6"]) engines[v === "live" ? "tree" : v] = build(v);
for (const [label, { create, M }] of Object.entries(engines)) {
  const res = [];
  for (let s = 0; s < seeds; s++) {
    const e = create(sc.w, sc.h, sc.seed + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    sc.paint(p, M);
    let biggest = 0, ticksBig = 0;
    for (let t = 1; t <= sc.ticks; t++) {
      sc.act(p, t, M); e.tick();
      const b = e.getCellBytes(), W = sc.w, seen = new Uint8Array(W * sc.h);
      let big = 0;
      for (let i = 0; i < W * sc.h; i++) {
        if (b[i * 8] !== M.Steam || seen[i]) continue;
        const stack = [i]; seen[i] = 1; let n = 0;
        while (stack.length) { const c = stack.pop(); n++; const x = c % W, y = (c / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= sc.h) continue; const j = ny * W + nx; if (!seen[j] && b[j * 8] === M.Steam) { seen[j] = 1; stack.push(j); } } }
        big = Math.max(big, n);
      }
      biggest = Math.max(biggest, big); if (big >= N) ticksBig++;
    }
    res.push([biggest, ticksBig]);
  }
  const pass = res.filter(([, t]) => t >= 30).length;
  console.log(`${label.padEnd(13)} bodies>=${N} for 30+ ticks on ${pass}/${seeds}; biggest ${res.map((r) => r[0]).join(",")}; ticks ${res.map((r) => r[1]).join(",")}`);
}
