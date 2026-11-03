// Scratch: the deep end against everything dark it can sit beside, through the real renderer.
import { compileApp } from "../../scripts/compile-app.mjs";
import { loadRenderer, M, redmeanDistance as rd } from "../../scripts/interaction-scenes.mjs";
const { colorForCell } = loadRenderer("water-d");
const { WASH_DEEP, WASH_INDIGO, WASH_VIOLET } = compileApp("water-d2", ["rendering/nightWash.ts", "materials.ts"]).load("rendering/nightWash");
const W = 20, H = 40, mk = () => new Uint8Array(W * H * 8), put = (c, x, y, k, v = 0) => { const o = (y * W + x) * 8; c[o] = k; c[o + 1] = v; };
const col = (c, x, y, time = 1000) => { const o = (y * W + x) * 8; return colorForCell({ kind: c[o], variant: c[o + 1], age: 0, energy: 0, flags: 0, time, cells: c, width: W, height: H, x, y }); };
const c = mk(); for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) put(c, x, y, M.Water, (x * 7 + y * 3) & 255);
for (const d of [1, 2, 3, 4, 6, 8, 12, 16, 20, 30]) { const y = 2 + d; const s = [[0,0,0]]; let worst = 1e9, rgb; for (let t = 0; t < 4000; t += 40) { rgb = col(c, 10, y, t); for (const w of [WASH_DEEP, WASH_INDIGO, WASH_VIOLET]) worst = Math.min(worst, rd(rgb, w)); } console.log("depth", String(d).padStart(2), rgb.map(Math.round).join(","), "worst vs night", Math.round(worst)); }
// Beside other dark materials, deep water's worst case over variants and clock.
for (const [name, k] of [["oil", M.Oil], ["stone", M.Stone], ["moonwater", M.Moonwater], ["ice", M.Ice]]) {
  const b = mk(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(b, x, y, k, (x * 7 + y * 3) & 255);
  let worst = 1e9; for (let v = 0; v < 8; v++) for (let t = 0; t < 2000; t += 80) { const a = col(c, 10 + v % 3, 28, t); worst = Math.min(worst, rd(a, col(b, 10, 20 + v, t))); }
  console.log("deep water vs", name, Math.round(worst));
}
