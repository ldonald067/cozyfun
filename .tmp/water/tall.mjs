import { compileApp } from "../../scripts/compile-app.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
const { createFallbackEngine } = compileApp("water-tall", ["engine.ts", "materials.ts"]).load("engine");
const W = 96, H = 56, f = createFallbackEngine(W, H, 22);
for (let x = 4; x <= 30; x++) f.paint(x, 6, 0, M.Wall, 100); for (let y = 2; y <= 6; y++) f.paint(4, y, 0, M.Wall, 100);
for (let x = 20; x <= 70; x++) f.paint(x, 52, 0, M.Wall, 100);
for (let t = 1; t <= 340; t++) { if (t % 3 === 0) f.paint(12, 1, 1, M.Water, 100); f.tick(); }
const c = f.getCellBytes();
for (let y = 0; y < H; y += 2) { let l = ""; for (let x = 0; x < 60; x++) { const k = c[(y * W + x) * 8]; l += k === M.Water ? "~" : k === M.Wall ? "#" : "."; } console.log(l); }
