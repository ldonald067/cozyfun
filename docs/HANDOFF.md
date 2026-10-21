# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-21, after poured lava stopped
deleting itself (it pools now, and sets into stone), the day after the heat batch (the owner's
items 6 and 7). See `git log` for the live commit. Check `gh run list` first
and only then run `npm run deploy:verify`: a red CI run makes Railway skip that commit for good
(a rerun does not revive it, a new push does).*

## Work within the owner's usage limits

The owner hits usage limits early, so keep each chat lean:

- **Read docs on demand, in ranges.** `CLAUDE.md` names the deep docs as plain paths. `grep -n`
  for the section you need, then read only those lines. `HARNESS.md`, `VISUAL_PIPELINE.md` and
  `MATERIAL_AUDIT.md` are 40-70 KB each; reading a file under `app/src/rendering/` pulls
  `VISUAL_PIPELINE.md` in whole through that directory's `CLAUDE.md`, so grep there first.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all checks at 8 seeds against `main` takes about five. Keep `--only` to
  about six ids a run: the cache file is named after the list, and 17 ids made the name too long
  for macOS (ENAMETOOLONG).
- **Run the full gate (`npm run check`, ~8 minutes) once per batch**, not after every edit.

## The owner picks from pictures, and there is a canvas for it

**The design canvas "Flowers and Interactions"** (https://claude.ai/artifact/9DB9Smb5oY65EfpdKJkXkS,
private to the owner) holds the eight flower species, the tulip and bluebell reshapes, life
stages, weather states, a ranked shortlist of eight upgrades, and the interaction roster marked
shows / thin / reads weak / half hidden. Shortlist items 1, 2 and 7 shipped (`a20f77d`), and 3
shipped as the heat batch; 4 (lava thawing across a gap) was built, measured and dropped (below).
5, 6 and 8 are open. **The canvas does not say so yet**; its files are under
`.tmp/design/canvas/`, publish edits to the same URL. The owner asks for a filmstrip before
anything ships.

## Scratch tools (under `.tmp/`, untracked)

- **Heat (2026-10-20):** `.tmp/heat/scenes.mjs` holds the batch's painted scenes (slab, puddle,
  warm-puddle, thaw, ice-wall). `probe.mjs [seeds] [scene]` prints counts at set ticks, base
  against the working tree; `board.mjs <scene> <t,t> [off] [base]` prints the board (water as a
  digit for its energy); `ablate.mjs <seeds> <sabotage>` gives one number per scene with any
  sabotage from `.tmp/halves/sabotages.mjs` applied; `kinds.mjs <scene> <tick>` a material
  census; `boil.mjs` three pots under a held flame; `lavacount.mjs` the lava self-deletion below.
  `NOTES.md` there covers the exploration, including what was tried and dropped.
- **Lava and oil (2026-10-21):** `.tmp/lava/variant.mjs` builds find/replace copies of
  `app/src/engine.ts` without touching it; its `live` is the WORKING TREE, so compare against
  `.tmp/lava/base` (refresh it with `git archive HEAD app/src | tar -x -C .tmp/lava/base`).
  `measure.mjs <variant> pour|spring|long` (a basin pour, a spring on the 220x140 board, a pool
  left 2.5 min), `scan.mjs <variant> [seeds]` (every audit check, live against a variant, pass
  counts), `film.mjs <scene> <variant>` and `film3.mjs <scene>` (three engines in one strip),
  `slick.mjs` and `pondcount.mjs` (oil in the open), `crowd.mjs <n>` (oil thinning only with n
  oil neighbours). `NOTES.md` there has every number, oil's included.
- **Sabotage:** `.tmp/halves/sabotages.mjs` holds find/replace edits on `app/src/engine.ts`, one
  per rule half, both ways where a rule has two sides; the heat batch's are at the end. Keep the
  dice (leave the `chance()` roll). `.tmp/halves/sab.mjs <name> [seeds] [id,id]` plays every
  check against one sabotage and counts only seeds the clean mirror passes. Launch parallel runs
  about 12 s apart: they share the `halves-base` compile. `try-map.mjs`, `c-verify4/5.mjs`,
  `show2.mjs`, `passes.mjs`, `why.mjs` and `lockstep.mjs` are as before (see their headers).
