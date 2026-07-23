# Phase 18 — Living-World Batch (handoff)

Status snapshot for resuming in a fresh session. Phase 18 applies a roster-wide
design-feedback pass (four lenses: interaction depth, visual identity, uniqueness,
combos — each item fact-checked against the code before it made this list). The
owner approved **12 items**, split into four gated commits. **All four batches are
shipped.** The only Phase 18 work left is the not-approved visual-lens list below,
which still needs an owner yes.

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

## Done — Batch 3: geology

- **Stone gravity.** `update_stone` (`sim/src/lib.rs`, mirrored in JS `stone()`) drops
  an unsupported Stone cell straight down one cell per tick via `try_move` down only —
  no diagonal slip, so pillars/floors/shelves hold and only true overhangs fall. Wall
  never moves. Freshly-created stone (lava/meteor→stone) is dispatched on its *old*
  kind, so it settles the tick after it forms, not the tick it appears. Tests:
  `unsupported_stone_falls_straight_to_the_floor`, `supported_stone_holds_and_overhangs_drop_without_slipping`,
  `wall_stays_anchored_in_midair`. Parity scenario: "cliff slump and a dropping boulder".
  - **Fixture fallout (resolved).** ~26 cargo tests plus the wasm/js-fallback/parity
    smokes placed floating stone that now falls. Fixes: floors that can be the bottom
    row were grounded by height (rocket/cosmic-seed scenes); mid-air frames, basins,
    ceilings, and substrates became **Wall** (Wall is the only true fixed scaffold now);
    subject-stones compared against wall got a Wall placed directly beneath. `Universe::new`
    clamps height to ≥16, so shrinking below 16 is a no-op — grounding used Wall instead.
    The material **showcase is a static render** (`tick: 0`), so it needed no grounding.
- **Crumble retune.** Freeze-thaw wall crumble threshold lowered `200 → 150` in
  `heat_softens_cell` (and JS `heatSoftens`), so lava (heat 72) crumbles a stressed wall
  in two rounds and fire (42) in three. Existing crumble tests set energy 190 directly,
  so their outcomes were unchanged. The high-stress tier (`energy > 130`) in `wallColor`
  (`shapeLanguage.ts`) now draws spatially coherent **fracture veins** (dark fissure +
  pale relief lip, position-based so cracks thread across neighboring cells) instead of
  hash flecks, and the showcase carries a frost-stressed near-crumble wall so it is
  reviewable on the visual board.

## Done — Batch 4: cycles & rituals

- **Wellspring re-attunement via ice.** The absorb branch now runs when
  `energy == 0 || chilled`, so a spring held under ice re-drinks a touching source
  (consuming it) exactly like first attunement; remove the ice and it pours the new
  material. Emission still only happens unchilled and attuned, so `ice_stills_the_spring`
  is unchanged. Fixes irreversible first-touch misattunement. Tests:
  `ice_lets_a_wellspring_be_reattuned`, `an_unchilled_spring_keeps_its_first_identity`.
- **Fairy ring.** `update_fungus` takes `cell` (was `_cell`) and reads FLAG_COSMIC: on its
  wood/moss/soil conversion a charged fungus at `chance(10)` sows a **Stardust** grain
  instead of Fungus and clears its own cosmic flag. Test:
  `a_cosmic_fungus_sows_a_stardust_grain_as_it_digests`.
- **Fungus → soil collapse.** A fungus past age 600 with no adjacent seed/moss/wood/soil
  collapses into fresh **Soil** at `chance(20)`, closing soil→moss→fungus→soil. Tests:
  `a_starved_old_fungus_collapses_into_soil`, `a_young_starved_fungus_holds_instead_of_collapsing`.
- **Meteor spark trail.** After each successful fall step `leave_meteor_trail` drops a
  `SPARK_DOWN` spark (energy 90) at `chance(3)` in the vacated cell, so showers streak and
  can light rocket fuses; the batch-2 spark-over-water hiss still composes. Test:
  `a_falling_meteor_streaks_a_spark_trail`.
- **Ember doc honesty.** Added a prose note (Decisions row + a dedicated section) that
  Ember's 3 documented roles respect the generated cap while it carries five felt beats,
  and that paintable **Char/Coal** is the strongest 20th-slot candidate. No 4th matrix
  clause — that would break the gate.
- Parity scenarios: "meteor shower over rockets and a pond", "cosmic fungus grove",
  "wellspring re-attuned under ice". All three were confirmed non-vacuous (sparks shed,
  stardust count rose from the fairy ring, springs observed going water → sand under ice).

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
