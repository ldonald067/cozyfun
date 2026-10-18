# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-15, after three new interactions
the owner chose from filmstrips went live (`8c080b0`): a meteor's trail fans out, sparks light
oil, and stardust gives oil a firework sheen. Item 1 and the weather restart were updated
2026-10-16, the absent checks and the reaction cues 2026-10-17. See `git log` for the live commit. Check
`gh run list` first and only then run `npm run deploy:verify`: a red CI run makes Railway skip
that commit for good (a rerun does not revive it, a new push does).*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths. `grep -n`
  for the section you need, then read only those lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and
  `MATERIAL_AUDIT.md` are 40-70 KB each; reading a file under `app/src/rendering/` pulls
  `VISUAL_PIPELINE.md` in whole through that directory's `CLAUDE.md`, so grep there first.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all 160 checks at 8 seeds against `main` takes about five.
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## Scratch tools (under `.tmp/`, untracked)

- **Sabotage:** `.tmp/halves/sabotages.mjs` holds find/replace edits on `app/src/engine.ts`, one
  per rule half, both ways where a rule has two sides. Keep the dice (leave the `chance()` roll).
  `.tmp/halves/try-map.mjs <module> <seeds> [label]` scores a module's `CANDIDATES` on the JS
  mirror and against the sabotages its `AGAINST` map names; `c-verify4.mjs` and `c-verify5.mjs`
  pull checks out of the scenes file by role, so they are scored exactly as written.
  `.tmp/halves/sab.mjs <name> [seeds] [id,id]` plays every check against one sabotage. Launch
  parallel runs about 12 s apart: each recompiles a shared `.tmp` dir on start, and two at once
  crash.
- **Boards:** `.tmp/halves/show2.mjs <module> <label> <k> <ticks> [x0 x1 y0 y1]` prints a
  candidate's board, cropped, with counted cells highlighted; `SAB=<name>` plays it sabotaged.
  `.tmp/halves/passes.mjs <module> <label> <seeds>` lists each seed's first tick (also takes
  `SAB=`); `.tmp/halves/why.mjs` gives each failing seed's reason.
- **Lockstep:** `.tmp/halves/lockstep.mjs <sabotage> <seeds>` plays scenes on the mirror and a
  sabotaged copy side by side and diffs every cell: the test for "does this line do anything".
- **Reaction cues:** `.tmp/cues/probe.mjs [seeds] [filter]` plays movement-only and real scenes
  through the detector and a model of the controller (priority, 0.28 s, cooldowns), printing
  firings/heard plays per cue; `BASE=1` uses the snapshot in `.tmp/cues/base` (refresh it with
  `git archive HEAD app/src | tar -x -C .tmp/cues/base`). `.tmp/cues/truth.mjs` scores one cue
  against the engine's own conversions, logged by an instrumented copy in `.tmp/cues/instr`
  (`CUE=… TARGET=… SOURCES=…`, default steam-flash).
- **Filmstrips for the owner:** `.tmp/film/film.mjs <scene> [seed]` draws the last commit's
  build above the working tree through the real renderer, with glow approximated, into
  `.tmp/film/<scene>.png`; scenes live in `.tmp/film/scenes.mjs`. Snapshot the base with
  `git archive HEAD app/src | tar -x -C .tmp/film/base` first.

## What to do next

0. **The owner's answers of 2026-10-17, in progress.** Batches A and B are live (below). Still
   to do, so it SHOWS in play, with a filmstrip after: C, lava thaws frozen cells a couple of
   cells off before its meltwater reaches it, and hot water's melt carries its heat so it bores
   into ice instead of refreezing. The owner's bar: "only meaningful changes that shows". Star
   shells look like plain ones in flight (a wider bloom and a stardust rain are the difference);
   a colour of their own would be renderer work, put to the owner with the filmstrip.
