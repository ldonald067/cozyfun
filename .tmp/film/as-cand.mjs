import { SCENES } from "./scenes.mjs";
export const AGAINST = {};
export const CANDIDATES = Object.entries(SCENES).map(([label, s]) => ({ ...s, label, ticks: Math.max(...s.ticks), outcome: () => [] }));
