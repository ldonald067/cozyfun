// Batch 5 candidate checks. node .tmp/halves/try-map.mjs .tmp/halves/c-b5.mjs <seeds> [label]
import { M, F, grid } from "../../scripts/interaction-scenes.mjs";
const fuseLaunched = (g, before, memo) => {
  memo.t = (memo.t ?? -1) + 1;
  if (memo.t <= 5) { memo.against = grid(g.cells.slice(), g.w, g.h); return []; }
  return g.vanished(M.Rocket, memo.against).filter((i) => { const [x, y] = g.xyOf(i); return x >= 22 && y >= 57 && y <= 61; });
};
const meteorFuse = (every, last) => ({ w: 48, h: 96, seed: 175, ticks: 700,
  paint: (p) => { for (let x = 24; x <= 38; x++) p(x, 60, 1, M.Rocket); for (let x = 22; x <= 40; x++) p(x, 62, 0, M.Wall); },
  act: (p, t) => { if (t % every === 1 && t <= last) p(19, 8, 0, M.Meteor); },
  outcome: fuseLaunched });
const pond = { w: 64, h: 64, seed: 176, ticks: 400,
  paint: (p) => {
    for (let x = 4; x <= 60; x++) p(x, 41, 0, M.Wall);
    for (let y = 51; y <= 60; y++) { p(26, y, 0, M.Wall); p(60, y, 0, M.Wall); }
    for (let x = 28; x <= 58; x++) for (let y = 55; y <= 59; y++) p(x, y, 0, M.Water);
    for (let x = 28; x <= 58; x++) p(x, 52, 0, M.Oil);
    p(17, 56, 3, M.Rocket);
  },
  act: (p, t) => { if (t <= 60 && t % 10 === 1) p(17, 54, 0, M.Fire); },
  outcome: (g) => g.all(M.Fire).filter((i) => g.xyOf(i)[0] >= 27 && g.xyOf(i)[1] >= 48) };
const slick = (stardust, flame) => ({ w: 64, h: 50, seed: 177, ticks: flame ? 420 : 300,
  paint: (p) => {
    for (let y = 32; y <= 46; y++) { p(6, y, 0, M.Wall); p(58, y, 0, M.Wall); }
    for (let x = 8; x <= 56; x++) for (let y = 41; y <= 45; y++) p(x, y, 0, M.Water);
    for (let x = 8; x <= 56; x++) p(x, 38, 0, M.Oil);
    if (stardust) for (const x of [16, 28, 40, 50]) p(x, 26, 1, M.Stardust);
  },
  act: flame ? (p, t) => { if (t >= 300 && t <= 303) p(9, 35, 0, M.Fire); } : undefined,
  outcome: flame ? (g) => g.all(M.Spark) : (g, before) => g.gained(M.Oil, F.Cosmic, before) });
export const AGAINST = {
  "meteors past fuse 40x12": ["trail-straight-down"], "meteors past fuse 30x16": ["trail-straight-down"],
  "fireworks over slick": ["spark-never-lights-oil"], "one meteor past fuse": ["trail-straight-down"],
  "sheen": ["stardust-never-sheens"], "sheen burns": ["sheen-burns-plain"],
};
export const CANDIDATES = [
  { label: "meteors past fuse 40x12", ...meteorFuse(40, 450) },
  { label: "one meteor past fuse", ...meteorFuse(1000, 1) },
  { label: "meteors past fuse 30x16", ...meteorFuse(30, 460) },
  { label: "fireworks over slick", ...pond },
  { label: "fireworks no rockets", ...pond, paint: (p) => { pond.paint(p); p(17, 56, 3, M.Empty); }, act: undefined },
  { label: "sheen", ...slick(true, false) },
  { label: "sheen burns", ...slick(true, true) },
  { label: "plain slick burns", ...slick(false, true) },
];
