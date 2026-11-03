// Scratch: steam by mark and energy band over time. node .tmp/steam/flags.mjs <variant> <scene> <t,t,..>
import { build } from "./variant.mjs";
import { SCENES, W, H } from "./scenes.mjs";
const [name, sname, ts] = process.argv.slice(2);
const { create, M } = build(name);
const sc = SCENES[sname], e = create(W, H, 4100), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
sc.paint(p, M);
let t = 0;
for (const stop of ts.split(",").map(Number)) {
  while (t < stop) { t++; sc.act(p, t, M); e.tick(); }
  const b = e.getCellBytes(), c = {};
  let water = 0, hotWater = 0;
  for (let i = 0; i < b.length; i += 8) {
    const E = b[i + 4] | (b[i + 5] << 8), f = b[i + 6] | (b[i + 7] << 8), age = b[i + 2] | (b[i + 3] << 8);
    if (b[i] === M.Water) { water++; if (E > 150) hotWater++; }
    if (b[i] !== M.Steam) continue;
    const k = (f & 2 ? "puff" : f & 128 ? "billowed" : "plain") + (E > 30 ? ">30" : "<=30") + (age < 20 ? ":young" : "");
    c[k] = (c[k] ?? 0) + 1;
  }
  console.log(`t=${t} water ${water} (>150: ${hotWater})`, JSON.stringify(c));
}
