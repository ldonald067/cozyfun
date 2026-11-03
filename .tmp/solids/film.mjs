// Scratch (2026-10-31): the seven solids beside `main`, same engine and dice, painted with the app's brush.
// Left to right: stone outcrop, poured sand, soil bed, wood beam, ice block, wall with a glass pane.
// Rain falls on the sand and soil's right halves, then a flame touches the beam's end.
// node .tmp/solids/film.mjs [seed] -> frames.raw/json, then python3 .tmp/solids/sheet.py
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), seed = Number(process.argv[2] ?? 11);
const { createFallbackEngine } = compileApp("solids-film", ["engine.ts", "materials.ts"]).load("engine");
const LOOKS = [["Today", ".tmp/solids/base"], ["Build", "."]].map(([label, root], i) => ({ label, color: loadRenderer("solids-film" + i, resolve(repo, root)).colorForCell }));
const W = 128, H = 80, S = 4, PW = W * S, PH = H * S;
const e = createFallbackEngine(W, H, seed), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
for (let x = 0; x < W; x += 2) p(x, 77, 2, M.Wall);
for (let x = 5; x <= 25; x += 2) p(x, Math.round(66 + Math.abs(x - 15) * 0.7), 5, M.Stone);
for (let t = 0; t < 26; t++) { p(40, 30, 4, M.Sand, 55); e.tick(); }
for (let y = 46; y <= 74; y++) p(58, y, 0, M.Wall);
for (let x = 62; x <= 73; x++) p(x, 68, 5, M.Soil);
for (let y = 64; y <= 74; y++) { p(78, y, 0, M.Wall); p(94, y, 0, M.Wall); }
for (let x = 76; x <= 96; x++) for (let y = 55; y <= 62; y++) p(x, y, 1, M.Wood);
for (let x = 101; x <= 111; x++) for (let y = 56; y <= 73; y++) p(x, y, 1, M.Ice);
for (let y = 40; y <= 74; y++) for (let x = 115; x <= 125; x++) p(x, y, 1, M.Wall);
for (let y = 46; y <= 58; y++) for (let x = 119; x <= 121; x++) p(x, y, 1, M.Glass);
p(86, 47, 4, M.Wood, 55); p(106, 49, 3, M.Ice, 55);
const act = (t) => {
  if (t >= 170 && t < 200 && t % 3 === 0) p(13, 28, 3, M.Stone, 55);
  if (t >= 120 && t < 170 && t % 6 === 0) p(52, 30, 1, M.Water, 6);
  if (t >= 300 && t < 312 && t % 4 === 0) p(72, 40, 2, M.Water, 20);
  if (t >= 280 && t < 292 && t % 4 === 0) p(96, 53, 1, M.Fire, 55);
};
const SHOTS = [...Array(80).keys()].map((i) => 100 + i * 3);
const out = Buffer.alloc(SHOTS.length * 2 * PW * PH * 3);
let t = 0;
SHOTS.forEach((at, f) => {
  while (t < at) { t++; act(t); e.tick(); }
  const cells = e.getCellBytes();
  LOOKS.forEach(({ color }, panel) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 8, kind = cells[o];
      const c = kind ? color({ kind, variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: at * 50, cells, width: W, height: H, x, y }) : [14, 18, 36];
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const q = (((f * 2 + panel) * PH + y * S + dy) * PW + x * S + dx) * 3; for (let i = 0; i < 3; i++) out[q + i] = Math.max(0, Math.min(255, Math.round(c[i]))); }
    }
  });
});
writeFileSync(resolve(repo, ".tmp/solids/frames.raw"), out);
writeFileSync(resolve(repo, ".tmp/solids/frames.json"), JSON.stringify({ PW, PH, FRAMES: SHOTS.length, PANELS: 2, labels: LOOKS.map((l) => l.label), fps: 10 }));
console.log("frames", SHOTS.length);
