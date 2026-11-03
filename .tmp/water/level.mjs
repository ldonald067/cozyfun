// Scratch: does the basin level once the pour stops? Prints the surface height per column.
import { compileApp } from "../../scripts/compile-app.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
const { createFallbackEngine } = compileApp("water-level", ["engine.ts", "materials.ts"]).load("engine");
const W = 96, H = 56, e = createFallbackEngine(W, H, Number(process.argv[2] ?? 11));
const p = (x, y, r, m) => e.paint(x, y, r, m, 100);
for (let x = 4; x <= 40; x++) p(x, 20, 0, M.Wall); for (let y = 15; y <= 20; y++) p(4, y, 0, M.Wall);
for (let x = 30; x <= 90; x++) p(x, 52, 0, M.Wall); for (let y = 36; y <= 52; y++) { p(30, y, 0, M.Wall); p(90, y, 0, M.Wall); }
for (let x = 60; x <= 66; x++) for (let y = 44; y <= 50; y++) p(x, y, 0, M.Stone);
const prof = () => { const c = e.getCellBytes(); const hs = []; for (let x = 32; x <= 88; x += 4) { let top = 50; while (top > 0 && c[(top * W + x) * 8] === M.Water) top--; hs.push(50 - top); } return hs.join(" "); };
for (let t = 1; t <= 1700; t++) { if (t <= 478 && t % 3 === 0) p(12, 8, 1, M.Water); e.tick(); if ([478, 520, 600, 800, 1100, 1700].includes(t)) console.log(String(t).padStart(5), prof()); }
