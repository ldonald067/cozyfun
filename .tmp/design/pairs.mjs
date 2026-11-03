// All 28 species pairs on the real heads, the way renderer:probe measures them, plus each
// head's petal mean. For tuning only.  node .tmp/design/pairs.mjs
import { readFile } from "node:fs/promises";
import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("pairs-renderer", ["rendering/materialColor.ts", "materials.ts"]);
const { colorForCell } = app.load("rendering/materialColor");
const { MATERIAL, CELL_FLAG } = app.load("materials");
const W = 26, H = 14, STRIDE = 8;
const redmean = ([r1, g1, b1], [r2, g2, b2]) => {
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.round(Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db));
};
const text = await readFile("app/src/engine.ts", "utf8");
const at = text.indexOf("const BLOOM_SHAPES");
const block = text.slice(text.indexOf("= [", at) + 3, text.indexOf("\n];", at));
const SHAPES = [...block.matchAll(/^\s*\[((?:\s*\[-?\d+,\s*-?\d+\],?)+)\],\s*$/gm)]
  .map((m) => [...m[1].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)].map((q) => [Number(q[1]), Number(q[2])]));
const head = (v, t) => {
  const cells = new Uint8Array(W * H * STRIDE);
  const put = (x, y, kind, energy = 0, age = 0, flags = 0, variant = 0) => {
    const o = (y * W + x) * STRIDE;
    cells[o] = kind; cells[o + 1] = variant & 7; cells[o + 2] = age & 255; cells[o + 3] = age >> 8;
    cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags & 255; cells[o + 7] = flags >> 8;
  };
  for (let x = 0; x < W; x++) put(x, 12, MATERIAL.Wall, 0, 40, 0, x);
  put(13, 11, MATERIAL.Soil, 120, 40, CELL_FLAG.Wet);
  for (let i = 2; i <= 5; i++) put(13, 12 - i, MATERIAL.Stem, 20, 50, i === 2 ? CELL_FLAG.Rooted : 0, v);
  put(13, 6, MATERIAL.Flower, 95, 200, CELL_FLAG.Rooted, v);
  for (const [dx, dy] of SHAPES[v]) put(13 + dx, 6 + dy, MATERIAL.Flower, 90, 180, 0, v);
  const cols = SHAPES[v].map(([dx, dy]) => {
    const o = ((6 + dy) * W + 13 + dx) * STRIDE;
    return colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
      energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: t, cells, width: W, height: H, x: 13 + dx, y: 6 + dy });
  });
  return cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map((x) => Math.round(x / cols.length));
};
const N = ["corn", "poppy", "daisy", "sun", "tulip", "lav", "blue", "cosmos"];
const means = N.map((_, v) => head(v, 0));
N.forEach((n, v) => console.log(n.padEnd(7), means[v].join(",")));
const rows = [];
for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) rows.push([redmean(means[a], means[b]), `${N[a]}-${N[b]}`]);
rows.sort((p, q) => p[0] - q[0]);
console.log(rows.slice(0, 8).map(([d, n]) => `${n} ${d}`).join("  "));
