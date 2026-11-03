// Scratch (2026-10-20): the heat batch's three pictures, base (HEAD) vs working tree, N seeds.
// node .tmp/heat/probe.mjs [seeds] [scene]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SCENES } from "./scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [seedsArg = "8", only] = process.argv.slice(2);
const seeds = Number(seedsArg);
const builds = {
  base: compileApp("heat-base", ["engine.ts", "materials.ts"], { root: resolve(repo, ".tmp/film/base") }),
  now: compileApp("heat-now", ["engine.ts", "materials.ts"]),
};
const M = builds.now.load("materials").MATERIAL;
const S = 8;
function stats(bytes, w, box) {
  const out = { ice: 0, water: 0, hot: 0, steam: 0, frozen: 0, lava: 0, stone: 0, sumE: 0 };
  for (let i = 0, c = 0; i < bytes.length; i += S, c++) {
    const x = c % w, y = Math.floor(c / w);
    if (box && (x < box[0] || x > box[2] || y < box[1] || y > box[3])) continue;
    const k = bytes[i], e = bytes[i + 4] | (bytes[i + 5] << 8), f = bytes[i + 6];
    if (k === M.Ice) out.ice++;
    if (k === M.Water) { out.water++; out.sumE += e; if (e > 120) out.hot++; }
    if (k === M.Steam) out.steam++;
    if (k === M.Lava) out.lava++;
    if (k === M.Stone) out.stone++;
    if (f & 8) out.frozen++;
  }
  return out;
}
for (const [name, scene] of Object.entries(SCENES)) {
  if (only && name !== only) continue;
  console.log(`\n== ${name}: ${scene.note}`);
  for (const [label, app] of Object.entries(builds)) {
    const { createFallbackEngine } = app.load("engine");
    const rows = [];
    for (let s = 0; s < seeds; s++) {
      const e = createFallbackEngine(scene.w, scene.h, scene.seed + s);
      const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
      scene.paint(p, M);
      for (let x = 1; x < scene.w; x += 3) p(x, scene.h - 2, 1, M.Wall);
      const cols = [];
      let t = 0;
      for (const at of scene.at) {
        while (t < at) { t++; scene.act?.(p, t, M); e.tick(); }
        cols.push(scene.show(stats(e.getCellBytes(), scene.w, scene.box)));
      }
      rows.push(cols.join(" | "));
      e.dispose?.();
    }
    console.log(`  ${label}  t=${scene.at.join(",")}`);
    for (const r of rows) console.log(`    ${r}`);
  }
}
