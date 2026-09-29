# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-09-29. `main` carries Phase 20
and hot-only bubbles, live and verified at `e50b700`; this rewrite changes only docs.*

## Where things stand

**Phase 20 — the water budget — is done, and so is the bubble fix that followed it.** Moving
water throws a faint visible mist (`MIST_ODDS`, 1 in 450 per move), which is the game's one
deliberate water sink: a settled pond keeps every drop, a puddle on open ground dries in
15-30 s, and a spring settles into a lake of ~7% of the board. Five move-clobber classes are
closed (water over water, gas over gas, gas over water, water over freshly vented gas,
pollen/stardust over water); the 789 overwrites left are listed class by class, with the reason
each stays, in docs/HARNESS.md ("The move clobber, and what is left of it"). Since then, gas
hotter than mist trades places with whatever sinks into it, so boiled steam surfaces instead of
being eaten by the water above it; mist is excluded because bubbling it flooded a spring to
29.5% of the board. ROADMAP Phase 20 and "After Phase 20: bubbles" have every number.

The harness grew two things worth knowing. `audit:drift --per-seed` prints the audit's own
verdict for every seed, which is how the bubble bug was found; and every script now reads
material ids and flags from `materials.ts` — the material showcase, which cannot import, has
the real tables written into it by its Node builder, and `material:audit` checks the result.

Everything is green: 126 cargo tests, 32 parity scenarios, 125 interaction checks, the slow
world (a day away grows the garden 18 new columns), and the full `npm run check`.

## What to do next

No next phase is planned; what to build is the owner's call. The threads below are measured,
not remembered.

### 1. Checks that pass the gate only on a lucky seed

`interaction:audit` plays ONE seed per check. Measured 2026-09-29 on 32 seeds
(`npm run audit:drift -- --seeds 32 --per-seed`): 106 of 125 checks pass on all 32, and four
fall below the 7-of-8 bar a re-staged scene is held to. **None of the four was caused by
bubbles** — each was compared against the commit before them (`ed522fa`) and is unchanged or
better.

| check | seeds passing | how it fails |
| --- | --- | --- |
| `rocket.climbs` (a lit grain climbs with a glittering trail) | **8 / 32** (5 before bubbles) | 21 seeds on screen 27-28 ticks against a floor of 30; 3 never climb |
| `stem.climbs` (unfurls side leaves) | 26 / 32 | 2 leaf cells against a floor of 4 |
| `ice.stresses` (frost-stresses damp hard materials) | 27 / 32 | 3 cells against 4 |
| `moss.dries` (dries and scorches before burning) | 27 / 32 | 2-3 cells against 4 |

`rocket.climbs` is the one to start with: it has been passing on a lucky seed for as long as
anyone can tell, and it misses by one or two ticks on almost every seed, which says the
flight is either genuinely under half a second or the scene gives it too little room — find
out which before touching anything. Do not tune the fixture until it passes; a re-staged scene
must be what a player would do. Fifteen more pass on 28-31 seeds (28 meets the bar); the full list is one
command away.

### 2. Design questions for the owner

- **Phase 8's subjective listening pass** is the one unfinished item from before Phase 20.
- **One watering grows a minimum plant.** A planter watered once leaves most plants at the
  minimum 4-cell stalk and 58% leafless, before and after 20B alike. Whether one watering
  should grow a leafy plant is a design question, not a bug.
- **Steam reads as a dotted thread.** docs/VISUAL_PIPELINE.md records that no renderer change
  can fix it; the lever is emitting steam in small clusters in the sim, a choice about vapour
  volume.
- **Oil and lava still delete water** (19 overwrites across the audit). Left by decision: oil
  has no sink. Reopen only together with a sink for oil.

### 3. Fixture debt

- **The `water.boils` scene is a quench, not a boil.** Paint order lets the lava poke through
  the top of its Wall pan into the water, so its steam comes from a direct quench rather than
  "sustained flame". It passes on 32 of 32, so it is not urgent, but it does not stage what its
  clause describes.

