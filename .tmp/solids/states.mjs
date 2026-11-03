// Scratch: each solid plain, wet, frozen, scorched and cosmic, today above the build. A look at the overlays, not a gate.
// node .tmp/solids/states.mjs -> .tmp/solids/states.raw, then python3 .tmp/solids/states.py
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), F = { Wet: 1, Cosmic: 4, Frozen: 8, Scorched: 16 };
const looks = [".tmp/solids/base", "."].map((root, i) => loadRenderer("solids-states" + i, resolve(repo, root)).colorForCell);
const kinds = [M.Stone, M.Sand, M.Soil, M.Wood, M.Wall], flags = [0, F.Wet, F.Frozen, F.Scorched, F.Cosmic];
const B = 22, S = 5, W = kinds.length * (B + 2), H = flags.length * (B + 2);
const cells = new Uint8Array(W * H * 8);
kinds.forEach((k, a) => flags.forEach((f, b) => { for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
  const X = a * (B + 2) + 1 + x, Y = b * (B + 2) + 1 + y, o = (Y * W + X) * 8;
  cells[o] = k; cells[o + 1] = (X * 7 + Y * 3) & 7; cells[o + 2] = 90; cells[o + 4] = f === F.Wet ? 60 : 0; cells[o + 6] = f;
} }));
const PW = W * S, PH = H * S, out = Buffer.alloc(2 * PW * PH * 3);
looks.forEach((color, panel) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 8, kind = cells[o];
  const c = kind ? color({ kind, variant: cells[o + 1], age: 90, energy: cells[o + 4], flags: cells[o + 6], time: 5000, cells, width: W, height: H, x, y }) : [14, 18, 36];
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const q = ((panel * PH + y * S + dy) * PW + x * S + dx) * 3; for (let i = 0; i < 3; i++) out[q + i] = Math.max(0, Math.min(255, Math.round(c[i]))); }
} });
writeFileSync(resolve(repo, ".tmp/solids/states.raw"), out);
console.log(PW, PH);
