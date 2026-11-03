// The eleven absent checks exactly as written in the scenes file, with their precondition or
// actor taken out, scored on the JS mirror and against the sabotage of the rule each guards.
import { CHECKS, M } from "../../scripts/interaction-scenes.mjs";
const by = (role) => { const c = CHECKS.find((x) => x.role === role); if (!c) throw new Error(role); return c; };
const swap = (c, from, to) => (p) => c.paint((x, y, r, m, d) => p(x, y, r, m === from ? to : m, d));
const drop = (c, mat) => (p) => c.paint((x, y, r, m, d) => { if (m !== mat) p(x, y, r, m, d); });
const pillar = by("a pillar holds"), hot = by("never freezes hot water"), dry = by("leaves dry stone and wall bare");
const smo = by("smothers hydration so seeds cannot sprout"), smo2 = by("is smothered by an oil coating"), blk = by("is blocked from feeding life by oil");
const pau = by("pauses life in frozen dormancy"), dor = by("waits dormant when frozen"), sha = by("never sprouts in the shadow of a neighbouring plant");
const res = by("resists casual moss crossing"), sti = by("is stilled by nearby ice");
const OIL = ["oil-never-dries", "oil-never-blocks", "oil-never-smothers"];
export const CANDIDATES = [
  { ...pillar, label: "pillar" }, { ...pillar, label: "pillar as wall", paint: swap(pillar, M.Stone, M.Wall) },
  { ...hot, label: "hot" }, { ...hot, label: "hot no flame", act: undefined },
  { ...dry, label: "dry" }, { ...dry, label: "dry no ice", act: undefined },
  ...[["smo", smo], ["smo2", smo2], ["blk", blk]].flatMap(([l, c]) => [
    { ...c, label: l }, { ...c, label: `${l} no water`, paint: drop(c, M.Water) }, { ...c, label: `${l} no oil`, paint: drop(c, M.Oil) }, { ...c, label: `${l} soil as wall`, paint: swap(c, M.Soil, M.Wall) }]),
  ...[["pau", pau], ["dor", dor]].flatMap(([l, c]) => [
    { ...c, label: l }, { ...c, label: `${l} no ice`, paint: drop(c, M.Ice) }, { ...c, label: `${l} no water`, paint: drop(c, M.Water) }, { ...c, label: `${l} soil as wall`, paint: swap(c, M.Soil, M.Wall) }]),
  { ...sha, label: "shadow" }, { ...sha, label: "shadow no water", paint: drop(sha, M.Water) },
  { ...res, label: "resists" }, { ...res, label: "resists no water", paint: drop(res, M.Water) }, { ...res, label: "resists no moss", paint: drop(res, M.Moss) },
  { ...sti, label: "stilled" }, { ...sti, label: "stilled no dab", paint: drop(sti, M.Water) }, { ...sti, label: "stilled sand dab", paint: swap(sti, M.Water, M.Sand) }, { ...sti, label: "stilled no ice", paint: drop(sti, M.Ice), act: undefined },
];
export const AGAINST = {
  pillar: ["stone-slips"], hot: ["ice-freezes-hot"], dry: ["ice-frosts-dry"], smo: OIL, smo2: OIL, blk: OIL,
  pau: ["frozen-seed-grows"], dor: ["frozen-seed-grows"], "pau no water": ["frozen-seed-grows"], "dor no water": ["frozen-seed-grows"], shadow: ["no-spacing"], resists: ["plain-moss-takes-wall"], stilled: ["spring-never-stilled"],
};
