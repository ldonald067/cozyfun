// The batch-4 checks exactly as written in scripts/interaction-scenes.mjs, with variants.
import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
const by = (role, label = role) => ({ ...CHECKS.find((x) => x.role === role), label });
export const AGAINST = {
  "grows taller fed cosmic": ["cosmic-not-taller"],
  "pushes up through its own pool": ["spring-bare-face-only"],
  "fades once the fire is out": ["smoke-never-fades"],
  "thaws only against a brick touching the flame": ["hearth-thaws-by-conduction"],
  "vents from a side face under a downpour": ["soil-vents-up-only"],
  "pours again once the ice is erased": ["spring-stays-stilled"],
  "chain-lights powder beside a burst": ["burst-never-chains"],
};
const soil = by("vents from a side face under a downpour");
const spring = by("pours again once the ice is erased");
export const CANDIDATES = [
  ...Object.keys(AGAINST).map((r) => by(r)),
  { ...by("grows taller fed cosmic", "~ plain water"), paint: (p) => {
    for (let x = 8; x <= 212; x++) { p(x, 34, 1, M.Soil); p(x, 31, 0, M.Seed); }
    for (let x = 14; x <= 212; x += 12) p(x, 24, 2, M.Water);
  } },
  { ...soil, label: "~ soil as stone", paint: (p) => { p(15, 19, 6, M.Stone); } },
  { ...soil, label: "~ no dry spell", act: (p, t) => { if (t >= 10 && t < 40 && t % 3 === 0) p(15, 11, 5, M.Water); } },
  { ...spring, label: "~ ice left", act: (p, t) => { if (t === 4) for (const [x, y] of [[17, 14], [23, 14], [20, 11], [20, 17]]) p(x, y, 1, M.Ice); } },
  { ...by("chain-lights powder beside a burst", "~ no volley"), paint: (p) => {
    for (const cx of [14, 36]) { p(cx, 41, 3, M.Rocket); for (let x = cx - 6; x <= cx + 6; x++) p(x, 46, 0, M.Wall); }
  } },
];