1. **If Chrome's launch flakes on CI again, read its stderr first.** On 2026-10-07 the debugger
   missed a 10 s window twice in a row on a runner whose other stages ran at their usual pace;
   nothing was captured to say why. `launchBrowserOnce` now waits 30 s and appends Chrome's
   stderr to the error. That makes it diagnosable, not fixed. The other flake (2026-10-08, no
   drizzle in 2,200 ticks) is addressed, see below. A red CI run on a good commit still needs a
   rerun to confirm the flake and then a new push to deploy.
2. **The two halves an engine sabotage cannot reach.** `flower.pollen` "more often when cosmic"
   is a rate, which one check cannot see without two gardens compared inside it, and "dulls
   toward grey" is in the renderer (`shapeLanguage.ts`), which the sabotage tools do not copy.
   Every other half sabotage found unwitnessed has a witness or is a design question below.

## How a witness gets checked

1. **Take the actor away** (paint it as Wall, or leave it out). It must fail on every seed.
2. **Take the precondition away**, or check it is not already gone. For an absent check, declare
   it as `requires`.
3. **Does it credit the brush?** A gesture painted with `act` lands after `before` is taken.
4. **Does it credit another clause, or a leftover?** Classify what every counted cell is NOW,
   and filter on the outcome, not the material. (A meteor drifting onto a ledge lit the fuse the
   fanned-trail check is about; that check counts only while no meteor has stopped there.)
5. **Sabotage the rule in the sim**, both ways where it has two sides (never fires, always
   fires). This catches a witness of the wrong KIND: a position standing in for a speed
   (`sand.pours`), natural cooling standing in for a quench.

## Where things stand

Live, with the full gate, CI, `deploy:verify` and `qa:live` green:

- **Moss bursts across a gap; a meteor lights star rockets** (2026-10-17). Moss over 150 energy
  with nothing beside it to take throws a patch two cells off across a gap of air, gas or water
  (`SPORE_ODDS`, `SPORE_JUMPS`): 32 of 32, 0 on the old build. A meteor lights the powder it lands
  on with `FLAG_COSMIC`; a star grain passes the star to every lit grain it touches; a star
  shell's sparks fly 10 ticks instead of 6 and all burn out into stardust (2-3x a fire-lit
  pile's): 32 of 32, 0 on the old build. Review: a grain starred in the tick it burst threw a
  plain shell (now read from `next`); the audit passed with star sparks burning out 1 in 6, so
  it now requires 9 in 10 to leave stardust; the water-gap test never held its water. Sabotage
  tool entries `star-sparks-plain-burnout`, `meteor-lights-plain`, `moss-no-spore`: each caught
  8 of 8. `moss_cannot_spread_into_claimed_ground` outlived its seed's claim; it runs 190 ticks.

- **Pollen pollinates, and a garden sows itself** (2026-10-17, the owner's logic: pollen is not
  a seed). A mote older than `POLLINATE_AGE` brushing the side of a flower of its own kind is
  taken in (1 in `POLLINATE_ODDS` a tick) and the flower sets a seed, `FLAG_WINDBORNE` with
  `FLAG_DRIFT_EAST`, which sails off two across for one down, rolls off a head, turns away from
  a plant it heads into, and lands on the first ground; seeds now root in moss as on soil, and
  a set seed waits for water. `pollen.seeds` 30 of 32 (0 on the old build). Review: a gliding
  seed deleted water that flowed in first (now only into open air: empty or gas at both ends of
  the tick) and stale flags undid a same-tick freeze. The sunflower's petal under its crown
  became two hugging the stalk, the daisy's dead one went, and `PETAL_COST` 3 -> 2 so heads can
  afford their shapes in play (sunflower rim 15 -> 22 of 24, bottom pair 11/6 -> 22/19,
  cornflower outers 16/12 -> 20/19). `water.oilblocked` folded into `oil.smothers`.

