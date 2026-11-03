import { CHECKS } from "../../scripts/interaction-scenes.mjs";
const by = (role) => ({ ...CHECKS.find((c) => c.role === role), label: role });
export const CANDIDATES = [by("lands as stardust"), by("bursts against a ceiling")];
export const AGAINST = {
  "lands as stardust": ["meteor-never-stardust", "meteor-dust-dies"],
  "bursts against a ceiling": ["ceiling-fizzles", "burst-dust-dies"],
};
