// The slow world: what a terrarium does while nobody is watching it.
//
// This module owns the whole ABSENCE POLICY — how much time away is worth, in both
// units, and in what order the two are applied. The rules themselves live in the two
// engines (`Universe::slow_step` in `sim/src/lib.rs`, mirrored in `engine.ts`); what
// lives here is everything the app and the harness must agree about.
//
// **Why absence needs a second unit.** The tick catch-up saturates at
// MAX_AWAY_GROWTH_TICKS after about 66 minutes, so measured in ticks a two-day
// absence is identical to a one-hour one. A ten-minute session runs roughly 15,800
// ticks — four times more than any absence can buy — so anything slow enough to be
// invisible while playing is far too slow to show after a night. Slow steps break
// that tie by running only on return. This is the argument; everywhere else that
// needs it should point here rather than restate it.
//
// It must stay free of `import.meta` and of React, exactly like `engine.ts` and
// `materials.ts`: `scripts/slow-world-audit.mjs` compiles it to CommonJS alongside
// the engine and the real renderer, and that is the second consumer that makes this
// a module rather than a private helper in `App.tsx`.

import { CELL_STRIDE, MATERIAL } from "./materials";

/** Slow steps added by each doubling of the time away. */
const SLOW_STEPS_PER_DOUBLING = 4;
/** A week away and a month away are the same visit; the world waits, it does not rot. */
const MAX_SLOW_STEPS = 24;
/**
 * Under an hour is a reload, not an absence. Stepping the world for a tab that was
 * closed over lunch would read as the game editing your scene behind your back.
 */
const SLOW_WORLD_MIN_AWAY_SECONDS = 3600;
/**
 * Away-time growth: one tick per second away, capped at ~66 sim-seconds so a long
 * absence enriches a scene without eroding it beyond recognition.
 */
const MAX_AWAY_GROWTH_TICKS = 4000;

/**
 * How many Flower NEIGHBOURS a cell needs before it counts as the crown of an open head.
 *
 * Counting Flower cells was the obvious version and it was wrong: a spent crown is still a
 * Flower cell, so four scattered sticks across a meadow scored as a bloom. The audit caught
 * it — with the stop-early rule sabotaged, the "arrived in flower" assertion still passed.
 * An opened head is a crown ringed by petals, so it is ADJACENCY that separates a flower
 * from its own leftovers: an unopened bud has no Flower neighbours by construction, and a
 * shed crown is alone again.
 */
const CROWN_NEIGHBOURS = 3;
/**
 * Catch-up left to run once a head has opened. Not zero: stopping dead would hand over a
 * garden that bloomed entirely off-screen, which is the same complaint as arriving after it.
 * This tail is spent on screen (App paces it at ~4x) so the arrival is WATCHED. It is short
 * enough to be safe — measured live, a head takes roughly 2,000 ticks to shed back down to
 * a bare crown, so 600 lands well inside the flower's life.
 */
export const WAKE_BLOOM_TAIL_TICKS = 600;

/** Anything that can take a slow step — the engine, without importing its module. */
type SlowSteppable = { slowStep(): void };

export type AbsencePlan = {
  /** Between-session steps earned. 1h -> 4, 12h -> 14, a day -> 18, a week -> 24. */
  slowSteps: number;
  /** Ordinary ticks to replay afterwards, one per second away and capped. */
  catchUpTicks: number;
};

export function planAbsence(secondsAway: number): AbsencePlan {
  const away = Number.isFinite(secondsAway) ? Math.max(0, secondsAway) : 0;
  const slowSteps =
    away < SLOW_WORLD_MIN_AWAY_SECONDS
      ? 0
      : Math.min(MAX_SLOW_STEPS, Math.floor(Math.log2(1 + away / 3600) * SLOW_STEPS_PER_DOUBLING));
  return { slowSteps, catchUpTicks: Math.min(Math.floor(away), MAX_AWAY_GROWTH_TICKS) };
}

/**
 * Wake a restored terrarium: take the slow steps the absence earned, and report the
 * catch-up still owed so the caller can replay it at whatever pace it likes.
 *
 * **The order is the feature, which is why it lives in one function.** A slow step
 * only changes conditions — cold char becomes plantable ground, a spent seed head
 * sows into the carpet — and the ordinary sim then plays those conditions forward, so
 * the player arrives to a garden rather than to a diff. Ticking first would leave
 * bare seeds sitting on soil. Both the app and `scripts/slow-world-audit.mjs` come
 * through here, so the gate cannot measure an order the app does not perform.
 */
/**
 * How much catch-up is left, given what the scene now looks like.
 *
 * **An absence should end on the rising action, not after it.** `catchUpTicks` saturates at
 * MAX_AWAY_GROWTH_TICKS and a bloom runs about that same length end to end, so any absence
 * over an hour used to spend the ENTIRE flowering invisibly: measured against the live
 * deployment, a player coming back after two days arrived at two or three Flower cells —
 * spent crowns, which read as sticks — with the whole event already over. Worse, the first
 * 3,400 of those ticks run 250 to a frame, a quarter-second of wall clock.
 *
 * So the wake stops early once a real head is open, leaving only the tail to play on screen.
 * A scene with nothing growing in it never trips this and spends its full budget exactly as
 * before, which is why the check is on the flowers rather than on a shorter cap: there is no
 * single tick count that lands mid-bloom for every scene, and picking one would be tuning to
 * whichever fixture was measured last.
 *
 * Deliberately NOT an engine rule — it changes how many ticks the app runs, not what a tick
 * does, so both engines stay byte-identical and parity is untouched.
 */
export function catchUpRemaining(cells: Uint8Array, remaining: number, width: number): number {
  if (remaining <= WAKE_BLOOM_TAIL_TICKS) return remaining;
  return aHeadIsOpen(cells, width) ? WAKE_BLOOM_TAIL_TICKS : remaining;
}

/**
 * Is any bloom currently OPEN — a crown with petals around it, rather than a bud that has
 * not unfurled or a crown that has already shed? Shared with
 * `scripts/slow-world-audit.mjs` on purpose, the same way `wakeTerrarium` is: a gate that
 * restated this would be free to drift from the rule the app actually applies.
 */
export function aHeadIsOpen(cells: Uint8Array, width: number): boolean {
  const count = cells.length / CELL_STRIDE;
  for (let i = 0; i < count; i++) {
    if (cells[i * CELL_STRIDE] !== MATERIAL.Flower) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    let petals = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny * width + nx >= count) continue;
        if (cells[(ny * width + nx) * CELL_STRIDE] === MATERIAL.Flower && ++petals >= CROWN_NEIGHBOURS) {
          return true;
        }
      }
    }
  }
  return false;
}

export function wakeTerrarium(engine: SlowSteppable, secondsAway: number): AbsencePlan {
  const plan = planAbsence(secondsAway);
  for (let step = 0; step < plan.slowSteps; step++) engine.slowStep();
  return plan;
}
