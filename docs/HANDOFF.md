# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-20, after two owner batches went
live: the landing poster as a watercolour (`9c709cd`) and the flower renderer batch
(`a20f77d`). See `git log` for the live commit. Check `gh run list` first and only then run
`npm run deploy:verify`: a red CI run makes Railway skip that commit for good (a rerun does
not revive it, a new push does).*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths. `grep -n`
  for the section you need, then read only those lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and
  `MATERIAL_AUDIT.md` are 40-70 KB each; reading a file under `app/src/rendering/` pulls
  `VISUAL_PIPELINE.md` in whole through that directory's `CLAUDE.md`, so grep there first.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all checks at 8 seeds against `main` takes about five.
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## The owner picks from pictures, and there is a canvas for it

**The design canvas "Flowers and Interactions"** (https://claude.ai/artifact/9DB9Smb5oY65EfpdKJkXkS,
private to the owner) is where the owner chose the flower batch. It holds the eight species
today against the proposal, the tulip and bluebell reshapes, the life stages, the weather
states, a ranked shortlist of eight upgrades, and the whole interaction roster with each role
marked shows / thin / reads weak / half hidden from the audit and the handoff. Shortlist items
1, 2 and 7 shipped (`a20f77d`); the rest are open. Its files are under `.tmp/design/canvas/`;
publish edits to the same URL. The owner asks for a filmstrip before anything ships.

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
- **Reaction cues:** `.tmp/cues/probe.mjs [seeds] [filter]` and `.tmp/cues/truth.mjs` (see the
  2026-10-17 entry below); `BASE=1` uses the snapshot in `.tmp/cues/base`.
- **Filmstrips for the owner:** `.tmp/film/film.mjs <scene> [seed]` draws the base build above
  the working tree through the real engine and renderer, glow approximated, into
  `.tmp/film/<scene>.png`; scenes live in `.tmp/film/scenes.mjs`. **Refresh the base first:**
  `rm -rf .tmp/film/base && mkdir -p .tmp/film/base && git archive HEAD app/src | tar -x -C .tmp/film/base`
  (it is still the pre-flower `9c709cd`). Flower scenes: `flowers-species` (all eight, placed),
  `flowers-states` (open/wet/frozen/scorched/moonlit, poppy and daisy), `garden-life` (a garden
  from painted soil, seeds and rain only). `.tmp/film/perf.mjs` times the renderer per frame on
  24 full heads, base against working tree.
- **Flower tuning:** `.tmp/design/pairs.mjs` prints every species' petal mean and the closest
  pairs, the way `renderer:probe` measures them. `.tmp/design/mock.py` / `mock2.py` draw
  one-pixel-per-cell flower mockups for the canvas.
- **The embed poster:** `.tmp/poster/shot.mjs <url> <out> [w h dpr t reduced]` captures it with
  animations paused at `t`; `contrast.mjs` gives each text line's worst contrast against the
  painting over five moments including two strikes; `fps.mjs` frame timing and layout counts;
  `motion.mjs` whether each creature moves (and holds still under reduced motion);
  `resize.mjs` whether a resize repaints the identical picture; `ff.mjs` a Firefox render over
  BiDi. `old.html` there is the pre-watercolour poster.

## What to do next

