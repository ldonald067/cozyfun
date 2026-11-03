import { play, board, M, F } from "./proto.mjs";
play({ w: 30, h: 26, seed: 147, ticks: 1440,
  paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 1, M.Water); },
  act: (p, t) => { if (t === 200) p(15, 17, 1, M.Ice); if (t === 1400) p(15, 16, 2, M.Lava); },
}, 1, (g, prev, t) => {
  if (![199, 220, 1399, 1401, 1405, 1420, 1440].includes(t)) return undefined;
  const frozen = []; for (let i = 0; i < g.size; i++) if (g.kindOf(i) !== M.Ice && g.hasFlag(i, F.Frozen)) frozen.push(i);
  return `frozen ${frozen.length} lava ${g.count(M.Lava)}\n` + board(g).split("\n").slice(12, 23).join("\n");
});
