import { M } from "../../scripts/interaction-scenes.mjs";
export const AGAINST = {};
export const CANDIDATES = [
  { label: "slick on pond", w: 50, h: 30, seed: 1, ticks: 400,
    paint: (p) => {
      for (let y = 14; y <= 26; y++) { p(6, y, 0, M.Wall); p(44, y, 0, M.Wall); }
      for (let x = 8; x <= 42; x++) for (let y = 21; y <= 25; y++) p(x, y, 0, M.Water);
      for (let x = 8; x <= 42; x++) p(x, 19, 0, M.Oil);
    },
    act: (p, t) => { if (t >= 60 && t <= 66) p(9, 17, 0, M.Fire); },
    outcome: (g) => g.all(M.Fire) },
  { label: "stardust on oil", w: 40, h: 30, seed: 2, ticks: 600,
    paint: (p) => { for (let x = 8; x <= 32; x++) p(x, 23, 1, M.Oil); p(20, 12, 2, M.Stardust); },
    outcome: (g) => g.all(M.Oil).filter((i) => g.hasFlag(i, 4)) },
];