0. **The heat batch: the owner's items 6 and 7** (2026-10-17: "6. lava should thaw", "7. change
   so it shows" for hot water melting ice, under the bar "only meaningful changes that shows,
   because if not then whats the point"). Shortlist items 3 and 4 on the canvas; they are one
   physics change, heat that travels. A first attempt was measured and not shipped; it is in
   `.tmp/cues/batch-c-wip.patch` (lava's radiant heat, `RADIANT_REACH`/`RADIANT_ODDS`; the melt
   carrying heat, `MELT_COST`; two audit scenes), with the probe `.tmp/cues/slab.mjs` and the
   filmstrip scenes `lava-thaw` and `hot-melt`. What it found:
   - Ice re-frosts the wet or freezable cells beside it every tick (masonry) or 1 in 4 (life),
     so no thaw lasts while the ice is there: lava "thaws" in play only by getting rid of the
     ice. Radiant heat two cells out melts ice through a gap or a one-cell wall, but only the
     first column; on a moss bed the lava sets the moss alight and the fire dominates (use
     masonry or bare ground). The audit scene passed 8 of 32 against 4.
   - Hot water: a melt that carries the heat on less `MELT_COST` makes heat from nothing. At 15
     the basin slab lost about 16 of 86 cells against 10; at 10, 8 or 5 it runs away on some
     seeds and not others. With heat conserved, a splash of hot water cannot melt much ice.
   - What would show: heat that spreads through water (a pool a flame warms warms its edges and
     melts the ice round it) and a wider lava heat. Both have wide drift (boiling, steam, mist,
     `water:budget`): run `audit:drift` on every check, and show the owner a filmstrip first.
