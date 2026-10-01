# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-09-30 and brought up to date on
2026-10-01: the tick-rate correction, rockets that fly, three lucky-seed checks, and frost that
needs water (see below).*

## Where things stand

**A tick is not a frame.** The app ticks the sim at most once per animation frame, and only
once `SIM_TICK_MS` (38) has passed, so a 60 Hz display gets a tick every third frame: **20.2
ticks a second, measured in the shipped bundle**, not the 60 every duration in the docs had
been read at. The audit's 30-tick visibility floor stays where it is, by the owner's decision —
it just means about 1.5 s of play, not 0.5 s. `TICKS_PER_SECOND` in
`scripts/interaction-scenes.mjs` derives the rate from `SIM_TICK_MS`, the audit prints through
it, and the durations quoted around the repo were corrected (a puddle dries in roughly twenty
seconds to two minutes, not 15-30 s).

**Rockets fly, and a line of powder is a fuse.** A pile lit at the default brush used to send
up 2 grains of ~24 and burst 12 on the ground, because a lit grain took its own powder and the
flame that lit it for a ceiling. Two rules, both in `update_rocket` and mirrored in `engine.ts`:
`try_thrust` lets a lit grain shove straight up through its own charge, and
`light_touching_powder` lets it light the unlit powder it touches. The second exists because
the first removed the ground bursts that had been relaying light through a charge, which killed
the fuse a dragged line of powder used to be. Over 32 seeds: 12 grains fly, none bursts on the
ground, none is left unlit, and a line burns its full length on 16 of 16. The owner chose this
after comparing it with the volley alone and with a random blend. docs/VISUAL_PIPELINE.md
("A lit charge goes up whole") has every number and both accepted costs.

The last handoff's first thread was `rocket.climbs` passing on 8 seeds of 32. It passes on 32
now, and the reason it failed was never the flight: it was a radius-2 fixture (the app paints at
4) and a witness counting the burst's sparks. On the way, `spark.lights` turned out to have been
passing on leftover UNLIT powder — its witness remembered cells and kept counting whatever rocket
grain sat in them — and it now stages its charges under a roof, where sparks can reach the next
charge, with a witness that credits sparks only after a far charge is seen lit.

**Ice frosts only wet stone and wall** (2026-10-01). A dry rock beside ice used to frost
exactly like a wet one, so "damp" in `[ice.stresses]` meant nothing. The owner chose to make it
mean something, as a two-material discovery, and the first frost in masonry now gets a field
note. `ice_leaves_dry_stone_and_wall_unfrosted`, a parity scenario witnessing both halves, an
`absent` audit twin and the field-note smoke all fail by name with the old rule.

Everything is green: 132 cargo tests, 35 parity scenarios, 127 interaction checks bound to all
118 role ids, the slow world (a day away grows the garden 18 new columns), and the full
`npm run check`.

## What to do next

No next phase is planned; what to build is the owner's call.

### 1. The rest of the lucky-seed list

Re-measured on 2026-10-01 over all 127 checks at 32 seeds: 13 failed on at least one seed.
Four were fixed that day, all re-staged at the default brush and each failing on all 32 seeds
with its rule switched off. `fire.ignites` (wood) and `wood.burns` needed a flame, not a
one-cell dab, which caught on tick 1-3 or never. `steam.frosts` needed a pond with lava dropped
in and ice held over it, and now counts only ice that was steam. `water.rinses` needed a stone
pillar beside a log fire, because a flame beside a mound sooted one cell at most, and its
witness had been counting wet stone rather than soot coming off.

**Two checks were found certifying nothing**, and they are the next thing to settle:

- **`wellspring.reattune` passes 32 of 32 with no wellspring at all.** Its witness is "sand
  that appeared", which the scene's own sand dabs satisfy. Witnessed honestly, as spring cells
  that remembered water and now remember sand, it fails on every seed. A player's spring sits
  in its own outflow (a pool, or a pile it buries itself in), and a re-teach sequence that
  ends in a sand pour has not been found yet. Three explanations were tested and none held,
  so this needs a proper investigation, and probably the owner, before the scene is rebuilt.
  The cargo test passes because it hand-places a bare spring.
