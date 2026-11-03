// Scratch (2026-10-30): today / last build / tuned, same engine and dice, on a deep basin under a tall
// fall. node .tmp/water/tune.mjs [seed] -> frames.raw/json for sheet.py
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), seed = Number(process.argv[2] ?? 11);
const { createFallbackEngine } = compileApp("water-t", ["engine.ts", "materials.ts"]).load("engine");
const LOOKS = [["Today", ".tmp/water/base"], ["Last build", ".tmp/water/prev"], ["Tuned", "."]].map(([label, root], i) => ({ label, color: loadRenderer("water-t" + i, resolve(repo, root)).colorForCell }));
const W = 96, H = 72, S = 4, PW = W * S, PH = H * S, STEP = 2;
const e = createFallbackEngine(W, H, seed), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
for (let x = 4; x <= 36; x++) p(x, 10, 0, M.Wall); for (let y = 5; y <= 10; y++) p(4, y, 0, M.Wall);
for (let x = 30; x <= 90; x++) p(x, 68, 0, M.Wall); for (let y = 36; y <= 68; y++) { p(30, y, 0, M.Wall); p(90, y, 0, M.Wall); }
for (let x = 33; x <= 87; x++) for (let y = 42; y <= 66; y++) p(x, y, 0, M.Water);
const SHOTS = [...Array(70).keys()].map((i) => 240 + i * STEP);
const out = Buffer.alloc(SHOTS.length * 3 * PW * PH * 3);
let t = 0;
SHOTS.forEach((at, f) => {
  while (t < at) { t++; if (t % 3 === 0) p(12, 2, 1, M.Water); e.tick(); }
  const cells = e.getCellBytes();
  LOOKS.forEach(({ color }, panel) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 8;
      const c = color({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: at * 50, cells, width: W, height: H, x, y });
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const q = (((f * 3 + panel) * PH + y * S + dy) * PW + x * S + dx) * 3; for (let i = 0; i < 3; i++) out[q + i] = Math.max(0, Math.min(255, Math.round(c[i]))); }
    }
  });
});
writeFileSync(resolve(repo, ".tmp/water/frames.raw"), out);
writeFileSync(resolve(repo, ".tmp/water/frames.json"), JSON.stringify({ PW, PH, FRAMES: SHOTS.length, PANELS: 3, labels: LOOKS.map((l) => l.label), fps: 10 }));
console.log("frames", SHOTS.length);
