import { SCENES } from "./scenes.mjs";
import { M, F } from "../../scripts/interaction-scenes.mjs";
const s = SCENES["stardust-sheen"];
export const AGAINST = {};
export const CANDIDATES = [{ ...s, label: "sheen", ticks: 340, outcome: (g) => g.all(M.Oil).filter((i) => g.hasFlag(i, F.Cosmic)) }];
