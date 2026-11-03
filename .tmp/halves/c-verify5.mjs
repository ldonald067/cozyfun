import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
const by = (role, label = role) => ({ ...CHECKS.find((x) => x.role === role), label });
export const AGAINST = {
  "its fanned trail lights a fuse it passes": ["trail-straight-down"],
  "is set alight by falling sparks": ["spark-never-lights-oil"],
  "takes a rainbow sheen from stardust": ["stardust-never-sheens"],
  "a sheened slick burns like a firework": ["sheen-burns-plain"],
};
const burn = by("a sheened slick burns like a firework");
const fw = by("is set alight by falling sparks");
export const CANDIDATES = [
  ...Object.keys(AGAINST).map((r) => by(r)),
  { ...burn, label: "~ plain slick burns", paint: (p) => { burn.paint(p); for (const x of [16, 28, 40, 50]) p(x, 26, 1, M.Empty); } },
  { ...fw, label: "~ no fireworks", act: undefined, paint: (p) => { fw.paint(p); p(17, 56, 3, M.Empty); } },
];
