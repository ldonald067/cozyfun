import { play, board, M } from "./proto.mjs";
const HOT = [M.Fire, M.Lava, M.Meteor];
const basin = (p) => { for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall); for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); } };
const [variant = "a", seed = "141"] = process.argv.slice(2);
const scenes = {
  a: { paint: (p) => { basin(p); for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice); }, act: (p, t) => { if (t === 20) p(15, 13, 3, M.Fire); } },
  b: { paint: (p) => { basin(p); for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice); }, act: (p, t) => { if (t >= 20 && t < 100 && t % 4 === 0) p(15, 12, 2, M.Fire); } },
  c: { paint: (p) => { basin(p); for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice); p(15, 14, 2, M.Oil); }, act: (p, t) => { if (t === 60) p(15, 11, 1, M.Fire); } },
};
let melts = 0, byHot = 0, fireMelts = 0;
play({ w: 30, h: 26, seed: Number(seed), ticks: 600, ...scenes[variant] }, 30, (g, prev, t) => {
  for (let i = 0; i < g.size; i++) {
    if (prev.kindOf(i) !== M.Ice || g.kindOf(i) !== M.Water) continue;
    const [x, y] = g.xyOf(i);
    let flame = false, hotWater = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = prev.kindAt(x + dx, y + dy);
      if (HOT.includes(k)) flame = true;
      if (k === M.Water && prev.energyAt((y + dy) * g.w + x + dx) > 120) hotWater = true;
    }
    melts++; if (flame) fireMelts++; else if (hotWater) byHot++;
  }
  const water = g.all(M.Water);
  return `ice ${g.count(M.Ice)} water ${water.length} hot ${water.filter((i) => g.energyAt(i) > 120).length} fire ${g.count(M.Fire)} oil ${g.count(M.Oil)} | melts ${melts} fire ${fireMelts} hotwater ${byHot}` + (t === 600 ? "\n" + board(g) : "");
});
