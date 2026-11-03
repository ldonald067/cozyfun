import { measure } from "../lucky/measure.mjs";
const { CANDIDATES } = await import("./c-b2.mjs");
const get = (l) => CANDIDATES.find((c) => c.label === l);
measure("moss takes moonwater wall", get("moss takes moonwater wall"));
measure("moss wall, plain water", get("moss wall, plain water"));
const stem = get("stem freezes");
measure("stem freezes", stem);
measure("stem freezes, no ice", { ...stem, act: undefined });
