// Scratch: print a region. node .tmp/steam/board.mjs <variant> <scene> <tick> <x0,y0,x1,y1> [seed]
import { build } from "./variant.mjs";
import { SCENES, W, H } from "./scenes.mjs";
const [name, sname, tick, box, seed = "4100"] = process.argv.slice(2);
const { create, M } = build(name);
const sc = SCENES[sname], e = create(W, H, Number(seed)), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
sc.paint(p, M);
for (let t = 1; t <= Number(tick); t++) { sc.act(p, t, M); e.tick(); }
const [x0, y0, x1, y1] = box.split(",").map(Number), b = e.getCellBytes();
for (let y = y0; y <= y1; y++) {
  let row = String(y).padStart(3) + " ";
  for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 8, k = b[i], f = b[i + 6], E = b[i + 4] | (b[i + 5] << 8);
    row += k === M.Steam ? (f & 2 ? "p" : f & 128 ? "B" : E > 30 ? "S" : "m") : k === M.Water ? "~" : k === M.Fire ? "F" : k === M.Wall ? "#" : k === M.Smoke ? "s" : k ? "?" : ".";
  }
  console.log(row);
}
