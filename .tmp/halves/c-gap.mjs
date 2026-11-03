import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
const c = { ...CHECKS.find((x) => x.role === "a wide gap of air stops it"), label: "wide gap" };
export const AGAINST = { "wide gap": ["fuse-jumps-8"] };
export const CANDIDATES = [c, { ...c, label: "wide gap unlit", act: undefined },
  { ...c, label: "wide gap line cut short", paint: (p) => {
    for (let x = 6; x <= 32; x++) p(x, 58, 1, M.Rocket);
    for (let x = 45; x <= 78; x++) p(x, 58, 1, M.Rocket);
    for (let x = 4; x <= 82; x++) p(x, 60, 0, M.Wall);
  } }];
