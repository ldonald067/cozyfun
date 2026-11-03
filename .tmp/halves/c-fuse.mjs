import { M } from "../../scripts/interaction-scenes.mjs";
// Gap g: the air between the two lines' middle rows.
const fuse = (gap) => ({ label: "fuse gap " + gap, w: 80, h: 70, seed: 167, ticks: 600, absent: true,
  paint: (p) => {
    for (let x = 6; x <= 36; x++) p(x, 58, 1, M.Rocket);
    for (let x = 38 + gap + 1; x <= 72; x++) p(x, 58, 1, M.Rocket);
    for (let x = 4; x <= 75; x++) p(x, 60, 0, M.Wall);
    p(6, 55, 1, M.Fire);
  },
  outcome: (g) => g.all(M.Rocket).filter((i) => g.energyAt(i) > 0 && g.xyOf(i)[0] >= 38 + gap) });
export const AGAINST = { "fuse gap 1": ["rocket-trail-never-lights"], "fuse gap 2": ["fuse-jumps-4"], "fuse gap 3": ["fuse-jumps-4"] };
AGAINST["fuse gap 4"] = AGAINST["fuse gap 5"] = ["fuse-jumps-6"];
export const CANDIDATES = [fuse(1), fuse(2), fuse(3), fuse(4), fuse(5)];
