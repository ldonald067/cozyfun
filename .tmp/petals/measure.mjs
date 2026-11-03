// Scratch (2026-10-28): a shed petal's colour through the real renderer, per species, against
// the night background and against a pollen puff of the same variant. Redmean, floor 24 = visible.
import { loadRenderer, redmeanDistance } from "../../scripts/interaction-scenes.mjs";
const { colorForCell } = loadRenderer("petal-measure");
const W = 5, H = 5;
const cellAt = (kind, variant, age, energy, flags, floor) => {
  const cells = new Uint8Array(W * H * 8);
  const put = (x, y, k, v, a, e, f) => { const o = (y * W + x) * 8; cells[o] = k; cells[o + 1] = v; cells[o + 2] = a & 255; cells[o + 3] = a >> 8; cells[o + 4] = e & 255; cells[o + 5] = e >> 8; cells[o + 6] = f; };
  put(2, 2, kind, variant, age, energy, flags);
  if (floor) put(2, 3, 1, 0, 0, 0, 0);
  return cells;
};
const color = (cells, x, y, time) => colorForCell({ kind: cells[(y * W + x) * 8], variant: cells[(y * W + x) * 8 + 1], age: cells[(y * W + x) * 8 + 2] | (cells[(y * W + x) * 8 + 3] << 8), energy: cells[(y * W + x) * 8 + 4], flags: cells[(y * W + x) * 8 + 6], time, cells, width: W, height: H, x, y });
const names = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
const bg = color(cellAt(0, 0, 0, 0, 0, false), 2, 2, 0);
console.log("species      age  min-to-bg(fall) min-to-pollen(fall) to-bg(rest) to-pollen(rest)");
for (let v = 0; v < 8; v++) for (const age of [10, 70, 130]) {
  let fallBg = 1e9, fallPol = 1e9;
  for (let t = 0; t < 4000; t += 37) {
    const pet = color(cellAt(22, v, age, 150, 2, false), 2, 2, t), pol = color(cellAt(22, v, age, 150, 0, false), 2, 2, t);
    fallBg = Math.min(fallBg, redmeanDistance(pet, bg)); fallPol = Math.min(fallPol, redmeanDistance(pet, pol));
  }
  const pr = color(cellAt(22, v, age, 150, 2, true), 2, 2, 0), po = color(cellAt(22, v, age, 150, 0, true), 2, 2, 0);
  console.log(names[v].padEnd(12), String(age).padStart(4), fallBg.toFixed(0).padStart(10), fallPol.toFixed(0).padStart(16), redmeanDistance(pr, bg).toFixed(0).padStart(14), redmeanDistance(pr, po).toFixed(0).padStart(14), JSON.stringify(pr.map(Math.round)));
}
