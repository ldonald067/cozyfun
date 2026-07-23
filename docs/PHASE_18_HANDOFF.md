# Phase 18 — Living-World Batch (handoff)

Status snapshot for resuming in a fresh session. Phase 18 applies a roster-wide
design-feedback pass (four lenses: interaction depth, visual identity, uniqueness,
combos — each item fact-checked against the code before it made this list). The
owner approved **12 items**, split into four gated commits. **Batches 1 and 2 are
shipped; batches 3 and 4 remain.**

## Working conventions (do not skip)

- Every sim rule lives in **both** `sim/src/lib.rs` (source of truth) and
  `app/src/engine.ts` (JS fallback). They must stay **byte-for-byte identical** —
  `npm run test:parity` (`scripts/smoke-parity.mjs`) runs 13 scenarios through both
  engines and asserts every cell byte matches each tick. Add a scenario for each new
  rule and confirm it isn't vacuous (that it actually exercises the path).
- Full gate: `npm run check` (from repo root; `source "$HOME/.cargo/env"` first for
  cargo). It runs material audit, contrast floor, 71 cargo tests, both engine smokes,
  the parity harness, audio + browser smoke, and visual QA.
- `docs/MATERIAL_AUDIT.md` interaction matrix: **toolbar materials document 4–6
  roles, generated-only materials 1–3** (semicolon-separated clauses). The
  `material:audit` gate enforces this and also asserts the showcase renders every
  material + every flag state. Keep clause counts within the caps when editing rows.
- New parity scenarios that leave cells **floating** must remember liquids side-hop
  ±2 and gases rise — seal test enclosures with walls, or the scenario diverges for
  the wrong reason.
- Commit per batch, push, let CI (`npm run check`) confirm green.

## Done — Batch 1: garden lineage (commit `fbaafae`)

- **Pollen gate retune.** The self-seeding loop was mathematically dead (flower
  blooms energy 90, drains 1/tick, but pollen needed age>120 AND energy>80). Now
  `age>20 && energy>40 && chance(120)` (60 for cosmic). Flower arm in `apply_reactions`.
- **Cosmic pollen lineage.** `emit_vapor_from` now returns the emitted index; a cosmic
  flower stamps FLAG_COSMIC on its pollen, and cosmic pollen roots into a cosmic seed
  (which already grows the taller stalk). Cosmic pollen gets a moonlit sheen in
  `pollenColor`. Tests: `untended_garden_still_releases_pollen_within_its_energy_arc`,
  `cosmic_flower_pollen_breeds_a_cosmic_seed`.

## Done — Batch 2: terrarium & hearth (commit `e5cfebe`)

- **Glass dew.** Steam adjacent to Glass fogs the pane (FLAG_WET) and beads back to
  water at chance(4); Glass joined `is_absorbent`. `glassColor` renders persistent
  fog + droplet runs. Fixes the namesake sealed-terrarium build drying out.
- **Hearth walls.** A Wall beside fire/lava/hot-ember dries wet neighbors chance(10)
  and thaws frozen ones chance(6). Only clears flags — never ignites, never spawns.
  New `wallReact`/wall arm dispatched before the shared neighbor loop.
- **Spark hiss.** A spark touching water becomes one Steam(60) cell (check at the top
  of `update_spark`). Fireworks sizzle over a pond.
- Tests: `glass_dew_fogs_the_pane_and_beads_into_water`, `hearth_wall_dries_and_thaws_its_nook`,
  `spark_hisses_into_steam_on_water`. Parity scenarios: "glass terrarium over a hearth",
  "fireworks over a pond".

## TODO — Batch 3: geology (the churny one; do it in its own commit)

1. **Stone gravity (medium).** A Stone cell with an empty/gas cell **directly below**
   falls straight down one cell per tick — **no diagonal slip** (pillars, floors,
   shelves stay put; only true overhangs drop). Wall **never** moves. Add a
   `update_stone` mover dispatched in the bottom-up pass (mirror in JS `stone()`),
   using `try_move` straight down only. Self-limiting: no spawns, motion halts on
   contact, supported cells never move.
   - **Payoff:** makes three existing rare events visible — erosion undercuts a cliff
     and it slumps, lava crusts collapse into rubble, meteor stone lands.
   - **GOTCHAS:** several parity scenarios and the material showcase place **floating
     stone rows** that will now fall (e.g. `scripts/smoke-parity.mjs` scenes use stone
     floors — those sit on walls/floor, fine; but "isolated lava crusting to stone"
     produces mid-air crust that will now drop, and cargo tests / showcase with
     floating stone need grounding). Grep `Material::Stone`/`M.Stone`/`material.Stone`
     across `sim/src/lib.rs` tests, `scripts/*.mjs`, and fix fixtures so intended-static
     stone rests on a support. Update audit rows: Stone gains a "falls when
     unsupported" role; Wall's row makes "never moves / stays absolutely anchored"
     explicit (this is the debate-ender for the Wall/Stone overlap the uniqueness lens
     flagged). Grounding: erosion `sim/src/lib.rs:730-739`, crust `590-596`,
     `docs/MATERIAL_AUDIT.md:91`.

