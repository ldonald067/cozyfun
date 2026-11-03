// Scratch: the review's chain. A puff beside a dry wall, a tick, then fire held beside the wall:
// ordinary steam and water cell-ticks over 200 ticks, with and without the puff, on the tree.
import { build } from "./variant.mjs";
const { create, M } = build(process.argv[2] ?? "live");
for (const withPuff of [true, false]) {
  let steam = 0, water = 0, peakWater = 0;
  for (let s = 0; s < 4; s++) {
    const w = 32, h = 24, e = create(w, h, 50 + s), b = new Uint8Array(w * h * 8);
    const put = (x, y, k, E = 0, f = 0, age = 0) => { const o = (y * w + x) * 8; b[o] = k; b[o + 1] = 1; b[o + 2] = age & 255; b[o + 4] = E; b[o + 6] = f; };
    for (let x = 10; x <= 20; x++) for (let y = 12; y <= 14; y++) put(x, y, M.Wall);
    if (withPuff) put(15, 11, M.Steam, 120, 2, 10);
    e.loadCellBytes(b);
    e.tick();
    for (let t = 0; t < 200; t++) {
      if (t % 4 === 0) e.paint(15, 10, 1, M.Fire, 100);
      e.tick();
      const c = e.getCellBytes(); let wn = 0;
      for (let i = 0; i < c.length; i += 8) { if (c[i] === M.Steam && !(c[i + 6] & 2)) steam++; if (c[i] === M.Water) { water++; wn++; } }
      peakWater = Math.max(peakWater, wn);
    }
  }
  console.log(`${withPuff ? "with a puff " : "without     "}: ordinary steam ${steam} cell-ticks, water ${water} cell-ticks, peak water ${peakWater}`);
}
