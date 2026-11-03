// Scratch: all eight heads, today's and the mock's, fully open on a stalk, through each build's
// own renderer. node .tmp/bighead/closeup.mjs -> .tmp/bighead/closeup-{1,2}x.png (raw RGB → PNG via python)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const ROOTS = process.argv.slice(2).length ? process.argv.slice(2).map((r) => (r === "-" ? repo : resolve(repo, r))) : [repo, resolve(repo, ".tmp/bighead/m-big")];
const builds = ROOTS.map((root, n) => ({
  shapes: compileApp(`bhc-${n}`, ["engine.ts", "materials.ts"], { root }).load("engine").BLOOM_SHAPES,
  color: loadRenderer(`bhc-${n}-r`, root).colorForCell,
}));
const PITCH = 15, W = 8 * PITCH + 1, H = 24, BASE = 21;
const out = [];
builds.forEach(({ shapes, color }) => {
  const cells = new Uint8Array(W * H * STRIDE);
  const put = (x, y, kind, variant, energy, age, flags) => { const o = (y * W + x) * STRIDE; cells[o] = kind; cells[o + 1] = variant; cells[o + 2] = age & 255; cells[o + 3] = age >> 8; cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags; };
  for (let x = 0; x < W; x++) { put(x, BASE + 1, M.Soil, 0, 60, 400, 0); put(x, BASE + 2, M.Soil, 0, 60, 400, 0); }
  for (let v = 0; v < 8; v++) {
    const sx = 8 + v * PITCH, crownY = BASE - 6;
    for (let y = crownY + 1; y <= BASE; y++) put(sx, y, M.Stem, v, 20, 400, y === BASE ? F.Rooted : 0);
    for (const y of [BASE - 1, BASE - 3]) put(sx + (y % 2 ? 1 : -1), y, M.Stem, v, 12, 400, 0);
    put(sx, crownY, M.Flower, v, 180, 400, F.Rooted);
    for (const [dx, dy] of shapes[v]) put(sx + dx, crownY + dy, M.Flower, v, 150, 400, 0);
  }
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * STRIDE;
    const c = color({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: 20000, cells, width: W, height: H, x, y });
    rgb.set([0, 1, 2].map((ch) => Math.max(0, Math.min(255, Math.round(c[ch])))), (y * W + x) * 3);
  }
  out.push(rgb);
});
writeFileSync(resolve(import.meta.dirname, "closeup.raw"), Buffer.concat(out.map((b) => Buffer.from(b))));
console.log(W, H);