- **`lava.scorches` mostly counts `lava.quenched`.** Of 205 scorched-stone cells over 32 seeds,
  123 were lava that water quenched into stone; only 82 were the rock being scorched. Counting
  the painted rock alone, it fails on every seed (2-3 cells). Lava against a wetted rock at
  the default brush passes 18 of 32.

Still at 29-31 of 32, untouched: `fire.softens`, `meteor.trail`, `stem.burns`,
`fungus.fairyring`, `oil.ignites` and `meteor.shocked` (31 each), and `fire.thaws` below.

**`fire.thaws` joined that list when ice stopped frosting dry stone**, and it is the thinnest:
31 of 32, with 4 thawed cells on almost every seed, which is exactly the floor. Its ice dab
sits on top of the rock. The old rule frosted 7 cells around it: 3 on the rock's wet surface
and 4 inside the rock, where the water never reached. Only the wet ones frost now. Painting
more water, a default-brush rock and pour, or a dragged line of ice did not help: a brush
paints over the wet surface it is meant to touch, and fire painted over frost paints over the
frost too. Frost on stone is a thin layer where ice meets wet stone, so thawing it is small
by nature. Re-stage it with a different frozen material if it needs more, rather than tuning
the stone scene.

**Then the remembered-cell witnesses.** 27 checks remember every cell an outcome ever touched
and keep counting it while it holds the same MATERIAL, not the same outcome. Two of those were
found counting leftovers today — `spark.lights` credited unlit powder, `moss.dries` credited moss
that had recovered from its scorch — and neither failed because of it, which is exactly why
nobody noticed. docs/HARNESS.md lists how to tell; the 27 are not audited yet.

### 2. Design questions for the owner


- **The sim runs faster on faster screens.** `App.tsx` sets `lastSimTick = time` rather than
  advancing it by `SIM_TICK_MS`, so ticks land on frame boundaries: 20 a second at 60 Hz and,
  by the same arithmetic, about 24 at 120 Hz (only 60 Hz was measured). Making it frame-rate
  independent would change the speed of the game for everyone, which is why it is a question.
- **The rocket volley rises as one tight column**, because the shove is straight up and grains
  only sway in open air, and **about one burst in eight goes off extra high**, because a burst
  re-lights a neighbour already in flight (`ignited_cell` resets its fuse). Both were shown to
  the owner and accepted; either could be revisited.
- **Separate piles no longer set each other off in open air** (12 cells apart: 12 seeds of 32,
  against 30). Accepted; a line of powder between them is the fuse now.
- **Phase 8's subjective listening pass** is still the one unfinished item from before Phase 20.
- **One watering grows a minimum plant** — most plants in a once-watered planter stop at the
  4-cell minimum stalk. A design question, not a bug.
- **Steam reads as a dotted thread.** No renderer change can fix it; the lever is emitting steam
  in small clusters in the sim.
- **Oil and lava still delete water** (19 overwrites across the audit). Left by decision: oil
  has no sink. Reopen only together with a sink for oil.

### 3. Fixture debt

- **The `water.boils` scene is a quench, not a boil.** Lava pokes through the top of its Wall
  pan into the water. It passes 32 of 32, so it is not urgent, but it does not stage what its
  clause describes.

## Decisions already made — do not relitigate

All by the owner, each after seeing measurements:

- **Ice frosts only stone and wall that hold water** (2026-09-30), and a field note marks the
  first time. A dry rock beside ice used to frost just the same. Dropping "damp" from the
  clause was the other option; the owner chose a hidden two-material discovery, because a wet
  rock meeting ice happens in ordinary play. Cracking a wall now needs water in it too, but
  melting ice supplies that: an ice block against a dry wall, then lava, still cracks it on 13
  of 16 seeds (15 before), because the meltwater wets the wall first. What stopped is the
  quick version, a small dab of ice and then fire on a dry wall, which cracked on 16 of 16
  seeds at the first touch and now never does.

- **Rockets: a lit grain shoves through its own charge and lights the powder it touches**
  (2026-09-30), over the volley alone and a random blend, accepting that separate piles rarely
  chain in open air.
