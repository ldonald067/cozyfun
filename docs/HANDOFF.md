# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-09-27; `main` carries the end of
Phase 20.*

## Where things stand

**Phase 20 — the water budget — is done.** The game's accidental water sink (movers
overwriting cells another mover had filled that tick) is replaced by a deliberate, visible
one: moving water throws a faint mist (`MIST_ODDS`, 1 in 450 per move). A settled pond keeps
every drop, a puddle on open ground dries in 15-30 s, and a spring settles into a lake of
~7% of the board. Five overwrite classes are closed: water over water, gas over gas, gas over
water, water over freshly vented gas, and pollen/stardust over water. Others remain by
decision — including 19 oil and lava overwrites of water. ROADMAP Phase 20 has every step with its numbers; docs/HARNESS.md ("The move
clobber, and what is left of it") lists the 787 overwrites that remain and why each class
stays.

Everything is green: 124 cargo tests, 31 parity scenarios, 125 interaction checks, the slow
world (a day away still grows the garden 18 new columns), and the full `npm run check`.

**No next phase is planned.** What to build next is the owner's call. Open threads, none
started, in no particular order:

- **Phase 8's subjective listening pass** is the one unfinished item from before Phase 20.
- **One watering grows a minimum plant.** Measured in the 20B triage: a planter watered once
  leaves most plants at the minimum 4-cell stalk and 58% leafless, before and after 20B
  alike. Whether one watering should grow a leafy plant is a design question.
- **Steam reads as a dotted thread.** docs/VISUAL_PIPELINE.md records that no renderer change
  can fix it and that the lever is emitting steam in small clusters in the sim — a design
  choice about vapour volume, not a tweak.
- **Oil and lava still delete water (19 overwrites across the audit).** Left by decision; oil
  has no sink. Reopen only with a sink for oil.
- **Three scripts still hand-type material ids**: `slow-world-audit.mjs`,
  `smoke-field-notes.mjs` (both can read `MATERIAL` through `compileApp`, as
  `smoke-parity.mjs` now does), and `material-showcase.mjs`, which runs inside the page as a
  template literal and cannot import — it needs a check, like the one `material:audit` already
  makes for its flag map, rather than an import.
- **Consider a per-seed pass/fail mode for `audit:drift`.** Re-staging scenes in 20B needed
  one a dozen times, and the triage needed `--seeds 32` to separate dice from effects.

## Decisions already made — do not relitigate

All by the owner, recorded in the user's memory and ROADMAP Phase 20:

- **Mist is visible**, never a silent delete. An interaction check enforces it.
- **Lakes are a feature**: a spring fills a real pond that stops growing.
- **Puddles dry** (1-in-450). That rate also sets spring size; they are one knob.
- **Gases are conserved and smoke keeps its 180-tick life** (20D), though a lidded fire's smoke
  doubles.
- **The clobber's remaining classes stay** (20E): only the pollen and stardust water leaks were
  closed. Grain-over-grain was rejected as a cheap fix.
- **No cheap fixes.** Every change needs its own justification and must not create a problem
  later. Do not bundle opportunistic fixes into a step, and never tune a fixture until it
  passes — a re-staged scene must be what a player would do, and pass on 7-8 seeds of 8.
- **A rain-filled sand basin turning to sandstone is geology**, not a bug.
- **Never conserve a liquid that has no sink.** Oil is deliberately NOT conserved.

## How to work (this is what caught every real bug in Phase 20)

- **Branch until green.** A push to `main` deploys, and Railway waits for CI before it
  builds. Fast-forward `main` only once the full gate passes, then `npm run deploy:verify`
  against the host until it reports the new commit (about five minutes).
- **Screen on eight seeds, confirm on 32.** The interaction audit is one seed per check and
  reads dice as effects. `npm run audit:drift -- --base <ref> [--only id,id]` compares the
  working tree with any commit — and at eight seeds it still misfires on wide distributions
  (10 of 17 in the triage). Re-run anything you would act on with `--seeds 32 --only ...`.
- **When a moved metric survives, ask what its cells WERE** before asking why they changed:
  five triage "regressions" were the audit's own Wall floor.
- **A changed witness can hide a real loss.** `water.boils` was filed as a witness change and
  was also losing its steam to the water above it. Measure what the new witness sees.
- **Water tools:** `npm run water:budget` (spring, oil spring, pour, sand into a pond) and
  `npm run clobber:census` (every overwrite by mover, victim and origin).
- **Vacuity-test every gate you touch**: sabotage the rule in BOTH engines, rebuild with
  `npm run build:sim`, and watch the gate fail by name. `PARITY_ONLY=<name text> npm run
  test:parity` runs one scenario. A parity scenario may start from exact cells with
  `cells(w, h)` when painting cannot reach a state reliably.
- **Close each step with `/adversarial-review`** (Codex; check `codex login status`). In 20B
  it found five real problems after every gate was green.

## Traps this work already paid for

- **A piped gate hides its exit code.** `npm run x | tail` returns tail's status; a failed
  `material:audit` reached a commit that way. Redirect to a file and check `$?`.
- **`.tmp/` compiles go stale.** A reviewer's number was wrong (54 vs 76) from a stale
  compile; `scripts/compile-app.mjs` rebuilds fresh — use it rather than reading old folders.
- **Liquids side-hop two cells**: they jump a one-cell wall, and a one-cell floor lets them
  drain diagonally. Twice in 20E a fixture passed because the water stepped aside instead of
  meeting the rule; seal a one-wide shaft two walls thick, and print the board.
- **Liquids move before gases in a tick** (bottom-up pass, then top-down), so water can never
  land on steam that MOVED this tick — only on steam a reaction made.
- **Water plus steam is not conserved even with every clobber closed**: water sinking through
  a gas cell displaces it by design. Witness water on its own (lost == mist born this tick).
- **In Rust's `apply_reactions`, `x` inside a match arm is the material kind**, not a
  coordinate (`x if x == Material::Water as u8`). Take coordinates from `idx`.
- **A sealed test fixture cannot tell "still" from "can't move"** — 20B's first "still water"
  tests put a lid on the pond and so missed that open air above counted as flow.
- **Hand-typed copies of `MATERIAL` / `CELL_FLAG` rot.** Read them from `materials.ts`, as the
  parity script and the interaction audit do; three scripts still carry copies (listed above).
- **Field notes fire once ever.** A note triggered by the wrong cause is spent for good; give
  it a `requires` rather than trusting the kind alone.
