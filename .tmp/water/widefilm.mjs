// Scratch: the build on a real default-brush pour, a still at 4x. node widefilm.mjs <radius> <density>
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), [R, D] = [Number(process.argv[2]), Number(process.argv[3])];
const { createFallbackEngine } = compileApp("water-wf", ["engine.ts", "materials.ts"]).load("engine");
const { colorForCell } = loadRenderer("water-wf-r");
const W = 96, H = 56, S = 4, SHOTS = [150, 154, 158, 162];
const e = createFallbackEngine(W, H, 3), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
for (let x = 6; x <= 90; x++) p(x, 52, 0, M.Wall); for (let y = 36; y <= 52; y++) { p(6, y, 0, M.Wall); p(90, y, 0, M.Wall); }
const rgb = Buffer.alloc(SHOTS.length * (W * S) * (H * S) * 3); let t = 0;
SHOTS.forEach((at, f) => {
  while (t < at) { t++; if (t % 3 === 0) p(48, 8, R, M.Water, D); e.tick(); }
  const c = e.getCellBytes();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8;
    const col = colorForCell({ kind: c[o], variant: c[o + 1], age: 0, energy: c[o + 4] | (c[o + 5] << 8), flags: c[o + 6] | (c[o + 7] << 8), time: at * 50, cells: c, width: W, height: H, x, y });
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const q = ((f * H * S * W * S) + (y * S + dy) * W * S + x * S + dx) * 3; for (let i = 0; i < 3; i++) rgb[q + i] = Math.max(0, Math.min(255, Math.round(col[i]))); } }
});
writeFileSync(resolve(repo, ".tmp/water/wide.raw"), rgb);
