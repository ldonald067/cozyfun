# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Shipped work lives in `git log`, whose commit
messages carry each batch's measurements. Written 2026-10-30, after water learned to move
(`7f97074`, `b8127a4`): a calm body with drifting currents, depth as real absorption, and
streams that stretch and whiten as they fall. Nothing else is in flight.*

## Keep chats lean

The owner hits usage limits early.

- **Read deep docs in ranges.** `grep -n` for the section you need, then read only those
  lines. `VISUAL_PIPELINE.md` is 87 KB, `HARNESS.md` 68 KB, `MATERIAL_AUDIT.md` 46 KB.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all checks at 8 seeds against `main` takes about five. Keep `--only` to
  about six ids: the cache file is named after the list, and 17 ids made the name too long
  for macOS (ENAMETOOLONG).
- **Run the full gate (`npm run check`) once per batch**, not after every edit. It was about
  8 minutes before the big heads; the flower checks now play 6,000-7,200 ticks (a second wave
  opens about four minutes in), so the audit, the drift tool and the gate all run longer.
- **Do not fan out long runs.** A 32-seed `.tmp/halves/sab.mjs` pass over `flower.opens` plays
  every seed twice (clean and sabotaged); six at once ran for well over half an hour. Run two
  at most, and prefer a script's raw numbers (`.tmp/bighead/thresh.mjs`) to a full verdict run
  when the gap is already measured. Anything importing `scripts/interaction-scenes.mjs`
  recompiles `.tmp/audit-renderer` on load, so two started together can crash each other.

## What to do next

**The owner's direction (2026-10-30): "a mix of realism but still pixel art" for every element,
one batch at a time, in this order.** (1) Heat: fire, ember, lava, smoke, steam. (2) Moonwater, oil.
(3) Solids: stone, sand, soil, ice, glass, wood, wall. (4) Living things. (5) Stardust, meteor, rocket,
spark. The recipe is water's: pick the one or two things that make the real material look real, draw
only those in the cells the sim already makes, show a MOVING side-by-side (`.tmp/water/tune.mjs` with
`sheet.py`), and gate it from painted materials. Most interactions improve with their materials; the
one shared idea left is light that fades with distance. Fire, lava and oil must keep their flicker,
crust and sheen: an earlier painted pass lost them and was ruled out. Time it on a phone early, because
each batch adds cost.

0. **Flowers, only if the owner asks.** Left from the reference sheet `.tmp/flowers-ref/3.png`:
   leaves in two greens with a lit edge on cooler stems. Leaves are cells on every segment now,
   so that is drawing only. The bluebell is the darkest head at
   play size; the owner saw that in the filmstrip and shipped it. The images in
   `.tmp/flowers-ref/` are stock art to look at, never to ship or commit.
2. **Painting water itself (A2), only if the owner asks.** The night sky (B2) shipped
   2026-10-29; A2 from the same mock (`.tmp/pixel-review/watercolour2-sheet.png`) paints
   water, moonwater, steam and smoke as washes and needs a moving mock before anyone decides.
   Painting fire, lava or oil lost their identity (crust, flicker, sheen) and was ruled out.
3. **Loose ends the big heads left**, small and measurable, worth offering:
   - Retake `flower.pollen` "a moonlit garden puffs pollen more often" over 32 seeds on big
     heads (last taken on the fuller garden, 30/32; buds now puff nothing while they wait).
   - Time the renderer on a phone (Node: 5.6 ms a full-board frame, `.tmp/bighead/perf.mjs`).
   - Give the showcase a frozen and a scorched big head beside plain ones, so the strengthened
     weather shows in the maintained capture (review; space is the problem, see its layout
     note in `scripts/material-showcase.mjs`).
   - Bring the design canvas up to date (below).

## Open questions, accepted unless the owner says otherwise

