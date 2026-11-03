// Scratch: a full 220x140 board in three bands of stone, wood and ice, to see whether the 64-cell tiles repeat visibly.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), W = 220, H = 140, S = 2;
const color = loadRenderer("solids-board", repo).colorForCell;
const cells = new Uint8Array(W * H * 8);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 8; cells[o] = y < 46 ? M.Stone : y < 93 ? M.Wood : M.Ice; cells[o + 1] = (x * 7 + y * 3) & 7; cells[o + 2] = 90; }
const out = Buffer.alloc(W * S * H * S * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 8, c = color({ kind: cells[o], variant: cells[o + 1], age: 90, energy: 0, flags: 0, time: 5000, cells, width: W, height: H, x, y });
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const q = ((y * S + dy) * W * S + x * S + dx) * 3; for (let i = 0; i < 3; i++) out[q + i] = Math.max(0, Math.min(255, Math.round(c[i]))); }
}
writeFileSync(resolve(repo, ".tmp/solids/board.raw"), out);
