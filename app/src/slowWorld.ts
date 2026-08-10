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
export function wakeTerrarium(engine: SlowSteppable, secondsAway: number): AbsencePlan {
  const plan = planAbsence(secondsAway);
  for (let step = 0; step < plan.slowSteps; step++) engine.slowStep();
  return plan;
}
