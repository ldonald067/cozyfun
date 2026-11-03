import { play, board, M } from "./proto.mjs";
const basin = (p) => { for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall); for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); } };
const [seed = "142"] = process.argv.slice(2);
play({ w: 30, h: 26, seed: Number(seed), ticks: 500,
  paint: (p) => { basin(p); for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Water); },
  act: (p, t) => { if (t === 30) p(15, 10, 2, M.Oil); if (t === 80) p(15, 10, 1, M.Fire); },
}, 10, (g, prev, t) => {
  const water = g.all(M.Water);
  return `water ${water.length} hot ${water.filter((i) => g.energyAt(i) > 120).length} max ${Math.max(0, ...water.map((i) => g.energyAt(i)))} fire ${g.count(M.Fire)} oil ${g.count(M.Oil)} steam ${g.count(M.Steam)}` + (t === 120 ? "\n" + board(g) : "");
});
