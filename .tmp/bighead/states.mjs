// Scratch: every species in every weather state, today's heads against the big ones, through
// each build's own renderer. node .tmp/bighead/states.mjs -> states.raw (two panels)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const STATES = [0, F.Wet, F.Frozen, F.Scorched, F.Cosmic];
const PITCH = 15, ROW = 16, W = 8 * PITCH + 1, H = STATES.length * ROW + 2;
const panels = [resolve(repo, ".tmp/bighead/base"), repo].map((root, n) => {
  const shapes = compileApp(`bhs-${n}`, ["engine.ts", "materials.ts"], { root }).load("engine").BLOOM_SHAPES;
  const color = loadRenderer(`bhs-${n}-r`, root).colorForCell;
  const cells = new Uint8Array(W * H * STRIDE);
  const put = (x, y, kind, variant, energy, age, flags) => { const o = (y * W + x) * STRIDE; cells[o] = kind; cells[o + 1] = variant; cells[o + 2] = age & 255; cells[o + 3] = age >> 8; cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags & 255; cells[o + 7] = flags >> 8; };
  STATES.forEach((flags, row) => {
    const base = row * ROW + ROW - 1;
    for (let x = 0; x < W; x++) put(x, base, M.Wall, 0, 40, 0, 0);
    for (let v = 0; v < 8; v++) {
      const sx = 7 + v * PITCH, cy = base - 3;
      for (let y = cy + 1; y < base; y++) put(sx, y, M.Stem, v, 20, 400, y === base - 1 ? F.Rooted : 0);
      put(sx, cy, M.Flower, v, 180, 400, F.Rooted | flags);
      for (const [dx, dy] of shapes[v]) put(sx + dx, cy + dy, M.Flower, v, 90, 400, flags);
    }
  });
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * STRIDE;
    const c = color({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: 700, cells, width: W, height: H, x, y });
    rgb.set([0, 1, 2].map((ch) => Math.max(0, Math.min(255, Math.round(c[ch])))), (y * W + x) * 3);
  }
  return rgb;
});
writeFileSync(resolve(import.meta.dirname, "states.raw"), Buffer.concat(panels.map((b) => Buffer.from(b))));
console.log(W, H);
