# Simulation rules

`sim/src/lib.rs` is the source of truth for behaviour. Every user-visible rule here MUST be
mirrored in `app/src/engine.ts` and behave byte-for-byte identically — see the root
`CLAUDE.md` for the full invariant and the parity workflow.

## Physics gotchas that have already cost time

- **`Universe::new` clamps width and height to ≥16.** Shrinking a test grid below 16 is a
  silent no-op, so a "tiny" fixture is quietly a 16×16 one.
- **Wall is the only immovable scaffold.** Stone falls when unsupported. Test frames, floors,
  ceilings and showcase display stands MUST be Wall, never Stone.
- **Powders need a floor wide enough to hold them.** Soil, sand and seeds slide off a
  one-cell pedestal diagonally, so a planter built on a single Wall cell collapses and takes
  the plant with it. Several tests were debugged twice over this.
- **Order matters inside a tick.** `age_and_decay` runs, then `apply_reactions`, then the
  bottom-up pass, then the top-down pass. Rules read `old` and write `next`; reading `next`
  means you see whatever earlier cells in the same tick already did.

## Adding a rule

1. Write it here, guarding on `old` state so it cannot depend on iteration order by accident.
2. Mirror it in `app/src/engine.ts`, matching **`chance()` call order exactly** — a roll on
   one side but not the other desynchronises both engines permanently.
3. Add a `#[test]`, and pair any "X happens" test with an "X does not happen when it
   shouldn't" one. A single-sided test cannot tell a working rule from one that always fires.
4. Add a parity scenario, and a check in `scripts/interaction-audit.mjs` if a player is meant
   to see the outcome.

## `slow_step` is not a slow `tick`

`Universe::slow_step` runs only when the player returns, on a clock derived from how long
they were away. It is a separate entry point on purpose: the app's tick catch-up saturates
after about 66 minutes, so in ticks a two-day absence and a one-hour one are the same
thing, and a ten-minute session outruns either.

Rules belong there only if they are too consequential to fire while watched, and only if
they touch something the player left living — a scene of walls and sand must come back
byte-identical, and `slow_steps_leave_an_unliving_scene_byte_identical` enforces that.
Everything else about it is ordinary: same RNG stream, same parity obligation, same
mirroring in `engine.ts`.
