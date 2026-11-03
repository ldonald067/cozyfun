import { measure, find } from "../lucky/measure.mjs";
const sand = find("sand.clumps", "half pace"), melt = find("water.boils", "hot water melts ice");
measure("wet sand (arrival)", sand);
measure("wet sand, no water", { ...sand, act: (p, t) => { if (t === 120) for (let x = 9; x <= 17; x++) p(x, 14, 1, 0); } });
measure("melt (credit expires)", melt);
