// Scratch: how much poured lava and oil survive, and how far a spring floods, per variant.
// node .tmp/lava/measure.mjs <variant> [pour|pool|spring]
import { build } from "./variant.mjs";
const [name = "live", what = "pour", tag = ""] = process.argv.slice(2);
const { create, M } = build(name);
const count = (e, k) => { const b = e.getCellBytes(); let n = 0; for (let i = 0; i < b.length; i += 8) if (b[i] === k) n++; return n; };
const basin = (p, w, top, bottom, left, right) => {
  for (let x = 0; x < w; x++) p(x, bottom + 1, 1, M.Wall);
  for (let y = top; y <= bottom + 1; y++) { p(left, y, 1, M.Wall); p(right, y, 1, M.Wall); }
};
if (what === "pour") {
  // The water budget's pour, for lava and oil: 30 dabs into a 40x30 basin, then left alone.
  for (const kind of ["Lava", "Oil"]) {
    const rows = [];
    for (let s = 0; s < 4; s++) {
      const e = create(40, 30, 5 + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
      basin(p, 40, 10, 27, 1, 38);
      let painted = 0; const at = [];
      for (let t = 1; t <= 690; t++) {
        if (t <= 90 && t % 3 === 1) { const b4 = count(e, M[kind]); p(20, 4, 4, M[kind]); painted += count(e, M[kind]) - b4; }
        e.tick();
        if ([90, 200, 400, 690].includes(t)) at.push(`${count(e, M[kind])}${kind === "Lava" ? "/" + count(e, M.Stone) : ""}`);
      }
      rows.push(`${painted} painted -> ${at.join(" ")}`);
    }
    console.log(`${(name + tag).padEnd(18)} ${kind} pour (t=90,200,400,690${kind === "Lava" ? ", lava/stone" : ""}): ${rows.join("  ;  ")}`);
  }
}
if (what === "spring") {
  // The water budget's spring on the real 220x140 board, for lava and oil.
  for (const kind of ["Lava", "Oil"]) {
    const W = 220, H = 140, e = create(W, H, 3), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    for (let x = 0; x < W; x++) p(x, H - 2, 1, M.Wall);
    p(110, 100, 4, M.Wellspring);
    for (let t = 0; t < 5; t++) e.tick();
    p(110, 94, 1, M[kind]);
    const out = []; let t = 0;
    for (const at of [1000, 4000, 8000]) {
      while (t < at) { e.tick(); t++; }
      const n = count(e, M[kind]);
      out.push(`t${at}: ${n} (${((100 * n) / (W * H)).toFixed(1)}%)${kind === "Lava" ? " stone " + count(e, M.Stone) : ""}`);
    }
    console.log(`${(name + tag).padEnd(18)} ${kind} spring: ${out.join("   ")}`);
  }
}
if (what === "long") {
  // The lava pour left alone for 2.5 minutes: does a kept pool ever set into stone?
  const e = create(40, 30, 5), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
  basin(p, 40, 10, 27, 1, 38);
  const at = [];
  for (let t = 1; t <= 3000; t++) { if (t <= 90 && t % 3 === 1) p(20, 4, 4, M.Lava); e.tick(); if (t % 500 === 0) at.push(`t${t} ${count(e, M.Lava)}/${count(e, M.Stone)}`); }
  console.log(`${(name + tag).padEnd(18)} lava pool left alone (lava/stone): ${at.join("  ")}`);
}
