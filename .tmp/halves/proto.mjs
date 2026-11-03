// Scratch: play a candidate scene on wasm and print per-tick stats.
import { M, F, loadWasmEngine, grid, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
const engine = await loadWasmEngine();
export function play({ w, h, seed, ticks, paint, act }, every, stat) {
  const uni = engine.create(w, h, seed);
  const p = (x, y, r, mat, d = 100) => uni.paint(x, y, r, mat, d);
  paint(p);
  for (let x = 1; x < w; x += 3) p(x, h - FLOOR_FROM_BOTTOM, 1, M.Wall);
  let prev = grid(uni.view().slice(), w, h);
  for (let t = 1; t <= ticks; t++) {
    if (act) act(p, t);
    uni.tick();
    const g = grid(uni.view().slice(), w, h);
    const s = stat(g, prev, t);
    if (t % every === 0 && s !== undefined) console.log(t, s);
    prev = g;
  }
  uni.free();
}
export function board(g) {
  const ch = { [M.Empty]: ".", [M.Water]: "~", [M.Ice]: "#", [M.Wall]: "W", [M.Fire]: "^", [M.Steam]: "s", [M.Sand]: ":", [M.Oil]: "o", [M.Stone]: "S" };
  let out = "";
  for (let y = 0; y < g.h; y++) { for (let x = 0; x < g.w; x++) out += ch[g.kindAt(x, y)] ?? "?"; out += "\n"; }
  return out;
}
export { M, F };
