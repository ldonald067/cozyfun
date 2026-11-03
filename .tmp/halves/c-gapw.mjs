import { CHECKS } from "../../scripts/interaction-scenes.mjs";
import { M } from "../../scripts/interaction-scenes.mjs";
const base = CHECKS.find((x) => x.role === "a wide gap of air stops it");
// Gap g between the lines' middle rows: the near line's middle row ends at x = 37.
const gap = (g) => ({ ...base, label: "gap " + g,
  paint: (p) => {
    for (let x = 6; x <= 36; x++) p(x, 58, 1, M.Rocket);
    for (let x = 39 + g; x <= 72 + g; x++) p(x, 58, 1, M.Rocket);
    for (let x = 4; x <= 76 + g; x++) p(x, 60, 0, M.Wall);
  },
  w: 84 + g,
  outcome: (g2) => g2.all(M.Rocket).filter((i) => g2.energyAt(i) > 0 && g2.xyOf(i)[0] >= 38 + g) });
export const AGAINST = {};
export const CANDIDATES = [gap(4), gap(6), gap(8)];