- **A reaction sound no longer rings when a material only moves** (2026-10-17). The detector
  read "a cell became X" as an event, as the bloom cue once did: a falling stalk rang sprout,
  water and moonwater mixing cosmic-charge, stone sinking through a pond erode, a bubble rising
  steam-flash, stardust sinking through moonwater impact-burst, settling grains dew, and
  (review) a cosmic soil grain falling cosmic-charge. A move keeps every count, so each cue
  whose cells can move also needs the census to change the way it claims. Moonwater ->
  Stardust is no longer a clause: only a meteor impact makes it, and the meteor's own cell
  rings. Heard through the controller model, 8 seeds: a falling stalk 16 plays to 0, mixing 13
  to 0, stardust poured into water 66 impact-bursts to 0, stone in a pond 30 erodes to 7 (real
  erosion). Against the engine's own conversions, steam-flash and cosmic-charge land within 2
  plays of a perfect detector in every scene (the old one was up to 11 over). The steam gate
  misses about a quarter of real steam ticks while boiling, but nothing audible: the cue is
  already at its cooldown. Field notes count kinds and the slow world was fixed for flowers, so
  no frame-diffing consumer is left reading a move as an event.
- **Every absent check names its precondition** (2026-10-17). All thirteen `absent` checks
  declare a `requires`; each of the eleven new ones holds on 32 of 32 as written, fails as never
  set up on 32 of 32 with its precondition taken out, and leaks on 32 of 32 with its rule
  sabotaged in the JS mirror (`.tmp/halves/c-req-final.mjs`). Two were proving nothing.
  `wall.resists`: water pooled between the moss and the wall, so moss never touched it; the bed
  now runs up to the wall and the witness is a brick of it turning to moss. `water.oilblocked`
  counted soil turning cosmic, which plain water never does; it is now the oil-on-a-seed scene,
  and its own half is thin (below). Oil's smothering is two rules, and the seed checks are
  carried by oil drying what it touches, not by water refusing to feed it. Review found two
  preconditions still loose (an oiled seed with no ground under it, a spring taught sand when
  the witness counts water); both now fail as never set up.
- **A clear restarts the weather** (2026-10-16). `engine.clear()` resets the tick count to 0
  and `RoomWeather` scheduled at absolute ticks, so a clear left an open window dry for as long
  as the tray had already run. `handleClear` now calls `RoomWeather.restart()`. Inferring the
  clear from a backwards tick missed a clear made with the window shut (review). The new
  `npm run test:weather` witnesses both halves (schedule, census). The browser weather check's
  budget went from 2,200 to 3,500 ticks because 29% of drops paint nothing (five cells at
  density 22), which the old budget ignored: a run with no visible drop went from 0.16% to
  0.008% (Node model over 2026-27). The 10-08 timeout fits that model but was not reproduced.

- **Fanned meteor trail, sparks lighting oil, stardust sheen** (2026-10-15, `8c080b0`). A trail
  spark flies down, down-left or down-right (one more roll in both engines). Oil ignites on a
  spark as well as on `is_hot`; Spark stays out of `is_hot`. Stardust sets the cosmic flag on
  oil, lifting it to energy 36 so the age pass keeps it, and the sheen spreads cell to cell
  (`SHEEN_SPREAD`); a sheened cell burns as cosmic fire and throws a spark upward
  (`SHEEN_SPARK_DIRS`). `ignited_cell` keeps the sheen on every ignition path (review: a flame
  processed after the oil burned it plain on 16 of 32 seeds). New role `oil.sheen`. The renderer
  draws the sheen last of oil's treatments, as rainbow bands, and the flame in the firework hues;
  `renderer:probe` gates both over every contact (sheen worst 95, floor 85; flame 188, floor
  170), and the showcase's oil basin has a sheened half. The duplicate wet strip in water's oil
  branch is gone. The parity harness gained `act`.
- **A wide gap of air stops a fuse** (`rocket.fuses`, an absent check with `requires`): six cells
  in open sky, held on 128 of 128. A grain bursting low beside a gap chain-lights the far side
  (one cell crossed on 11 of 32 seeds; with a wall two rows over the line, six cells on 8 of 8),
  so the clause promises no width.
- **The clause-half witness work is done** (2026-10-09 to 10-14): 27 halves sabotage had found
  unwitnessed got a second check under their id, each 32 of 32 and 0 of 32 with its half taken
  out of the JS mirror, and every check that remembers cells was asked the questions above. What
  is left is item 2 above and the design questions below.