- **Water's edges** (2026-10-30). A broad pour is not traced, so on the default brush about 27% of
  airborne cells take the strand and the rest are clumps. A thick falling mass darkens in its core,
  1.5% of a held radius-12 brush's airborne water, on purpose. A one-wide stream walled on both sides
  draws as still water. Bands and glints always drift the same way, because the renderer cannot tell
  which way a cell moved. Streams keep a toothed edge, because cells hop columns in the sim. Water
  heaps under a pour and levels in about 15 s; that is how it moves, not how it is drawn, and changing
  it is a sim decision the owner has not taken. Moonwater is unchanged.
- Water's cost was timed in Node only: 9.3 to 12.5 ms a frame on a board two-thirds deep water.
- **Big heads, the edges of taking turns** (2026-10-29). A bud waits for a neighbour of another
  species until its last petal has gone, but for one of its own species only until the petals
  round that crown have gone: two heads of one species cannot be told apart cell by cell, and
  reading every leftover petal stalled two cornflowers at 30 of 70 (the cargo test now says
  so). So a second-wave head beside a same-species neighbour can open a few cells short where
  its neighbour's last petals still hang. And the renderer draws a petal from its crown's grid
  only while that crown has a petal beside it; leftover outer petals round a bare crown are
  drawn in the plain species colour.
- The showcase has no frozen or scorched flower head, before or after the big heads (review,
  2026-10-29): the strengthened weather is measured by `renderer:probe` and was judged by the
  owner from `.tmp/bighead/states-sheet-2.png`, not from the maintained capture.
- The big heads' rendering was timed in Node only: 5.6 ms a full-board frame against 5.9 ms
  for the old heads (`.tmp/bighead/perf.mjs`). Not timed on a phone.
- A dormant wellspring blocks only non-sources.
- A meteor shock's scorch is often brief (26 of 32 seeds).
- The sim runs about 24 ticks a second at 120 Hz, against 20 at 60 Hz.
- The `water.boils` scene is really a quench (fixture debt).
- **Fallen petals** (2026-10-28) were shown to the owner with the commit, as a filmstrip
  (`.tmp/petals/petals-sheet.png`): drawn at the spent head's fade (0.4 toward grey), browning
  as they lie, with no glow and no moonlit tint. The bluebell's and cornflower's read dim at
  night, as their heads do. Tune only on the owner's word; the fade is in `shedPetalColor`.
- Lava melting ICE stays out of reach by touch: the melt quenches the lava into a crust
  between them. `lava.scorches` "thaws" is witnessed on frosted masonry instead, with the ice
  erased first; the scene says so.
- The landing poster has not been tested in Safari/WebKit, and neither has the night wash
  behind the board (an alpha base canvas over a canvas, then `mix-blend-mode: screen` glow).
- The wash paints once at mount, 30-40 ms in Node; it has not been timed on a phone.
- The wash is one fixed painting (seeds 14/2/3 in `nightWash.ts`), the same in every room.
- `test:browser`'s "a garden planted in the app actually blooms" timed out once in five runs
  on 2026-10-28 (90 s wall clock; the brush lands at wall-clock times, so the bed differs run
  to run). A second sighting should make it a harness fix, not a rerun.

## Decisions already made — do not relitigate

All by the owner, after seeing pictures or measurements:

- **Water moves, and behaves like real water** (2026-10-30), from a moving side-by-side
  (`.tmp/water/currents-tuned.gif`): "currents" over a painted wash and today's look, then depth and
  streaks retuned on the owner's word. `docs/VISUAL_PIPELINE.md` has the rules and their reasons.
