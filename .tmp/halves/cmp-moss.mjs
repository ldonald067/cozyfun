// Scratch: tick at which the plank is fully mossed, real vs moss-no-burst, on the JS mirror.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { jsEngine, grid, M, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "./sabotages.mjs";
const repo = resolve(import.meta.dirname, "../..");
const base = jsEngine(compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine);
const root = resolve(repo, ".tmp/halves/root-moss-no-burst");
const mut = jsEngine(compileApp("halves-moss-no-burst", ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine);
const scenes = {
  disc: { w: 30, h: 26, paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); } },
  plank: { w: 40, h: 28, paint: (p) => { for (let y = 16; y <= 21; y++) for (let x = 6; x <= 34; x++) p(x, y, 0, M.Wood); p(7, 15, 0, M.Moss); }, act: (p, t) => { if (t < 200 && t % 3 === 0) p(7 + Math.floor(t / 8), 10, 1, M.Water); } },
  dryish: { w: 40, h: 28, paint: (p) => { for (let y = 16; y <= 21; y++) for (let x = 6; x <= 34; x++) p(x, y, 0, M.Wood); p(7, 15, 0, M.Moss); p(7, 12, 1, M.Water); } },
};
for (const [name, sc] of Object.entries(scenes)) for (const [label, engine] of [["real", base], ["no-burst", mut]]) {
  const done = [], at50 = [];
  for (let k = 0; k < 8; k++) {
    const uni = engine.create(sc.w, sc.h, 150 + k * 1000);
    const p = (x, y, r, mat, d = 100) => uni.paint(x, y, r, mat, d);
    sc.paint(p); for (let x = 1; x < sc.w; x += 3) p(x, sc.h - FLOOR_FROM_BOTTOM, 1, M.Wall);
    const wood0 = grid(uni.view(), sc.w, sc.h).count(M.Wood);
    let d = -1, h = -1;
    for (let t = 1; t <= 2000 && d < 0; t++) { if (sc.act) sc.act(p, t); uni.tick(); const w = grid(uni.view(), sc.w, sc.h).count(M.Wood); if (h < 0 && w <= wood0 / 2) h = t; if (w === 0) d = t; }
    done.push(d); at50.push(h); uni.free();
  }
  console.log(name.padEnd(7), label.padEnd(9), "half at", at50.join(" "), "| all at", done.join(" "));
}
