import { play, board, M } from "./proto.mjs";
const basin = (p) => { for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall); for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); } };
play({ w: 30, h: 26, seed: 140, ticks: 400,
  paint: (p) => { basin(p); for (let y = 15; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Water); },
  act: (p, t) => { if (t === 20) p(15, 13, 2, M.Fire); },
}, 20, (g, prev, t) => {
  const water = g.all(M.Water);
  const hot = water.filter((i) => g.energyAt(i) > 120).length;
  return `water ${water.length} hot ${hot} max ${Math.max(0, ...water.map((i) => g.energyAt(i)))} fire ${g.count(M.Fire)} steam ${g.count(M.Steam)}` + (t === 400 ? "\n" + board(g) : "");
});