- **Big heads in two waves** (2026-10-29), from a close-up of our own eight designs against the
  old heads (`.tmp/bighead/tweak-sheet.png`) and a filmstrip of a watered bed
  (`.tmp/bighead/bighead-sheet.png`). Heads are up to 13 cells across and 11 tall, crown at the
  bottom; `HEAD_ART` in `rendering/shapeLanguage.ts` draws each as a grid of tones and the sim
  grows the same cells (`renderer:probe` holds them together). Cornflower, poppy and cosmos were
  redrawn after measuring outline overlap (worst pair 0.77, now 0.71) and the poppy's black
  heart sinking into the sky; the bluebell's arch is rounded two cells so it bends over.
  Neighbours take turns (`HEAD_REACH_X` 12, `HEAD_REACH_Y` 10): a bud waits with its whole
  budget and no pollen while a head is open within reach, and its arc starts when it opens. A
  watered bed holds 10-14 big heads at once in each of two waves, about seven minutes in all,
  with about twice the flower on screen. Budget: `BLOOM_ENERGY` 250, `PETAL_COST` 1,
  `CROWN_RESERVE` 40, or the sunflower stalls (90 of 110 at a reserve of 100).
- **Weather on big heads strengthened, not the floors moved** (2026-10-29, from
  `.tmp/bighead/states-sheet.png` and `-2.png`): bluer frost tinting further in, char that
  browns the whole head behind its ember line, moonlight weighted toward pale petals, and a
  dew pattern that cannot miss a head. One floor was re-set on the owner's word: a head's
  outline darker than the head, 40 to 28, because big heads draw their own dark rim and the
  ring cannot go darker without sinking into the night.

- **A spent garden stays as it is** (2026-10-29, from `.tmp/garden/rebloom-sheet.png`).
  Watering it again already brings it back: water feeds a flower's energy, so a spent head
  opens again, and a bed gone to seed reopened 22 of ~24 heads within 30 s and held them
  about 3.5 minutes. The rain room's rain is too light to do it (about 1 head in 5 minutes).
  Not picked: any fresh water on a plant waking it (about 3 heads in 5 minutes of rain), and
  plants withering after going to seed so their seeds regrow (about 13 heads at its peak, the
  seed-head stage mostly gone). Prototypes in `.tmp/garden/rebloom.py`, numbers from
  `rearc.mjs`, film from `refilm.mjs`. A re-watering has to be poured above the plants: the
  brush writes over whatever it covers.
- **The fuller garden** (2026-10-29): A + B from `.tmp/garden/garden-sheet.png`. A stalk is 7
  to 10 cells (budget 365 + 55 per variant step, cosmic one more) with a leaf on every segment,
  alternating sides; a head holds its petals for `PETAL_SHED_AGE` 3600, so a bed watered once
  is in full bloom for about three minutes, where it was one, and bare by four, where it was
  two. The same age is when a crown is a spent seed head, so the night sows only from heads
  that had gone to seed when the player left: about four minutes after blooming, where it was
  two. `slow-world:audit` plays in 4400 ticks for that and asserts the night itself sowed (at
  2400 it passed on catch-up dice alone; review). A stalk's budget, up to 585, now survives a
  scene load; both loaders cut it to 255, and a stalk saved mid-climb came back five cells.
  Measured first, the premise it was offered on was wrong: plants were already 4 to 7 cells
  with 1-2 leaves and 10-16% leafless, not mostly 4-cell and over half leafless.

- **Sound** (2026-10-29): the 2026-10-28 retune is fine as it stands. `npm run audio:levels`
  holds its bands: the mix at -25 to -28 dBFS RMS at default sliders, a room's own beds 10-18
  dB under the featured one, each cue group within 6 dB and 0-7 dB under the rain bed. Desk
  Radio replaces the native beds once its player is up; rain under the radio would be
  `setDeskRadioOn` in `controller.ts`.

- **The painted night** (2026-10-29): B2, a still watercolour wash (deep blue, indigo,
  violet, dried tide lines, paper grain) behind crisp pixels, matched to the mock's measured
  statistics (`rendering/nightWash.ts`). Open air is transparent in the base canvas; lit and
  outlined air are overlays. Harnesses measure air against `washAt(x, y)`, held within 2
  levels of the painted cell by `renderer:probe`. Head outlines are option B
  (`.tmp/nightsky/outline-options.png`): as picked on the dark sky, and on indigo or violet a
  ring gives back only as much of its violet push as keeps it 120 from the sky. Option A (the
  sky shows through every ring) left the bluebell's outline 75 from the violet wash and was
  not picked. Cost, measured: cold char against the tray 296 to 239; outline darker than head
  46 to 42 (floor 40). `.tmp/nightsky/night-sky-before-after.png` is the board.