## Decisions already made — do not relitigate

All by the owner, each after seeing measurements; recorded in ROADMAP and the operator's
memory:

- **Mist is visible**, never a silent delete. An interaction check enforces it.
- **Lakes are a feature** and **puddles dry** (1-in-450) — one knob sets both.
- **Gases are conserved and smoke keeps its 180-tick life**, though a lidded fire's smoke doubles.
- **Only the pollen and stardust water leaks were closed** in 20E; the other clobber classes
  stay. "Grains never overwrite grains" was rejected as a cheap fix.
- **Bubbles are hot-only.** Mist must not bubble (the spring floods); `lava.scorches` falling
  32 -> 29 of 32 was accepted with it.
- **A rain-filled sand basin turning to sandstone is geology**, not a bug.
- **Never conserve a liquid that has no sink.** Oil is deliberately not conserved.
- **No cheap fixes.** Every change needs its own justification and must not create a problem
  later; do not bundle opportunistic fixes into a step.

## How to work

- **Branch until green.** A push to `main` deploys, and Railway waits for CI before it builds.
  Fast-forward `main` only once the full gate passes, then run `npm run deploy:verify` until it
  reports the new commit (about five minutes), and `npm run qa:live` when the change is visible.
- **Ask whether each seed PASSES, not only whether the spread moved:**
  `npm run audit:drift -- --per-seed --only <ids>`. Screen on 8 seeds, confirm on 32 — at 8 the
  spread comparison misfires on wide distributions (10 of 17 in the 20B triage).
- **When a moved metric survives, ask what its cells WERE** before asking why they changed:
  five triage "regressions" were the audit's own Wall floor.
- **A changed witness can hide a real loss.** `water.boils` was filed as a witness change and
  was also losing its steam; measure what the new witness sees.
- **Water tools:** `npm run water:budget` and `npm run clobber:census`. Anything that changes
  mist's fate goes behind a `water:budget` run.
- **Vacuity-test every gate you touch**: sabotage the rule in BOTH engines, rebuild with
  `npm run build:sim`, and watch the gate fail by name. `PARITY_ONLY=<name text>` runs one
  parity scenario; `cells(w, h)` starts one from exact bytes when painting cannot reach a state.
- **Close each step with `/adversarial-review`** (Codex; check `codex login status`). If Codex
  is out of usage, wait for the reset — the skill forbids falling back to a same-model review.

## Traps this work already paid for

- **A piped gate hides its exit code.** `npm run x | tail` returns tail's status. Redirect to a
  file and check `$?`.
- **A fixture can pass for the wrong reason.** Twice in 20E the water side-hopped around the
  rule instead of meeting it (liquids hop two cells and jump a one-cell wall). Seal a one-wide
  shaft two walls thick, and print the board before trusting a pass.
- **Liquids move before gases in a tick** (bottom-up pass, then top-down), so water can only
  land on steam a reaction made, never on steam that moved.
- **Water plus steam is not conserved**: hot steam bubbles, but water sinking into mist deletes
  it. Witness water alone (lost == mist born this tick), and where motes are present bound it
  rather than asserting it — a mote can take mist thrown earlier the same tick.
- **A claim that something is "by design" needs a source.** The deletion bubbles replaced was
  written up as designed and nothing showed anyone had chosen it.
- **Sabotaging compiled output: patch before the first load.** A loaded CommonJS module is
  cached, so a patch applied afterwards silently tests the unpatched code.
- **`.tmp/` compiles go stale.** `scripts/compile-app.mjs` rebuilds fresh; do not read old
  folders, including a reviewer's.
- **In Rust's `apply_reactions`, `x` inside a match arm is the material kind**, not a
  coordinate. Take coordinates from `idx`.
- **A sealed test fixture cannot tell "still" from "can't move."**
- **Hand-typed copies of `MATERIAL` / `CELL_FLAG` rot.** Read them through `compileApp`.
- **Field notes fire once ever.** Give a note a `requires` rather than trusting the kind alone.
