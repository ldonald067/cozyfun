import { CELL_STRIDE, MATERIAL } from "./materials";
import type { SceneEnvironmentId } from "./sceneEnvironments";

// Room weather (Phase 12D): with the window open, the backdrop leans into the tray as
// REAL cells — drizzle in Rain Desk is water that actually feeds a garden, snow in Snow
// Window is ice settling on real surfaces, a meteor over Stardust Hearth truly falls.
//
// Tonight's sky comes from the DATE: the local YYYY-MM-DD seeds a small PRNG that picks
// each room's intensity and rhythm for the day, so Tuesday's drizzle is not Wednesday's,
// two visits on the same evening feel like the same night, and there is no server. The
// stream is deliberately separate from the engine's RNG — weather is player-shaped input
// through the same paint API as the brush, not a simulation rule, so the two engines
// stay byte-identical by construction.
//
// Weather must never flood the toy: every drop type has a cell-count ceiling, checked
// from a cheap cached census, so an open window left overnight settles into a drizzly
// equilibrium instead of filling the tray.

export type WeatherDrop = {
  x: number;
  y: number;
  radius: number;
  material: number;
  density: number;
};

type RoomPattern = {
  material: number;
  /** Mean ticks between drops at intensity 1. */
  every: number;
  density: number;
  /** Stop dropping when this kind already occupies more than `cap` of the grid. */
  cap: number;
  /** Snow settles at the surface instead of falling from the sky. */
  settles?: boolean;
};

// Rates are means, jittered per-drop. Caps are fractions of total cells.
//
// The two window rooms were originally an order of magnitude busier than the rest:
// measured over five-minute runs across six seed days, Rain Desk dropped every 1.8s
// and Snow Window every 2.8s, against roughly one a minute for Stardust Hearth and
// Forest Hut. That reads as constant weather rather than weather — water was always
// falling somewhere, and the 6% cap is a puddle about eight cells deep across the
// whole floor, which nothing drains. Both are now brought toward the calmer rooms:
// a shower is something that arrives, not the room's default state.
const PATTERNS: Partial<Record<SceneEnvironmentId, RoomPattern>> = {
  "rain-desk": { material: MATERIAL.Water, every: 340, density: 22, cap: 0.02 },
  "snow-window": { material: MATERIAL.Ice, every: 420, density: 25, cap: 0.015, settles: true },
  "stardust-hearth": { material: MATERIAL.Meteor, every: 2600, density: 100, cap: 0.0005 },
  "moonwater-garden": { material: MATERIAL.Moonwater, every: 420, density: 20, cap: 0.03 },
  "forest-hut": { material: MATERIAL.Seed, every: 3600, density: 25, cap: 0.002 },
  // cozy-fireplace: indoors on purpose. That room's weather is the fire you build.
};

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const CENSUS_EVERY_TICKS = 300;

// Kinds that are only passing through a column, not standing in it.
const AIRBORNE: ReadonlySet<number> = new Set([
  MATERIAL.Smoke,
  MATERIAL.Steam,
  MATERIAL.Pollen,
  MATERIAL.Spark,
  MATERIAL.Fire,
  MATERIAL.Meteor,
]);

export class RoomWeather {
  private rng: () => number;
  private intensity = new Map<SceneEnvironmentId, number>();
  private phase: number;
  private nextDropAt = new Map<SceneEnvironmentId, number>();
  private censusAt = -Infinity;
  private censusCounts = new Map<number, number>();

  constructor(dateKey = todayKey()) {
    this.rng = mulberry32(hashString(dateKey));
    this.phase = this.rng() * Math.PI * 2;
  }

  /** Tonight's temperament for a room: calm, ordinary, or lively. Fixed per day. */
  private intensityFor(room: SceneEnvironmentId): number {
    let value = this.intensity.get(room);
    if (value === undefined) {
      const tiers = [0.55, 1, 1.7];
      value = tiers[Math.floor(this.rng() * tiers.length)] ?? 1;
      this.intensity.set(room, value);
    }
    return value;
  }

  /**
   * Called once per sim tick while the window is open. Returns at most one drop.
   * `sampleCells` is only invoked on the rare ticks that actually need a census or a
   * surface, so the steady-state cost is a map lookup and a comparison.
   */
  drop(
    room: SceneEnvironmentId,
    tick: number,
    width: number,
    height: number,
    sampleCells: () => Uint8Array
  ): WeatherDrop | null {
    const pattern = PATTERNS[room];
    if (!pattern) return null;

    const due = this.nextDropAt.get(room);
    if (due === undefined) {
      // First sight of this room today: schedule the opening drop soon, so an open
      // window visibly IS one within a few seconds rather than a rumour.
      this.nextDropAt.set(room, tick + Math.round(pattern.every * 0.3 * (0.5 + this.rng())));
      return null;
    }
    if (tick < due) return null;

    // Breathe: a slow deterministic swell makes showers gather and pass within a
    // session instead of metronoming. Same phase all day, per the date seed.
    const swell = Math.sin(tick / 900 + this.phase) > 0.55 ? 2 : 1;
    const interval = (pattern.every / (this.intensityFor(room) * swell)) * (0.6 + this.rng() * 0.8);
    this.nextDropAt.set(room, tick + Math.max(20, Math.round(interval)));

    if (tick - this.censusAt >= CENSUS_EVERY_TICKS) {
      const cells = sampleCells();
      this.censusCounts.clear();
      for (let offset = 0; offset < cells.length; offset += CELL_STRIDE) {
        const kind = cells[offset];
        if (kind !== MATERIAL.Empty) this.censusCounts.set(kind, (this.censusCounts.get(kind) ?? 0) + 1);
      }
      this.censusAt = tick;
    }
    if ((this.censusCounts.get(pattern.material) ?? 0) > pattern.cap * width * height) return null;

    const x = 2 + Math.floor(this.rng() * (width - 4));
    if (!pattern.settles) {
      return { x, y: 1, radius: 1, material: pattern.material, density: pattern.density };
    }

    // Snow settles: find the top of whatever STANDS in this column and rest a speck on
    // it. Ice never falls in this sim, so dropping it from the sky would leave flakes
    // hanging mid-air; settled frost on roofs and ground is the honest version. The scan
    // skips airborne kinds for the same reason — a drifting pollen mote or a rising wisp
    // is briefly the "top" of its column, then moves on, and a flake that settled on it
    // is left floating in the sky. (Caught from a capture: two ice specks hanging in
    // mid-air over a garden, exactly where a mote had been.)
    const cells = sampleCells();
    let surface = height - 1;
    for (let y = 0; y < height; y++) {
      const kind = cells[(y * width + x) * CELL_STRIDE];
      if (kind !== MATERIAL.Empty && !AIRBORNE.has(kind)) {
        surface = y;
        break;
      }
    }
    if (surface <= 2) return null;
    // Bump the census so a blizzard of settled specks still respects the cap between
    // full recounts.
    this.censusCounts.set(pattern.material, (this.censusCounts.get(pattern.material) ?? 0) + 1);
    return { x, y: surface - 1, radius: 1, material: pattern.material, density: pattern.density };
  }
}
