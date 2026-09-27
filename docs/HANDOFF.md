# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-09-27; `main` carries 20D, gas
conservation, on top of the 20B water budget.*

## Where things stand

Phase 20 replaces the game's accidental water sink with a deliberate one (ROADMAP Phase 20
has the full story). **20A** built the instruments and **20B** shipped the water budget:
moving water throws a faint visible mist (`MIST_ODDS`, 1 in 450 per move), water never
deletes water, a settled pond keeps every drop, a puddle on open ground dries in 15-30 s, and
a spring settles into a lake of ~7% of the board. Everything is green: 123 cargo tests, 30
parity scenarios, 125 interaction checks, the slow world, the full `npm run check`.

**The triage of the 17 checks 20B moved is done**: 10 were dice (they stop moving at 32
seeds), 5 were the audit's own Wall floor and one is a bigger pool. The seventeenth,
`water.boils`, was filed as a changed witness and was half wrong — water was also deleting the
steam it boiled, which 20E fixed (contrast 115 -> 423). ROADMAP Phase 20 has the per-check reasoning; HARNESS.md's
`audit:drift` section has the two lessons. The two watch items it raised are measured and hold (ROADMAP Phase 20): plants
watered once are not shorter at player scale, and a day away still grows the slow-world
garden 18 new columns — keep that number where it is through 20E.

**20D is done**: a gas never deletes a gas. A confined fire's smoke roughly doubles and pools
under its lid; the owner saw it and kept it as-is (do not relitigate — shortening smoke's
lifetime was offered and declined). Numbers in ROADMAP Phase 20.

One piece of work remains: **20E — the rest of the move clobber**, including the last small
water leak.

## Decisions already made — do not relitigate

All by the owner, recorded in the user's memory and ROADMAP Phase 20:

- **Mist is visible**, never a silent delete. An interaction check enforces it.
- **Lakes are a feature**: a spring fills a real pond that stops growing.
- **Puddles dry** (1-in-450). That rate also sets spring size; they are one knob.
- **Gases are conserved and smoke keeps its 180-tick life** (20D), though a lidded fire's smoke
  doubles.
- **No cheap fixes.** Every change needs its own justification and must not create a problem
  later. Do not bundle opportunistic fixes into a step, and never tune a fixture until it
  passes — a re-staged scene must be what a player would do, and pass on 7-8 seeds of 8.
- **A rain-filled sand basin turning to sandstone is geology**, not a bug.
- **Never conserve a liquid that has no sink.** Oil is deliberately NOT conserved.

## How to work (this is what caught every real bug in 20B)

- **Branch until green.** A push to `main` deploys. 20B lived on `phase-20b-mist` (merged;
  the remote branch can be deleted) and only fast-forwarded once the full gate passed.
- **Screen on eight seeds, confirm on 32.** The interaction audit is one seed per check and
  reads dice as effects. `npm run audit:drift -- --base <ref> [--only id,id]` compares the
  working tree with any commit; a metric is listed only when the two builds' middle halves do
  not overlap — and at eight seeds that still misfires on wide distributions (10 of 17 in the
  triage). Re-run anything you would act on with `--seeds 32 --only ...`. The pre-mist
  baseline is `8dc123b`; the baseline for 20E is the current `main`.
- **Water tools:** `npm run water:budget` (spring, oil spring, pour, sand into a pond) and
  `npm run clobber:census` (every overwrite by mover, victim and origin).
- **Vacuity-test every gate you touch**: sabotage the rule in BOTH engines and watch the gate
  fail by name. `PARITY_ONLY=<name text> npm run test:parity` runs one scenario, because the
  harness stops at the first vacuous one.
- **Close each step with `/adversarial-review`** (Codex; check `codex login status`). In 20B
  it found five real problems after every gate was green — including an oil spring flooding
  a third of the board.
- Scratch scorers are in `.tmp/` (untracked, may be gone): `candidates.mjs` scores a
  candidate check on eight seeds, and `origin-split.mjs <id...>` classifies every cell a
  check's outcome touched by what the scene painted there and whether it is below the Wall
  floor, base against working tree — it settled five of the triage's seventeen in one run. **Consider promoting a per-seed pass/fail mode into `audit:drift`**: re-staging a
  scene needed it a dozen times, which is this repo's own rule for when a tool earns a place.

## 1. 20E — the rest of the clobber

- **Done: a gas never deletes water** (steam-over-water 1,343 -> 0; spring still ~7%). Its
  witness counts water only — see docs/HARNESS.md for why water plus steam is not conserved.
- **Done: water never deletes a gas that arrived this tick** (1,836 -> 0). It restored
  `water.boils` to its pre-20B contrast and, less expectedly, halved the steam over a big lava
  pour — both recorded in docs/HARNESS.md. Its parity scenario starts from exact cells
  (`cells(w, h)`), because no painted scene reached the state reliably.
- **What is left: 942 overwrites, every class under ~200.** Decide per class with the census; anything left
  open gets documented as intended in docs/HARNESS.md ("The move clobber, and what is left").

## Traps this work already paid for

- **A piped gate hides its exit code.** `npm run x | tail` returns tail's status; a failed
  `material:audit` reached a commit that way. Redirect to a file and check `$?`.
- **`.tmp/` compiles go stale.** A reviewer's number was wrong (54 vs 76) from a stale
  compile; `scripts/compile-app.mjs` rebuilds fresh — use it rather than reading old folders.
- **Liquids side-hop two cells**: they jump a one-cell wall, and a one-cell floor lets them
  drain diagonally. The `shaft` and `open_shallow_pond` test helpers show the right seal.
- **In Rust's `apply_reactions`, `x` inside a match arm is the material kind**, not a
  coordinate (`x if x == Material::Water as u8`). Take coordinates from `idx`.
- **A sealed test fixture cannot tell "still" from "can't move"** — 20B's first "still water"
  tests put a lid on the pond and so missed that open air above counted as flow.
- **Hand-typed copies of `MATERIAL` / `CELL_FLAG` rot.** Read them from `materials.ts`, as the
  parity, audit and smoke scripts now do.
- **Field notes fire once ever.** A note triggered by the wrong cause is spent for good; give
  it a `requires` rather than trusting the kind alone.
