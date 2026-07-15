import { CELL_FLAG, CELL_STRIDE, MATERIAL } from "./materials";

export type DiscoveryId =
  | "first-ember"
  | "quenched-char"
  | "char-relight"
  | "vitrified-glass"
  | "starfire"
  | "cosmic-etching"
  | "freeze-thaw-crumble"
  | "first-bloom"
  | "moss-pioneer"
  | "fungus-takeover"
  | "moonlit-cleansing"
  | "meteor-burst"
  | "frost-bloom"
  | "charged-water";

export type Discovery = {
  id: DiscoveryId;
  title: string;
  description: string;
  hint: string;
};

export const DISCOVERIES: Discovery[] = [
  {
    id: "first-ember",
    title: "First Campfire",
    description: "Burning wood settled into a glowing ember instead of vanishing.",
    hint: "Wood remembers the fire."
  },
  {
    id: "quenched-char",
    title: "Quenched Embers",
    description: "Water hissed a hot ember down into cold wet char.",
    hint: "Cool something that still glows."
  },
  {
    id: "char-relight",
    title: "Second Wind",
    description: "Cold char caught heat again and glowed back to life.",
    hint: "Old fires are easy to restart."
  },
  {
    id: "vitrified-glass",
    title: "Vitrified Glass",
    description: "Strong heat fused dry sand into a translucent pane.",
    hint: "The desert keeps a molten secret."
  },
  {
    id: "starfire",
    title: "Starfire",
    description: "Stardust wrapped a flame and crystallized it into sparkle.",
    hint: "Fight fire with something gentler."
  },
  {
    id: "cosmic-etching",
    title: "Cosmic Etching",
    description: "Cosmic light settled into hard stone and left glittering marks.",
    hint: "Let the cosmos rest on something solid."
  },
  {
    id: "freeze-thaw-crumble",
    title: "Freeze-Thaw Crumble",
    description: "Repeated frost and thaw cracked a sealed wall into natural stone.",
    hint: "Winter and warmth take turns on old walls."
  },
  {
    id: "first-bloom",
    title: "First Bloom",
    description: "A wet, rooted seed opened into a flower.",
    hint: "Give a seed soil and rain."
  },
  {
    id: "moss-pioneer",
    title: "Moss Pioneer",
    description: "Moss crossed onto bare rock and made it home.",
    hint: "Keep hard surfaces damp and green nearby."
  },
  {
    id: "fungus-takeover",
    title: "Quiet Takeover",
    description: "Fungus claimed living growth for the decay cycle.",
    hint: "Decay waits patiently beside the garden."
  },
  {
    id: "moonlit-cleansing",
    title: "Moonlit Cleansing",
    description: "Moonwater dissolved oil into drifting stardust.",
    hint: "The cosmic liquid cleans what water cannot."
  },
  {
    id: "meteor-burst",
    title: "Meteor Burst",
    description: "A meteor met moonwater and burst into stardust.",
    hint: "Catch a falling rock in cosmic water."
  },
  {
    id: "frost-bloom",
    title: "Frost Bloom",
    description: "Steam frosted against ice and crystallized.",
    hint: "Warm breath meets a frozen window."
  },
  {
    id: "charged-water",
    title: "Charged Water",
    description: "Stardust charged plain water into moonwater.",
    hint: "Sprinkle the cosmos into a puddle."
  }
];

export const DISCOVERY_BY_ID = new Map(DISCOVERIES.map((discovery) => [discovery.id, discovery]));

const STORAGE_KEY = "cozy-pixel-sandbox:discoveries:v1";

export function loadDiscoveredIds(): Set<DiscoveryId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is DiscoveryId => DISCOVERY_BY_ID.has(id as DiscoveryId)));
  } catch {
    return new Set();
  }
}

export function saveDiscoveredIds(ids: ReadonlySet<DiscoveryId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage can be unavailable (private mode); discoveries then last for the session only.
  }
}

export function detectDiscoveries(
  before: Uint8Array,
  after: Uint8Array,
  alreadyFound: ReadonlySet<DiscoveryId>
): DiscoveryId[] {
  const found = new Set<DiscoveryId>();
  const remaining = DISCOVERIES.length - alreadyFound.size;
  if (remaining <= 0) return [];
  const len = Math.min(before.byteLength, after.byteLength);

  for (let idx = 0; idx + CELL_STRIDE <= len; idx += CELL_STRIDE) {
    const beforeKind = before[idx];
    const afterKind = after[idx];

    if (beforeKind === MATERIAL.Wood && afterKind === MATERIAL.Ember) found.add("first-ember");
    if (afterKind === MATERIAL.Glass && beforeKind !== MATERIAL.Glass) found.add("vitrified-glass");
    if (beforeKind === MATERIAL.Fire && afterKind === MATERIAL.Stardust) found.add("starfire");
    if (beforeKind === MATERIAL.Wall && afterKind === MATERIAL.Stone) found.add("freeze-thaw-crumble");
    if (beforeKind === MATERIAL.Seed && afterKind === MATERIAL.Flower) found.add("first-bloom");
    if ((beforeKind === MATERIAL.Stone || beforeKind === MATERIAL.Wall) && afterKind === MATERIAL.Moss) {
      found.add("moss-pioneer");
    }
    if ((beforeKind === MATERIAL.Moss || beforeKind === MATERIAL.Seed) && afterKind === MATERIAL.Fungus) {
      found.add("fungus-takeover");
    }
    if (beforeKind === MATERIAL.Oil && afterKind === MATERIAL.Stardust) found.add("moonlit-cleansing");
    if (beforeKind === MATERIAL.Moonwater && afterKind === MATERIAL.Stardust) found.add("meteor-burst");
    if (beforeKind === MATERIAL.Steam && afterKind === MATERIAL.Ice) found.add("frost-bloom");
    if (beforeKind === MATERIAL.Water && afterKind === MATERIAL.Moonwater) found.add("charged-water");

    if (beforeKind === MATERIAL.Ember && afterKind === MATERIAL.Ember) {
      const beforeFlags = readU16(before, idx + 6);
      const afterFlags = readU16(after, idx + 6);
      if ((beforeFlags & CELL_FLAG.Wet) === 0 && (afterFlags & CELL_FLAG.Wet) !== 0) found.add("quenched-char");
      if (readU16(before, idx + 4) < 60 && readU16(after, idx + 4) >= 200) found.add("char-relight");
    }

    if (
      beforeKind === afterKind &&
      (afterKind === MATERIAL.Stone || afterKind === MATERIAL.Wall) &&
      (readU16(before, idx + 6) & CELL_FLAG.Cosmic) === 0 &&
      (readU16(after, idx + 6) & CELL_FLAG.Cosmic) !== 0
    ) {
      found.add("cosmic-etching");
    }

    if (found.size >= remaining) break;
  }

  return DISCOVERIES.map((discovery) => discovery.id).filter(
    (id) => found.has(id) && !alreadyFound.has(id)
  );
}

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
