// Batch C visibility on painted scenes: (1) frost thawed by lava before it touches it;
// (2) ice melted by hot water, and how much of the melt stays melted.
import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const BASE = process.env.BASE === "1";
const app = compileApp(BASE ? "bc-base" : "bc-now", ["materials.ts", "engine.ts"], BASE ? { root: resolve(import.meta.dirname, "base") } : {});
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const S = 8;
const fl = (c, i) => c[i + 6] | (c[i + 7] << 8);
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
{
  const out = [];
  for (const seed of seeds) {
    const W = 48, H = 30, e = createFallbackEngine(W, H, seed);
    const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    for (let x = 4; x <= 44; x++) p(x, 24, 1, M.Wall);
    for (let x = 6; x <= 42; x++) p(x, 22, 0, M.Moss);
    p(30, 19, 2, M.Ice);
    let thawedNearLava = 0, frozenPeak = 0;
    for (let t = 1; t <= 900; t++) {
      if (t >= 300 && t < 340 && t % 4 === 0) p(14, 12, 1, M.Lava, 60);
      const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
      let frozen = 0;
      for (let i = 0; i < a.length; i += S) {
        if (fl(a, i) & F.Frozen) frozen++;
        if (!(fl(b, i) & F.Frozen) || fl(a, i) & F.Frozen || a[i] !== b[i]) continue;
        const c = i / S, x = c % W, y = (c - x) / W;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && b[(ny * W + nx) * S] === M.Lava) near = true; }
        if (near) thawedNearLava++;
      }
      if (t === 299) frozenPeak = frozen;
    }
    out.push(`${thawedNearLava}/${frozenPeak}`);
  }
  console.log(`frost thawed with lava within 2 / frosted cells before the pour: ${out.join(" ")}`);
}
{
  const out = [];
  for (const seed of seeds) {
    const W = 48, H = 30, e = createFallbackEngine(W, H, seed);
    const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
    for (let x = 4; x <= 44; x++) { p(x, 26, 1, M.Wall); }
    // A pot: walls two thick, water in it, fire under its floor; an ice slab against its side.
    for (let y = 14; y <= 24; y++) { p(10, y, 0, M.Wall); p(22, y, 0, M.Wall); }
    for (let x = 10; x <= 22; x++) p(x, 23, 0, M.Wall);
    for (let x = 13; x <= 19; x += 2) for (let y = 16; y <= 20; y += 2) p(x, y, 1, M.Water);
    for (let x = 24; x <= 32; x += 2) for (let y = 14; y <= 22; y += 2) p(x, y, 1, M.Ice);
    const iceAt0 = () => { const a = e.getCellBytes(); let n = 0; for (let i = 0; i < a.length; i += S) if (a[i] === M.Ice) n++; return n; };
    const start = iceAt0();
    let hotMelts = 0;
    for (let t = 1; t <= 1200; t++) {
      if (t % 3 === 0) p(16, 25, 1, M.Fire, 50);
      // pour hot? the pot's water heats over the fire; ladle some onto the slab now and then
      if (t > 400 && t % 30 === 0) { const a = e.getCellBytes(); for (let x = 12; x <= 20; x++) for (let y = 14; y <= 22; y++) { const o = (y * W + x) * S; if (a[o] === M.Water && (a[o + 4] | (a[o + 5] << 8)) > 120) { e.paint(25, 10, 0, M.Water, 100); y = 99; x = 99; } } }
      const b = e.getCellBytes().slice(); e.tick(); const a = e.getCellBytes();
      for (let i = 0; i < a.length; i += S) if (b[i] === M.Ice && a[i] === M.Water && (a[i + 4] | (a[i + 5] << 8)) > 40) hotMelts++;
    }
    out.push(`${start}->${iceAt0()} (${hotMelts} hot melts)`);
  }
  console.log(`ice in the slab start->end: ${out.join(" ")}`);
}
