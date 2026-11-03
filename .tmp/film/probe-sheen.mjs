// Scratch: the swept worst cases for the sheen probe check, before writing it into the probe.
import { loadRenderer, redmeanDistance as redmean, M, F } from "../../scripts/interaction-scenes.mjs";
const { colorForCell } = loadRenderer("probe-sheen");
const W = 26, H = 14, S = 8;
const board = (paint) => { const c = new Uint8Array(W * H * S); paint((x, y, k, e = 0, a = 0, f = 0, v = 0) => { const o = (y * W + x) * S; c[o] = k; c[o + 1] = v & 7; c[o + 2] = a & 255; c[o + 4] = e & 255; c[o + 5] = e >> 8; c[o + 6] = f & 255; c[o + 7] = f >> 8; }); return c; };
const at = (c, x, y, t) => { const o = (y * W + x) * S; return colorForCell({ kind: c[o], variant: c[o + 1], age: c[o + 2], energy: c[o + 4] | (c[o + 5] << 8), flags: c[o + 6] | (c[o + 7] << 8), time: t, cells: c, width: W, height: H, x, y }); };
const TIMES = [0, 700, 1400, 2100, 2800, 3500, 4200, 4900, 6300, 9100];
const NEAR = [M.Empty, M.Oil, M.Water, M.Moss, M.Seed, M.Wall, M.Fire];
let worstOil = Infinity, atOil;
// A slick cell at (12,6) with every neighbour kind above, below and to the side it can meet.
for (const above of NEAR) for (const below of NEAR) for (const side of NEAR) for (const v of [0, 3, 7]) for (const e of [36, 120]) for (const fr of [0, F.Frozen]) {
  const slick = (flags) => board((put) => {
    for (let x = 8; x <= 16; x++) put(x, 6, M.Oil, e, 20, flags | fr, v);
    put(12, 5, above, 60, 20, 0, v); put(12, 7, below, 60, 20, 0, v); put(13, 6, side === M.Oil ? M.Oil : side, 60, 20, side === M.Oil ? flags | fr : 0, v);
  });
  const a = slick(0), b = slick(F.Cosmic);
  for (const t of TIMES) { const d = redmean(at(a, 12, 6, t), at(b, 12, 6, t)); if (d < worstOil) { worstOil = d; atOil = `above ${above} below ${below} side ${side} v${v} e${e} frozen ${!!fr} t${t}`; } }
}
console.log("sheened vs plain oil, worst:", worstOil.toFixed(0), atOil);
let worstFire = Infinity, atFire;
for (const e of [60, 150, 240]) for (const age of [0, 20, 60]) for (const v of [0, 1, 2, 3, 4, 5, 6, 7]) for (const [x, y] of [[12, 6], [5, 9], [19, 3]]) {
  const flame = (flags) => board((put) => { for (let i = 0; i < W; i++) put(i, 12, M.Wall); put(x, y, M.Fire, e, age, flags, v); put(x, y + 1, M.Oil, 36, 0, flags); });
  const a = flame(0), b = flame(F.Cosmic);
  let best = 0;
  for (let t = 0; t < 4000; t += 100) best = Math.max(best, redmean(at(a, x, y, t), at(b, x, y, t)));
  if (best < worstFire) { worstFire = best; atFire = `e${e} age${age} v${v} (${x},${y})`; }
}
console.log("cosmic vs plain fire, worst cell's best phase:", worstFire.toFixed(0), atFire);
