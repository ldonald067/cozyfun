// Scratch (2026-10-21): live engine above a .tmp/lava variant, same renderer (working tree).
// node .tmp/lava/film.mjs <scene> <variant> [seed]   -> .tmp/lava/<scene>.png
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { SCENES } from "./scenes.mjs";
import { build } from "./variant.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, variant = "candidate", seedArg] = process.argv.slice(2);
const scene = SCENES[name];
const seed = Number(seedArg ?? scene.seed);
const colorForCell = loadRenderer("lava-film-r").colorForCell;
const glow = compileApp("lava-film-g", ["rendering/materialColor.ts", "materials.ts"]).load("rendering/materialColor");
const builds = [{ engine: build("live").create, colorForCell, glow }, { engine: build(variant).create, colorForCell, glow }];
const S = scene.scale ?? 4, GAP = 6;
const [x0, y0, x1, y1] = scene.crop ?? [0, 0, scene.w - 1, scene.h - 1];
const cw = (x1 - x0 + 1) * S, ch = (y1 - y0 + 1) * S;
const W = scene.ticks.length * cw + (scene.ticks.length - 1) * GAP, H = 2 * ch + GAP;
const img = new Uint8Array(W * H * 3).fill(40);
builds.forEach((b, row) => {
  const e = b.engine(scene.w, scene.h, seed);
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  scene.paint(p);
  for (let x = 1; x < scene.w; x += 3) p(x, scene.h - FLOOR_FROM_BOTTOM, 1, 1);
  if (scene.cells) e.loadCellBytes(scene.cells(e.getCellBytes().slice(), scene.w));
  let t = 0;
  scene.ticks.forEach((at, col) => {
    while (t < at) { t++; if (scene.act) scene.act(p, t); e.tick(); }
    const cells = e.getCellBytes();
    // Approximate glow: each glowing cell lights a 7x7 patch around it, falling off with distance.
    const light = new Float32Array(scene.w * scene.h * 3);
    for (let i = 0; i < scene.w * scene.h; i++) {
      const o = i * 8, kind = cells[o], energy = cells[o + 4] | (cells[o + 5] << 8), age = cells[o + 2] | (cells[o + 3] << 8), flags = cells[o + 6] | (cells[o + 7] << 8);
      if (!kind || !b.glow.hasGlow(kind, flags, energy, age)) continue;
      const k = b.glow.glowIntensity(kind, energy, age, at * 50) / 255, c = b.glow.glowColorFor(kind, flags, energy, age);
      const cx = i % scene.w, cy = Math.floor(i / scene.w);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= scene.w || ny >= scene.h) continue;
        const f = k * 0.32 / (1 + dx * dx + dy * dy), j = (ny * scene.w + nx) * 3;
        light[j] += c[0] * f; light[j + 1] += c[1] * f; light[j + 2] += c[2] * f;
      }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = (y * scene.w + x) * 8;
      const rgb = b.colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
        energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8),
        time: at * 50, cells, width: scene.w, height: scene.h, x, y }).map((v, ch) => v + light[(y * scene.w + x) * 3 + ch]);
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const px = col * (cw + GAP) + (x - x0) * S + dx, py = row * (ch + GAP) + (y - y0) * S + dy;
        img.set(rgb.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (py * W + px) * 3);
      }
    }
  });
  e.dispose();
});
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = resolve(repo, `.tmp/lava/${name}.png`);
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(out, W, "x", H, "ticks", scene.ticks.join(","));
