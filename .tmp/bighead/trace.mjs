// Scratch: trace one crown in the sunflower check's scene. node .tmp/bighead/trace.mjs <seedIndex> <crownX>
import { CHECKS, M, F, STRIDE, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const app = compileApp("bh-trace", ["engine.ts", "materials.ts"]);
const { createFallbackEngine, BLOOM_SHAPES } = app.load("engine");
const c = CHECKS.find((x) => /sunflower whole/.test(x.role));
const [k, X] = process.argv.slice(2).map(Number);
const e = createFallbackEngine(c.w, c.h, c.seed + k * 1000);
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
c.paint(p);
for (let x = 1; x < c.w; x += 3) p(x, c.h - FLOOR_FROM_BOTTOM, 1, M.Wall);
let last = "";
for (let t = 1; t <= 6000; t++) {
  e.tick();
  const cells = e.getCellBytes(), W = c.w;
  let cy = -1;
  for (let y = 0; y < c.h; y++) { const o = (y * W + X) * STRIDE; if (cells[o] === M.Flower && cells[o + 6] & F.Rooted) cy = y; }
  if (cy < 0) continue;
  const o = (cy * W + X) * STRIDE, v = cells[o + 1];
  const energy = cells[o + 4] | (cells[o + 5] << 8), age = cells[o + 2] | (cells[o + 3] << 8);
  const open = BLOOM_SHAPES[v].filter(([dx, dy]) => cells[((cy + dy) * W + X + dx) * STRIDE] === M.Flower && cells[((cy + dy) * W + X + dx) * STRIDE + 1] === v).length;
  const blocked = e.headInReach(X, cy, v, cells, cells);
  let who = "";
  if (blocked) for (let yy = cy - 10; yy <= cy + 10; yy++) for (let xx = X - 12; xx <= X + 12; xx++) {
    if (xx === X && yy === cy) continue; const q = (yy * W + xx) * STRIDE;
    if (cells[q] === M.Flower && cells[q + 6] & F.Rooted) who += ` crown(${xx},${yy}) v${cells[q + 1]} beside=${e.petalBeside(xx, yy, cells)} on=${e.headStillOn(xx, yy, cells[q + 1], cells)}`;
  }
  const line = `v${v} energy ${energy} open ${open} blocked ${blocked}${who}`;
  if (line !== last && (t % 50 === 0 || !last)) { console.log(`t${t} age ${age} ${line}`); last = line; }
}
