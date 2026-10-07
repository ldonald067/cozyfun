# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-07. Live at `5c39044`; the full
gate, CI and `deploy:verify` were green there.*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths, so they
  no longer load into every chat. `grep -n` for the section you need, then read only those
  lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and `MATERIAL_AUDIT.md` are 40-70 KB each.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes. Surveying all 127 checks at 32 seeds took over ten, so do it rarely.
- **Write scratch scripts once and reuse them.** `.tmp/lucky/measure.mjs` exports
  `find(id, role)` and `measure(label, check)`, which prints pass count, cells, ticks and
  contrast over 32 seeds. `.tmp/lucky/board.mjs <id> <seed k> <ticks>` prints a check's board.
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## What to do next: audit the remembered-cell witnesses

A check whose witness remembers cells (`memo.x ??= new Set()`) can count leftovers, another
clause's outcome, or the scene's own brushwork. It reads as a reliable pass while proving
nothing. This work found seven that did: `spark.lights`, `moss.dries`, `wellspring.reattune`,
`lava.scorches`, `water.rinses`, `meteor.shocked` and `stem.burns`. None had failed.

**Not yet audited (20):** `water.flows` (both checks), `glass.shatters`, `wall.hearth`,
`stone.blocks`, `sand.pours`, `sand.drains`, `water.hydrates`, `steam.rises`, `soil.breathes`,
`fire.dries`, `fire.thaws`, `pollen.drifts`, `stem.footing`, `ember.glows`, `ember.quenched`,
`oil.floats`, `meteor.falls`, `meteor.vitrifies`, `wellspring.blocks`.
Already re-examined: `water.rinses`, `steam.frosts`, `stem.burns`, `meteor.shocked`,
`oil.ignites`, `fungus.fairyring`, `rocket.climbs`, `spark.flies`.

**The four questions to ask of each** (docs/HARNESS.md, "A sticky outcome is only honest...",
has the worked examples):

1. **Take the actor away.** Paint the material the check is named after as Wall, or leave it
   out. It must then fail on every seed.
2. **Take the precondition away** (the water, the flame, the ice). It must fail.
3. **Does it credit the brush?** A gesture painted with `act` lands after `before` is taken,
   so "was X last tick, is Y now" counts cells the brush painted over.
4. **Does it credit another clause, or a leftover?** Classify every counted cell by what it was
   when painted and what it is now, and filter remembered cells on the OUTCOME, not on the
   material.

If a witness fails one of these, fix it and re-measure at 32 seeds. If the honest version then
fails on most seeds, the interaction may not happen in play. That is what the wellspring was,
and it needs the owner's decision, not a re-staged scene.

## Where things stand

The interaction audit has 127 checks bound to all 118 role ids. All pass on the audit's seed,
and on 32 seeds all but four pass every seed. Those four are `fire.thaws`, `oil.ignites`,
`fungus.fairyring` and `lava.scorches`, each at 31 of 32 with the reason at its scene. Recent
rule changes, with their reasoning in docs/VISUAL_PIPELINE.md and docs/MATERIAL_AUDIT.md:

- **Rockets fly as a volley, and a line of powder is a fuse** (`try_thrust`,
  `light_touching_powder`).
- **Ice frosts only stone and wall that hold water**, with a field note the first time.
- **A wellspring can really be re-taught.** A chilled spring ignores its own pool, latches the
  first new material (`FLAG_TAUGHT`, the rooted flag on a spring), spreads it through every
  attuned cell, holds it for `LESSON_HOLD` after the ice goes, and shows a fourth rune state,
  "learned", while the ice holds it.

## Design questions for the owner

- **A meteor shock's scorch is often brief.** The stone sinks through water the impact stirred,
  and the rinse clears the scorch: it stays past the floor on 26 of 32 seeds.
- **The sim runs faster on faster screens.** `App.tsx` sets `lastSimTick = time`, so a 60 Hz
  display gets ~20 ticks a second and 120 Hz about 24 (only 60 Hz was measured).
- **The rocket volley rises as one column**, and about one burst in eight goes off extra high.
  Both were shown and accepted.
- **Phase 8's listening pass** is the one unfinished item from before Phase 20.
- **One watering grows a minimum plant** (a 4-cell stalk).
- **Steam reads as a dotted thread.** The lever is in the sim (emit steam in small clusters),
  not the renderer.
- **Oil and lava still delete water** (19 overwrites). Left by decision: oil has no sink.
- **Fixture debt:** the `water.boils` scene is really a quench (lava pokes through its pan).

## Decisions already made — do not relitigate

All by the owner, after seeing measurements:

- Wellspring re-teaching sticks for the whole spring, and the learned state is shown
  (2026-10-01). Two materials offered at opposite ends at once may split a spring; that is
  accepted.
- Ice frosts only wet masonry (2026-09-30). A dry wall no longer cracks from a quick dab of ice
  and fire; meltwater still lets a block of ice and lava crack it.
- Rockets: a lit grain shoves through its own charge and lights the powder it touches.
- The audit floor stays at 30 ticks (about 1.5 s of play at ~20 ticks a second).
- Mist is visible; lakes are a feature; puddles dry (1 in 450); gases are conserved; bubbles are
  hot-only; never conserve a liquid with no sink; a rain-filled sand basin becoming sandstone
  is geology.
- **No cheap fixes**, and never tune a fixture until it passes: if the honest version is thin,
  say so at the scene.

## How to work

- **Branch until green.** A push to `main` deploys, and Railway waits for CI. Fast-forward
  `main` after the full gate, then `npm run deploy:verify`; add `npm run qa:live` when players
  can see the change.
- **Seconds are ticks over ~20**, never 60.
- **Print the board before believing a fixture.** Most wrong turns in this work were a fixture
  that did not stage what its comment claimed.
- **Vacuity-test every gate you touch**: sabotage the rule in BOTH engines, rebuild with
  `npm run build:sim`, and watch the gate fail by name.
- **Close each batch with `/adversarial-review`** (Codex; check `codex login status`). It
  caught a real problem in nearly every batch of this work.
- **For a design choice, show the owner a rendered picture** and explain it plainly.
