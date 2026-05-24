import { CELL_STRIDE, MATERIAL } from "./materials";

export type ReactionEvent = {
  cue: "steam" | "cool" | "growth" | "spark";
  intensity: number;
};

type ReactionCounts = Record<ReactionEvent["cue"], number>;

export function detectReactionEvents(before: Uint8Array, after: Uint8Array): ReactionEvent[] {
  const counts: ReactionCounts = {
    steam: 0,
    cool: 0,
    growth: 0,
    spark: 0
  };

  const length = Math.min(before.byteLength, after.byteLength);
  for (let idx = 0; idx < length; idx += CELL_STRIDE) {
    const oldKind = before[idx];
    const newKind = after[idx];
    if (oldKind === newKind) continue;

    if (newKind === MATERIAL.Steam && (oldKind === MATERIAL.Water || oldKind === MATERIAL.Moonwater || oldKind === MATERIAL.Fire)) {
      counts.steam++;
      continue;
    }
    if (oldKind === MATERIAL.Lava && newKind === MATERIAL.Stone) {
      counts.cool++;
      continue;
    }
    if ((oldKind === MATERIAL.Seed || oldKind === MATERIAL.Soil || oldKind === MATERIAL.Wood) && (newKind === MATERIAL.Moss || newKind === MATERIAL.Fungus)) {
      counts.growth++;
      continue;
    }
    if (oldKind === MATERIAL.Meteor || newKind === MATERIAL.Stardust) {
      counts.spark++;
    }
  }

  return (Object.keys(counts) as ReactionEvent["cue"][])
    .filter((cue) => counts[cue] > 0)
    .map((cue) => ({ cue, intensity: Math.min(1, counts[cue] / 18) }));
}
