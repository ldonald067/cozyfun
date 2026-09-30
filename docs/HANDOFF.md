# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-09-30, after two batches: the
tick-rate correction (live and verified at `cfe32df`) and rockets that fly (see below).*

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

Everything is green: 131 cargo tests, 34 parity scenarios, 126 interaction checks bound to all
118 role ids, the slow world (a day away grows the garden 18 new columns), and the full
`npm run check`.

## What to do next

No next phase is planned; what to build is the owner's call.

### 1. The rest of the lucky-seed list

Measured 2026-09-29 on 32 seeds and not moved by the rocket work (an 8-seed drift over all 126
checks moved only rocket and spark checks): `stem.climbs` passes on 26, `ice.stresses` on 27,
`moss.dries` on 27, against the 28-of-32 bar. Fifteen more pass on 28-31. Re-measure before
starting — `npm run audit:drift -- --seeds 32 --per-seed --only <ids>` — and take them the way
`rocket.climbs` went: find out why before touching anything. That one was a fixture smaller
than anything a player paints plus a witness measuring the wrong thing, not the rule.

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
  hop two cells and jump a one-cell wall.
- **A claim that something is "by design" needs a source.** Nothing showed anyone had chosen
  the water-into-mist deletion that bubbles replaced.
- **Sabotaging compiled output: patch before the first load.** A loaded CommonJS module is
  cached, so a later patch silently tests the unpatched code.
- **Hand-typed copies of `MATERIAL` / `CELL_FLAG` rot.** Read them through `compileApp`.
- **`.tmp/` compiles go stale.** `scripts/compile-app.mjs` rebuilds fresh.
- **In Rust's `apply_reactions`, `x` inside a match arm is the material kind**, not a
  coordinate. Take coordinates from `idx`.
- **Field notes fire once ever.** Give a note a `requires` rather than trusting the kind alone.
