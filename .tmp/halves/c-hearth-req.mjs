// The hearth absent check as written, and with its ice or its flame taken out.
import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
const c = CHECKS.find((x) => x.role === "thaws only against a brick touching the flame");
export const AGAINST = { "hearth": ["hearth-thaws-by-conduction"] };
export const CANDIDATES = [
  { ...c, label: "hearth" },
  { ...c, label: "hearth no ice", act: (p, t) => { if (t === 1) p(10, 11, 3, M.Water, 60); if (t >= 120 && t % 20 === 0) p(3, 16, 1, M.Fire); } },
  { ...c, label: "hearth no flame", act: (p, t) => { if (t === 1) p(10, 11, 3, M.Water, 60); if (t === 60) p(7, 13, 1, M.Ice); } },
];
