// The slow world: how much a terrarium changes while nobody is watching it.
//
// The rules themselves live in the two engines (`Universe::slow_step` in
// `sim/src/lib.rs`, mirrored in `engine.ts`). This module owns only the question
// the app has to answer at boot: given an absence, how many slow steps did it earn?
//
// It exists as its own module because that curve is the part worth measuring —
// `scripts/slow-world-audit.mjs` compiles it to CommonJS alongside the engine and
// the real renderer to check that a day away is visibly different from an hour.
// It must therefore stay free of `import.meta` and of React, exactly like
// `engine.ts` and `materials.ts`.
//
// Why absence needs its own unit at all: the app's tick catch-up saturates at
// MAX_AWAY_GROWTH_TICKS after about 66 minutes, so measured in ticks, two days away
// is identical to one hour. A ten-minute session runs roughly 15,800 ticks — four
// times more than any absence can buy — so anything slow enough to be invisible
// while playing is far too slow to show up after a night. Slow steps break that tie
// by running only on return.

/** Slow steps added by each doubling of the time away. */
const SLOW_STEPS_PER_DOUBLING = 4;
/** A week away and a month away are the same visit; the world waits, it does not rot. */
const MAX_SLOW_STEPS = 24;
/**
 * Under an hour is a reload, not an absence. Stepping the world for a tab that was
 * closed over lunch would read as the game editing your scene behind your back.
 */
const SLOW_WORLD_MIN_AWAY_SECONDS = 3600;

/** Slow steps earned by an absence. 1h -> 4, 12h -> 14, a day -> 18, a week -> 24. */
export function slowStepsForAbsence(secondsAway: number): number {
  if (!Number.isFinite(secondsAway) || secondsAway < SLOW_WORLD_MIN_AWAY_SECONDS) return 0;
  const hours = secondsAway / 3600;
  return Math.min(MAX_SLOW_STEPS, Math.floor(Math.log2(1 + hours) * SLOW_STEPS_PER_DOUBLING));
}
