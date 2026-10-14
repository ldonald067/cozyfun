# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-14, after the last untried halves were sabotaged: eleven got witnesses, and pollen turned out never to root at all.
See `git log` for the live commit. Check `gh run list` first and only then run
`npm run deploy:verify`: a red CI run makes Railway skip that commit for good (a rerun does not
revive it, a new push does).*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths. `grep -n`
  for the section you need, then read only those lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and
  `MATERIAL_AUDIT.md` are 40-70 KB each.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all 148 checks at 8 seeds against `main` takes about five.
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
  `.tmp/halves/try.mjs <module> <seeds> <sabotage,...>` scores candidate checks (a module
  exporting `CANDIDATES`) on the JS mirror and on sabotaged copies, before they go in the file;
  `.tmp/halves/proto.mjs` plays a scene on wasm and prints a stat and the board.
  `.tmp/halves/try-map.mjs <module> <seeds> [label]` is `try.mjs` scoring each candidate only
  against the sabotages its module's `AGAINST` map names; `.tmp/halves/show.mjs` prints a
  candidate's board at chosen ticks. Every sabotage named below is already in `sabotages.mjs`.
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## What to do next

1. **Witness the halves that sabotage found unwitnessed.** Each is listed with its sabotage in
   `.tmp/halves/sabotages.mjs`; none fails its clause's checks on any of 8 seeds.
   `seed.germinates` "taller when cosmic" (`cosmic-not-taller`: one more 55-energy segment, so
   only a cosmic variant-3 stalk reaches 8 cells), `meteor.trail` lights fuses
   (`trail-never-lights`; trail sparks only fly straight down), `rocket.bursts` chain-lighting
   (`burst-never-chains`), `rocket.fuses` a gap stops it (`fuse-jumps-gap`, an absent check),
   `oil.smothers` strips wet (`oil-keeps-wet`), `wall.hearth` thaw needs contact
   (`hearth-thaws-by-conduction`), `wellspring.stilled` until the cold is removed
   (`spring-stays-stilled`), `wellspring.pours` through its own pool (`spring-bare-face-only`),
   `smoke.rises` fades (`smoke-never-fades`), `soil.breathes` any open face
   (`soil-vents-up-only`). Two cannot be reached by an engine sabotage: `flower.pollen` "more
   often when cosmic" is a rate, which one check cannot see without a comparison, and "dulls
   toward grey" is in the renderer (`shapeLanguage.ts`), which `sab.mjs` does not copy.
2. **Harden `test:browser` on CI.** It flaked twice in two days, each time making Railway skip
   a good commit for good: Chrome's debugger never started (2026-10-07, `launchBrowserOnce` in
   `scripts/browser-qa-helpers.mjs`, after its one retry), and no drizzle reached the cleared
   tray in 2,200 ticks on a runner sampling 17 ticks a second (2026-10-08, the weather check in
   `scripts/smoke-browser.mjs`). Both passed on a rerun and locally. Until it is fixed, a red
   CI run on a good commit needs a rerun to confirm the flake and then a new push to deploy.
3. **Look for other consumers that read "a cell became X" as an event.** Review found two for
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

- **Eleven more clause halves have witnesses**, each a second check under its id, each 32 of 32
  and 0 of 32 with its half taken out of the JS mirror: a meteor landing as stardust
  (`meteor.impacts`), stardust etching a wall (`stardust.etches`) and charging fungus (one scene,
  bound to both `stardust.energizes` and `fungus.cosmic`), fungus digesting soil
  (`fungus.digests`), running water rinsing a sooty wall (`water.rinses`), stalks climbing
  through a flooded planter (`seed.germinates`), a stone pillar holding (`stone.slumps`, an
  absent check), rockets bursting against a ceiling (`rocket.bursts`), and lava and a hot ember
  each lighting a fuse (`rocket.lights`). Stardust never rests, so the two stardust witnesses
  follow each grain as it drifts (`driftingStardust`). Moonwater charging fungus was already
  witnessed. The other halves sabotage tried are under "What to do next".
