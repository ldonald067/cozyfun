// Scratch: where and when petal motes are, per 10 ticks, in a film scene. node .tmp/petals/where.mjs <scene> <from> <to>
import { compileApp } from "../../scripts/compile-app.mjs";
import { FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../film/scenes.mjs";
const [name, from, to, seedArg] = process.argv.slice(2);
const scene = SCENES[name];
const e = compileApp("petal-probe", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine(scene.w, scene.h, Number(seedArg ?? scene.seed));
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
scene.paint(p);
for (let x = 1; x < scene.w; x += 3) p(x, scene.h - FLOOR_FROM_BOTTOM, 1, 1);
for (let t = 1; t <= Number(to); t++) {
  if (scene.act) scene.act(p, t);
  e.tick();
  if (t < Number(from) || t % 10) continue;
  const c = e.getCellBytes(), at = [];
  for (let i = 0; i < scene.w * scene.h; i++) if (c[i * 8] === 22 && c[i * 8 + 6] & 2) at.push(`${i % scene.w},${Math.floor(i / scene.w)}:${c[i * 8 + 1] & 7}${c[(i + scene.w) * 8] === 0 ? "f" : ""}`);
  if (at.length) console.log(t, at.join(" "));
}
