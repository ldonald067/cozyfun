import { M, F } from "../../scripts/interaction-scenes.mjs";
// Wet sand on a wall shelf, the shelf erased: a wet grain with air under it that did not move.
const shelf = (p) => { for (let x = 9; x <= 17; x++) p(x, 14, 0, M.Wall); };
const hang = (g, before, memo, prev) => g.all(M.Sand).filter((i) => {
  if (prev.kindOf(i) !== M.Sand || !prev.hasFlag(i, F.Wet)) return false;
  const [x, y] = g.xyOf(i);
  return prev.kindAt(x, y + 1) === M.Empty && g.kindAt(x, y + 1) === M.Empty;
});
const pond = (p, liquid) => {
  for (let y = 18; y <= 25; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, liquid);
  for (let x = 6; x <= 24; x++) p(x, 26, 1, M.Wall);
  for (let y = 12; y <= 26; y++) { p(7, y, 1, M.Wall); p(23, y, 1, M.Wall); }
};
const underOil = (g) => g.all(M.Sand).filter((i) => {
  const [x, y] = g.xyOf(i);
  for (let ay = y - 1; ay >= 0; ay--) {
    const above = g.kindAt(x, ay);
    if (above === M.Oil) return true;
    if (above !== M.Sand) return false;
  }
  return false;
});
export const CANDIDATES = [
  { label: "wet sand hangs", w: 26, h: 64, seed: 143, ticks: 400,
    paint: (p) => { shelf(p); p(13, 11, 2, M.Sand); },
    act: (p, t) => { if (t === 20) p(13, 6, 1, M.Water); if (t === 120) for (let x = 9; x <= 17; x++) p(x, 14, 0, M.Empty); },
    outcome: hang },
  { label: "dry sand hangs (no water)", w: 26, h: 64, seed: 143, ticks: 400,
    paint: (p) => { shelf(p); p(13, 11, 2, M.Sand); },
    act: (p, t) => { if (t === 120) for (let x = 9; x <= 17; x++) p(x, 14, 0, M.Empty); },
    outcome: hang },
  { label: "sand under oil", w: 30, h: 28, seed: 144, ticks: 600,
    paint: (p) => { pond(p, M.Oil); p(15, 8, 3, M.Sand); },
    outcome: underOil },
];
