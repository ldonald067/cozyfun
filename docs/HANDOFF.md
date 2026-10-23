# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-10-22, late evening: the flowers batch is on branch `flowers-depth`, unpushed (item 1). Railway caught up
by itself once builds resumed after the 2026-10-21 outage: lava pooling (`24d5075`), the oil
batch (`f6c57e2`) and the petrol film (`9e92777`) went out together, with `deploy:verify` and
`qa:live` green on `53c86a7`. Water no longer deleting lava was pushed on top the same evening
("Where things stand"). After any push, check `gh run list` before `npm run deploy:verify`: a
red CI run makes Railway skip that commit for good.*

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
8 is built on branch `flowers-depth` ("Where things stand"); 5 and 6 are open. The shortlist
board shows each item's status since 2026-10-22, and the "Flowers with more depth" board holds
the four outline/depth candidates the owner picked from. Publish edits
to the same URL; read the artifact first (`Artifact` read of the url, then the file by `path`),
because a publish against a stale version is refused. The owner asks for a filmstrip before
anything ships.

## Scratch tools (under `.tmp/`, untracked)

- **Flowers with more depth (2026-10-22):** `.tmp/flowers-depth/`. `ref2.py` measures a
  reference sheet at its art-pixel grid (head size, tones, luminance spread); `ours.mjs` and
  `board.mjs <scene> <tick> <scale> <variant,...> [crop]` the same on our heads, through scratch
  renderer copies that `make-variants.py` builds (today, A lit from above, B rings inside, C the
  outline, AC; D is drawn in `board.mjs`; `tree` is the working tree); `perf.mjs` times a frame
  (`ALL=1` includes empty cells); `film2.mjs <ticks> <scale> [seed]` a painted meadow, HEAD above
  the tree; `reshape-checks.mjs [seeds]` and `actor.mjs` the two reshape audit checks;
  `sheet.py` builds `flowers-batch-sheet.png`, the filmstrip the owner saw. `.tmp/film/` now
  plants each build's own shapes (`film.mjs` passes the build root), and has `reshape-opening`.

- **Heat (2026-10-20):** `.tmp/heat/scenes.mjs` holds the batch's painted scenes (slab, puddle,
  warm-puddle, thaw, ice-wall). `probe.mjs [seeds] [scene]` prints counts at set ticks, base
  against the working tree; `board.mjs <scene> <t,t> [off] [base]` prints the board (water as a
  digit for its energy); `ablate.mjs <seeds> <sabotage>` gives one number per scene with any
  sabotage from `.tmp/halves/sabotages.mjs` applied; `kinds.mjs <scene> <tick>` a material
  census; `boil.mjs` three pots under a held flame; `lavacount.mjs` the lava self-deletion below.
  `NOTES.md` there covers the exploration, including what was tried and dropped.
- **Lava deleted by water (2026-10-22):** `.tmp/lavafix/`. `halves.mjs [seeds]` plays the new
  check on the tree, without its water, and on three sabotages of the guard (water let through,
  grains let through, lava-only as before); `census.mjs` / `perseed.mjs` the quench scene's
  rock per seed; `diff.mjs <seeds>` the kinds that change on the tick lava plus rock drops;
  `instr.mjs <seeds>` the same on an instrumented engine copy in `instr/` that names the move
  overwriting rock; the filmstrip sheet is `lava-quench-sheet.png`.
- **Lava and oil (2026-10-21):** `.tmp/lava/variant.mjs` builds find/replace copies of
  `app/src/engine.ts` without touching it; its `live` is the WORKING TREE, so compare against
  `.tmp/lava/base` (refresh it with `git archive HEAD app/src | tar -x -C .tmp/lava/base`).
  `measure.mjs <variant> pour|spring|long` (a basin pour, a spring on the 220x140 board, a pool
  left 2.5 min), `scan.mjs <variant> [seeds]` (every audit check, live against a variant, pass
  counts), `film.mjs <scene> <variant>` and `film3.mjs <scene>` (three engines in one strip),
  `slick.mjs` and `pondcount.mjs` (oil in the open), `crowd.mjs <n>` (oil thinning only with n
  oil neighbours). `NOTES.md` there has every number, oil's included.
