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
- **Liquid is not support.** Everything that falls as a grain — sand, soil, seed, stone,
  unlit rocket powder, a cut stalk — moves with `try_fall`, which sinks it through water,
  moonwater and oil. A stone shelf or a seed bed laid over a pond goes to the bottom.
- **A one-cell wall does not hold water.** Liquids side-hop two cells and jump it, and a
  one-cell floor lets them drain out diagonally. Seal a liquid fixture with walls two thick
  and a floor that runs under them — the `shaft` test helper does both.
- **`try_move` can overwrite a cell another mover filled this tick**, because it counts a
  target as free if it was empty in `old`. That clobber is load-bearing and mostly left alone,
  with eight exceptions: a grain never overwrites a liquid (`try_fall`), water never
  overwrites water, nothing overwrites lava, oil never overwrites oil, a gas never overwrites a gas — safe without a new rule, because smoke
  and steam already expire by age — a gas never overwrites water, water never overwrites a
  gas that arrived this tick (it may still sink through gas that was already there), and a
  mote (pollen, stardust) never overwrites water. The second only works because **moving water throws mist**
  (`MIST_ODDS`) — that is the water sink now, and without it a spring floods the tray.
  **Never conserve a liquid that has no sink**: oil was in that guard at first and an oil
  spring flooded a third of the board. Lava was conserved on 2026-10-21 only with a sink of
  its own — deep lava cools too (`LAVA_DEEP_COOLS`), so a lava spring seals itself under the
  stone it makes — and `npm run water:budget` reports a lava spring too. Oil was conserved the
  same day with a sink that spares a slick: only oil a spring poured fades
  (`OIL_SPRING_FADES`, marked by `FLAG_SPRING_OIL`). A per-MOVE sink cannot bound a spring once
  its liquid comes to rest: a finished layer lies still, so it never rolls.
- **A mover that runs on even ticks only always sees the left-to-right pass.** The bottom-up
  pass flips direction every tick, so `tick % 2 == 0` is always the same direction, and
  `side = tick % 2` never flips. Oil moved that way and every slick slid right until it met a
  wall; lava (`update_liquid` at sluggishness 2) still does, and leans left. Moving against the
  pass also lets a whole run shift in one tick, so even a symmetric side choice drifts unless
  the mover gets one tick of each direction: oil moves on `tick % 4 < 2`.
- **Hot gas bubbles; mist does not.** A mover sinking into gas that sat there all tick trades
  places with it when the gas is hotter than `MIST_ENERGY`, so steam rises out of a pool
  instead of being eaten. Letting mist bubble too flooded a spring to 29.5% of the board:
  keep anything that changes the mist's fate behind a `water:budget` run.
- **A puff is not water.** Hot steam billows into up to 12 puffs (`billow`, `FLAG_PUFF`) the
  first time it meets open air. Every rule that turns steam into water or ice skips a puff,
  and skips its roll, or a stone pot would make water out of nothing; a new one must too. A
  puff wets nothing either: heat vents a wet wall as ordinary steam, which condenses.
  A puff that meets ice simply vanishes, so puffs never crowd wisps off an ice face.
- **"Running water" has to be written as running water.** The soot rinse and the char wash
  gate on `liquid_can_flow` — somewhere the water could actually move. They used to take any
  touching water while their comments said "running", and their first fix reused erosion's
  `water_can_move` (any empty neighbour), which counts the open sky above a still pond as
  flow. Erosion keeps that looser test on purpose, so a pond's waterline wears. If a rule
  says flow, test flow — and a sealed test fixture will not tell you whether it does.
- **Order matters inside a tick.** `age_and_decay` runs, then `apply_reactions`, then the
  bottom-up pass, then the top-down pass, then `share_heat`. Rules read `old` and write `next`;
  reading `next` means you see whatever earlier cells in the same tick already did.
- **A rule that MOVES a quantity between cells cannot share a pass with rules that spend it.**
  Conduction computed from `old` and debited from `next` gave away heat a vent or the chill had
  already spent there, and the clamp at zero kept it (review, 2026-10-20). That is why heat
  spreads in `share_heat`, after everything else, from the tick's final energies.

## Adding a rule

1. Write it here, guarding on `old` state so it cannot depend on iteration order by accident.
2. Mirror it in `app/src/engine.ts`, matching **`chance()` call order exactly** — a roll on
   one side but not the other desynchronises both engines permanently.
3. Add a `#[test]` in `sim/src/tests.rs`, and pair any "X happens" test with an "X does not
   happen when it shouldn't" one. A single-sided test cannot tell a working rule from one
   that always fires.
4. Add a parity scenario, and a check in `scripts/interaction-audit.mjs` if a player is meant
   to see the outcome.

## `slow_step` is not a slow `tick`

`Universe::slow_step` runs only when the player returns, on a clock derived from how long
they were away. It is a separate entry point on purpose; the argument for why ticks cannot
express an absence lives in `app/src/slowWorld.ts`, which owns that policy for both the app
and the harness.

Rules belong there only if they are too slow or too consequential to fire while watched,
and only if they **never rearrange something the player built**. That used to read "only if
they touch something the player left living", and living was always a proxy for the real
promise: a week away does not edit your construction. Sediment turning to rock is the case
that separated the two — a lake bed is not alive, and nobody built it either. So submerged
sand may change; a dry dune on a shelf may not, because a dune is a thing somebody made.
`slow_steps_leave_an_unliving_scene_byte_identical` still holds a dry scene of walls and sand
to byte-identical, and `a_dry_dune_is_never_turned_to_stone` guards the burial case, which
that older test could not see: its sand was never covered.
Everything else about it is ordinary: same RNG stream, same parity obligation, same
mirroring in `engine.ts`.
