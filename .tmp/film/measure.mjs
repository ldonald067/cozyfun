import { loadRenderer, redmeanDistance, M, F } from "../../scripts/interaction-scenes.mjs";
const { colorForCell } = loadRenderer("film-measure");
const W = 30, H = 12;
// A slick 3 rows deep on water, every oil cell with or without the sheen; a burning row likewise.
function board(kind, flags, energy) {
  const c = new Uint8Array(W * H * 8);
  const set = (x, y, k, e, f, v) => { const o = (y * W + x) * 8; c[o] = k; c[o + 1] = v; c[o + 4] = e & 255; c[o + 5] = e >> 8; c[o + 6] = f; };
  for (let x = 2; x < W - 2; x++) { for (let y = 5; y <= 7; y++) set(x, y, kind, energy, flags, (x * 3 + y) & 7); for (let y = 8; y <= 10; y++) set(x, y, M.Water, 0, 0, x & 3); }
  return c;
}
function compare(kind, energy, label) {
  const a = board(kind, 0, energy), b = board(kind, F.Cosmic, energy);
  const d = [];
  for (let t = 0; t < 40000; t += 777) for (let y = 5; y <= 7; y++) for (let x = 2; x < W - 2; x++) {
    const o = (y * W + x) * 8;
    const ctx = (cells) => ({ kind: cells[o], variant: cells[o + 1], age: 20, energy, flags: cells[o + 6], time: t, cells, width: W, height: H, x, y });
    d.push(redmeanDistance(colorForCell(ctx(a)), colorForCell(ctx(b))));
  }
  d.sort((p, q) => p - q);
  console.log(`${label}: per-cell redmean, sheened vs plain — min ${d[0].toFixed(0)}  p10 ${d[Math.floor(d.length * 0.1)].toFixed(0)}  median ${d[d.length >> 1].toFixed(0)}`);
}
compare(M.Oil, 36, "oil  ");
compare(M.Fire, 150, "fire ");
