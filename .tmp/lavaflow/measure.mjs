// Scratch: how a lava pour spreads on a flat floor, per variant. node .tmp/lavaflow/measure.mjs <mode> [k] [spring]
import { build } from "./variant.mjs";
const [mode = "live", k = "4", spring] = process.argv.slice(2);
const { create, M, name } = build(mode, Number(k));
const W = 200, H = 60, FLOOR = H - 3;
const out = [];
let offs = [];
for (let s = 0; s < 6; s++) {
  const e = create(W, H, 21 + s), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
  for (let x = 0; x < W; x++) p(x, FLOOR, 1, M.Wall);
  const row = [];
  for (let t = 1; t <= 1200; t++) {
    if (t <= 40 && t % 4 === 1) p(W / 2, 20, 3, M.Lava);
    e.tick();
    if ([100, 300, 600, 1200].includes(t)) {
      const b = e.getCellBytes(); const h = new Array(W).fill(0); let n = 0, sx = 0, lava = 0;
      for (let i = 0, c = 0; i < b.length; i += 8, c++) {
        const kd = b[i]; if (kd !== M.Lava && kd !== M.Stone) continue;
        const x = c % W, y = Math.floor(c / W); if (y >= FLOOR - 1) {} 
        if (kd === M.Lava) lava++;
        n++; sx += x; h[x] = Math.max(h[x], FLOOR - 1 - y + 1);
      }
      const cols = h.map((v, i) => [v, i]).filter(([v]) => v > 0); const span = cols.length ? cols[cols.length - 1][1] - cols[0][1] + 1 : 0;
      row.push(`${(sx / n - W / 2).toFixed(1)} w${span} h${Math.max(...h)} L${lava}`);
      if (s === 0 && t === 1200) out.push("  profile s0 @1200: " + h.slice(40, 160).map((v) => (v > 9 ? "#" : v || ".")).join(""));
      if (s === 0 && t === 300) out.push("  profile s0 @300:  " + h.slice(40, 160).map((v) => (v > 9 ? "#" : v || ".")).join(""));
    }
  }
  offs.push(row.join(" | "));
}
console.log(`== ${name}  offset/width/height/lava at 5,15,30,60 s\n  ${offs.join("\n  ")}\n${out.join("\n")}`);
if (spring) {
  const count = (e, kd) => { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === kd) n++; return n; };
  const SW = 220, SH = 140, sp = create(SW, SH, 3), q = (x, y, r, m) => sp.paint(x, y, r, m, 100);
  for (let x = 0; x < SW; x++) q(x, SH - 2, 1, M.Wall); q(110, 100, 4, M.Wellspring); for (let t = 0; t < 5; t++) sp.tick(); q(110, 94, 1, M.Lava);
  const r = []; let t = 0; for (const at of [1000, 4000, 16000]) { while (t < at) { sp.tick(); t++; } r.push(`t${at} lava ${(100 * count(sp, M.Lava) / (SW * SH)).toFixed(1)}% stone ${count(sp, M.Stone)}`); }
  console.log("  spring: " + r.join("  "));
}
