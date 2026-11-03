// Scratch: how far ice's glint actually moves a top-edge cell, in luminance.
import { resolve } from "node:path";
import { loadRenderer, M } from "../../scripts/interaction-scenes.mjs";
const repo = resolve(import.meta.dirname, "../.."), W = 60, H = 30;
const color = loadRenderer("solids-iceglint", repo).colorForCell;
const c = new Uint8Array(W * H * 8);
for (let y = 10; y < 28; y++) for (let x = 5; x < 55; x++) { const o = (y * W + x) * 8; c[o] = M.Ice; c[o + 1] = (x * 7 + y * 3) & 7; }
const lum = ([r, g, b]) => r * 0.3 + g * 0.59 + b * 0.11;
const swings = [];
for (let x = 6; x < 54; x++) { const o = (10 * W + x) * 8; const l = Array.from({ length: 50 }, (_, i) => lum(color({ kind: M.Ice, variant: c[o + 1], age: 0, energy: 0, flags: 0, time: 1000 + i * 50, cells: c, width: W, height: H, x, y: 10 }))); swings.push([Math.min(...l), Math.max(...l)]); }
const moved = swings.filter(([a, b]) => b - a > 0.5);
console.log("top cells", swings.length, "moved", moved.length, moved.map(([a, b]) => `${a.toFixed(0)}->${b.toFixed(0)}`).join(" "), "| typical", swings[0][0].toFixed(0));
