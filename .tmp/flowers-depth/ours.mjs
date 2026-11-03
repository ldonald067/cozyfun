// Our heads through the real engine and renderer: size, tones (40-redmean clusters) and spread per species.
// node ours.mjs [scene=flowers-species] [tick]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, FLOOR_FROM_BOTTOM, M } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../film/scenes.mjs";
const [name = "flowers-species", tickArg] = process.argv.slice(2);
const scene = SCENES[name];
const engine = compileApp("fd-ours", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine;
const { colorForCell } = loadRenderer("fd-ours-r");
const e = engine(scene.w, scene.h, scene.seed);
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
scene.paint(p);
for (let x = 1; x < scene.w; x += 3) p(x, scene.h - FLOOR_FROM_BOTTOM, 1, 1);
if (scene.cells) e.loadCellBytes(scene.cells(e.getCellBytes().slice(), scene.w));
const until = Number(tickArg ?? scene.ticks.at(-1));
for (let t = 1; t <= until; t++) { if (scene.act) scene.act(p, t); e.tick(); }
const cells = e.getCellBytes(), W = scene.w, H = scene.h;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const rm = (a, b) => { const r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db); };
const col = (x, y) => { const o = (y * W + x) * 8; return colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
  energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: until * 50, cells, width: W, height: H, x, y }).map(Math.round); };
// group flower cells into heads (8-connected, same species)
const seen = new Set(), heads = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 8; if (cells[o] !== M.Flower || seen.has(y * W + x)) continue;
  const v = cells[o + 1] & 7, comp = [], st = [[x, y]]; seen.add(y * W + x);
  while (st.length) { const [a, b] = st.pop(); comp.push([a, b]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = a + dx, ny = b + dy, k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue; const q = k * 8;
      if (cells[q] === M.Flower && (cells[q + 1] & 7) === v) { seen.add(k); st.push([nx, ny]); } } }
  heads.push({ v, comp });
}
const SPEC = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
for (const { v, comp } of heads) {
  if (comp.length < 4) continue;
  const xs = comp.map((c) => c[0]), ys = comp.map((c) => c[1]);
  const cs = comp.map(([x, y]) => col(x, y)).sort((a, b) => lum(a) - lum(b));
  const tones = [];
  for (const c of cs) { const t = tones.find((t) => rm(t[0], c) < 40); if (t) t[1]++; else tones.push([c, 1]); }
  const ls = cs.map(lum);
  const hex = (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");
  console.log(`${SPEC[v].padEnd(10)} at ${Math.min(...xs)},${Math.min(...ys)} head ${Math.max(...xs) - Math.min(...xs) + 1}x${Math.max(...ys) - Math.min(...ys) + 1}, ${comp.length} cells, ${tones.length} tones, lum ${ls[0].toFixed(0)}-${ls.at(-1).toFixed(0)}, dark-light ${rm(cs[0], cs.at(-1)).toFixed(0)}: ${tones.map((t) => hex(t[0]) + "/" + t[1]).join(" ")}`);
}
e.dispose();
