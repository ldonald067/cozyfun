// Scratch (2026-10-28): a log burning down. node .tmp/log/measure.mjs <variant,...> [seeds] [scene]
// Per seed: last tick with a hot ember (>90, lights neighbours), last tick with 5+ glowing
// embers (>40, the renderer's pulse), last with any ember >= 30 (not cold char), cells of char,
// wood left. Medians over seeds, in seconds at 20 ticks/s.
import { build } from "./variant.mjs";
import { SCENES, W, H } from "./scenes.mjs";
const [names = "live", seedsArg = "8", sname = "log"] = process.argv.slice(2);
const sc = SCENES[sname], seeds = Number(seedsArg);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const sec = (t) => (t / 20).toFixed(1);
for (const name of names.split(",")) {
  const { create, M } = build(name);
  const r = { hot: [], glow: [], warm: [], char: [], wood: [], peakGlow: [] };
  for (let s = 0; s < seeds; s++) {
    const e = create(W, H, 4100 + s * 7), p = (x, y, rr, m, d = 100) => e.paint(x, y, rr, m, d);
    sc.paint(p, M);
    let hot = 0, glow = 0, warm = 0, peakGlow = 0, b;
    for (let t = 1; t <= sc.ticks; t++) {
      sc.act(p, t, M); e.tick(); b = e.getCellBytes();
      let h = 0, g = 0, w = 0;
      for (let i = 0; i < b.length; i += 8) if (b[i] === M.Ember) { const E = b[i + 4] | (b[i + 5] << 8); if (E > 90) h++; if (E > 40) g++; if (E >= 30) w++; }
      if (h) hot = t; if (g >= 5) glow = t; if (w) warm = t; peakGlow = Math.max(peakGlow, g);
    }
    let char = 0, wood = 0;
    for (let i = 0; i < b.length; i += 8) { if (b[i] === M.Ember) char++; if (b[i] === M.Wood) wood++; }
    r.hot.push(hot); r.glow.push(glow); r.warm.push(warm); r.char.push(char); r.wood.push(wood); r.peakGlow.push(peakGlow);
  }
  console.log(`${name.padEnd(6)} lights-neighbours to ${sec(med(r.hot))}s  glowing(5+) to ${sec(med(r.glow))}s [${sec(Math.min(...r.glow))}-${sec(Math.max(...r.glow))}]  any warm to ${sec(med(r.warm))}s  char ${med(r.char)}  wood left ${med(r.wood)}  peak glowing ${med(r.peakGlow)}`);
}
