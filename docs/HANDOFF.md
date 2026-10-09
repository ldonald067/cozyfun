# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-09, after four clause halves got witnesses.
See `git log` for the live commit. Check `gh run list` first and only then run
`npm run deploy:verify`: a red CI run makes Railway skip that commit for good (a rerun does not
revive it, a new push does).*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths. `grep -n`
  for the section you need, then read only those lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and
  `MATERIAL_AUDIT.md` are 40-70 KB each.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all 132 checks at 8 seeds against `main` takes about five.
- **Sabotage with `.tmp/halves/sab.mjs <name> [seeds] [id,id]`.** It applies a find/replace from
  `.tmp/halves/sabotages.mjs` to a copy of `app/src/engine.ts`, compiles it, and plays every
  check (or the listed ids) on the JS mirror and on an unsabotaged copy, counting a seed as
  caught only where the baseline passes and the sabotage fails: about 95 s a seed for all
  checks. No cargo build. Launch parallel runs about 12 s apart: each recompiles the shared `.tmp/audit-renderer`
  on start, and two at once crash. Keep the dice where you can (leave the `chance()` roll).
- **Reuse the scratch scripts.** `.tmp/lucky/measure.mjs` exports `find(id, role)` and
  `measure(label, check)` (pass count, cells, ticks, contrast over 32 seeds).
  `.tmp/lucky/board.mjs <id> <seed k> <ticks>` prints a check's board. `.tmp/witness/audit.mjs`
  runs actor-away and precondition-away variants and tallies what counted cells ARE.
  `.tmp/witness/bytes-compare.mjs` plays uncut gardens on two builds and compares the bytes.
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## What to do next

1. **Witness the clause halves sabotage found unwitnessed.** With each taken out of the JS
   mirror, no check fails on any seed: `sand.clumps` "slows when wet", `sand.settles` "through
   oil", `water.boils` and `ice.freezes` "hot water melts ice" (one rule, two clauses),
   `ice.freezes` "hot water resists" freezing, `moss.spreads` "bursting to two patches",
   `moss.colonizes` "a soaked wall when moonwater has charged it", `stem.burns` "freezes like
   living growth", and `lava.scorches` "thaws". A new witness is a second check under the same
   id; the four added on 2026-10-09 (`ember.glows`, `ember.quenched`, `wellspring.blocks`,
   `fire.dries`) show the shape. Already witnessed: lava lighting fuel and lava flowing, and
   plain moss never taking a wall (`wall.resists`).
2. **Sabotage the halves not yet tried.** Read but not sabotaged: `flower.pollen` (more often
   when cosmic, dulls to grey), `pollen.seeds` (carries the cosmic spark), `seed.germinates`
   (through standing water, taller when cosmic), `meteor.trail` (lights fuses), `rocket.lights`
   (lava, hot ember, meteor), `rocket.bursts` (against a ceiling, chain-lighting),
   `rocket.fuses` (a gap stops it), `stardust.energizes` (fungus), `stardust.etches` (wall),
   `meteor.impacts` (stardust), `fungus.cosmic` (moonwater), `fungus.digests` (soil),
   `water.rinses` (wall), `oil.smothers` (strips wet), `wall.hearth` (thaw needs contact),
   `wellspring.stilled` (until the cold is removed), `wellspring.pours` (through its own pool),
   `smoke.rises` (fades), `stone.slumps` (pillars hold), `soil.breathes` (any open face).
3. **Harden `test:browser` on CI.** It flaked twice in two days, each time making Railway skip
   a good commit for good: Chrome's debugger never started (2026-10-07, `launchBrowserOnce` in
   `scripts/browser-qa-helpers.mjs`, after its one retry), and no drizzle reached the cleared
   tray in 2,200 ticks on a runner sampling 17 ticks a second (2026-10-08, the weather check in
   `scripts/smoke-browser.mjs`). Both passed on a rerun and locally. Until it is fixed, a red
   CI run on a good commit needs a rerun to confirm the flake and then a new push to deploy.
