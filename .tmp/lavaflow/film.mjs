// Scratch: lava filmstrip, one row per variant, through the real renderer (glow approximated).
// node .tmp/lavaflow/film.mjs <scene> <variant,...>   variant = mode or mode:k  -> .tmp/lavaflow/<scene>.png
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
import { build } from "./variant.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, list = "live,visc:8"] = process.argv.slice(2);
const SCENES = {
  floor: { w: 120, h: 50, seed: 21, ticks: [40, 120, 300, 600, 1000, 1400], crop: [20, 18, 99, 47], scale: 3,
    paint: (p) => { for (let x = 0; x < 120; x++) p(x, 47, 1, M.Wall); },
    act: (p, t) => { if (t <= 60 && t % 3 === 1) p(60, 22, 3, M.Lava); } },
  slope: { w: 120, h: 60, seed: 7, ticks: [40, 120, 240, 480, 800, 1200], crop: [10, 8, 109, 57], scale: 3,
    paint: (p) => { for (let x = 0; x < 120; x++) p(x, 57, 1, M.Wall); for (let x = 14; x < 70; x++) { const top = 18 + Math.floor((x - 14) * 0.65); for (let y = top; y < 57; y += 1) p(x, y, 0, M.Wall); } },
    act: (p, t) => { if (t <= 80 && t % 4 === 1) p(20, 12, 2, M.Lava); } },
  spring: { w: 160, h: 90, seed: 3, ticks: [200, 600, 1200, 2400, 4000, 8000], crop: [0, 20, 159, 89], scale: 2,
    paint: (p) => { for (let x = 0; x < 160; x++) p(x, 88, 1, M.Wall); p(80, 60, 4, M.Wellspring); },
    act: (p, t) => { if (t === 6) p(80, 54, 1, M.Lava); } },
};
const scene = SCENES[name];
const r = loadRenderer("lavaflow-r");
const glow = compileApp("lavaflow-g", ["rendering/materialColor.ts", "materials.ts"]).load("rendering/materialColor");
const variants = list.split(",").map((v) => { const [m, k] = v.split(":"); return build(m, Number(k ?? 4)); });
const S = scene.scale, GAP = 6, [x0, y0, x1, y1] = scene.crop;
const cw = (x1 - x0 + 1) * S, ch = (y1 - y0 + 1) * S;
const W = scene.ticks.length * cw + (scene.ticks.length - 1) * GAP, H = variants.length * ch + (variants.length - 1) * GAP;
const img = new Uint8Array(W * H * 3).fill(40);
variants.forEach((b, row) => {
  const e = b.create(scene.w, scene.h, scene.seed), p = (x, y, rr, m) => e.paint(x, y, rr, m, 100);
  scene.paint(p);
  let t = 0;
  scene.ticks.forEach((at, col) => {
    while (t < at) { t++; if (scene.act) scene.act(p, t); e.tick(); }
    const cells = e.getCellBytes(), light = new Float32Array(scene.w * scene.h * 3);
    for (let i = 0; i < scene.w * scene.h; i++) {
      const o = i * 8, kind = cells[o], energy = cells[o + 4] | (cells[o + 5] << 8), age = cells[o + 2] | (cells[o + 3] << 8), flags = cells[o + 6] | (cells[o + 7] << 8);
      if (!kind || !glow.hasGlow(kind, flags, energy, age)) continue;
      const k = glow.glowIntensity(kind, energy, age, at * 50) / 255, c = glow.glowColorFor(kind, flags, energy, age);
      const cx = i % scene.w, cy = Math.floor(i / scene.w);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= scene.w || ny >= scene.h) continue;
        const f = k * 0.32 / (1 + dx * dx + dy * dy), j = (ny * scene.w + nx) * 3;
        light[j] += c[0] * f; light[j + 1] += c[1] * f; light[j + 2] += c[2] * f;
      }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = (y * scene.w + x) * 8;
      const rgb = r.colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
        energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8),
        time: at * 50, cells, width: scene.w, height: scene.h, x, y }).map((v, c) => v + light[(y * scene.w + x) * 3 + c]);
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const px = col * (cw + GAP) + (x - x0) * S + dx, py = row * (ch + GAP) + (y - y0) * S + dy;
        img.set(rgb.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (py * W + px) * 3);
      }
    }
  });
});
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = resolve(repo, `.tmp/lavaflow/${name}.png`);
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(out, W, "x", H, "rows", list, "ticks", scene.ticks.join(","));
