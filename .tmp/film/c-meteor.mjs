import { M, grid } from "../../scripts/interaction-scenes.mjs";
export const AGAINST = { "meteor past fuse": ["trail-straight-down"], "shower past fuse": ["trail-straight-down"] };
const launched = (g, before, memo) => {
  memo.t = (memo.t ?? -1) + 1;
  if (memo.t <= 5) { memo.against = grid(g.cells.slice(), g.w, g.h); return []; }
  return g.vanished(M.Rocket, memo.against).filter((i) => { const [x, y] = g.xyOf(i); return x >= 22 && y >= 57 && y <= 61; });
};
const scene = (meteor) => ({ w: 48, h: 96, seed: 3, ticks: 140,
  paint: (p) => { for (let x = 23; x <= 38; x++) p(x, 60, 1, M.Rocket); for (let x = 22; x <= 40; x++) p(x, 62, 0, M.Wall); meteor(p); },
  outcome: launched });
export const CANDIDATES = [
  { label: "meteor past fuse", ...scene((p) => p(19, 8, 0, M.Meteor)) },
  { label: "shower past fuse", ...scene((p) => p(16, 8, 3, M.Meteor)) },
];
