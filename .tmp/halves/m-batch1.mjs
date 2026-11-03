import { measure } from "../lucky/measure.mjs";
const { CANDIDATES: sand } = await import("./c-sand.mjs");
const { CANDIDATES: ice } = await import("./c-ice2.mjs");
for (const c of [...sand, ...ice.filter((c) => c.label.startsWith("hold9s"))]) measure(c.label, c);
const melt = ice.find((c) => c.label === "hold9s r3 melt");
measure("melt, no flame", { ...melt, act: undefined });
