// Scratch (2026-10-30): the heat batch beside `main`, same engine and dice. A log fire under a
// shelf of smoke room, a lava pool with water poured on one end. Moving, for the owner.
// node .tmp/heat2/film.mjs [seed] -> frames.raw/json, then python3 .tmp/heat2/sheet.py
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), seed = Number(process.argv[2] ?? 11);
const { createFallbackEngine } = compileApp("heat-film", ["engine.ts", "materials.ts"]).load("engine");
const LOOKS = [["Today", ".tmp/heat2/base"], ["Tuned", "."]].map(([label, root], i) => ({ label, color: loadRenderer("heat-film" + i, resolve(repo, root)).colorForCell }));
const W = 96, H = 72, S = 4, PW = W * S, PH = H * S;
const e = createFallbackEngine(W, H, seed), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
for (let x = 2; x <= 94; x++) p(x, 68, 0, M.Stone);
for (let x = 10; x <= 30; x++) for (let y = 60; y <= 66; y++) p(x, y, 0, M.Wood);
for (let y = 52; y <= 68; y++) { p(50, y, 0, M.Stone); p(90, y, 0, M.Stone); }
for (let x = 53; x <= 87; x++) for (let y = 56; y <= 66; y++) p(x, y, 0, M.Lava);
const act = (t) => { if (t >= 90 && t % 3 === 0) p(20, 56, 4, M.Fire, 55); if (t >= 150 && t < 210 && t % 3 === 0) p(80, 40, 1, M.Water); };
const SHOTS = [...Array(80).keys()].map((i) => 120 + i * 2);
const out = Buffer.alloc(SHOTS.length * 2 * PW * PH * 3);
let t = 0;
SHOTS.forEach((at, f) => {
  while (t < at) { t++; act(t); e.tick(); }
  const cells = e.getCellBytes();
  LOOKS.forEach(({ color }, panel) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 8;
      const c = color({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: at * 50, cells, width: W, height: H, x, y });
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const q = (((f * 2 + panel) * PH + y * S + dy) * PW + x * S + dx) * 3; for (let i = 0; i < 3; i++) out[q + i] = Math.max(0, Math.min(255, Math.round(c[i]))); }
    }
  });
});
writeFileSync(resolve(repo, ".tmp/heat2/frames.raw"), out);
writeFileSync(resolve(repo, ".tmp/heat2/frames.json"), JSON.stringify({ PW, PH, FRAMES: SHOTS.length, PANELS: 2, labels: LOOKS.map((l) => l.label), fps: 10 }));
console.log("frames", SHOTS.length);
