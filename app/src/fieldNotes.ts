import { CELL_STRIDE, MATERIAL } from "./materials";

// Mystical field notes: one-line observations that appear the FIRST time the player's
// terrarium produces something, written as if the desk's occupant noticed it too.
//
// The design here answers a specific failure. An earlier attempt at "discovery" fell
// flat for two reasons: things happened too fast to see, and with several reactions
// going at once the player could not tell WHICH one the message meant. So:
//
//   - Only generated outcomes qualify — kinds a brush cannot paint. A note can never
//     be about something the player just did themselves. (The two paintable
//     exceptions, moonwater and stone, are guarded by a recently-painted check.)
//   - One note at a time, and it lingers: the app holds each note on screen for
//     NOTE_LINGER_MS in its own line, never overwritten by functional status text.
//   - A hard cooldown between notes. If steam, embers and smoke all appear in the
//     same chaotic minute, ONE note fires; the others stay unwitnessed and surface
//     the next time their moment comes around, in a calmer scene. Discoveries are
//     deliberately spread across sessions rather than spent in the first minute.
//   - Each note fires once EVER (localStorage ledger). Seeing it is the discovery.
//
// Detection is count-based, not diff-based: a cheap pass every SAMPLE_EVERY_TICKS
// comparing per-kind counts against the previous sample. Count deltas survive any
// sim speed, which per-tick diffing would not, and cost nothing while idle.

export type FieldNote = {
  id: string;
  text: string;
};

type NoteRule = FieldNote & {
  kind: number;
  // The moment only counts with its cause on the board, so the note lands while the
  // player can still see what made it. Empty means the outcome alone is proof enough.
  requires?: readonly number[];
  // Minimum simultaneous cells before the moment is legible at play zoom.
  atLeast?: number;
};

// Ordered by wonder: when one sample window produces several first-times, the
// earliest entry in this list wins and the rest wait for their own moment.
const NOTE_RULES: readonly NoteRule[] = [
  { id: "flower.opens", kind: MATERIAL.Flower, atLeast: 4,
    text: "a bloom has opened — the garden kept its promise" },
  { id: "stem.climbs", kind: MATERIAL.Stem,
    text: "something green is climbing toward the dark" },
  { id: "glass.forms", kind: MATERIAL.Glass, requires: [MATERIAL.Lava, MATERIAL.Fire],
    text: "the heat pressed the sand into glass" },
  { id: "moonwater.charges", kind: MATERIAL.Moonwater, requires: [MATERIAL.Stardust],
    text: "the dust has taught the water to shine" },
  { id: "stone.born", kind: MATERIAL.Stone, requires: [MATERIAL.Lava],
    text: "the lava grows a skin of new stone" },
  { id: "ember.glows", kind: MATERIAL.Ember,
    text: "the wood keeps its warmth as embers" },
  { id: "pollen.drifts", kind: MATERIAL.Pollen,
    text: "the blooms are dusting the air" },
  { id: "spark.flies", kind: MATERIAL.Spark,
    text: "fire, briefly, learns to fly" },
  { id: "steam.rises", kind: MATERIAL.Steam,
    text: "fire and water argue in whispers of steam" },
  { id: "smoke.rises", kind: MATERIAL.Smoke,
    text: "the wood breathes out its years" },
];

// Paintable kinds guarded by the brush check: a rise in these only counts as a
// discovery when the player has not painted that material in the last few seconds.
const BRUSH_GUARDED = new Set<number>([MATERIAL.Moonwater, MATERIAL.Stone]);
const BRUSH_GUARD_MS = 5_000;

export const SAMPLE_EVERY_TICKS = 30;
export const NOTE_COOLDOWN_MS = 45_000;
export const NOTE_LINGER_MS = 8_000;

const LEDGER_KEY = "cozy-pixel-sandbox:fieldnotes:v1";

function loadLedger(): Set<string> {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export class FieldNoteJournal {
  private witnessed = loadLedger();
  private lastCounts: Map<number, number> | null = null;
  // Negative infinity, not 0: performance.now() is small early in a session, and a
  // zero sentinel silently put every fresh page inside the cooldown for its first
  // 45 seconds — which is exactly when a new player's first discovery happens.
  private lastNoteAt = Number.NEGATIVE_INFINITY;
  private lastPaintAt = new Map<number, number>();

  /** Everything witnessed so far — the seed for a future journal panel. */
  observed(): readonly string[] {
    return [...this.witnessed];
  }

  notePaint(material: number, now: number) {
    this.lastPaintAt.set(material, now);
  }

  /**
   * Feed one snapshot of cell bytes; returns a note the first time a legible moment
   * appears, or null. Callers own the cadence (every SAMPLE_EVERY_TICKS) and must
   * not sample during catch-up fast-forward — retroactive discoveries are exactly
   * the "it already happened, what was it?" confusion this module exists to avoid.
   */
  sample(cells: Uint8Array, now: number): FieldNote | null {
    const counts = new Map<number, number>();
    for (let offset = 0; offset < cells.length; offset += CELL_STRIDE) {
      const kind = cells[offset];
      if (kind !== MATERIAL.Empty) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const previous = this.lastCounts;
    this.lastCounts = counts;
    // The first sample of a session is baseline only: a restored scene full of glass
    // must not "discover" glass the player made last week.
    if (!previous) return null;
    if (now - this.lastNoteAt < NOTE_COOLDOWN_MS) return null;

    for (const rule of NOTE_RULES) {
      if (this.witnessed.has(rule.id)) continue;
      const have = counts.get(rule.kind) ?? 0;
      const had = previous.get(rule.kind) ?? 0;
      if (have <= had || have < (rule.atLeast ?? 1)) continue;
      if (rule.requires && !rule.requires.some((kind) => (counts.get(kind) ?? 0) > 0)) continue;
      if (BRUSH_GUARDED.has(rule.kind) && now - (this.lastPaintAt.get(rule.kind) ?? -Infinity) < BRUSH_GUARD_MS) continue;

      this.witnessed.add(rule.id);
      this.lastNoteAt = now;
      try {
        localStorage.setItem(LEDGER_KEY, JSON.stringify([...this.witnessed]));
      } catch {
        // Storage may be unavailable; the note still shows, it just may repeat one day.
      }
      return { id: rule.id, text: rule.text };
    }
    return null;
  }
}