- **Oil (2026-10-21, evening):** `.tmp/oil/` is this batch's. `variant.mjs` (find/replace
  copies of `app/src/engine.ts`; `live` is the WORKING TREE), `measure.mjs <variant> [quick|spring]`
  (open dab, basin pour, pond slick, spring at 4k/8k/16k), `bias32.mjs [root]` and `bias6.mjs`
  (does a pour drift: centre offsets over varied pours; keep the sheet clear of the board's
  edges or the edges set the centre), `checks.mjs <roleRegex> [seeds] [sab,sab|all]` (chosen
  audit checks on the tree, on HEAD in `.tmp/oil/base`, and on named sabotages of the oil rules;
  `PAINT=1` matches the regex against a scene's paint instead), `film.mjs <scene>` (HEAD above
  the tree) and `sheet.py` (the four strips on one labelled sheet, `oil-sheet.png`).
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
- **Liquids review (2026-10-22):** `.tmp/review/` holds the design review's tools.
  `cmp.mjs <scene> <engineRoot:rendererRoot> <engineRoot:rendererRoot> [seed]` draws one row per
  build (scenes in `cmpscenes.mjs`: `oil-on-soil`, `lava-quench`); `lavacount.mjs <engineRoot> [n]`
  is the quench leak below; `oilsheet2.mjs [rendererRoot]` a resting slick against six floors;
  `oilrivals.mjs` the slick against what else lies on soil; `slickgate.mjs` gate 12 standalone
  (`STATES=frozen,cosmic,...`, `CHAR=1`). `vlava/` is HEAD's engine with the one-line lava guard;
  `head/` is HEAD's `app/src`. `oil-candidates.png` is the board the owner picked from.
- **The embed poster:** `.tmp/poster/shot.mjs`, `contrast.mjs`, `fps.mjs`, `motion.mjs`,
  `resize.mjs`, `ff.mjs` (see the 2026-10-18 entry below); `old.html` is the pre-watercolour one.

## What to do next

0. **If a push makes no Railway deployment at all**, check https://status.railway.com first, then
   deploy the commit from the service's GitHub source:
   `railway api 'mutation($s: String!, $e: String!, $c: String) { serviceInstanceDeployV2(serviceId: $s, environmentId: $e, commitSha: $c) }' --var s=b0acc433-99f7-4db1-9ec0-8fc94d813955 --var e=374411d2-6a14-448d-9e1f-1ccea6180158 --var c="\"$(git rev-parse HEAD)\""`.
   The CLI was logged out on 2026-10-22 (`railway whoami`: Unauthorized); the owner runs
   `railway login`. Never `railway up` (no build commit, so `deploy:verify` fails), nor the
   Railway MCP's `redeploy` (re-runs the old build) or `create-deployment` (a new service).
1. **Ship branch `flowers-depth` on the owner's word** ("Where things stand"). The owner asked
   for a filmstrip before anything ships: `.tmp/flowers-depth/flowers-batch-sheet.png` (live
   above the branch). On a yes: fast-forward `main`, push, `gh run list`, then
   `npm run deploy:verify` and `COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run qa:live`.
   Leaves (two greens with a lit edge, cooler stems, from the reference `3.png`) were not part
   of the pick and are untouched; the reference images in `.tmp/flowers-ref/` are stock art to
   look at, never to ship or commit.
2. **Lava leans left, for the reason oil leaned right** (found 2026-10-21, not changed). Lava
   moves on even ticks only (`update_liquid` at sluggishness 2), always the left-to-right pass:
   a mid-floor pour ends 15-25 cells left of where it was poured, on every seed. Giving it one
   tick of each pass (`tick % 4 < 2`, as oil now has) centres it (-0.3) and leaves a basin pour
   setting to stone in 50-75 s as before, but a lava spring's stone hill grows from 24% of the
   board to 29% (7,480 -> 9,067 stone at 16,000 ticks), and 24% is the owner's accepted number.
   The owner decides; measure with `.tmp/oil/lava.mjs lcad` and `bias.mjs .tmp/oil/root-lcad`.
