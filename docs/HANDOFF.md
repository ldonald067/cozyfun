# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Shipped work lives in `git log`, whose commit
messages carry each batch's measurements. Written 2026-10-28 (evening): fallen petals fall in
their flower's colour, four rules no check could see now have one, sound (item 2) waits on the
owner's ears, and `interaction:audit` passes all 179 checks.*

## Keep chats lean

The owner hits usage limits early.

- **Read deep docs in ranges.** `grep -n` for the section you need, then read only those
  lines. `VISUAL_PIPELINE.md` is 87 KB, `HARNESS.md` 68 KB, `MATERIAL_AUDIT.md` 46 KB.
- **Measure narrowly.** `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` takes a
  couple of minutes; all checks at 8 seeds against `main` takes about five. Keep `--only` to
  about six ids: the cache file is named after the list, and 17 ids made the name too long
  for macOS (ENAMETOOLONG).
- **Run the full gate (`npm run check`, about 8 minutes) once per batch**, not after every
  edit.

## What to do next

1. **Flowers, only if the owner asks.** Left from the reference sheet `.tmp/flowers-ref/3.png`:
   leaves in two greens with a lit edge on cooler stems. The bluebell is the darkest head at
   play size; the owner saw that in the filmstrip and shipped it. The images in
   `.tmp/flowers-ref/` are stock art to look at, never to ship or commit.
2. **Sound: the owner's ears on the 2026-10-28 retune.** Everything the audit found is fixed
   and gated by `npm run audio:levels`: the mix is -25 to -28 dBFS RMS at default sliders (was
   -41) through a makeup gain and a limiter; a room's own beds are heard 10-18 dB under the
   featured one (rooms used to change the mix by 0.1 dB); each cue group spans under 6 dB and
   sits 0-7 dB under the rain bed (painting oil was 14 dB under the rest, every cue 10-20 dB
   under the bed); a click on half of all noise cues
   (up to -3 dBFS) is gone; painting rockets and a wellspring has a cue (both were silent);
   Desk Radio replaces the native beds once its player is up instead of playing over them,
   and Master and Mute reach it. Listen to `.tmp/audio-fix/{before,after}-*.wav` (20 s each:
   beds, then painting, then reaction cues) before tuning further; `audio:levels` holds the
   bands. If the owner wants rain under the radio after all, it is `setDeskRadioOn` in
   `controller.ts`.
3. **A painted night sky behind the pixels, if the owner wants it next.** Mocked 2026-10-28
   (`.tmp/pixel-review/watercolour2-sheet.png`, option B2): every pixel stays crisp on a calm
   indigo and violet wash in the landing poster's language. It cost at most 6 L of edge
   contrast (soil 52 to 47, lava 42 to 39). Building it needs empty cells transparent in the
   base canvas (they are opaque today) and the same backdrop in the postcard, clip and
   visual-qa composites. Painting water itself (A2) needs a moving mock before anyone decides;
   painting fire, lava or oil lost their identity (crust, flicker, sheen) and was ruled out.

## Open questions, accepted unless the owner says otherwise

- A dormant wellspring blocks only non-sources.
- A meteor shock's scorch is often brief (26 of 32 seeds).
- The sim runs about 24 ticks a second at 120 Hz, against 20 at 60 Hz.
- One watering grows a minimum plant: most stay at the 4-cell stalk, and over half leafless.
- The `water.boils` scene is really a quench (fixture debt).
- **Fallen petals** (2026-10-28) were shown to the owner with the commit, as a filmstrip
  (`.tmp/petals/petals-sheet.png`): drawn at the spent head's fade (0.4 toward grey), browning
  as they lie, with no glow and no moonlit tint. The bluebell's and cornflower's read dim at
  night, as their heads do. Tune only on the owner's word; the fade is in `shedPetalColor`.
- Lava melting ICE stays out of reach by touch: the melt quenches the lava into a crust
  between them. `lava.scorches` "thaws" is witnessed on frosted masonry instead, with the ice
  erased first; the scene says so.
- The landing poster has not been tested in Safari/WebKit.
- `test:browser`'s "a garden planted in the app actually blooms" timed out once in five runs
  on 2026-10-28 (90 s wall clock; the brush lands at wall-clock times, so the bed differs run
  to run). A second sighting should make it a harness fix, not a rerun.

## Decisions already made — do not relitigate

All by the owner, after seeing pictures or measurements:

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
- **Flowers** (2026-10-19, 10-22): species marks, weather drawn as what it is, readable life
  stages; moonlight keeps each species. Seed heads stay dry and speciesless except the poppy's
  capsule and the sunflower's disc. Depth comes from an own-hue outline round each head, not
  lighting from above, a dark rim inside the head, or petals drawn inside the cell. The tulip
  is a cup and the bluebell nods.
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

`npm run interaction:audit` passes 179 checks, bound to all 118 role ids, on the audit's seed
(2026-10-28). These pass on fewer than 32 of 32 seeds:

- **31:** `fire.thaws`, both `oil.ignites` checks, `meteor.trail`'s fanned-trail check,
  `fungus.fairyring`, `stem.burns`, `lava.quenched` "water never deletes the lava it
  meets" (thick lava creeps toward the splash, and on one seed never meets it), and
  `ember.quenched`'s doused-log cloud, now 80 cells so it sees the hiss's odds (one seed
  peaks at 71; at the old 1 in 6 the biggest is 74).
- **30:** `ice.condenses` "takes the steam's heat" (thick lava creeps the gap to the ice, and
  is late on two seeds).
- **29:** `fire.dries`'s ember check.
- **27:** `stem.footing`'s stalk check.

The full 32-seed list was last taken on 2026-10-17; each batch since re-measured only the
checks it moved. Retake it before relying on it.

## The design canvas

**"Flowers and Interactions"** (https://claude.ai/artifact/9DB9Smb5oY65EfpdKJkXkS, private to
the owner) holds the eight flower species, life stages, weather states, the interaction roster
marked shows / thin / reads weak / half hidden, and a ranked shortlist of eight upgrades with
each one's status. Seven have shipped (the burning log last, 2026-10-28) and one was dropped (lava
thawing ice across a gap); the canvas itself still marks the log open. The "Flowers with more depth" board holds the four outline
candidates. To edit the canvas, read it first (`Artifact` read of the URL, then the file by
`path`) and publish to the same URL: a publish against a stale version is refused.

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

- **Filmstrips:** `.tmp/film/film.mjs <scene> [seed]` draws the base build above the working
  tree through the real engine and renderer (glow approximated) into `.tmp/film/<scene>.png`;
  scenes are in `.tmp/film/scenes.mjs`. Refresh the base first, it is `43d9292` (before
  the petals): `rm -rf .tmp/film/base && mkdir -p .tmp/film/base && git archive HEAD app/src | tar -x -C .tmp/film/base`.
- **Sabotage:** `.tmp/halves/sabotages.mjs` holds find/replace edits on `app/src/engine.ts`,
  one per rule half, both ways where a rule has two sides; keep the dice (leave the `chance()`
  roll). `.tmp/halves/sab.mjs <name> [seeds] [id,id]` plays every check against one sabotage
  and counts only seeds the clean mirror passes. Launch parallel runs about 12 s apart: they
  share the `halves-base` compile.
- **Rates and witnesses:** `.tmp/batch2/` — `candidates.mjs` (checks with a `stat` per run),
  `try.mjs <candidate> <seeds> [sabotage,...]` (distributions and verdicts on the JS mirror,
  live and sabotaged), `board.mjs` (print a candidate's board). How the four 2026-10-28
  thresholds were chosen: measure both sides, then pick a round number between them.
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
