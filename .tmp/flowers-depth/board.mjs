// Candidate rows for one scene: node board.mjs <scene> <tick> <scale> <variant,variant,...> [crop x0,y0,x1,y1]
// Variants are folders made by make-variants.py; "D" draws today's petals inside the cell (3x3 sub-pixels).
// Writes out/<scene>-<tick>-<variant>.png (one per variant) and out/<scene>-<tick>.png (all stacked).
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { compileApp } from "../../scripts/compile-app.mjs";
import { FLOOR_FROM_BOTTOM, M } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "../film/scenes.mjs";
const here = import.meta.dirname, repo = resolve(here, "../..");
const [name, tickArg, scaleArg, list, cropArg] = process.argv.slice(2);
// A dry meadow from painted materials only: a soil bed, a row of seeds, one watering, no rain.
SCENES.meadow = { w: 150, h: 48, seed: Number(process.env.SEED ?? 4107), crop: [4, 16, 146, 44],
  paint: (p) => { for (let x = 4; x <= 146; x++) p(x, 44, 3, M.Soil, 55);
    for (let x = 10; x <= 140; x += 7) p(x, 39, 0, M.Seed);
    for (let x = 8; x <= 142; x += 4) p(x, 34, 1, M.Water); } };
const scene = SCENES[name], at = Number(tickArg), S = Number(scaleArg), names = list.split(",");
const [x0, y0, x1, y1] = cropArg ? cropArg.split(",").map(Number) : scene.crop ?? [0, 0, scene.w - 1, scene.h - 1];
const engine = compileApp("fd-eng", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine;
const e = engine(scene.w, scene.h, scene.seed);
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
scene.paint(p);
for (let x = 1; x < scene.w; x += 3) p(x, scene.h - FLOOR_FROM_BOTTOM, 1, 1);
if (scene.cells) e.loadCellBytes(scene.cells(e.getCellBytes().slice(), scene.w));
for (let t = 1; t <= at; t++) { if (scene.act) scene.act(p, t); e.tick(); }
const cells = e.getCellBytes(), W = scene.w, H = scene.h;
const headOf = new Int32Array(W * H).fill(-1); let heads = 0;
for (let i = 0; i < W * H; i++) {
  if (cells[i * 8] !== M.Flower || headOf[i] >= 0) continue;
  const v = cells[i * 8 + 1] & 7, st = [i]; headOf[i] = heads;
  while (st.length) { const j = st.pop(), x = j % W, y = Math.floor(j / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || headOf[k] >= 0 || cells[k * 8] !== M.Flower || (cells[k * 8 + 1] & 7) !== v) continue;
      headOf[k] = heads; st.push(k); } }
  heads++;
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const rm = (a, b) => { const r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db); };
const med = (a) => { const b = [...a].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const cw = (x1 - x0 + 1) * S, ch = (y1 - y0 + 1) * S;
mkdirSync(resolve(here, "out"), { recursive: true });
const png = (img, w, h, file) => {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) Buffer.from(img.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
};
const rows = [];
for (const v of names) {
  const root = v === "tree" ? repo : resolve(here, v === "D" ? "today" : v);
  const app = compileApp(`fd-r-${v}`, ["rendering/materialColor.ts", "rendering/shapeLanguage.ts", "materials.ts"], { root });
  const mc = app.load("rendering/materialColor"), SPECIES = app.load("rendering/shapeLanguage").SPECIES;
  const info = (x, y) => { const o = (y * W + x) * 8; return { kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
    energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8), time: at * 50, cells, width: W, height: H, x, y }; };
  const light = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const c = info(i % W, Math.floor(i / W));
    if (!c.kind || !mc.hasGlow(c.kind, c.flags, c.energy, c.age)) continue;
    const k = mc.glowIntensity(c.kind, c.energy, c.age, at * 50) / 255, g = mc.glowColorFor(c.kind, c.flags, c.energy, c.age);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = c.x + dx, ny = c.y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const f = k * 0.32 / (1 + dx * dx + dy * dy), j = (ny * W + nx) * 3;
      light[j] += g[0] * f; light[j + 1] += g[1] * f; light[j + 2] += g[2] * f;
    }
  }
  const img = new Uint8Array(cw * ch * 3);
  const got = Array.from({ length: heads }, () => []);
  const headNear = (x, y) => { for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H && headOf[ny * W + nx] >= 0) return headOf[ny * W + nx]; } return -1; };
  const isFlower = (x, y) => x >= 0 && y >= 0 && x < W && y < H && cells[(y * W + x) * 8] === M.Flower;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = info(x, y), base = mc.colorForCell(c);
    const lit = (rgb) => rgb.map((n, k) => Math.max(0, Math.min(255, Math.round(n + light[(y * W + x) * 3 + k]))));
    const petal = v === "D" && c.kind === M.Flower && !(c.flags & 1);
    const deep = petal ? mix(SPECIES[c.variant & 7].dark, [44, 12, 64], 0.42) : null;
    const t = !isFlower(x, y - 1), b = !isFlower(x, y + 1), l = !isFlower(x - 1, y), r = !isFlower(x + 1, y);
    const bg = petal ? mc.colorForCell(info(x, y - 1 >= 0 ? y - 1 : y)) : null;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      let rgb = base;
      if (petal) {
        const u = Math.floor(sx * 3 / S), w = Math.floor(sy * 3 / S);   // which third of the cell
        if ((u === 0 && w === 0 && t && l) || (u === 2 && w === 0 && t && r) || (u === 0 && w === 2 && b && l) || (u === 2 && w === 2 && b && r)) rgb = [9, 14, 20];
        else if (w === 2 && b) rgb = mix(base, deep, 0.62);
        else if (u === 2 && r) rgb = mix(base, deep, 0.4);
        else if (w === 0 && t) rgb = mix(base, [255, 244, 224], 0.38);
        else if (u === 0 && l) rgb = mix(base, [255, 244, 224], 0.2);
        else if (u === 1 && w === 1) rgb = mix(base, [255, 244, 224], 0.12);
      }
      const hd = c.kind === M.Flower ? headOf[y * W + x] : c.kind === 0 && rm(base, [9, 14, 20]) > 20 ? headNear(x, y) : -1;
      if (hd >= 0 && (S === 1 || (sx % (S / 3 | 0 || 1) === 0 && sy % (S / 3 | 0 || 1) === 0)) && !(rgb[0] === 9 && rgb[1] === 14 && rgb[2] === 20)) got[hd].push(rgb);
      img.set(lit(rgb), (((y - y0) * S + sy) * cw + (x - x0) * S + sx) * 3);
    }
  }
  png(img, cw, ch, resolve(here, `out/${name}-${at}-s${S}-${v}.png`));
  const st = got.filter((g) => g.length >= 9 * (S >= 3 ? 9 : 1) / 9 * 4).map((g) => {
    const tones = []; for (const c of [...g].sort((p, q) => lum(p) - lum(q))) { const t = tones.find((t) => rm(t[0], c) < 40); if (t) t[1]++; else tones.push([c, 1]); }
    const real = tones.filter((t) => t[1] >= 2), ls = g.map(lum).sort((p, q) => p - q);
    const dark = g.reduce((p, q) => (lum(q) < lum(p) ? q : p)), light = g.reduce((p, q) => (lum(q) > lum(p) ? q : p));
    return { tones: real.length, spread: ls.at(-1) - ls[0], dl: rm(dark, light), size: g.length / (S >= 3 ? 9 : 1) };
  });
  console.log(`${v.padEnd(6)} heads ${st.length}: tones ${med(st.map((q) => q.tones))} (min ${Math.min(...st.map((q) => q.tones))}), lum spread ${med(st.map((q) => q.spread)).toFixed(0)}, dark-light ${med(st.map((q) => q.dl)).toFixed(0)}, footprint ${med(st.map((q) => q.size)).toFixed(0)} cells`);
  rows.push(img);
}
const GAP = 4, all = new Uint8Array(cw * (ch * rows.length + GAP * (rows.length - 1)) * 3).fill(60);
rows.forEach((img, i) => all.set(img, i * (ch + GAP) * cw * 3));
png(all, cw, ch * rows.length + GAP * (rows.length - 1), resolve(here, `out/${name}-${at}-s${S}.png`));
console.log(`out/${name}-${at}-s${S}.png`, cw, "x", ch * rows.length, names.join(" "));
e.dispose();
