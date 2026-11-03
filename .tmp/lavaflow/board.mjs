// Scratch: print the "water never deletes the lava" scene at a few ticks. node .tmp/lavaflow/board.mjs <seed>
import { build } from "./variant.mjs";
const seed = Number(process.argv[2] ?? 25169);
const { create, M } = build("live");
const W = 70, H = 44, e = create(W, H, seed), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
for (const x of [1, 67]) for (let y = 20; y <= 39; y++) { p(x, y, 0, M.Wall); p(x + 1, y, 0, M.Wall); }
p(22, 26, 4, M.Lava); p(47, 26, 3, M.Water);
for (let x = 1; x < W; x += 3) p(x, H - 4, 1, M.Wall);
const ch = { [M.Lava]: "L", [M.Water]: "w", [M.Stone]: "#", [M.Wall]: "=", [M.Steam]: "~", [0]: "." };
for (let t = 1; t <= 600; t++) { e.tick(); if ([40, 100, 200, 400, 600].includes(t)) { const b = e.getCellBytes(); console.log("t" + t); for (let y = 28; y < 41; y++) { let s = ""; for (let x = 0; x < W; x++) s += ch[b[(y * W + x) * 8]] ?? "?"; console.log(s); } } }
