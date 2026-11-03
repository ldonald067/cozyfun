// Scratch (2026-10-28): burning-log filmstrip, one row per variant, real renderer, glow approximated.
// FILM=t,t,... node .tmp/log/film.mjs <scene> <variant,...> [seed] [scale] -> .tmp/log/film-<scene>.png
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer } from "../../scripts/interaction-scenes.mjs";
import { build as buildVariant } from "./variant.mjs";
// `main` is HEAD's engine (.tmp/steam/base); anything else is a variant of the working tree.
const build = (v) => buildVariant(v);
import { SCENES, W as BW, H as BH } from "./scenes.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, list, seedArg = "4100", scaleArg = "3"] = process.argv.slice(2);
const scene = { ...SCENES[name], film: (process.env.FILM ?? "60,140,200,300,440,600").split(",").map(Number) };
const { colorForCell } = loadRenderer("log-film-r");
const glow = compileApp("log-film-g", ["rendering/materialColor.ts", "materials.ts"]).load("rendering/materialColor");
const variants = list.split(",");
const S = Number(scaleArg), GAP = 6;
const [x0, y0, x1, y1] = scene.crop;
const cw = (x1 - x0 + 1) * S, ch = (y1 - y0 + 1) * S;
const W = scene.film.length * cw + (scene.film.length - 1) * GAP, H = variants.length * ch + (variants.length - 1) * GAP;
const img = new Uint8Array(W * H * 3).fill(40);
variants.forEach((v, row) => {
  const { create, M } = build(v);
  const e = create(BW, BH, Number(seedArg));
  const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  scene.paint(p, M);
  let t = 0;
  scene.film.forEach((at, col) => {
    while (t < at) { t++; scene.act(p, t, M); e.tick(); }
    const cells = e.getCellBytes(), w = BW, h = BH;
    const light = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      const o = i * 8, kind = cells[o], energy = cells[o + 4] | (cells[o + 5] << 8), age = cells[o + 2] | (cells[o + 3] << 8), flags = cells[o + 6] | (cells[o + 7] << 8);
      if (!kind || !glow.hasGlow(kind, flags, energy, age)) continue;
      const k = glow.glowIntensity(kind, energy, age, at * 50) / 255, c = glow.glowColorFor(kind, flags, energy, age);
      const cx = i % w, cy = Math.floor(i / w);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const f = k * 0.32 / (1 + dx * dx + dy * dy), j = (ny * w + nx) * 3;
        light[j] += c[0] * f; light[j + 1] += c[1] * f; light[j + 2] += c[2] * f;
      }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = (y * w + x) * 8;
      const rgb = colorForCell({ kind: cells[o], variant: cells[o + 1], age: cells[o + 2] | (cells[o + 3] << 8),
        energy: cells[o + 4] | (cells[o + 5] << 8), flags: cells[o + 6] | (cells[o + 7] << 8),
        time: at * 50, cells, width: w, height: h, x, y }).map((c, chn) => c + light[(y * w + x) * 3 + chn]);
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const px = col * (cw + GAP) + (x - x0) * S + dx, py = row * (ch + GAP) + (y - y0) * S + dy;
        img.set(rgb.map((c) => Math.max(0, Math.min(255, Math.round(c)))), (py * W + px) * 3);
      }
    }
  });
  e.dispose?.();
});
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = resolve(repo, `.tmp/log/film-${name}${process.env.TAG ?? ''}.png`);
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(out, W, "x", H, "ticks", scene.film.join(","), "rows", variants.join(","));
