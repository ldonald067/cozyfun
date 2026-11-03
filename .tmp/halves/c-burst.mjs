import { M, grid } from "../../scripts/interaction-scenes.mjs";
// Shelf powder that has left the shelf (lit and launched), counted where it was.
// Measured against the shelf as it settled by tick 5, before any burst.
const launched = (x0, x1, y0, y1) => (g, before, memo) => {
  memo.t = (memo.t ?? 0) + 1;
  if (memo.t <= 5) { memo.base = grid(g.cells.slice(), g.w, g.h); memo.against = memo.base; return []; }
  return g.vanished(M.Rocket, memo.base).filter((i) => {
    const [x, y] = g.xyOf(i); return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  });
};
export const AGAINST = { "open shelf": ["burst-never-chains"], "open shelf far": ["burst-never-chains"], "ceiling shelf 22": ["burst-never-chains"], "ceiling shelf 21": ["burst-never-chains"] };
const open = (x0) => ({ w: 44, h: 80, seed: 171, ticks: 900,
  paint: (p) => {
    for (let x = x0 + 1; x <= x0 + 11; x++) p(x, 44, 1, M.Rocket);
    for (let x = x0; x <= x0 + 12; x++) p(x, 46, 0, M.Wall);
    p(15, 72, 4, M.Rocket); p(15, 66, 4, M.Fire);
  },
  outcome: launched(x0, x0 + 12, 40, 45) });
const ceil = (s) => ({ w: 40, h: 44, seed: 168, ticks: 900,
  paint: (p) => {
    for (let x = 4; x <= 36; x++) p(x, 22, 1, M.Wall);
    for (let x = s + 1; x <= s + 9; x++) p(x, 25, 1, M.Rocket);
    for (let x = s; x <= s + 10; x++) p(x, 27, 0, M.Wall);
    p(15, 37, 4, M.Rocket); p(15, 31, 4, M.Fire);
  },
  outcome: launched(s, s + 10, 23, 26) });
export const CANDIDATES = [
  { label: "open shelf", ...open(22) }, { label: "open shelf far", ...open(24) },
  { label: "ceiling shelf 22", ...ceil(22) }, { label: "ceiling shelf 21", ...ceil(21) },
];
const mound = (sides) => ({ w: 50, h: 80, seed: 172, ticks: 900,
  paint: (p) => {
    for (const cx of sides) { p(cx, 41, 3, M.Rocket); for (let x = cx - 6; x <= cx + 6; x++) p(x, 46, 0, M.Wall); }
    p(25, 72, 4, M.Rocket); p(25, 66, 4, M.Fire);
  },
  outcome: (g, before, memo) => {
    memo.t = (memo.t ?? 0) + 1;
    if (memo.t <= 5) { memo.base = grid(g.cells.slice(), g.w, g.h); memo.against = memo.base; return []; }
    return g.vanished(M.Rocket, memo.base).filter((i) => { const [x, y] = g.xyOf(i); return y >= 36 && y <= 45 && Math.abs(x - 25) >= 6; });
  } });
AGAINST["mound right"] = AGAINST["mound both"] = ["burst-never-chains"];
CANDIDATES.push({ label: "mound right", ...mound([36]) }, { label: "mound both", ...mound([14, 36]) });