- **Reaction cues:** `.tmp/cues/probe.mjs [seeds] [filter]` and `.tmp/cues/truth.mjs`.
- **Filmstrips for the owner:** `.tmp/film/film.mjs <scene> [seed]` draws the base build above
  the working tree through the real engine and renderer, glow approximated, into
  `.tmp/film/<scene>.png`; scenes live in `.tmp/film/scenes.mjs` (`heat-slab`, `heat-puddle`,
  `heat-thaw`, `heat-lava-ice` are the heat batch's). **Refresh the base first:**
  `rm -rf .tmp/film/base && mkdir -p .tmp/film/base && git archive HEAD app/src | tar -x -C .tmp/film/base`
  (it is still the pre-heat `79761a6`). Flower scenes: `flowers-species`, `flowers-states`,
  `garden-life`. `.tmp/film/perf.mjs` times the renderer per frame on 24 full heads.
- **Flower tuning:** `.tmp/design/pairs.mjs`, `.tmp/design/mock.py` / `mock2.py`.
- **The embed poster:** `.tmp/poster/shot.mjs`, `contrast.mjs`, `fps.mjs`, `motion.mjs`,
  `resize.mjs`, `ff.mjs` (see the 2026-10-18 entry below); `old.html` is the pre-watercolour one.

## What to do next

0. **Poured oil still deletes itself as it spreads** (583 cells of a basin pour are 19 ten
   seconds later; lava had the same fault until 2026-10-21). It needs a sink that spares a slick,
   and two were tried and dropped, with numbers, in `docs/HARNESS.md` ("Reopened for lava over
   lava"): thinning moving oil 1 in 50 bounds its spring but empties every open slick within
   30 s, because oil on a floor keeps shuffling into any gap; thinning only crowded oil keeps
   slicks but its spring climbs (6.5% of the board at 16,000 ticks). A sink tied to the spring
   itself is the untried idea. Show the owner `film3.mjs oil-pond` (live, and each candidate).
1. **The rest of the canvas shortlist, when the owner picks:** steam billowing instead of a
   dotted thread (5, a sim lever; `VISUAL_PIPELINE.md` records why a renderer fix was tried and
   reverted), a burning log that stays alive past 5-7 seconds (6), and the tulip cup and nodding
   bluebell (8: `BLOOM_SHAPES` in its three copies, a parity scenario that grows each new head,
   and `FLOWER_REACH` in `shapeLanguage.ts`, which `renderer:probe` checks against the engine's
   shapes and will fail on until it is updated). The roster board has one upgrade per material.
2. **Fallen petals in their flower's colour** needs a sim change: a shed petal becomes a Pollen
   cell identical to a pollen puff, so the renderer cannot tell them apart.
3. **If Chrome's launch flakes on CI again, read its stderr first.** `launchBrowserOnce` waits
   30 s and appends Chrome's stderr to the error. A red CI run on a good commit still needs a
   rerun to confirm the flake and then a new push to deploy.
4. **Halves no check can see yet:** `flower.pollen` "more often when cosmic" is a rate, which one
   check cannot see without two gardens compared inside it; `lava.scorches` "thaws" is still
   unreachable by touch, even with lava pooling now: a kept pool against an ice wall barely melts
   it, because a stone crust forms between them (a check for it passed 0 of 16 seeds after the heat batch, and was not
   kept): frost lies only beside the ice that made it, and lava meets the ice first.

## How a witness gets checked

1. **Take the actor away** (paint it as Wall, or leave it out). It must fail on every seed.
2. **Take the precondition away**, or check it is not already gone. For an absent check, declare
   it as `requires`.
3. **Does it credit the brush?** A gesture painted with `act` lands after `prev` and `before`
   are taken. The heat batch's warm-melt check passed with warmth never melting anything until it
   also looked for heat touching the cell NOW: a dab of flame melts ice last tick's view shows
   untouched.
4. **Does it credit another clause, or a leftover?** Classify what every counted cell is NOW,
   and filter on the outcome, not the material. The same check passed with warm water giving the
   ice nothing, because frost from boiling steam brings its heat too; it now skips any cell steam
   has touched.
5. **Sabotage the rule in the sim**, both ways where it has two sides (never fires, always
   fires). This catches a witness of the wrong KIND: a position standing in for a speed.

## Where things stand

Live, with the full gate, CI, `deploy:verify` and `qa:live` green:

- **Poured lava pools, and a pool sets into stone** (2026-10-21). Lava never deletes lava now
  (`try_move`, beside the water guard): a 408-cell pour into the water budget's basin used to be
  51 cells ten seconds later, a film, and keeps every cell. Its sink is its own: lava deep in a
  pool cools too, one roll in `LAVA_DEEP_COOLS` (24) against one in 8 at an edge, so a pour sets
  to stone in 50-75 s and a lava spring builds a stone hill over itself and is sealed by it
  (`npm run water:budget`: 13.7% of the board at tick 1,000, then no lava and 7,480 stone, 24%,
  by 16,000). Oil was ported too and taken out again before landing (item 0). Two new checks
  (`lava.flows` "pours into a pool instead of thinning to a film", `lava.cools` "a poured pool
  sets into stone from within") pass 32 of 32 and fail every seed with their rule sabotaged.
  Drift at 8 seeds: 6 of 165 checks moved, all gains (`lava.cools` crust 5 -> 11 cells,
  `stone.born` 21 -> 26 cells and contrast 201 -> 245, the two quench checks +3 or 4 cells); at
  32 seeds none of the 23 lava checks passes on fewer seeds. Review found only a duplicated note.
- **Heat that shows** (2026-10-20, the owner's items 6 and 7). Water's energy is its
  temperature and ice's energy is now its warmth. Four rules, each measured out against the others
  (`sim/src/lib.rs`, the constants after `PETAL_SHED_AGE`): heat spreads through water, exactly
  conserved, as the tick's last step (`share_heat`, `HEAT_SHARE` 8); water cools one tick in
  `WATER_CHILL` (16), on the global clock; ice freezes only water no warmer than `ICE_TEMP` (40),
  warmer water gives it `(E - 40) / 8` a tick instead, and ice that has taken `ICE_MELT` (180)
  melts; and frost from steam brings the steam's heat into the ice that catches it. A flame held
  ten seconds to the audit's slab leaves 17 of 86 cells of ice (78 before), a puddle between two
  ice banks opens and refreezes once the flame goes, pots now simmer visibly and boil away at
  about the old rate, and lava by an ice block no longer grows it (52 -> 53 cells by 20 s,
  against 68). Lava radiating heat across a gap was built and dropped: it moved nothing (85 cells
  against 84), because poured lava thins to a film (next item 0). A first version stopped hot
  steam freezing at all; it cost `ice.condenses` and `steam.frosts` their frost (8 of 8 seeds to
  0 and 1), and the owner chose the steam-heat rule instead. Review (Codex: skeptic, parity,
  drift, minimalist) found conduction, then inside the reaction pass, giving away heat a vent or
  the chill had already spent; it moved to the end of the tick. Drift at 8 seeds against the
  base: the three heat checks, `ice.melts` (37 -> 23 cells, contrast 267 -> 134 against a floor
  of 24), `oil.sheen` (+13 cells) and `oil.ignites` (contrast 426 -> 414). At 32 seeds no check
  passes on fewer seeds than before.
- **Flowers: every species drawn so you can tell it apart, and weather on petals** (2026-10-19,
  `a20f77d`, renderer only). A petal finds its own crown and is coloured by its offset; weather is
  drawn as what it is (dew beads, frost from the rims, char with an ember line, moonlight keeping
  each species); readable life stages. `renderer:probe` gates all of it (31 pairs), swept over
  species, placements and energies. In a grown garden at play size the change is modest.
- **The landing poster is a watercolour** (2026-10-18/19, `3518110`..`9c709cd`).
  `app/public/embed.html` paints a rainy night at a window, seeded, with a garden jar and a bug
  jar whose creatures move, all as transform/opacity animations; 60 fps after a ~240 ms paint,
  paragraph contrast 7.0:1 (6.3:1 on a phone). Not tested in Safari/WebKit. `docs/EMBEDDING.md`
  "What the poster draws" has the details.
- **Star shells have a colour of their own**, **moss bursts across a gap; a meteor lights star
  rockets**, **pollen pollinates and a garden sows itself**, **a reaction sound no longer rings
  when a material only moves**, and the clause-half witness work (2026-10-09 to 10-18); `git log`
  has each.

The interaction audit has 165 checks bound to all 118 role ids; all pass on the audit's seed.
The 32-seed list of checks that do not pass every seed was last taken in full on 2026-10-17:
`fire.thaws`, both `oil.ignites` checks, the fanned-trail check of `meteor.trail`,
`fungus.fairyring`, `lava.scorches` and `stem.burns` at 31, the stalk check of `stem.footing`
at 27, and the ember check of `fire.dries` at 29 (re-measured after the heat batch). Of the heat
batch's checks, two pass 32 of 32; `ice.condenses` "takes the steam's heat" passes 28 (four seeds
show it under 30 ticks: how long the lava keeps quenching beside the ice varies). The two lava
checks pass 32 of 32.

## Design questions for the owner

- **Poured oil still deletes itself as it spreads** — item 0, above.
- Smaller, accepted unless the owner says otherwise: a soaked log leaves a few scorched cells
  unburnt; a burning log is live for only 5-7 seconds; a dormant wellspring blocks only
  non-sources; a meteor shock's scorch is often brief (26 of 32); the sim runs about 24 ticks a
  second at 120 Hz against 20 at 60 Hz; one watering grows a minimum plant; steam reads as a
  dotted thread (the lever is in the sim); Phase 8's listening pass is unfinished; the
  `water.boils` scene is really a quench (fixture debt).

## Decisions already made — do not relitigate

All by the owner, after seeing pictures or measurements:

- **Heat** (2026-10-20): the four rules as shipped. Steam keeps frosting onto ice and gives the
  ice its heat; hot steam is NOT kept from freezing (that cost two frost interactions). Lava's
  radiant heat across a gap is not in.
- **Lava pools and sets** (2026-10-21): lava never deletes lava, and a deep pool cools from
  within at one roll in 24. A lava spring building a stone hill over itself (24% of the board at
  its peak) and going quiet is accepted. **Oil stays as it is live** until it has a sink that
  spares a slick; thinning every moving oil cell (1 in 50) was approved first and withdrawn when
  it turned out to empty open slicks within 30 s.
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
- **The brush clamps radius 0 to 1**: `p(x, y, 0, ...)` paints a plus of five cells, so a wall
  drawn cell by cell is three thick, and ice painted down to a floor eats into it.
- **Liquids jump a one-cell wall** (they side-hop two cells); divide a liquid exhibit or fixture
  with walls two thick. The cargo tests' `pocket` helper seals two thick.
- **Print the board before believing a fixture.** A fixture that hand-places a state play cannot
  reach passes for the wrong reason.
- **Sweep, do not pin, a visual gate.** Set floors from the swept worst, and gate a cue as what
  it is: dew is points, so its gate is the brightest bead, not a mean.
- **Run sim tests the way the gate does** (`npm run test:sim`, a debug build).
- **For a design choice, show the owner a rendered picture** (a filmstrip or the canvas) and
  explain it plainly. They decide from the picture, not from seed counts.
- **Close each batch with `/adversarial-review`** (Codex). It caught a real problem in every
  batch, including this one. Pick lenses by what the diff touches (Parity for an engine change,
  Perceptual for the renderer, Drift for a new rule). Codex has its own usage limit and can stop
  mid-review: check each reviewer's output exists, and rerun the missing ones. Keep review files
  in the session scratchpad, build the prompts with a Python script, and close `codex exec`'s
  stdin with `< /dev/null`.