- **Even pixels** (2026-10-28): every cell reaches the screen at one size and square
  (`rendering/pixelFit.ts`, gated by `npm run pixels:even`). From 2x up the board smooths down
  from the next whole multiple; below 2x it snaps to whole pixels only where that keeps 90% of
  the tray, and smooths elsewhere. Snapping everywhere below 2x was shown at 960 wide (72% of
  the tray inside a 94 px band where painting did nothing) and not picked; a frame that hugs
  the board was shown and not picked.

- **Lava is thick** (2026-10-28, the owner: "lava should flow like lava, so not even"). It
  falls like any liquid; lava with lava on top is pushed aside one cell; surface lava creeps
  one roll in 8 (`LAVA_CREEPS`); it moves on `tick % 4 < 2`. A pour heaps into a dome that
  slumps as it crusts, centred within a cell (was 15-25 cells left), a slope pour creeps down
  as a tongue, and a lava spring builds a volcano cone, 13% of the board (was 24%).
  `.tmp/lavaflow/lava-sheet.png` is the before/after; `.tmp/lavaflow/` has the variants tried
  (`measure.mjs`, `pool.mjs`, `film.mjs`, `check.mjs`).
- **Burning log** (2026-10-28): glowing cracks along the grain (C). Ember above 90 drains as
  before; cells on a crack (`ember_crack`, by position) hold 66-90 one tick in 32, so a log's
  cracks glow to ~26 s against ~7 s, then ash over. Heat relights a held crack, as it does
  char below 60 (a review fix). Whole-log slowing (A) and scattered specks (B) were shown and
  not picked.
- **Steam** (2026-10-23): hot steam billows into puffs that fade in 3 s, and a hot ember
  hisses on 1 roll in 2 (candidate B, over A at 2 s, from `.tmp/steam/steam-candidates-sheet.png`).
  The build puffs a pond about a quarter less than that candidate, because a review fix
  stopped puffs landing through the water's surface; `.tmp/steam/steam-built-sheet.png` is
  the build.
- **Heat** (2026-10-20): water's energy is its temperature and ice's is its warmth, with the
  four rules as shipped. Steam keeps frosting onto ice and gives the ice its heat; hot steam is
  not kept from freezing (that cost two frost interactions). Lava radiating heat across a gap
  was built, measured and dropped.
- **Lava** (2026-10-21/22): nothing that moves overwrites lava, and a deep pool cools from
  within at one roll in 24. A lava spring building a stone hill over itself and going quiet
  is accepted (24% of the board then; 13% since lava is thick).
- **Two leaks stay** (2026-10-22). Water still deletes a grain that sank into steam that same
  tick (`try_move` lets a mover sink through gas that sat in a cell all tick without checking
  it is still there), which costs one cell of quench stone or sand on 3 of 32 seeds of the
  quench scene; `.tmp/lavafix/instr.mjs 27169 2169 13169` names the move. And a blocked
  meteor's impact writes fire into any neighbour that was empty in `old` (`update_meteor`), so
  it can replace lava that flowed there that tick.
- **Oil** (2026-10-21/22): poured oil keeps every cell and rests as a still sheet one cell
  deep; only a spring's oil fades, so a spring holds a low, speckled mound of about 7% of the
  board. Thinning every moving oil cell was approved first and withdrawn: it emptied open
  slicks within 30 s. A thin slick on soil shows a petrol film.
- **Flowers** (2026-10-19, 10-22): weather drawn as what it is, readable life stages;
  moonlight keeps each species. Seed heads stay dry and speciesless except the poppy's capsule
  and the sunflower's disc. Depth comes from an own-hue outline round each head, not lighting
  from above or petals drawn inside a cell. The tulip is a cup and the bluebell nods. The big
  heads (2026-10-29, above) superseded the small heads' per-species marks and the rule against
  a dark rim inside the head: each big head's design has its own rim, and the outline ring
  sits outside it.
