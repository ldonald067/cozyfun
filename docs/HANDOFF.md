# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Shipped work lives in `git log`, whose commit
messages carry each batch's measurements. Written 2026-10-27: everything on `main` is live
(`deploy:verify` passed on `8937644`, wasm engine, CI green) and `interaction:audit` passes
all 174 checks. Next is a burning log that stays alive (item 1).*

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

1. **A burning log stays alive** (the owner's pick, 2026-10-23). The promise: the hearth
   smoulders with glowing cracks well past today's 5-7 seconds. Wood lights straight into
   Ember at energy 230 (`ignited_cell` in `sim/src/lib.rs`); an ember above 90 lights its
   neighbours, and below `COLD_CHAR_ENERGY` (30) it is cold char, which the slow world settles
   into soil. Find the ember's decay first, then measure a real log (painted wood, lit with a
   dab of flame) burning down: seconds lit, seconds glowing, cells left as char. A slower arc
   for wood's embers is the obvious lever. Check what rides on embers before moving it:
   `rocket.lights`, `fire.dries` (its ember check passes 29 of 32 seeds), `ember.cools`,
   `ember.glows`, `ember.quenched` (including the doused-log steam check), `wood.burns`, and
   the renderer's cold-char wink and ash. Already decided: embers dry wet fuel first, and a
   soaked log may leave a few scorched cells unburnt. Filmstrip before code.
2. **Should lava move evenly?** The owner's call; nothing is changed. Lava moves on even ticks
   only (`update_liquid` at sluggishness 2), so it always sees the left-to-right pass
   (`sim/CLAUDE.md` has the mechanism), and a mid-floor pour ends 15-25 cells left of where
   it was poured, on every seed. Giving it one tick of each pass (`tick % 4 < 2`, as oil has)
   centres a pour (-0.3 cells) and a basin pour still sets to stone in 50-75 s, but a lava
   spring's stone hill grows from 24% of the board to 29% (7,480 -> 9,067 stone at 16,000
   ticks), and 24% is the number the owner accepted. Measure with `.tmp/oil/lava.mjs lcad`
   and `.tmp/oil/bias.mjs .tmp/oil/root-lcad`.
3. **Flowers, only if the owner asks.** Left from the reference sheet `.tmp/flowers-ref/3.png`:
   leaves in two greens with a lit edge on cooler stems. The bluebell is the darkest head at
   play size; the owner saw that in the filmstrip and shipped it. The images in
   `.tmp/flowers-ref/` are stock art to look at, never to ship or commit.
4. **Fallen petals in their flower's colour** needs a sim change first: a shed petal becomes a
   Pollen cell identical to a pollen puff, so the renderer cannot tell them apart.
5. **Rules no audit check can see yet.**
   - A hot ember's hiss is a rate (1 roll in 2, was 1 in 6): the doused-log check still
     passes 15 of 16 seeds at the old odds, with a cloud half the size.
   - `flower.pollen` "more often when cosmic" is a rate too; one check cannot see it without
     comparing two gardens inside it.
   - `lava.scorches` "thaws" is unreachable by touch: a pool kept against an ice wall barely
     melts it, because a stone crust forms between them. A check for it passed 0 of 16 seeds
     and was not kept.
6. **Sound levels, the owner's ears first** (audit of 2026-10-28; loops and memory are done).
   - The mix is quiet: -41 dBFS RMS at default sliders, -35 at maximum, with 14 dB of
     headroom never used. Desk Radio (YouTube) plays ~20 dB louder. A makeup gain with a
     limiter would close that; render A/B clips before choosing a level.
   - 33 of 36 background beds (mood x room) sit 20 dB or more under the featured one, and
     fire never comes within 33 dB unless it is the mood, so `rooms.ts` is mostly
     inaudible. Retune, or stop loading what cannot be heard.
   - Probes: `.tmp/audio-audit/` (`probe.mjs` levels and seams, `beds.mjs` per-bed levels).
   - Open with the owner: native beds keep playing under Desk Radio, and the app's Mute and
     Master do not reach the YouTube player. Intended or not is undocumented.

## Open questions, accepted unless the owner says otherwise

- A dormant wellspring blocks only non-sources.
- A meteor shock's scorch is often brief (26 of 32 seeds).
- The sim runs about 24 ticks a second at 120 Hz, against 20 at 60 Hz.
- One watering grows a minimum plant: most stay at the 4-cell stalk, and over half leafless.
- The owner's subjective listening pass on the audio, left from Phase 8, is unfinished.
- The `water.boils` scene is really a quench (fixture debt).
- The landing poster has not been tested in Safari/WebKit.

## Decisions already made — do not relitigate

All by the owner, after seeing pictures or measurements:

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
  within at one roll in 24. A lava spring building a stone hill over itself (24% of the board
  at its peak) and going quiet is accepted.
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

`npm run interaction:audit` passes 174 checks, bound to all 118 role ids, on the audit's seed
(2026-10-27). These pass on fewer than 32 of 32 seeds:

- **31:** `fire.thaws`, both `oil.ignites` checks, `meteor.trail`'s fanned-trail check,
  `fungus.fairyring`, `stem.burns`, and `ice.condenses` "condenses steam into frost".
- **29:** `fire.dries`'s ember check.
- **28:** `ice.condenses` "takes the steam's heat" (four seeds show it under 30 ticks: how long
  lava keeps quenching beside the ice varies).
- **27:** `stem.footing`'s stalk check.

The full 32-seed list was last taken on 2026-10-17; each batch since re-measured only the
checks it moved. Retake it before relying on it.

## The design canvas

**"Flowers and Interactions"** (https://claude.ai/artifact/9DB9Smb5oY65EfpdKJkXkS, private to
the owner) holds the eight flower species, life stages, weather states, the interaction roster
marked shows / thin / reads weak / half hidden, and a ranked shortlist of eight upgrades with
each one's status. Six have shipped, one was dropped (lava thawing ice across a gap) and one is
open: the burning log (item 1). The "Flowers with more depth" board holds the four outline
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
  scenes are in `.tmp/film/scenes.mjs`. Refresh the base first, it is still the pre-heat
  `79761a6`: `rm -rf .tmp/film/base && mkdir -p .tmp/film/base && git archive HEAD app/src | tar -x -C .tmp/film/base`.
- **Sabotage:** `.tmp/halves/sabotages.mjs` holds find/replace edits on `app/src/engine.ts`,
  one per rule half, both ways where a rule has two sides; keep the dice (leave the `chance()`
  roll). `.tmp/halves/sab.mjs <name> [seeds] [id,id]` plays every check against one sabotage
  and counts only seeds the clean mirror passes. Launch parallel runs about 12 s apart: they
  share the `halves-base` compile.
- **The closest template for item 1:** `.tmp/steam/`. `variant.mjs` builds find/replace copies
  of `engine.ts` (`live` is the working tree), `scenes.mjs` has a doused log among its scenes,
  `checks.mjs <roleRegex> <seeds> [variant,...]` runs chosen audit checks against `main`, and
  `film.mjs` with `sheet.py` makes the labelled sheet the owner picks from.
- **For item 2:** `.tmp/oil/lava.mjs` and `.tmp/oil/bias.mjs`; `.tmp/lava/NOTES.md` has every
  lava and oil number.
- **Earlier batches**, each with tools for its own question: `.tmp/flowers-depth/`,
  `.tmp/heat/` (with `NOTES.md`), `.tmp/lavafix/`, `.tmp/review/`, `.tmp/cues/`,
  `.tmp/design/`, `.tmp/poster/`.