2. **Crumble retune (small).** Freeze-thaw wall crumble currently needs ~3 ice+fire
   rounds: the threshold is `next.energy + heat > 200` in `heat_softens_cell`
   (**`sim/src/lib.rs:1632`**, and the JS mirror in `heatSoftens`). Lower to **150** so
   two fire rounds suffice (lava's heat 72 already does it in two). Also give the
   high-stress tier a **distinct crack sprite**: `shapeLanguage.ts` currently draws
   dark flecks past energy>130 (~line 171-174) that read the same as the damp tint
   starting energy>30 (~line 147) — add a visible fracture cue at the 130+ tier so the
   wall looks cracked *before* it falls. Update the `accumulated_freeze_thaw_crumbles_wall_into_stone`
   test if its round count assumptions change.

## TODO — Batch 4: cycles & rituals (one commit)

3. **Wellspring re-attunement via ice (small).** Attunement is currently permanent
   (absorb branch only runs while `energy == 0`). While the spring is **chilled by ice**
   (the existing `chilled` check, `sim/src/lib.rs:482-484`), a touching wellspring-source
   should re-attune it — consuming that source cell exactly like first attunement
   (`493-496`). The rune glow shifts hue (already keyed off energy in `wellspringColor`);
   remove the ice and it pours the new material. Self-limiting: deliberate two-step,
   consumes one cell, creates nothing. Fixes irreversible first-touch mis-attunement.

4. **Fairy ring (small).** Stardust/moonwater set FLAG_COSMIC on fungus (`614-619`,
   `688-697`) but `update_fungus` (`sim/src/lib.rs:1214`, signature currently
   `(idx, _cell, old, next)` — rename `_cell` to `cell`) never reads it. When a cosmic
   fungus performs its existing wood/soil/moss conversion, at ~1-in-10 chance the
   digested cell becomes a **Stardust** grain instead of Fungus, and the fungus clears
   its own cosmic flag. Self-limiting: one grain per cosmic charge, yield below stardust
   invested. Gives the roster's least-loved corner a gift and a reason to charge it.

5. **Fungus → soil collapse (small).** Fungus is the only dead-end (everything converts
   INTO fungus; nothing converts it onward except fire). Starved fungus — past ~600 age
   with **no** adjacent seed/moss/wood/soil to eat — collapses into fresh **Soil** at low
   chance, closing soil→moss→fungus→soil. Note: fungus is NOT in the age-expiry list and
   energy 0 only strips flags, so add a starvation check in `update_fungus`. Self-limiting:
   only fires with nothing left to eat; produces inert substrate.

6. **Meteor spark trail (small).** Meteor's flight is one bare falling pixel
   (`update_meteor`, `sim/src/lib.rs:1303`, fall step ~1260-1263 region). After each
   successful fall step, `chance(3)` leaves a **Spark** (variant `SPARK_DOWN`, energy ~90)
   in the vacated cell — borrow the rocket's trail shape. Trail sparks already light
   rocket powder, so a meteor shower over a rocket field becomes a festival. Self-limiting:
   sparks age out at 60 ticks and (via `is_hot` excluding Spark) ignite nothing but rocket
   fuses. Confirm the spark-over-water hiss from batch 2 still composes.

7. **Ember doc honesty (tiny, doc-only).** Ember has 5 *felt* roles (glow-spread,
   cool-char, relight, quench, char-wash) but is generated-only so its matrix row
   (`docs/MATERIAL_AUDIT.md:60`) documents 3 to satisfy the 1-3 cap. Add a short note
   (Decisions section or prose, **NOT** a 4th matrix clause — that breaks the gate) that
   Ember intentionally exceeds the generated bar in felt depth, and that paintable
   **Char/Coal** (slow hearth heat, distinct from Fire's flash and Lava's flood) is the
   strongest candidate if a 20th toolbar slot is ever wanted.

## Not approved (yet) — visual-lens findings worth surfacing to the owner

The visual-identity lens (grounded on real captures) flagged renderer-only gaps beyond
the 12 approved items. Mention these; they're small and cozy but need a yes:
- **Wellspring is nearly invisible** on the `#091018` night background, and attuned-vs-
  dormant fails at small placements — needs a brighter carved-rune base + a glow when attuned.
- **Lit rocket head** climbs as a single un-glowing pixel — deserves a glow.
- **Glass reads as flat mint chalk**, not transparent — wants a see-through treatment.
- **Vitrify flash** lives only in the base layer and never blooms into the glow.
- **Steam out-glows its own source** (inherits fire's 120-alpha floor) — dial it down;
  and give night-light glow to attuned wellspring, lit rocket grain, fresh glass, and
  constellation-etched stone.

## Roster health (for context)

Strong overall. Benchmarks to copy: **Water's temperature dial** and **Rocket's
10-second arc**. Meteor survived its removal-watch (only instant-impact verb).
Wall/Stone was the one genuinely blurred pair — batch 3's stone gravity is the
debate-ender. Stardust/Moonwater double-cover cosmic charging (coherent as a chain
today, but any *future* cosmic material must claim a niche these two don't share).
