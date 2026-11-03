import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
import { measure } from "../lucky/measure.mjs";
const c = CHECKS.find((c) => c.role === "the embers it leaves dry wet fuel the same way");
measure("ember dries", c);
measure("ember dries, no water", { ...c, paint: (p) => p(15, 20, 6, M.Wood) });
measure("ember dries, no flame", { ...c, act: undefined });
