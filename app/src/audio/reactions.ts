import { CELL_FLAG, CELL_STRIDE, MATERIAL } from "../materials";

export const REACTION_CUES = ["impact-burst", "cleanse", "cosmic-charge", "bloom", "steam-flash"] as const;

export type ReactionCue = (typeof REACTION_CUES)[number];

const COSMIC_MARK_KINDS = new Set<number>([MATERIAL.Seed, MATERIAL.Moss, MATERIAL.Fungus, MATERIAL.Flower, MATERIAL.Soil]);

export function detectReactionCues(before: Uint8Array, after: Uint8Array): ReactionCue[] {
  const found = new Set<ReactionCue>();
  const len = Math.min(before.byteLength, after.byteLength);

  for (let idx = 0; idx + CELL_STRIDE <= len; idx += CELL_STRIDE) {
    const beforeKind = before[idx];
    const afterKind = after[idx];

    if (beforeKind === MATERIAL.Meteor && (afterKind === MATERIAL.Stone || afterKind === MATERIAL.Stardust)) {
      found.add("impact-burst");
    }
    if (beforeKind === MATERIAL.Moonwater && afterKind === MATERIAL.Stardust) {
      found.add("impact-burst");
    }
    if (beforeKind === MATERIAL.Oil && afterKind === MATERIAL.Stardust) {
      found.add("cleanse");
    }
    if (beforeKind === MATERIAL.Water && afterKind === MATERIAL.Moonwater) {
      found.add("cosmic-charge");
    }
    if (beforeKind === afterKind && COSMIC_MARK_KINDS.has(afterKind) && gainedFlag(before, after, idx, CELL_FLAG.Cosmic)) {
      found.add("cosmic-charge");
    }
    if (beforeKind === MATERIAL.Seed && afterKind === MATERIAL.Flower) {
      found.add("bloom");
    }
    if (afterKind === MATERIAL.Steam && beforeKind !== MATERIAL.Steam && isSteamFlashSource(beforeKind)) {
      found.add("steam-flash");
    }

    if (found.size === REACTION_CUES.length) break;
  }

  return REACTION_CUES.filter((cue) => found.has(cue));
}

function gainedFlag(before: Uint8Array, after: Uint8Array, idx: number, flag: number) {
  return (readU16(before, idx + 6) & flag) === 0 && (readU16(after, idx + 6) & flag) !== 0;
}

function isSteamFlashSource(kind: number) {
  return kind === MATERIAL.Water || kind === MATERIAL.Moonwater || kind === MATERIAL.Fire;
}

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