- **Five more clause halves have witnesses** (2026-10-13): wet sand falling at half pace, sand
  under an oil pond, ice never freezing hot water, moss taking a moonwater-soaked wall, and
  garden stalks freezing under an ice sweep.
- **Four clause halves have witnesses** (2026-10-09): ember spread, char wash, an attuned spring
  blocking stone, and ember drying.
- **Remembered-cell witness audit finished.** Every check that remembers cells was asked the
  questions above; 15 failed one and were fixed.
- **Embers dry wet fuel before lighting it**, as a flame does (owner's call after a filmstrip).
- **A bloom stands on its stalk, and a petal hangs from its crown.** Cut the stalk and the head
  comes down with it. The slow world's open-head count and the bloom sound ignore a falling head.

The interaction audit has 148 checks bound to all 118 role ids; all pass on the audit's seed.
On 32 seeds, seven do not pass every seed, each with its reason at its scene: `fire.thaws`,
`oil.ignites`, `fungus.fairyring`, `lava.scorches` and `stem.burns` at 31, the stalk check of `stem.footing` at 30, and the ember check of
`fire.dries` at 29. Thin by nature but passing every seed: the char-wash check of
`ember.quenched` (5 cells at the least), `sand.pours` (34 ticks against the floor of 30), the
wet-sand check of `sand.clumps` (46 ticks), and the lava and ember checks of `rocket.lights`
(35 and 33 ticks: a launch is over in under two seconds).

## Design questions for the owner

- **Pollen almost never roots, so `pollen.seeds` has no witness at all.** Pollen roots only on
  wet soil, and watered soil greens to moss first: on a wide watered bed 90 of 93 soil cells
  were moss by tick 200, and in 9,000 ticks settled pollen rested on moss 1,621 times and on soil
  never. No pollen rooted in that bed or in the check's own garden, with water or moonwater
  (3 seeds each). It can: review painted a ledge of fresh soil and a dab of water right under a
  mote already drifting, and it rooted in both engines (fresh soil cannot green for its first
  10 ticks). The check passes 8 of 8 with rooting taken out of the JS mirror, because a painted
  seed that settles "appeared"; it says so at the scene. So a garden does not reseed itself,
  and the cosmic spark a seed should carry does not travel. Let pollen root on wet moss, keep
  claimed soil bare around a plant, or drop the clause.
- **A meteor's own fuse-lighting never shows.** With it taken out of the JS mirror, a meteor
  dropped on powder still launched it on 8 of 8: the fire ring its impact throws lights the
  powder first. Harmless; drop the arm or leave it.
- **Moss's burst does nothing a player can see.** `moss.spreads` promises "bursting to two
  patches at once when well watered". On a watered wood plank moss covers it in 72-78 ticks
  with the burst and 67-80 without it (8 seeds): wet moss already takes damp wood every tick,
  and a new patch starts at energy 70, under the 150 a burst needs. No scene tried shows one
  parent taking two cells in a tick. Make the burst matter, or drop it (lib.rs, engine.ts, the
  clause).
- **Lava never thaws anything in play.** Frost exists only beside the ice that made it, so lava
  meets the ice first and the meltwater quenches it into stone, the same wall `lava.scorches`
  notes. Painted straight onto a 4-cell frost, lava thaws it on 6 of 8 seeds; poured on an ice
  layer over wet stone, 1 cell on 1 seed of 8; on the frost-stressed rock, 0 of 8 at three
  spots. `lava.scorches` "thaws" is unwitnessed for that reason.
- **Hot water melting ice barely shows.** Water is hot (over 120) for a few ticks only: a flame
  adds 30 a tick, water boils off at 200 and loses 2 a tick on its own. The one scene found is a
  flame held nine seconds to an ice slab: its hot meltwater melts ice the flame is not touching
  on 32 of 32 seeds, but the slab refreezes it, so it stays visible past the floors on only 25
  (30 ticks or more). `water.boils` and `ice.freezes` "melts it" are unwitnessed for that
  reason; that ice never freezes hot water is witnessed.

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
- **The brush clamps radius 0 to 1**: `p(x, y, 0, ...)` paints a plus of five cells, three rows
  tall, in both engines.
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
