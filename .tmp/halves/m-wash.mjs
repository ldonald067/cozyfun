import { CHECKS, loadWasmEngine, grid, M } from "../../scripts/interaction-scenes.mjs";
import { measure } from "../lucky/measure.mjs";
const wash = CHECKS.find((c) => c.role === "running water washes cold char away");
measure("wash, no pour", { ...wash, act: undefined });
// What every counted cell IS at the end, over 32 seeds.
const engine = await loadWasmEngine();
const tally = {};
for (let k = 0; k < 32; k++) {
  const c = { ...wash, seed: wash.seed + k * 1000 };
  const u = engine.create(c.w, c.h, c.seed); const b = (x, y, r, m, d = 100) => u.paint(x, y, r, m, d);
  c.paint(b); for (let x = 1; x < c.w; x += 3) b(x, c.h - 4, 1, M.Wall);
  const before = grid(u.view().slice(), c.w, c.h); let prev = before; const memo = {}; let last = [];
  for (let t = 1; t <= c.ticks; t++) { c.act(b, t); u.tick(); const g = grid(u.view(), c.w, c.h); last = c.outcome(g, before, memo, prev).map((i) => g.kindOf(i)); prev = grid(u.view().slice(), c.w, c.h); }
  for (const k of last) tally[k] = (tally[k] ?? 0) + 1;
  u.free();
}
const name = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
console.log("counted cells at the end:", Object.entries(tally).map(([k, n]) => `${name[k]} ${n}`).join(", "));
