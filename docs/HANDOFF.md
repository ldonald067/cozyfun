# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-07, after the remembered-cell
witness audit and the ember-drying rule it led to. See `git log` for the live commit and run
`npm run deploy:verify` to confirm it; check `gh run list` first, because a red CI run makes
Railway skip the commit for good (a rerun does not revive it, a new push does).*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths, so they
  no longer load into every chat. `grep -n` for the section you need, then read only those
  lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and `MATERIAL_AUDIT.md` are 40-70 KB each.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes. Surveying all 127 checks at 32 seeds took over ten, so do it rarely.
- **Write scratch scripts once and reuse them.** `.tmp/lucky/measure.mjs` exports
  `find(id, role)` and `measure(label, check)` (pass count, cells, ticks, contrast over 32
  seeds). `.tmp/lucky/board.mjs <id> <seed k> <ticks>` prints a check's board.
  `.tmp/witness/audit.mjs` runs actor-away and precondition-away variants of a check and
  tallies what its counted cells ARE (`measure(label, check, classify)`); copy its pattern.
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## What to do next

**Audit the clause halves no check witnesses.** The remembered-cell audit is finished: every
check that remembers cells has been asked the four questions (docs/HARNESS.md, "A sticky
outcome is only honest..."), and 15 failed one. The last, `fire.dries`, was a rule gap:
embers lit wet fuel without drying it. The owner chose to fix the rule (2026-10-07), so embers
now dry wet fuel before lighting it, as a flame does. Review then found a different gap: a clause
with two promises, where the check witnesses one. Known so far:

- `ember.glows` "weakly spreads fire": the painted flame lights the whole log, and with ember
  ignition taken out of a copy of the sim the check still passed 28 of 32.
- `ember.quenched` "running water washes cold char away": not witnessed at all.
- `wellspring.blocks` "between pours": the check now witnesses only a dormant spring.

The rest of `docs/MATERIAL_AUDIT.md` has not been read for this. For each compound clause,
ask whether sabotaging the second half in the sim would fail any check. Adding a witness means
a second check under the same id (as `water.flows` has two).

## How a witness gets checked (the method that found all of this)

1. **Take the actor away** (paint it as Wall, or leave it out). It must fail on every seed.
2. **Take the precondition away.** It must fail. A precondition can also be gone already:
   `ember.quenched` poured 70 s after the last live ember.
3. **Does it credit the brush?** A gesture painted with `act` lands after `before` is taken.
4. **Does it credit another clause, or a leftover?** Classify what every counted cell is NOW,
   and filter on the outcome, not the material.
5. **Sabotage the rule in the sim** (`sim/src/lib.rs` is enough for the audit, which runs
   wasm; `npm run build:sim`, measure, `git checkout sim/src/lib.rs`, rebuild). This is the
   only test that catches a witness of the wrong KIND: a position standing in for a speed
   (`sand.pours`), natural cooling standing in for a quench. Review caught both after the
   first four questions had passed them.

## Where things stand

The interaction audit has 127 checks bound to all 118 role ids. All pass on the audit's seed.
On 32 seeds, five do not pass every seed, each with its reason at its scene: `fire.thaws`,
`oil.ignites`, `fungus.fairyring` and `lava.scorches` at 31, and `stem.footing` at 30 (the
stalk can grow wholly below the cut). `sand.pours` passes every seed but is thin by nature: its
pace is on screen 34 ticks at least, against the floor of 30.

## Design questions for the owner

- **A soaked log leaves a few scorched cells unburnt.** Since embers dry wet fuel, the wet
  skin under a pool chars, and a couple of cells the embers dried but went cold before lighting
  stay on top of the char heap (2 cells, 75 s later, on the audit's seed). Shown and accepted
  as part of the ember-drying decision; worth a look in play.
- **A cut stalk's flowers hang in mid-air.** The stalk falls; its flowers stay where they
  were for about two minutes, then fade in place.
- **A burning log is live for only 5-7 seconds.** It catches all at once and is cold char
  after that, so a player has to douse it within seconds to see a quench.
- **A dormant wellspring only ever blocks non-sources.** It drinks the first sand, water, soil
  or oil that touches it and wakes, so a player sees "blocks while dormant" only with stone.
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

- Embers dry wet fuel before lighting it, as a flame does (2026-10-07, after a filmstrip):
  the same roll, so nothing changes without wet fuel beside an ember. Fire's `[fire.dries]`
  clause says so.
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
- **Vacuity-test every gate you touch**: sabotage the rule, rebuild with `npm run build:sim`,
  and watch the gate fail by name.
- **Close each batch with `/adversarial-review`** (Codex; check `codex login status`). It
  caught a real problem in every batch of this work, including this one.
- **For a design choice, show the owner a rendered picture** and explain it plainly.
