// Scratch: every species' open head on each night it can sit on, through the real renderer.
// Row 1 is the old flat night (air over [9,14,20] is exactly what shipped); the rest are the
// wash's darkest, most indigo, brightest and most violet cells as the probe picks them.
// node .tmp/nightsky/heads.mjs [ringOpacityNote]  -> .tmp/nightsky/heads.png
import { readFileSync } from "node:fs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { writePng } from "./png.mjs";
const app = compileApp("nightsky-heads", ["rendering/materialColor.ts", "materials.ts"]);
const { colorForCell } = app.load("rendering/materialColor");
const { washAt } = app.load("rendering/nightWash");
const { MATERIAL, CELL_FLAG } = app.load("materials");
const src = readFileSync("app/src/engine.ts", "utf8");
const at = src.indexOf("const BLOOM_SHAPES");
const block = src.slice(src.indexOf("= [", at) + 3, src.indexOf("\n];", at));
const SHAPES = [...block.matchAll(/^\s*\[((?:\s*\[-?\d+,\s*-?\d+\],?)+)\],\s*$/gm)].map((m) => [...m[1].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)].map((q) => [+q[1], +q[2]]));
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const tones = []; for (let y = 0; y < 140; y++) for (let x = 0; x < 220; x++) tones.push(washAt(x, y));
const pick = (score) => tones.reduce((a, b) => (score(b) > score(a) ? b : a));
const NIGHTS = [[9, 14, 20], pick((c) => -luma(c)), pick(([r, , b]) => b - r), pick(luma), pick(([r, g]) => r - g)];
const W = 8 * 9 + 1, H = 9, S = 8;
const cells = new Uint8Array(W * H * 8);
const put = (x, y, kind, energy, age, flags, variant) => { const o = (y * W + x) * 8; cells[o] = kind; cells[o + 1] = variant; cells[o + 2] = age & 255; cells[o + 3] = age >> 8; cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags & 255; cells[o + 7] = flags >> 8; };
for (let x = 0; x < W; x++) put(x, H - 1, MATERIAL.Wall, 0, 40, 0, x & 7);
for (let v = 0; v < 8; v++) {
  const cx = 5 + v * 9, cy = 3;
  put(cx, H - 2, MATERIAL.Soil, 120, 40, CELL_FLAG.Wet, 0);
  for (let y = cy + 1; y < H - 2; y++) put(cx, y, MATERIAL.Stem, 20, 50, y === H - 3 ? CELL_FLAG.Rooted : 0, v);
  put(cx, cy, MATERIAL.Flower, 95, 200, CELL_FLAG.Rooted, v);
  for (const [dx, dy] of SHAPES[v]) put(cx + dx, cy + dy, MATERIAL.Flower, 90, 180, 0, v);
}
const GAP = 4, img = new Uint8Array(W * S * (NIGHTS.length * (H * S + GAP)) * 3).fill(30);
const rowH = H * S + GAP, imgW = W * S;
NIGHTS.forEach((night, r) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 8;
    const c = colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: 0, cells, width: W, height: H, x, y, backdrop: night });
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const p = ((r * rowH + y * S + j) * imgW + x * S + i) * 3; img[p] = c[0]; img[p + 1] = c[1]; img[p + 2] = c[2]; }
  }
});
writePng(".tmp/nightsky/heads.png", imgW, NIGHTS.length * rowH, img);
console.log("rows:", NIGHTS.map((n) => n.join(",")).join(" | "));