- **Embers dry wet fuel before lighting it**, and **a bloom falls with its cut stalk** (owner's
  calls after filmstrips).

The interaction audit has 160 checks bound to all 119 role ids; all pass on the audit's seed.
On 32 seeds, nine do not pass every seed, each with its reason at its scene: `fire.thaws`,
both `oil.ignites` checks, the fanned-trail check of `meteor.trail`, `fungus.fairyring`,
`lava.scorches` and `stem.burns` at 31, the stalk check of `stem.footing` at 27, and the ember
check of `fire.dries` at 29. Thin by nature but passing every seed: the char-wash check of
`ember.quenched` (5 cells at the least), `sand.pours` (34 ticks against the floor of 30), the
wet-sand check of `sand.clumps` (46 ticks), the lava and ember checks of `rocket.lights` (35 and
33 ticks), and the downpour check of `soil.breathes` (33 ticks, about the life of one wisp).

## Design questions for the owner

- **Lava never thaws anything in play.** Frost exists only beside the ice that made it, so lava
  meets the ice first and the meltwater quenches it into stone. `lava.scorches` "thaws" is
  unwitnessed for that reason.
- **Hot water melting ice barely shows.** Water is hot (over 120) for a few ticks only, and a
  slab refreezes the melt: visible past the floors on 25 of 32. `water.boils` and `ice.freezes`
  "melts it" are unwitnessed for that reason.
- Smaller, accepted unless the owner says otherwise: a soaked log leaves a few scorched cells
  unburnt; a burning log is live for only 5-7 seconds; a dormant wellspring blocks only
  non-sources; a meteor shock's scorch is often brief (26 of 32); the sim runs about 24 ticks a
  second at 120 Hz against 20 at 60 Hz (`App.tsx` sets `lastSimTick = time`); one watering grows
  a minimum plant; steam reads as a dotted thread (the lever is in the sim); Phase 8's listening
  pass is unfinished; the `water.boils` scene is really a quench (fixture debt).

## Decisions already made — do not relitigate

All by the owner, after seeing measurements:

- A meteor's trail fans out and can light what it passes; sparks light oil; stardust gives oil a
  firework sheen, made stronger after the first filmstrip; the fanned tail's sky, gold and rose
  sparks were kept (2026-10-15). A single meteor passing six cells from a fuse lights it on 2 of
  32 seeds, two or three cells away about 1 in 4: a chance, not a certainty.
- A fuse stops at a WIDE gap of air; a grain bursting low beside it may relight the far side
  (2026-10-14). No width is promised: a burst's sparks fly about eight cells.
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
  full gate, watch CI, then `npm run deploy:verify`; add
  `COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run qa:live` when players can see the
  change.
- **Seconds are ticks over ~20**, never 60.
- **The brush clamps radius 0 to 1**: `p(x, y, 0, ...)` paints a plus of five cells in both
  engines. A meteor painted that way is five meteors that knock each other sideways as they fall.
- **Liquids jump a one-cell wall** (they side-hop two cells); divide a liquid exhibit or fixture
  with walls two thick.
- **Print the board before believing a fixture.** A fixture that hand-places a state play cannot
  reach passes for the wrong reason, and a rule that fixes play can break it.
- **Run sim tests the way the gate does** (`npm run test:sim`, a debug build). `cargo test
  --release` hid an integer overflow that the gate's debug build caught.
- **For a design choice, show the owner a rendered picture** (a filmstrip, above) and explain it
  plainly. They decide from the picture, not from seed counts.
- **Close each batch with `/adversarial-review`** (Codex). It caught a real problem in every
  batch. Pick lenses by what the diff touches (Parity for an engine change, Perceptual for the
  renderer, Drift for a new rule). Codex has its own usage limit and can stop mid-review: check
  each reviewer's output exists, and rerun the missing ones. Keep review files in the session
  scratchpad, and build the prompts with a Python script: Claude Code's safety check refuses a
  `bash -c` script it cannot inspect.
