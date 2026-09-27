# Handoff — where the work is, and what to do next

*Rewritten at each handoff, never appended to. Written 2026-09-27; `main` is `7b6c76c`, live
at pixelfun.littlealbumclub.net and verified with `npm run qa:live`.*

## Where things stand

Phase 20 replaces the game's accidental water sink with a deliberate one (ROADMAP Phase 20
has the full story). **20A** built the instruments and **20B** shipped the water budget:
moving water throws a faint visible mist (`MIST_ODDS`, 1 in 450 per move), water never
deletes water, a settled pond keeps every drop, a puddle on open ground dries in 15-30 s, and
a spring settles into a lake of ~7% of the board. Everything is green: 120 cargo tests, 27
parity scenarios, 125 interaction checks, the slow world, the full `npm run check`.

Three pieces of work remain, in this order:

1. **Triage what 20B moved** — 17 interaction checks got measurably worse (all still pass).
2. **20D — gases**: smoke and steam deleting each other.
3. **20E — the rest of the move clobber**, including the last small water leak.

## Decisions already made — do not relitigate

All by the owner, recorded in the user's memory and ROADMAP Phase 20:

- **Mist is visible**, never a silent delete. An interaction check enforces it.
- **Lakes are a feature**: a spring fills a real pond that stops growing.
- **Puddles dry** (1-in-450). That rate also sets spring size; they are one knob.
- **No cheap fixes.** Every change needs its own justification and must not create a problem
  later. Do not bundle opportunistic fixes into a step, and never tune a fixture until it
  passes — a re-staged scene must be what a player would do, and pass on 7-8 seeds of 8.
- **A rain-filled sand basin turning to sandstone is geology**, not a bug.
- **Never conserve a liquid that has no sink.** Oil is deliberately NOT conserved.

## How to work (this is what caught every real bug in 20B)

- **Branch until green.** A push to `main` deploys. 20B lived on `phase-20b-mist` (merged;
  the remote branch can be deleted) and only fast-forwarded once the full gate passed.
- **Measure on eight seeds, never one.** The interaction audit is one seed per check and
  reads dice as effects. `npm run audit:drift -- --base <ref> [--only id,id]` compares the
  working tree with any commit; a metric is listed only when the two builds' middle halves do
  not overlap. **The baseline for "what 20B moved" is `8dc123b`** (20A, before any mist).
- **Water tools:** `npm run water:budget` (spring, oil spring, pour, sand into a pond) and
  `npm run clobber:census` (every overwrite by mover, victim and origin).
- **Vacuity-test every gate you touch**: sabotage the rule in BOTH engines and watch the gate
  fail by name. `PARITY_ONLY=<name text> npm run test:parity` runs one scenario, because the
  harness stops at the first vacuous one.
- **Close each step with `/adversarial-review`** (Codex; check `codex login status`). In 20B
  it found five real problems after every gate was green — including an oil spring flooding
  a third of the board.
- Scratch scorers from 20B are in `.tmp/` (untracked, may be gone): `candidates.mjs` scores
  a candidate check on eight seeds, `mossfloor.mjs` counts moss that replaced audit scaffold
  walls. **Consider promoting a per-seed pass/fail mode into `audit:drift`**: re-staging a
  scene needed it a dozen times, which is this repo's own rule for when a tool earns a place.

## 1. Triage the 17 checks 20B moved

Reproduce with `npm run audit:drift -- --base 8dc123b`. Every one still clears the audit's
floors; the question is whether each is explained, and fixed at its cause if it is a real
regression. End each as **explained and accepted (write down why)** or **fixed at the cause**.

**Not regressions — the witness changed (confirm, then move on):**
- `water.boils` (cells 92 -> 32, contrast 424 -> 115) and `fire.softens` (first tick 6 -> 7).
  These now count only steam hotter than mist, because review showed they passed on mist
  with every thermal source turned off. Their numbers describe different cells now.

**Mostly scaffolding — moss used to eat the audit's own Wall floor** (plain moss may no
longer take a wall). Measured, pre-20B against now, cells that replaced a wall / growth
elsewhere:
- `seed.settles` 35 / 41 -> 0 / 41 — pure artefact; growth unchanged.
- `soil.feeds` 16 / 38 -> 0 / 34 — mostly artefact.
- `fungus.cosmic` 13 / 23 -> 0 / 18 — partly real.
- **`fungus.overtakes` 13 / 58 -> 0 / 39 and `moss.overtaken` 5 / 63 -> 0 / 41 — real drops
  beyond the scaffolding.** Moss is overtaken by fungus "when old or wet"; the likely cause is
  the drier world (puddles now dry), but that is a hypothesis. Find the cause first.

**The drier world (puddles dry, meltwater mists):**
- `ice.melts` shown 1200 -> 571 — the meltwater now evaporates as it runs. Probably honest;
  decide whether a melt's water should read longer.
- `fire.dries` contrast 133 -> 116, `stone.blocks` contrast 391 -> 337,
  `moss.dries` contrast 134 -> 111 (its scene was re-staged in 20B; see its comment).
- Later first ticks: `flower.wilts` 1311 -> 1403, `pollen.drifts` 138 -> 147,
  `wood.feeds` 17 -> 30, `fungus.rots` 7 -> 11. `stem.burns` shown 732 -> 706,
  `ember.quenched` cells 29 -> 27. Small; check whether any is a gameplay feel change.

Things to watch while doing it: plants watered only once grow shorter now (a stalk's height
is fixed by the seed's energy at germination), and the slow-world garden still grows 18 new
columns — keep it there.

## 2. 20D — gases

The census after 20B: **smoke deleting smoke 3,190** (37% of remaining overwrites), steam
over steam 347, smoke/steam over each other ~500. It works as extra fading today.

Unlike water, gases already HAVE a sink — smoke expires past age 180, steam past 150 — so
conserving them does not need a new rule, but it does mean more smoke. Measure before
deciding: peak and mean smoke on the board over a burning log pile and a lidded hearth, and
steam's documented bound (**0.8% of the board** with water poured on lava). If conservation
fogs a scene, the lever is fade age, not the clobber. Owner decision needed if it changes
how a fire looks.

## 3. 20E — the rest of the clobber

- **Steam overwriting water that just flowed in: 615** — the last small leak of the old water
  sink, mostly a spring's mist rising through its own stream. Closing it (a gas never deletes
  a liquid) will grow a spring's lake a little: re-run `water:budget` and keep the spring near
  the ~7% the owner accepted — if it grows past that, MIST_ODDS is the knob, and it also sets
  how fast puddles dry.
- **Water overwriting steam a reaction just made: 2,619** — quenching lava and boiling. Closing
  it keeps more of that steam; check `lava.quenched`, `water.quenches` and the steam bound.
- Everything else is under ~350 per class. Decide per class with the census; anything left
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
