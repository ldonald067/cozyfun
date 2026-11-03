// Scratch (2026-10-28): when are shed petals (pollen marked rooted) in a painted meadow?
// node .tmp/petals/probe.mjs [scene] [seed]
import { compileApp } from "../../scripts/compile-app.mjs";
import { FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../film/scenes.mjs";
const [name = "garden-life", seedArg] = process.argv.slice(2);
const scene = SCENES[name];
const make = compileApp("petal-probe", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine;
const e = make(scene.w, scene.h, Number(seedArg ?? scene.seed));
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
scene.paint(p);
for (let x = 1; x < scene.w; x += 3) p(x, scene.h - FLOOR_FROM_BOTTOM, 1, 1);
const rows = [];
for (let t = 1; t <= 6000; t++) {
  if (scene.act) scene.act(p, t);
  e.tick();
  if (t % 100) continue;
  const c = e.getCellBytes();
  let fall = 0, lie = 0, puff = 0, head = 0;
  for (let i = 0; i < scene.w * scene.h; i++) {
    const k = c[i * 8];
    if (k === 19) head++;
    if (k !== 22) continue;
    if (!(c[i * 8 + 6] & 2)) { puff++; continue; }
    const below = i + scene.w < scene.w * scene.h ? c[(i + scene.w) * 8] : 1;
    below === 0 ? fall++ : lie++;
  }
  rows.push(`${t}: heads ${head} puffs ${puff} petals falling ${fall} lying ${lie}`);
}
console.log(rows.join("\n"));
