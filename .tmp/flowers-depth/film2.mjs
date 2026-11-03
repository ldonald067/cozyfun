// HEAD (engine + renderer) above the working tree, one scene, several ticks, as film.mjs but with
// the meadow from board.mjs. node film2.mjs <tick,tick> <scale> [seed]
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, FLOOR_FROM_BOTTOM, M } from "../../scripts/interaction-scenes.mjs";
const here = import.meta.dirname, repo = resolve(here, "../..");
const [ticksArg, scaleArg, seedArg] = process.argv.slice(2);
const ticks = ticksArg.split(",").map(Number), S = Number(scaleArg), seed = Number(seedArg ?? 4107);
const w = 150, h = 48, [x0, y0, x1, y1] = [4, 16, 146, 44];
const paint = (p) => { for (let x = 4; x <= 146; x++) p(x, 44, 3, M.Soil, 55);
  for (let x = 10; x <= 140; x += 7) p(x, 39, 0, M.Seed);
  for (let x = 8; x <= 142; x += 4) p(x, 34, 1, M.Water); };
const builds = [resolve(repo, ".tmp/film/base"), repo].map((root, i) => ({
  engine: compileApp(`f2-e${i}`, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine,
  color: loadRenderer(`f2-r${i}`, root).colorForCell }));
const cw = (x1 - x0 + 1) * S, ch = (y1 - y0 + 1) * S, GAP = 4;
const W = cw, H = ticks.length * 2 * (ch + GAP);
const img = new Uint8Array(W * H * 3).fill(60);
builds.forEach((b, row) => {
  const e = b.engine(w, h, seed);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  paint(p);
  for (let x = 1; x < w; x += 3) p(x, h - FLOOR_FROM_BOTTOM, 1, 1);
  let t = 0;
  ticks.forEach((at, k) => {
    while (t < at) { t++; e.tick(); }
    const cells = e.getCellBytes();
    const top = (k * 2 + row) * (ch + GAP);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = (y * w + x) * 8;
      const rgb = b.color({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8), energy: cells[o + 4] | (cells[o + 5] << 8),
        flags: cells[o + 6] | (cells[o + 7] << 8), time: at * 50, cells, width: w, height: h, x, y }).map((v) => Math.max(0, Math.min(255, Math.round(v))));
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) img.set(rgb, ((top + (y - y0) * S + dy) * W + (x - x0) * S + dx) * 3);
    }
  });
  e.dispose();
});
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = resolve(here, `out/meadow-film-s${S}-${seed}.png`);
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(out, W, "x", H);