1. **The rest of the canvas shortlist, when the owner picks:** steam billowing instead of a
   dotted thread (5, a sim lever; `VISUAL_PIPELINE.md` records why a renderer fix was tried and
   reverted), a burning log that stays alive past 5-7 seconds (6), and the tulip cup and nodding
   bluebell (8: `BLOOM_SHAPES` in its three copies, a parity scenario that grows each new head,
   and `FLOWER_REACH` in `shapeLanguage.ts`, which `renderer:probe` now checks against the
   engine's shapes and will fail on until it is updated). The roster board has one upgrade per
   material beyond these.
2. **Fallen petals in their flower's colour** needs a sim change: a shed petal becomes a Pollen
   cell identical to a pollen puff (same variant, energy and age), so the renderer cannot tell
   them apart. It was left out of the flower batch on purpose.
3. **If Chrome's launch flakes on CI again, read its stderr first.** `launchBrowserOnce` waits
   30 s and appends Chrome's stderr to the error. A red CI run on a good commit still needs a
   rerun to confirm the flake and then a new push to deploy.
4. **One half an engine sabotage cannot reach:** `flower.pollen` "more often when cosmic" is a
   rate, which one check cannot see without two gardens compared inside it. (Its other half,
   the dulling, is renderer and now sits under `renderer:probe`'s swept flower checks.)

## How a witness gets checked

1. **Take the actor away** (paint it as Wall, or leave it out). It must fail on every seed.
2. **Take the precondition away**, or check it is not already gone. For an absent check, declare
   it as `requires`.
3. **Does it credit the brush?** A gesture painted with `act` lands after `before` is taken.
4. **Does it credit another clause, or a leftover?** Classify what every counted cell is NOW,
   and filter on the outcome, not the material.
5. **Sabotage the rule in the sim**, both ways where it has two sides (never fires, always
   fires). This catches a witness of the wrong KIND: a position standing in for a speed.

## Where things stand

Live, with the full gate, CI, `deploy:verify` and `qa:live` green:

- **Flowers: every species drawn so you can tell it apart, and weather on petals** (2026-10-19,
  `a20f77d`, renderer only). A petal finds its own crown (nearest rooted Flower of its species
  with the petal inside `FLOWER_REACH`) and is coloured by its offset: heart, tips, shaded
  underside, alternating petals, and each species' mark (poppy blotch round a capsule,
  sunflower seed disc, daisy's wide gold eye, cornflower violet, cosmos magenta, tulip streak,
  lavender alternating buds, bluebell lit bells). Weather is drawn as what it is: dew beads on a
  lattice of rim cells, frost in from the rims, char with an ember line, and moonlight silvering
  the plant's own colours under a starlight glow (it used to swap every species for one lilac).
  Life stages: a head with a heart keeps it hidden while its first petal or two open; a heart
  cell is gilded while it is itself puffing pollen; a poppy's capsule dries pale tan and a
  sunflower's olive middle ripens dark (the other six keep the dry husk). Stalks take a node
  every third cell. Swept over species, four placements and three petal energies, pre-batch ->
  now: heart 5 -> 132, dew bead 16 -> 92, frozen 31 -> 62, moonlit species 0 -> 40, closest
  species 81 -> 98, open crown vs its seed head 45 -> 52; scorched 157 -> 102 and moonlit
  73 -> 57 by design. `renderer:probe` gates all of it (31 pairs) and now reads `BLOOM_SHAPES`
  from the engine; its species gate had been measuring the old five-wide heads. Review found
  five real problems (lavender and bluebell stuck as buds, pollen keyed to the wrong cell, a
  living centre 12 from its seed head, a taller neighbour claiming petals, floors pinned to one
  fixture); all fixed. In a grown garden at play size the change is modest: hearts and dew read,
  the rest shows best up close. Renderer cost on 24 full heads 0.34 -> 0.42 ms a frame.
- **The landing poster is a watercolour** (2026-10-18/19, `3518110`..`9c709cd`).
  `app/public/embed.html` paints a rainy night at a window into canvases on load (Hobbs-style
  layered washes, paper grain, seeded): wet-into-wet sky with runs and backruns, brushstroke rain
  tiles, a dry-brushed desk, lightning painted as masked paper with pooled edges and a lavender
  bleed, and two living jars — a garden jar (right) and a bug jar (left) — whose plants sway and
  whose creatures move (fireflies, ladybug, butterfly, snail, spider, bee, pollen, a breathing
  moonlit glow), all as transform/opacity animations. Measured: about 240 ms to paint at 960x620
  on a 2x screen without a GPU; 60 fps with no layouts after; paragraph contrast 7.0:1 at
  960x620 and 6.3:1 at a 375x700 phone (95th percentile, two strikes included; the phone needs
  its own scrim, and a `max()` in a gradient size silently drops it in Chrome); same picture in
  Firefox; reduced motion holds everything still. Review caught a resize wiping both jars' glass
  (layers were taken as "the first two canvases"); fixed and proven pixel-identical. Not tested
  in Safari/WebKit. `docs/EMBEDDING.md` "What the poster draws" has the details.
- **Star shells have a colour of their own** (2026-10-18): violet `STAR_HUES`, `renderer:probe`
  gate 11 at 81 against plain sparks at the worst moment (floor 70).
- **Moss bursts across a gap; a meteor lights star rockets** (2026-10-17): `SPORE_ODDS`,
  `SPORE_JUMPS`; `FLAG_COSMIC` on meteor-lit powder; star sparks fly 10 ticks and burn out into
  stardust. Sabotage entries `star-sparks-plain-burnout`, `meteor-lights-plain`, `moss-no-spore`.
- **Pollen pollinates, and a garden sows itself** (2026-10-17): a mote brushing a flower of its
  kind sets a windborne seed that sails off; `pollen.seeds` 30 of 32. `PETAL_COST` 3 -> 2.
- **A reaction sound no longer rings when a material only moves** (2026-10-17): each cue whose
  cells can move needs the census to change the way it claims.
- **Every absent check names its precondition**, **a clear restarts the weather**, **a fanned
  meteor trail, sparks lighting oil, stardust sheen**, **a wide gap of air stops a fuse**, and the
  clause-half witness work (2026-10-09 to 10-17); `git log` has each.

The interaction audit has 161 checks bound to all 118 role ids; all pass on the audit's seed.
On 32 seeds, nine do not pass every seed, each with its reason at its scene: `fire.thaws`,
both `oil.ignites` checks, the fanned-trail check of `meteor.trail`, `fungus.fairyring`,
`lava.scorches` and `stem.burns` at 31, the stalk check of `stem.footing` at 27, and the ember
check of `fire.dries` at 29. Thin by nature but passing every seed: the char-wash check of
`ember.quenched` (5 cells), `sand.pours` (34 ticks against a floor of 30), the wet-sand check of
`sand.clumps` (46), the lava and ember checks of `rocket.lights` (35, 33), and the downpour check
of `soil.breathes` (33).

## Design questions for the owner

- **Lava never thaws anything in play**, and **hot water melting ice barely shows** — items 6
  and 7, above.
- Smaller, accepted unless the owner says otherwise: a soaked log leaves a few scorched cells
  unburnt; a burning log is live for only 5-7 seconds; a dormant wellspring blocks only
  non-sources; a meteor shock's scorch is often brief (26 of 32); the sim runs about 24 ticks a
  second at 120 Hz against 20 at 60 Hz; one watering grows a minimum plant; steam reads as a
  dotted thread (the lever is in the sim); Phase 8's listening pass is unfinished; the
  `water.boils` scene is really a quench (fixture debt).

## Decisions already made — do not relitigate

All by the owner, after seeing pictures or measurements:

- **The poster** is a loose, wet watercolour with watercolour rain and lightning and two living
  jars, a garden and a bug jar (2026-10-18/19). Keep visual changes to it painterly and animated
  with transform/opacity only.
- **Flowers** (2026-10-19): species marks, weather drawn as what it is, readable life stages, as
  shipped. Moonlight keeps each species. Seed heads stay dry and speciesless except the poppy's
  capsule and the sunflower's disc. Tulip and bluebell reshapes are a separate, unchosen item.
- A meteor's trail fans out and can light what it passes; sparks light oil; stardust gives oil a
  firework sheen (2026-10-15). A single meteor six cells from a fuse lights it on 2 of 32 seeds.
- A fuse stops at a WIDE gap of air; a burst may relight the far side (2026-10-14).
- Blooms fall with a cut stalk (2026-10-08); embers dry wet fuel first (2026-10-07).
- Wellspring re-teaching sticks for the whole spring, and the learned state is shown
  (2026-10-01); two materials offered at opposite ends at once may split a spring.
- Ice frosts only wet masonry (2026-09-30).
- Rockets: a lit grain shoves through its own charge and lights the powder it touches; the
  volley rises as one column, and about one burst in eight goes off extra high.
- The audit floor stays at 30 ticks (about 1.5 s of play at ~20 ticks a second).
- Mist is visible; lakes are a feature; puddles dry (1 in 450); gases are conserved; bubbles are
  hot-only; never conserve a liquid with no sink; oil and lava may still delete water; a
  rain-filled sand basin becoming sandstone is geology.
- **No cheap fixes**, and never tune a fixture until it passes: if the honest version is thin,
  say so at the scene.

## How to work

- **Branch until green.** A push to `main` deploys once CI passes. Fast-forward `main` after the
  full gate, watch CI, then `npm run deploy:verify`; add
  `COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run qa:live` when players can see the
  change. `deploy:verify` checks the game page, not `embed.html`: for a poster change, capture
  the live poster too (`.tmp/poster/shot.mjs`, `motion.mjs`).
- **Seconds are ticks over ~20**, never 60.
- **The brush clamps radius 0 to 1**: `p(x, y, 0, ...)` paints a plus of five cells.
- **Liquids jump a one-cell wall** (they side-hop two cells); divide a liquid exhibit or fixture
  with walls two thick.
- **Print the board before believing a fixture.** A fixture that hand-places a state play cannot
  reach passes for the wrong reason.
- **Sweep, do not pin, a visual gate.** Every flower floor that was measured at one placement
  and one energy failed somewhere else (review, 2026-10-19). Set floors from the swept worst,
  and gate a cue as what it is: dew is points, so its gate is the brightest bead, not a mean.
- **Run sim tests the way the gate does** (`npm run test:sim`, a debug build).
- **For a design choice, show the owner a rendered picture** (a filmstrip or the canvas) and
  explain it plainly. They decide from the picture, not from seed counts.
- **Close each batch with `/adversarial-review`** (Codex). It caught a real problem in every
  batch, including both of these. Pick lenses by what the diff touches (Parity for an engine
  change, Perceptual for the renderer, Drift for a new rule). Codex has its own usage limit and
  can stop mid-review: check each reviewer's output exists, and rerun the missing ones. Keep
  review files in the session scratchpad, build the prompts with a Python script, and close
  `codex exec`'s stdin with `< /dev/null`.
