import { M, MIST_ENERGY } from "../../scripts/interaction-scenes.mjs";
const births = (filter) => (g, before, memo, prev) => {
  memo.born ??= new Set();
  const age = (i) => g.cells[i * 8 + 2] | (g.cells[i * 8 + 3] << 8);
  for (let i = 0; i < g.size; i++) {
    if (g.kindOf(i) !== M.Steam || age(i) !== 0 || prev.kindOf(i) === M.Steam || g.energyAt(i) <= MIST_ENERGY) continue;
    if (filter(g, i, prev)) memo.born.add(i);
  }
  return [...memo.born];
};
const scene = { w: 30, h: 26, seed: 165, ticks: 2000, paint: (p) => { p(15, 19, 6, M.Soil); },
  act: (p, t) => { if (t >= 800 && t < 830 && t % 3 === 0) p(15, 11, 5, M.Water); } };
const sprinkle = { ...scene, act: (p, t) => { if (t >= 800 && t < 860 && t % 6 === 0) p(15, 11, 5, M.Water, 12); } };
export const AGAINST = { "pour births all": ["soil-vents-up-only"], "pour births upnotsoil": ["soil-vents-up-only"], "sprinkle births all": ["soil-vents-up-only"], "sprinkle births upnotsoil": ["soil-vents-up-only"] };
const upNotSoil = (g, i, prev) => { const [x, y] = g.xyOf(i); return prev.kindAt(x, y + 1) !== M.Soil; };
export const CANDIDATES = [
  { label: "pour births all", ...scene, outcome: births(() => true) },
  { label: "pour births upnotsoil", ...scene, outcome: births(upNotSoil) },
  { label: "sprinkle births all", ...sprinkle, outcome: births(() => true) },
  { label: "sprinkle births upnotsoil", ...sprinkle, outcome: births(upNotSoil) },
];
// Not an up-vent: the cell under the wisp did not take its first water this tick.
const notUpVent = (g, i, prev) => {
  const [x, y] = g.xyOf(i);
  const b = (y + 1) * g.w + x;
  return !(y + 1 < g.h && prev.kindOf(b) === M.Soil && prev.energyAt(b) === 0 && g.energyAt(b) > 0);
};
// Sticky at the birth cell while it is still mist.
const stay = (filter) => (g, before, memo, prev) => {
  const born = births(filter)(g, before, memo, prev);
  return born.filter((i) => g.kindOf(i) === M.Steam && g.energyAt(i) > MIST_ENERGY);
};
AGAINST["pour notup"] = AGAINST["sprinkle notup"] = AGAINST["pour notup stay"] = AGAINST["sprinkle notup stay"] = ["soil-vents-up-only"];
CANDIDATES.push(
  { label: "pour notup", ...scene, outcome: births(notUpVent) },
  { label: "sprinkle notup", ...sprinkle, outcome: births(notUpVent) },
  { label: "pour notup stay", ...scene, outcome: stay(notUpVent) },
  { label: "sprinkle notup stay", ...sprinkle, outcome: stay(notUpVent) },
);
