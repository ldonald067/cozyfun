// Scratch (2026-10-23): peak and mean steam on the 220x140 play board, main (.tmp/steam/base)
// against the working tree, default brush (radius 4, density 55 for liquids and fire).
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
const W = 220, H = 140, N = W * H, seeds = Number(process.argv[2] ?? 4);
const basin = (p, M, x0, x1, top, floor) => { for (let x = x0; x <= x1; x++) p(x, floor, 1, M.Wall); for (let y = top; y <= floor; y++) { p(x0, y, 1, M.Wall); p(x1, y, 1, M.Wall); } };
const SC = {
  "water on a lava pool": { ticks: 600, paint: (p, M) => { basin(p, M, 60, 160, 110, 132); for (let x = 66; x <= 154; x += 6) p(x, 126, 4, M.Lava); },
    act: (p, t, M) => { if (t >= 20 && t < 80 && t % 2 === 0) p(90 + ((t * 7) % 40), 95, 4, M.Water, 55); } },
  "flame held to a pond": { ticks: 600, paint: (p, M) => { basin(p, M, 40, 180, 110, 132); for (let x = 46; x <= 174; x += 6) p(x, 127, 4, M.Water); },
    act: (p, t, M) => { if (t < 400 && t % 2 === 0) p(110 + ((t * 5) % 20) - 10, 120, 4, M.Fire, 55); } },
  "a doused bonfire": { ticks: 600, paint: (p, M) => { for (let x = 60; x <= 160; x++) p(x, 133, 1, M.Wall); for (let y = 118; y <= 130; y += 3) for (let x = 80; x <= 140; x += 6) p(x, y, 3, M.Wood); },
    act: (p, t, M) => { if (t === 2) { p(100, 112, 3, M.Fire, 55); p(120, 112, 3, M.Fire, 55); } if (t >= 70 && t < 130 && t % 2 === 0) p(90 + ((t * 7) % 40), 95, 4, M.Water, 55); } },
};
for (const [label, opts] of [["main", { root: resolve(import.meta.dirname, "base") }], ["tree", {}]]) {
  const app = compileApp(`steam-bound-${label}`, ["engine.ts", "materials.ts"], opts);
  const M = app.load("materials").MATERIAL, { createFallbackEngine } = app.load("engine");
  for (const [name, sc] of Object.entries(SC)) { if (process.argv[3] && !name.includes(process.argv[3])) continue;
    const peaks = [], means = [];
    for (let s = 0; s < seeds; s++) {
      const e = createFallbackEngine(W, H, 900 + s), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
      sc.paint(p, M);
      let peak = 0, sum = 0;
      for (let t = 1; t <= sc.ticks; t++) {
        sc.act(p, t, M); e.tick();
        const b = e.getCellBytes(); let n = 0;
        for (let i = 0; i < b.length; i += 8) if (b[i] === M.Steam) n++;
        peak = Math.max(peak, n); sum += n;
      }
      peaks.push(peak); means.push(sum / sc.ticks);
    }
    const pc = (v) => `${(100 * v / N).toFixed(2)}%`;
    console.log(`${label.padEnd(5)} ${name.padEnd(22)} peak ${peaks.map(pc).join(" ")}   mean over ${sc.ticks} ticks ${means.map(pc).join(" ")}`);
  }
}