4. **Look for other consumers that read "a cell became X" as an event.** Review found two for
   flowers once flowers could move (the slow world's open-head count and the bloom sound). The
   same reading may exist for other materials that move.

## How a witness gets checked

1. **Take the actor away** (paint it as Wall, or leave it out). It must fail on every seed.
2. **Take the precondition away**, or check it is not already gone (`ember.quenched` once
   poured 70 s after the last live ember).
3. **Does it credit the brush?** A gesture painted with `act` lands after `before` is taken.
4. **Does it credit another clause, or a leftover?** Classify what every counted cell is NOW,
   and filter on the outcome, not the material.
5. **Sabotage the rule in the sim**, both ways where it has two sides (never fires, always
   fires). This catches a witness of the wrong KIND: a position standing in for a speed
   (`sand.pours`), natural cooling standing in for a quench.

## Where things stand

Live, all with the full gate, CI and `deploy:verify` green:

- **Four clause halves have witnesses**, each a second check under its id, each 0 of 32 with
  its half taken out of the JS mirror: an ember lighting wood with no flame beside it
  (`ember.glows`), running water washing cold char away (`ember.quenched`), stone resting on
  an attuned spring (`wellspring.blocks`), and an ember drying wet wood (`fire.dries`: with
  ember drying taken out the old check still passed 10 of 32, because it pools flame and ember).
- **Remembered-cell witness audit finished.** Every check that remembers cells was asked the
  questions above; 15 failed one and were fixed. The last, `fire.dries`, was a rule gap.
- **Embers dry wet fuel before lighting it**, as a flame does (owner's call after a filmstrip).
- **A bloom stands on its stalk, and a petal hangs from its crown.** Cut the stalk and the head
  comes down with it; a fallen crown is no longer rooted, so it neither re-opens nor sows. The
  rule never fires on a standing plant: 48 of 48 uncut garden runs end byte-identical to the
  build before. The slow world's open-head count and the bloom sound now ignore a falling head.

The interaction audit has 132 checks bound to all 118 role ids; all pass on the audit's seed.
On 32 seeds, seven do not pass every seed, each with its reason at its scene: `fire.thaws`,
`oil.ignites`, `fungus.fairyring`, `lava.scorches` and `stem.burns` at 31, the stalk check
of `stem.footing` at 30, and the ember check of `fire.dries` at 29. The char-wash check of
`ember.quenched` is thin by nature (5 cells at the least). `sand.pours` passes every seed but is thin by nature (34 ticks
against the floor of 30).

## Design questions for the owner

- **The daisy's and sunflower's petal at (0, 1) can never open.** It is the cell under the
  crown, where the stalk stands; it only ever opened on a crown hung in the air, in a test.
  Drop it from `BLOOM_SHAPES` (lib.rs, engine.ts, the showcase; `renderer-probe` checks they
  agree), or leave the shapes a petal short.
- **A soaked log leaves a few scorched cells unburnt**: wet skin the embers dried but went cold
  before lighting (2 cells on the audit's seed). Accepted with the ember change; look in play.
- **A burning log is live for only 5-7 seconds**, so a quench needs a quick douse.
- **A dormant wellspring only ever blocks non-sources**: it drinks the first sand, water, soil
  or oil that touches it, so "blocks while dormant" shows only with stone.
- **A meteor shock's scorch is often brief** (past the floor on 26 of 32 seeds).
- **The sim runs faster on faster screens.** `App.tsx` sets `lastSimTick = time`: ~20 ticks a
  second at 60 Hz, about 24 at 120 Hz (only 60 Hz was measured).
- **One watering grows a minimum plant** (a 4-cell stalk, a 1-5 cell head).
- **Steam reads as a dotted thread**; the lever is in the sim (emit in small clusters).
- **Phase 8's listening pass** is the one unfinished item from before Phase 20.
- **Fixture debt:** the `water.boils` scene is really a quench (lava pokes through its pan).

## Decisions already made — do not relitigate

All by the owner, after seeing measurements:

- Blooms fall with a cut stalk (2026-10-08); embers dry wet fuel first (2026-10-07).
- Wellspring re-teaching sticks for the whole spring, and the learned state is shown
  (2026-10-01); two materials offered at opposite ends at once may split a spring.
- Ice frosts only wet masonry (2026-09-30).
- Rockets: a lit grain shoves through its own charge and lights the powder it touches. The
  volley rises as one column, and about one burst in eight goes off extra high.
- The audit floor stays at 30 ticks (about 1.5 s of play at ~20 ticks a second).
- Mist is visible; lakes are a feature; puddles dry (1 in 450); gases are conserved; bubbles are
  hot-only; never conserve a liquid with no sink; oil and lava may still delete water (oil has
  no sink); a rain-filled sand basin becoming sandstone is geology.
- **No cheap fixes**, and never tune a fixture until it passes: if the honest version is thin,
  say so at the scene.

## How to work

- **Branch until green.** A push to `main` deploys once CI passes. Fast-forward `main` after the
  full gate, watch CI, then `npm run deploy:verify`; add `npm run qa:live` when players can see
  the change.
- **Seconds are ticks over ~20**, never 60.
- **Print the board before believing a fixture.** A test fixture that hand-places a state play
  cannot reach (a crown hung in the air) passes for the wrong reason, and a rule that fixes
  play can break it. Give fixtures the support play gives them.
- **Run sim tests the way the gate does** (`npm run test:sim`, a debug build). `cargo test
  --release` hid an integer overflow in a test that the gate's debug build caught.
- **Close each batch with `/adversarial-review`** (Codex). It caught a real problem in every
  batch of this work. Codex has a usage limit of its own and can stop mid-review: check each
  reviewer's output exists, and rerun the missing ones rather than landing on a partial
  review. Review files under `/tmp` do not survive a restart; use the session scratchpad.
- **For a design choice, show the owner a rendered picture** and explain it plainly.