- **The audit floor stays at 30 ticks**; the fix was to its description, not its value.
- **Mist is visible**, never a silent delete. An interaction check enforces it.
- **Lakes are a feature** and **puddles dry** (1-in-450) — one knob sets both.
- **Gases are conserved and smoke keeps its 180-tick life**, though a lidded fire's smoke doubles.
- **Only the pollen and stardust water leaks were closed** in 20E; the other clobber classes
  stay. "Grains never overwrite grains" was rejected as a cheap fix.
- **Bubbles are hot-only.** Mist must not bubble (the spring floods).
- **A rain-filled sand basin turning to sandstone is geology**, not a bug.
- **Never conserve a liquid that has no sink.** Oil is deliberately not conserved.
- **No cheap fixes.** Every change needs its own justification and must not create a problem
  later; do not bundle opportunistic fixes into a step.

## How to work

- **Branch until green.** A push to `main` deploys, and Railway waits for CI before it builds.
  Fast-forward `main` only once the full gate passes, then run `npm run deploy:verify` until it
  reports the new commit, and `npm run qa:live` when the change is visible.
- **Seconds are ticks over `TICKS_PER_SECOND`**, which is about 20. Never divide by 60.
- **Ask whether each seed PASSES:** `npm run audit:drift -- --per-seed --only <ids>`. Screen on 8
  seeds, confirm on 32.
- **Measure at play scale before you believe a fixture.** The rocket numbers that mattered —
  flights, ground bursts, a neighbour catching, a fuse burning — came from the 220x140 board at
  the default brush and the app's paint density (55 for powders and fire), not from the audit's
  30x44 scene. `.tmp/` scratch scripts are cheap; write one.
- **Show the owner a picture when the choice is visual.** The rocket decision changed twice once
  the owner could see a filmstrip rendered through `colorForCell`.
- **Vacuity-test every gate you touch**: sabotage the rule in BOTH engines, rebuild with
  `npm run build:sim`, and watch the gate fail by name.
- **Close each step with `/adversarial-review`** (Codex; check `codex login status`).

## Traps this work already paid for

- **A remembered-cell witness can count leftovers.** Filter remembered cells on the outcome,
  not on the material; `spark.lights` scored 1,193 ticks of unlit powder that way.
- **Credit an outcome's aftermath only after witnessing the outcome.** Sparks "over the far
  charge" came from the near charge's own shell.
- **A new rule can make a working witness ambiguous.** Once lit grains light their neighbours,
  a grain sliding into a vacated cell looked like a shove; the parity witness now tracks the
  flame, which cannot move on its own.
- **A flame dropped a row above settled powder never touches it.** Find the powder's top first,
  or a fuse measurement reads zero on every build.
- **Hooking the wasm: wrap a COPY of the exports.** The exports object is frozen, a Proxy over it
  throws on the first `tick()`, and the frame loop silently stops.
- **A piped gate hides its exit code.** Redirect to a file and check `$?`.
- **A fixture can pass for the wrong reason.** Print the board before trusting a pass; liquids
  hop two cells and jump a one-cell wall. `ice.stresses` claimed its ice sat against the rock,
  but there was a one-cell gap that only frozen water could cross.
- **A scene painted all at once hides ordering.** A player switches materials, and that takes
  a second. Paint later gestures with `act` at a player's pace, and use the app's densities
  (`PAINT_DENSITY` in `App.tsx`: 55 for powders and liquids).
- **A claim that something is "by design" needs a source.** Nothing showed anyone had chosen
  the water-into-mist deletion that bubbles replaced.
- **Sabotaging compiled output: patch before the first load.** A loaded CommonJS module is
  cached, so a later patch silently tests the unpatched code.
- **Hand-typed copies of `MATERIAL` / `CELL_FLAG` rot.** Read them through `compileApp`.
- **`.tmp/` compiles go stale.** `scripts/compile-app.mjs` rebuilds fresh.
- **In Rust's `apply_reactions`, `x` inside a match arm is the material kind**, not a
  coordinate. Take coordinates from `idx`.
- **Field notes fire once ever.** Give a note a `requires` rather than trusting the kind alone.