3. **The rest of the canvas shortlist, when the owner picks:** steam billowing instead of a
   dotted thread (5, a sim lever; `VISUAL_PIPELINE.md` records why a renderer fix was tried and
   reverted) and a burning log that stays alive past 5-7 seconds (6). Item 8 is on branch
   `flowers-depth`. The roster board has one upgrade per material.
4. **Fallen petals in their flower's colour** needs a sim change: a shed petal becomes a Pollen
   cell identical to a pollen puff, so the renderer cannot tell them apart.
5. **If Chrome's launch flakes on CI again, read its stderr first.** `launchBrowserOnce` waits
   30 s and appends Chrome's stderr to the error. A red CI run on a good commit still needs a
   rerun to confirm the flake and then a new push to deploy.
6. **Halves no check can see yet:** `flower.pollen` "more often when cosmic" is a rate, which one
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

On branch `flowers-depth`, committed, NOT pushed, waiting on the owner's yes to the filmstrip
(2026-10-22, late evening). Full gate green, review run (Codex: skeptic, parity, perceptual):

- **Every flower head is outlined in a deep shade of its own colour** (renderer only; the owner's
  pick, candidate C of four on the canvas's "Flowers with more depth" board). Measured first:
  the reference `3.png`'s heads are 12-16 px across with 4-9 tones and a dark own-hue outline a
  quarter to a half of each head, darkest to lightest about 30 -> 240; ours are 7 cells (about
  23 px on a laptop, 12 on a phone), one cell per petal, spread 85. A ramp inside a petal cannot
  exist at that size, so the outline is what carries over: open air beside a petal is drawn in
  the plant's dark colour pushed toward violet (`headRing` in `emptyCellColor`), spread 85 -> 133,
  heads drawn 9 wide. Only petals are ringed (no ring round a bud or seed head); the ring follows
  the petal's weather in `flowerColor`'s order (review caught frost on a charred petal leaving a
  black ring, 20 from the night). 0.15 ms a frame. `renderer:probe` gate 13: 120 from the night
  (floor 110), 46 darker than its head (floor 40), none round buds or seed heads, swept over every
  flag mix; every older flower gate is unchanged. `VISUAL_PIPELINE.md` has the four candidates.
- **The tulip is a cup and the bluebell nods** (shortlist item 8, a sim change). `BLOOM_SHAPES` 4
  and 6 in all three copies, `FLOWER_REACH`, and the two heads' colours from the canvas mock (the
  bluebell's scape and crown are green). `the_tulip_opens_a_cup_and_the_bluebell_nods` asserts
  the shapes as shapes and fails on the old rows; a parity scenario grows both whole (15/15,
  12/12); two `flower.opens` checks witness a whole cup and a whole nodding bluebell in a
  play-width meadow from painted materials: 30 and 29 of 32 seeds, every miss a meadow where no
  plant of that species came up, 0 of 8 on `main`, unreachable without the watering. Drift at 8
  seeds against `main`: only those two checks moved, of 172. Silhouette overlap: worst pair
  unchanged at 0.75, the tulip's nearest 0.64 -> 0.58.

Pushed to `main` on 2026-10-22 on the owner's word ("deploy and fix lava"), with the full gate and
review green; `npm run deploy:verify` says whether the deployment has reached it:

- **Water no longer deletes lava** (the design review's item 1). `try_move` (and `move` in the
  JS mirror) let water flowing into a cell lava had entered that tick overwrite it; nothing that
  moves may overwrite lava now, one line that replaced the lava-lava guard. The review's quench
  scene (a 49-cell pour beside a splash of water) kept a median 76% of itself as rock over 32
  seeds, 14% at the worst; now 100%, 92% at the worst, and every seed below 100% is lava still
  molten (lava plus rock stays at 49 on every seed). Water is the whole leak: let grains through
  the guard and the numbers do not move. `water:budget` is unchanged (the lava spring still peaks
  at 13.7% and sets to 7,480 stone). A cargo test and a parity scenario (19 quenched, 0 deleted;
  11 deleted with the old guard), and an absent audit check, `lava.quenched` "water never deletes
  the lava it meets": 32 of 32 on the tree, leaks on 32 of 32 on HEAD and with water let through,
  unreachable with the water left out. Drift at 8 seeds: only the new check moved (1 of 170); at
  32 seeds no lava or `stone.born` check passes on fewer seeds (`lava.scorches` 31 -> 32). `clobber:census` finds no mover overwriting lava in any audit
  scene. Review (Codex: parity, skeptic, drift) found no regression; the skeptic's one finding is
  the meteor leak, which the old guard shares. The filmstrip is
  `.tmp/lavafix/lava-quench-sheet.png` (live above the fix, seeds 11 and 8). The two leaks it
  left are under "Decisions already made": the owner left both.

Live since 2026-10-22 (`deploy:verify` and `qa:live` green on `53c86a7`), after Railway's outage:

- **A thin oil slick on soil shows a petrol film** (`9e92777`, fast-forwarded from branch
  `oil-petrol` on the owner's word; full gate and review, Codex: perceptual, skeptic, green).
  The owner's pick from a board of three. A poured slick rests one cell deep, and on soil 491 of
  696 of its cells sat within 45 of the soil under them; now none do. Renderer only, and only for a cell that is both the slick's surface and
  lying on soil or char, so every other floor draws as before. `renderer:probe` gate 12, three
  tiers (ordinary soil 87, char 65, every soil state 29: a frozen slick on frozen soil is frost on
  frost). A showcase exhibit beside the two rocks. `VISUAL_PIPELINE.md`, Oil, has the numbers and
  the three versions that were dropped. The same review found water deleting lava (above).
- **Oil keeps what is poured, spreads evenly and comes to rest; only a spring's oil fades**
  (2026-10-21, `f6c57e2`, landed from branch `oil-flow` after the owner saw the filmstrip). Printing the board found why oil never settled: it moved on even ticks only,
  always the left-to-right pass, so its side never flipped and every slick slid right (a pour
  on an open floor ended at the board's edge on 32 seeds of 32, 14 cells left of ~150). Now
  (`update_oil`): oil moves on `tick % 4 < 2`, one tick of each pass; keeps flowing the way it
  is going until blocked (`FLAG_DRIFT_EAST` xor the variant's low bit, so a dab starts both
  ways); rests on anything but oil, so a pour becomes a still sheet one cell deep; never deletes
  oil (`try_move`); and only oil a spring poured fades, 1 in `OIL_SPRING_FADES` (250) of its
  moving ticks (`FLAG_SPRING_OIL`, the rooted bit). Measured: basin pour 455 of 455 kept (19 of
  583 before), a dab and a pond slick keep every cell, an oil spring holds 7.0-7.2% of the
  220x140 board from tick 4,000 to 16,000 on wasm (water: 7.0-7.2%), pours centre at -0.5 cells
  over 32 varied pours (a 1-3 cell lean remains on an 85-cell sheet). Every step was needed:
  flipping the side alone left a heap shuffling in place; momentum with the old cadence drifted
  pours 23-28 cells left; a per-move sink let the settled spring reach 24%. Four new audit
  checks under `oil.floats`, each failing on HEAD and under its own rule's sabotage; the old
  "sheets sideways" check was restaged on a flat shelf after review (Codex: skeptic, parity,
  drift, minimalist) found it passed with every sideways move taken out. All other oil and
  spring checks pass 8 of 8 seeds (JS, against HEAD); "floats up above water" fell 24 -> 14
  cells, `fire.ignites` contrast 448 -> 385. Two side fixes: the JS eraser stamped a variant
  byte on empty cells (a parity bug Rust never had, found by the new spring scenario), and the
  `oil_rises_above_water` fixture (three copies) leaked water and passed only by ending on the
  swap tick.
- **Poured lava pools, and a pool sets into stone** (2026-10-21, `24d5075`). Lava never deletes lava now
  (`try_move`, beside the water guard): a 408-cell pour into the water budget's basin used to be
  51 cells ten seconds later, a film, and keeps every cell. Its sink is its own: lava deep in a
  pool cools too, one roll in `LAVA_DEEP_COOLS` (24) against one in 8 at an edge, so a pour sets
  to stone in 50-75 s and a lava spring builds a stone hill over itself and is sealed by it
  (`npm run water:budget`: 13.7% of the board at tick 1,000, then no lava and 7,480 stone, 24%,
  by 16,000). Oil was ported too and taken out again before landing; it is the batch above. Two new checks
  (`lava.flows` "pours into a pool instead of thinning to a film", `lava.cools` "a poured pool
  sets into stone from within") pass 32 of 32 and fail every seed with their rule sabotaged.
  Drift at 8 seeds: 6 of 165 checks moved, all gains (`lava.cools` crust 5 -> 11 cells,
  `stone.born` 21 -> 26 cells and contrast 201 -> 245, the two quench checks +3 or 4 cells); at
  32 seeds none of the 23 lava checks passes on fewer seeds. Review found only a duplicated note.

Live before that, with the full gate, CI, `deploy:verify` and `qa:live` green:

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
  against 84), because poured lava thinned to a film (fixed in `24d5075`; a kept pool against ice still barely melts it). A first version stopped hot
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

The interaction audit has 172 checks bound to all 118 role ids; all pass on the audit's seed.
The 32-seed list of checks that do not pass every seed was last taken in full on 2026-10-17:
`fire.thaws`, both `oil.ignites` checks, the fanned-trail check of `meteor.trail`,
`fungus.fairyring` and `stem.burns` at 31 (`lava.scorches` passes 32 since 2026-10-22), the stalk check of `stem.footing`
at 27, and the ember check of `fire.dries` at 29 (re-measured after the heat batch). Of the heat
batch's checks, two pass 32 of 32; `ice.condenses` "takes the steam's heat" passes 28 (four seeds
show it under 30 ticks: how long the lava keeps quenching beside the ice varies). The two lava
checks pass 32 of 32.

## Design questions for the owner

- **Should lava move evenly too?** Item 2: it centres a pour but grows a spring's hill to 29%.
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
- **Two leaks are left as they are** (2026-10-22, after the lava fix). Water still deletes a
  grain that sank into steam that same tick: `try_move` lets a mover sink through gas that was
  in a cell all tick without checking it is still there, which costs one cell of quench stone or
  sand on 3 of 32 seeds of the quench scene (`.tmp/lavafix/instr.mjs 27169 2169 13169` names the
  move). And a blocked meteor's impact writes fire into any neighbour empty in `old`
  (`update_meteor`), so it can replace lava that flowed there that tick (Codex reproduced it on
  seeds 7, 8, 10, 20 and 31 of a 16x16 fixture; the old guard does the same).
- **Lava pools and sets** (2026-10-21): lava never deletes lava, and a deep pool cools from
  within at one roll in 24. A lava spring building a stone hill over itself (24% of the board at
  its peak) and going quiet is accepted. **Oil stays as it is live** until it has a sink that
  spares a slick; thinning every moving oil cell (1 in 50) was approved first and withdrawn when
  it turned out to empty open slicks within 30 s. **The oil batch was approved** from its
  filmstrip (2026-10-22): poured oil keeps every cell and rests as a still sheet, and only a
  spring's oil fades, so a spring holds a low, speckled mound of about 7% of the board.
- **The poster** is a loose, wet watercolour with watercolour rain and lightning and two living
  jars, a garden and a bug jar (2026-10-18/19). Keep visual changes to it painterly and animated
  with transform/opacity only.
- **Flowers** (2026-10-19): species marks, weather drawn as what it is, readable life stages, as
  shipped. Moonlight keeps each species. Seed heads stay dry and speciesless except the poppy's
  capsule and the sunflower's disc. **2026-10-22:** depth comes from an own-hue outline round
  each head (C), not lighting from above (A), a dark rim inside the head (B), or petals drawn
  inside the cell (D); the tulip cup and nodding bluebell are chosen, in the same batch.
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
