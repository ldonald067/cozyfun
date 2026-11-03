import { CHECKS } from "../../scripts/interaction-scenes.mjs";
import { measure } from "../lucky/measure.mjs";
for (const c of CHECKS.filter((c) => c.m === "Ember")) measure(`${c.covers} / ${c.role}`.slice(0, 44), c);
