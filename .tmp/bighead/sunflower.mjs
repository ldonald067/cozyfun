// Scratch: which petals of a lone head stay shut, and the crown's budget as it opens.
// node .tmp/bighead/sunflower.mjs [variant=3]
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, STRIDE } from "../../scripts/interaction-scenes.mjs";
const app = compileApp("bh-sun", ["engine.ts", "materials.ts"]);
const { createFallbackEngine, BLOOM_SHAPES } = app.load("engine");
const v = Number(process.argv[2] ?? 3), W = 20, H = 20;
const e = createFallbackEngine(W, H, 3);
const cells = new Uint8Array(W * H * STRIDE);
const put = (x, y, kind, energy, age, flags) => { const o = (y * W + x) * STRIDE; cells[o] = kind; cells[o + 1] = v; cells[o + 2] = age; cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags; };
put(10, 10, M.Flower, 250, 20, F.Rooted); put(10, 11, M.Wall, 0, 0, 0);
e.loadCellBytes(cells);
let best = 0, bestAt = 0, missing = [];
for (let t = 1; t <= 2000; t++) {
  e.tick();
  const c = e.getCellBytes();
  const shut = BLOOM_SHAPES[v].filter(([dx, dy]) => c[((10 + dy) * W + 10 + dx) * STRIDE] !== M.Flower);
  const open = BLOOM_SHAPES[v].length - shut.length;
  if (open > best) { best = open; bestAt = t; missing = shut.map(([dx, dy]) => `${dx},${dy}:${["empty","","","","","","","","","","","","","","","","","","","","","","pollen"][c[((10 + dy) * W + 10 + dx) * STRIDE]] ?? c[((10 + dy) * W + 10 + dx) * STRIDE]}`); }
  if (t % 100 === 0 && t <= 600) console.log(`t${t} crown energy ${c[(10 * W + 10) * STRIDE + 4] | (c[(10 * W + 10) * STRIDE + 5] << 8)} open ${open}`);
}
console.log(`peak ${best}/${BLOOM_SHAPES[v].length} petals at t${bestAt}; shut: ${missing.join(" ")}`);