- **The poster** (2026-10-18/19): a loose, wet watercolour with watercolour rain and lightning
  and two living jars, a garden and a bug jar. Keep visual changes to it painterly and animated
  with transform/opacity only.
- A meteor's trail fans out and can light what it passes; sparks light oil; stardust gives oil
  a firework sheen (2026-10-15). A single meteor six cells from a fuse lights it on 2 of 32
  seeds.
- A fuse stops at a wide gap of air; a burst may relight the far side (2026-10-14).
- Blooms fall with a cut stalk (2026-10-08); embers dry wet fuel first (2026-10-07).
- Wellspring re-teaching sticks for the whole spring, and the learned state is shown
  (2026-10-01); two materials offered at opposite ends at once may split a spring.
- Ice frosts only wet masonry (2026-09-30).
- Rockets: a lit grain shoves through its own charge and lights the powder it touches; the
  volley rises as one column, and about one burst in eight goes off extra high.
- The audit floor stays at 30 ticks (about 1.5 s of play).
- Mist is visible; lakes are a feature; puddles dry (1 in 450); gases are conserved; bubbles
  are hot-only; never conserve a liquid with no sink; oil and lava may still delete water; a
  rain-filled sand basin becoming sandstone is geology.
- **No cheap fixes**, and never tune a fixture until it passes: if the honest version is thin,
  say so at the scene.

## Where the checks stand

`npm run interaction:audit` passes 183 checks, bound to all 118 role ids, on the audit's seed
(2026-10-29, with big heads). Retaken over 32 seeds on 2026-10-29 at `a19b507` (before the
wash), with the plant checks retaken on the fuller garden and the `flower.opens`,
`pollen.seeds`, `stem.climbs` and `seed.germinates` checks on big heads, these pass on fewer
than 32:

- **31:** `seed.germinates` grows taller fed cosmic (its bar is 11 cells now, the height only a
  moonlit plant reaches), `meteor.impacts`, `meteor.trail`'s fanned trail, `moonwater.bursts`,
  `fire.thaws`, `lava.quenched` "water never deletes the lava it meets", `ember.quenched`'s
  doused-log cloud, both `oil.ignites` checks, and `stem.footing`'s stalk check (was 27).
