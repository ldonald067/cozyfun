// Scratch: material census of a scene at given ticks. node .tmp/steam/census.mjs <variant> <scene> <t,t,..> [seed]
import { build } from "./variant.mjs";
import { SCENES, W, H } from "./scenes.mjs";
const [name, sname, ts, seedArg = "4100"] = process.argv.slice(2);
const { create, M } = build(name);
const names = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
const sc = SCENES[sname], e = create(W, H, Number(seedArg)), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
sc.paint(p, M);
const at = ts.split(",").map(Number); let t = 0;
for (const stop of at) {
  while (t < stop) { t++; sc.act(p, t, M); e.tick(); }
  const b = e.getCellBytes(), c = {};
  for (let i = 0; i < b.length; i += 8) if (b[i]) { const E = b[i + 4] | (b[i + 5] << 8); const k = names[b[i]] + (b[i] === M.Ember ? (E > 90 ? "(hot)" : E >= 30 ? "(warm)" : "(char)") : b[i] === M.Steam ? (E > 30 ? "(hot)" : "(mist)") : ""); c[k] = (c[k] ?? 0) + 1; }
  delete c.Wall;
  console.log(`t=${t}`, JSON.stringify(c));
}
