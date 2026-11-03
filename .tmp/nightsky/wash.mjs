// Scratch: render the shipped wash alone, beside the mock's B2 backdrop, and time it.
// node .tmp/nightsky/wash.mjs  -> .tmp/nightsky/wash-vs-mock.png
import { compileApp } from "../../scripts/compile-app.mjs";
import { writePng, readPng } from "./png.mjs";
const w = compileApp("nightsky-wash", ["rendering/nightWash.ts", "materials.ts"]).load("rendering/nightWash");
let t = performance.now();
const wash = w.paintNightWash(220, 140);
console.log(`painted ${wash.width}x${wash.height} in ${(performance.now() - t).toFixed(0)} ms`);
t = performance.now(); w.paintNightWash(220, 140); console.log(`again ${(performance.now() - t).toFixed(0)} ms`);
// board region, downscaled to the mock's 3.2 px a cell (704x448) by box filter at 4->3.2 is awkward: keep 4 px, crop board
const { x, y, width, height } = wash.board;
const out = new Uint8Array(width * height * 3);
for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
  const s = ((y + j) * wash.width + x + i) * 4, d = (j * width + i) * 3;
  out[d] = wash.data[s]; out[d + 1] = wash.data[s + 1]; out[d + 2] = wash.data[s + 2];
}
writePng(".tmp/nightsky/wash.png", width, height, out);
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const L = []; for (let i = 0; i < out.length; i += 3) L.push(lum(out[i], out[i + 1], out[i + 2]));
L.sort((a, b) => a - b);
console.log("wash luma p1/p50/p99/max", [0.01, 0.5, 0.99, 1].map((q) => L[Math.min(L.length - 1, Math.floor(q * L.length))].toFixed(1)).join(" / "));
console.log("washAt samples", [[0, 0], [50, 30], [110, 70], [200, 120]].map(([a, b]) => w.washAt(a, b).join(",")).join("  "));