- **30:** `ice.condenses` "takes the steam's heat", `flower.opens` "opens a tulip into a cup"
  and "opens a sunflower whole" (on each one's two misses no plant of that species grew),
  `meteor.shocked`, and `flower.pollen` "a moonlit garden puffs pollen more often" (on the
  fuller garden; not retaken at 32 on big heads, where buds puff nothing while they wait).
- **27:** `fire.dries`'s ember check.
- **25:** `meteor.vitrifies`.

The fuller garden lifted `pollen.seeds` and `stem.burns` to 32 and the bluebell from 29 to 32.
On big heads the bluebell, both wave checks and `pollen.seeds` pass 32 of 32; `pollen.seeds`'s
rain now falls from row 4, because at row 20 the brush painted it into the heads. Every check
over 8 seeds against `main`: none passes on fewer seeds; the 16 that moved are all garden and
pollen checks.

Against the 2026-10-17 list: `fungus.fairyring` now passes 32 of 32, `fire.dries`'s ember
check fell from 29 to 27, and eight checks are new to it. Nobody has looked at why; each batch
since 10-17 re-measured only the checks it moved, so nothing says these moved recently rather
than went unmeasured.

## The design canvas

**"Flowers and Interactions"** (https://claude.ai/artifact/9DB9Smb5oY65EfpdKJkXkS, private to
the owner) holds the eight flower species, life stages, weather states, the interaction roster
marked shows / thin / reads weak / half hidden, and a ranked shortlist of eight upgrades with
each one's status. Seven have shipped (the burning log last, 2026-10-28) and one was dropped
(lava thawing ice across a gap). It is out of date: it still marks the log open, and the night
sky, the fuller garden and the big heads (all 2026-10-29) are not on it; its flower species
are the old small heads. Editing it means following the Design type's own `SKILL.md`. The
"Flowers with more depth" board holds the four outline candidates. To edit the canvas, read it
first (`Artifact` read of the URL, then the file by `path`) and publish to the same URL: a
publish against a stale version is refused.

## How a witness gets checked

`docs/HARNESS.md` has the long form; these five steps are the ones that caught real bugs:

1. **Take the actor away** (paint it as Wall, or leave it out). The check must fail on every
   seed.
2. **Take the precondition away**, or check it is not already gone. For an absent check,
   declare it as `requires`.
3. **Does it credit the brush?** A gesture painted with `act` lands after `prev` and `before`
   are taken, so a dab of flame can melt ice that last tick's view shows untouched. Look for
   the actor touching the cell NOW.
4. **Does it credit another clause, or a leftover?** Classify what every counted cell is now,
   and filter on the outcome, not the material. Frost from boiling steam brings heat to ice
   too, so the warm-melt check skips any cell steam has touched.
5. **Sabotage the rule in the sim**, both ways where it has two sides (never fires, always
   fires). This catches a witness of the wrong kind: a position standing in for a speed.

## How to work

- **Branch until green.** A push to `main` deploys once CI passes. Fast-forward `main` after
  the full gate, check `gh run list`, then `npm run deploy:verify`; add
  `COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run qa:live` when players can see the
  change. When a push does not deploy, `docs/EMBEDDING.md` ("When a push does not deploy")
  has the recovery. `deploy:verify` checks the game page, not `embed.html`: for a poster
  change, capture the live poster too (`.tmp/poster/shot.mjs`, `motion.mjs`).
- **Seconds are ticks over ~20**, never 60 (`TICKS_PER_SECOND` in
  `scripts/interaction-scenes.mjs`).
- **The brush clamps radius 0 to 1**: `p(x, y, 0, ...)` paints a plus of five cells, so a wall
  drawn cell by cell is three thick, and ice painted down to a floor eats into it.
- **Print the board before believing a fixture.** A fixture that hand-places a state play
  cannot reach passes for the wrong reason.
- **Sweep, do not pin, a visual gate.** Set floors from the swept worst, and gate a cue as what
  it is: dew is points, so its gate is the brightest bead, not a mean.
- **Run sim tests the way the gate does** (`npm run test:sim`, a debug build).
- **For a design choice, show the owner a rendered picture** (a filmstrip or the canvas) and
  explain it plainly. They decide from the picture, not from seed counts, and ask for a
  filmstrip before anything ships.
- **Close each batch with `/adversarial-review`** (Codex). It has caught a real problem in
  every batch. Pick lenses by what the diff touches: Parity for an engine change, Perceptual
  for the renderer, Drift for a new rule. Codex has its own usage limit and can stop
  mid-review: check each reviewer's output exists, and rerun the missing ones. Keep review
  files in the session scratchpad, build the prompts with a Python script, and close
  `codex exec`'s stdin with `< /dev/null`.

## Scratch tools (`.tmp/`, untracked)

Nothing backs these up. Each script's header gives its purpose and arguments; read the header,
not this list.

- **Water:** `.tmp/water/` — `tune.mjs` + `sheet.py` (three looks, moving, the template for each new
  batch: `base` and `prev` are `git archive` copies of `app/src`), `mock.mjs` (the first mock; its streaks
  never drew), `sab.py` (sabotage table; it edits the real renderer and a hard kill leaves it broken,
  so diff against `shapeLanguage.keep.ts`), `airdark.mjs` (airborne water on real pours), `perf.mjs`.
- **Filmstrips:** `.tmp/film/film.mjs <scene> [seed]` draws the base build above the working
  tree through the real engine and renderer (glow approximated) into `.tmp/film/<scene>.png`;
  scenes are in `.tmp/film/scenes.mjs`. Its base is stale (`43d9292`, before the petals); refresh
  it before use: `rm -rf .tmp/film/base && mkdir -p .tmp/film/base && git archive HEAD app/src | tar -x -C .tmp/film/base`.
  `.tmp/bighead/film.mjs [seed]` does the same for a watered bed over seven minutes, with
  `.tmp/bighead/base` (`7937e21`, before the big heads) as its base.
- **Sabotage:** `.tmp/halves/sabotages.mjs` holds find/replace edits on `app/src/engine.ts`,
  one per rule half, both ways where a rule has two sides; keep the dice (leave the `chance()`
  roll). `.tmp/halves/sab.mjs <name> [seeds] [id,id]` plays every check against one sabotage
  and counts only seeds the clean mirror passes. Launch parallel runs about 12 s apart: they
  share the `halves-base` compile.
- **Rates and witnesses:** `.tmp/batch2/` — `candidates.mjs` (checks with a `stat` per run),
  `try.mjs <candidate> <seeds> [sabotage,...]` (distributions and verdicts on the JS mirror,
  live and sabotaged), `board.mjs` (print a candidate's board). How the four 2026-10-28
  thresholds were chosen: measure both sides, then pick a round number between them.
- **Big heads:** `.tmp/bighead/` — `bighead.py` (the designs as grids, and the first mock as a
  copy of `app/src`; it no longer applies to the tree), `gen.py` (writes the shapes into both
  engines), `closeup.mjs` / `states.mjs` (every head, every state, today against the build),
  `film.mjs`, `arc.mjs` (heads over time), `measure.mjs` (outline overlap, tones against the
  sky), `thresh.mjs <sabotage>` (the new checks' raw numbers), `trace.mjs <seed> <x>` (one
  crown tick by tick), `sunmiss.mjs`, `perf.mjs`.
- **The garden:** `.tmp/garden/` — `measure.mjs` (stalk heights, leaves, heads per plant;
  `KIND=brush` for a bed painted with the app's brush), `arc.mjs` (a bed's bloom over time),
  `variants.py` + `film.mjs` + `sheet.py` (the filmstrip the owner picked from), `thresh.mjs`
  (the new checks' raw numbers, live and sabotaged), `moonpuff.mjs` (the moonlit-pollen tally).
- **The night sky:** `.tmp/nightsky/` — `wash.mjs` (paint and time the wash alone),
  `seeds.mjs` (violet and deep coverage per seed), `corr.mjs` (feature size per period),
  `rings.mjs` (each species' outline against every wash cell), `heads.mjs` (every head on
  each tone, the sheet the owner picked B from).
- **Fallen petals:** `.tmp/petals/` — `sweep.mjs` (worst petal-vs-night and petal-vs-puff
  over every reachable state), `where.mjs` (when and where petals fall in a film scene),
  `one.mjs <roleRegex> [seed...]` (one check's raw numbers on the wasm).
- **The burning log:** `.tmp/log/` — `variant.mjs` (candidates patch `main`'s engine; `live`
  and `sab-*` the working tree), `measure.mjs` (seconds lit / glowing / char), `film.mjs`,
  `sheet.py`, `checks.mjs <roleRegex> <seeds> [variant,...]`.
- **Steam's template:** `.tmp/steam/`. `variant.mjs` builds find/replace copies
  of `engine.ts` (`live` is the working tree), `scenes.mjs` has a doused log among its scenes,
  `checks.mjs <roleRegex> <seeds> [variant,...]` runs chosen audit checks against `main`, and
  `film.mjs` with `sheet.py` makes the labelled sheet the owner picks from.
- **Lava:** `.tmp/lavaflow/` (thick lava, 2026-10-28); `.tmp/lava/NOTES.md` has the
  earlier lava and oil numbers.
- **Earlier batches**, each with tools for its own question: `.tmp/flowers-depth/`,
  `.tmp/heat/` (with `NOTES.md`), `.tmp/lavafix/`, `.tmp/review/`, `.tmp/cues/`,
  `.tmp/design/`, `.tmp/poster/`.
