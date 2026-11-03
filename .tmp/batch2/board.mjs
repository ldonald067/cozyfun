// Scratch: print a candidate's board at chosen ticks (live JS mirror). node .tmp/batch2/board.mjs <candidate> <seed> <t,t,...> [x0,y0,x1,y1]
import { compileApp } from "../../scripts/compile-app.mjs";
import { M, F, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { CANDIDATES } from "./candidates.mjs";
const [name, seedArg, ticksArg, cropArg] = process.argv.slice(2);
const c = CANDIDATES[name];
const e = compileApp("b2-board", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine(c.w, c.h, Number(seedArg ?? c.seed));
const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
c.paint(p);
for (let x = 1; x < c.w; x += 3) p(x, c.h - FLOOR_FROM_BOTTOM, 1, M.Wall);
const name2ch = { [M.Empty]: ".", [M.Wall]: "#", [M.Water]: "~", [M.Ice]: "I", [M.Lava]: "L", [M.Stone]: "o", [M.Steam]: "s", [M.Fire]: "f", [M.Ember]: "e", [M.Wood]: "w" };
const [x0, y0, x1, y1] = (cropArg ?? `0,0,${c.w - 1},${c.h - 1}`).split(",").map(Number);
const want = ticksArg.split(",").map(Number);
for (let t = 1; t <= Math.max(...want); t++) {
  if (c.act) c.act(p, t);
  e.tick();
  if (!want.includes(t)) continue;
  const b = e.getCellBytes();
  console.log(`-- tick ${t}  (# wall, F frosted wall, ~ water, I ice, L lava, o stone, s steam)`);
  for (let y = y0; y <= y1; y++) {
    let row = "";
    for (let x = x0; x <= x1; x++) {
      const o = (y * c.w + x) * 8, k = b[o], fl = b[o + 6] | (b[o + 7] << 8);
      row += k === M.Wall && fl & F.Frozen ? "F" : (name2ch[k] ?? "?");
    }
    console.log(row);
  }
}
