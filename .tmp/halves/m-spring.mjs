import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
import { measure } from "../lucky/measure.mjs";
const c = CHECKS.find((c) => c.role === "blocks flow between pours once attuned");
measure("attuned blocks", c);
measure("attuned blocks, springs as Wall", { ...c, paint: (p) => { c.paint((x, y, r, m, d) => p(x, y, r, m === M.Wellspring ? M.Wall : m, d)); } });
measure("attuned blocks, no water", { ...c, paint: (p) => { c.paint((x, y, r, m, d) => m !== M.Water && p(x, y, r, m, d)); } });
