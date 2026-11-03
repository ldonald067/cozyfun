// Scratch (2026-10-30): moonwater and oil beside `main`, same engine and dice. Left basin: a moonwater
// pool with water poured in. Middle: a deep oil pool. Right: a thin slick on a pond and on soil.
// node .tmp/moonoil/film.mjs [seed] -> frames.raw/json, then python3 .tmp/moonoil/sheet.py
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), seed = Number(process.argv[2] ?? 11);
const { createFallbackEngine } = compileApp("moonoil-film", ["engine.ts", "materials.ts"]).load("engine");
const LOOKS = [["Today", ".tmp/moonoil/base"], ["Build", "."]].map(([label, root], i) => ({ label, color: loadRenderer("moonoil-film" + i, resolve(repo, root)).colorForCell }));
const W = 128, H = 80, S = 3, PW = W * S, PH = H * S;
const e = createFallbackEngine(W, H, seed), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
for (let x = 2; x <= 125; x++) p(x, 76, 0, M.Stone);
for (const wall of [46, 84]) for (let y = 40; y <= 76; y++) p(wall, y, 0, M.Stone);
for (let y = 40; y <= 76; y++) { p(3, y, 0, M.Stone); p(124, y, 0, M.Stone); }
for (let x = 6; x <= 44; x += 2) for (let y = 48; y <= 73; y += 2) p(x, y, 1, x < 28 ? M.Moonwater : M.Water);
for (let x = 49; x <= 82; x += 2) for (let y = 52; y <= 73; y += 2) p(x, y, 1, M.Oil);
for (let x = 87; x <= 104; x += 2) for (let y = 62; y <= 73; y += 2) p(x, y, 1, M.Water);
for (let x = 106; x <= 122; x += 2) p(x, 73, 1, M.Soil);
const act = (t) => { if (t >= 60 && t < 100 && t % 8 === 0) { p(92 + (t % 3) * 4, 50, 2, M.Oil, 55); p(112 + (t % 3) * 3, 56, 2, M.Oil, 55); } if (t >= 200 && t < 260 && t % 3 === 0) p(16, 30, 2, M.Moonwater, 55); };
const SHOTS = [...Array(70).keys()].map((i) => 180 + i * 3);
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
writeFileSync(resolve(repo, ".tmp/moonoil/frames.raw"), out);
writeFileSync(resolve(repo, ".tmp/moonoil/frames.json"), JSON.stringify({ PW, PH, FRAMES: SHOTS.length, PANELS: 2, labels: LOOKS.map((l) => l.label), fps: 10 }));
console.log("frames", SHOTS.length);
