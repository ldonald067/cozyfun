# Cozy Pixel Sandbox Roadmap

This roadmap keeps the project focused: make the toy feel good, keep the codebase stable, and add atmosphere without turning the project into a giant platform too early.

## Status Snapshot

Every phase through 19 is complete except Phase 8's remaining subjective listening pass, and
the September design passes between 19 and 20 all shipped. Phase 20 — replacing the move
clobber's hidden water sink with a deliberate one — is done: moving water throws a visible
mist, and water no longer deletes water or freshly vented gas, gas no longer deletes gas or
water, and pollen and stardust no longer delete water. The 787 overwrites that remain are
listed class by class, with the reason each stays, in docs/HARNESS.md. Since then, hot steam
bubbles up through water instead of being deleted by it ("After Phase 20: bubbles"). No Phase
21 is planned yet.
**Start at `docs/HANDOFF.md`.**

The sandbox is a playable, deployed browser toy: React/Vite UI, Rust/WASM sim with a byte-identical JS fallback, 18 paintable materials plus the Eraser on the toolbar and 8 generated-only outcomes, six credited room backdrops with room-linked native ambience, optional YouTube Desk Radio, local save/share/postcard/clip export, a click-to-load embed poster, deterministic sim/parity/browser/visual/audio QA wired into local scripts and CI, and a deploy gate that proves which commit the running host is serving. It runs at `pixelfun.littlealbumclub.net` and is iframed into `littlealbumclub.net`. Details live in the phase sections below.

## Phase 0: Playable V0

Status: done.

- React/Vite browser app.
- Rust/WASM simulation core with JavaScript fallback.
- Manual painting as the core interaction.
- 18 materials with soft reactions.
- Local save/load and JSON export/import.
- Cozy night desk terrarium presentation.
- GitHub CI for sim tests and production build.

## Phase 1: Quality Foundation

Status: done.

Goal: make the project safer to change before adding more visual complexity.

- Add lightweight smoke tests for app launch, painting, clear, save/load, import rejection, export, and audio controls.
- Add a deterministic WASM smoke check that exercises a few core reactions from JavaScript.
- Keep Rust tests focused on simulation behavior.
- Document architecture, rendering boundaries, local dev quirks, and expected commands.
- MIT license selected before wider sharing.

## Phase 2: Visual Shape Language

Status: baseline done.

Goal: make each material recognizable by silhouette and texture, not color alone.

The simulation should still stay grid-based. Shape language belongs mostly in the renderer, so physics remains stable while visuals improve.

Material directions:

- Ice: small cube-like clusters with sharp pale highlights.
- Stone: chunky irregular blocks with darker cracks.
- Sand: tiny warm grains and speckles.
- Soil: darker clumps with organic texture.
- Water: smoother connected ribbons and reflective shimmer.
- Moonwater: glowing droplets and soft ripple accents.
- Fire: flickering tongues, sparks, and brighter cores.
- Smoke: soft fading puffs.
- Steam: brighter translucent puffs with glow.
- Seed: small chestnut ovals with green flecks.
- Moss: leafy clusters and soft green growth.
- Fungus: clustered spores and cap-like dots.
- Lava: hot cracked rock with glowing seams.
- Stardust: tiny star-shaped spark pixels.
- Meteor: bright falling cores with ember trails.

Implementation approach:

- Add renderer helpers that can inspect neighboring cells.
- First batch: Ice, Stone, Seed, Sand, Water/Moonwater, and Stardust.
- Keep renderer orchestration separate from material shape-language rules.
- Keep effects subtle at single-cell scale.
- Avoid changing Rust simulation rules for this phase unless a visual need exposes a real behavior bug.
- Verify desktop and mobile screenshots after each batch.

Done in this phase:

- Added reusable rendering modules for color math, cell inspection, deterministic cell hashing, glow, and material shape rules.
- Added first-pass shape treatment for sand, seed, ice, stone, water, moonwater, and stardust.
- Strengthened ice so it reads more like small cubes instead of pale liquid.
- Added readability treatment for wall, soil, smoke, and steam so the first visual pass is not relying on color alone.

Phase 2 is ready for Phase 3 atmosphere work. Deeper realism and more ambitious silhouettes continue in Phase 4.

## Phase 3: Cozy Atmosphere

Status: done.

Done:

- Procedural Web Audio foundation with master and ambience channels.
- Optional sound enable flow that respects browser autoplay rules.
- Procedural lo-fi jazz bed was prototyped, then removed later after listening review.
- Reusable audio module boundaries for mixer, preferences, ambience, buffers, cues, reactions, and controller lifecycle.
- Simple sound mood controls for Rain, Window, and Stardust.
- Prototype material paint sounds and basic UI cues implemented, then removed after listening review.
- Rain/window ambience polish with room hush and occasional window drip accents.
- Reaction event hooks beyond paint cues: steam, lava cooling, growth, and cosmic sparkle.
- Sound mood tuning moved toward concrete recorded ambience instead of synthetic pads (the moods later settled as Rain, Purr, and Fire in Phase 8).
- External source provider foundation:
  - Native ambience remains the live fallback.
  - Desk Radio uses a visible user-provided YouTube video or playlist player without requiring accounts, API keys, or a backend.
  - Procedural ambience remains native and separate from Desk Radio.
- Softer UI control treatment through reusable segmented controls, focus states, panel scrolling, and compact room controls.
- Better postcard export composition with contextual scene, sound, and simulation metadata.
- Room/backdrop switching that changes atmosphere and audio mood without replacing the sandbox.
- Room photos now load locally from `app/public/rooms` with source tracking in `ASSET_CREDITS.md`.
- Leftover polish pass:
  - Dormant synthetic effect hooks were removed from the live code after listening review.
  - Rain Desk and Stardust Hearth backdrops were softened so the photos support the toy instead of competing with it.
  - Moonlit Garden stayed as-is after the room-photo pass because it already reads calm and low-contrast.
  - Visual QA now captures every room backdrop and checks desktop/mobile panel layout so control crowding is caught by a repeatable script.
- Cozy Fireplace, Forest Hut, and Snow Window backdrops added as generated local assets with credits tracked in `ASSET_CREDITS.md`.

## Phase 4: Sharper Realistic Visuals

Status: done.

Goal: make the sandbox feel more tactile and physically readable while keeping the cozy pixel style.

This is not photorealism. The target is clearer material identity: ice should feel like cubes, stone like broken chunks, lava like hot cracked rock, smoke like soft volume, and liquids like connected puddles.

- Expand material silhouettes beyond single square pixels:
  - Ice: clearer cube clusters, hard edges, brighter corner glints, subtle internal cracks.
  - Stone: irregular block clusters, chipped corners, darker fracture lines.
  - Wall: sturdier tile/block pattern so it reads as built structure, not gray dust.
  - Soil: loose clumps, roots, and darker organic pockets.
  - Fungus: caps, spores, and clustered growth shapes.
  - Moss: leafy patches that spread visually across neighboring cells.
  - Fire: sharper tongues, ember cores, and tiny sparks.
  - Lava: black cooling crust with glowing seams.
  - Smoke/steam: larger soft puffs assembled from nearby cells.
  - Water/moonwater: connected surface highlights, droplet edges, and ripple bands.
- Add local lighting cues:
  - fire/lava/stardust/moonwater illuminate nearby cells more clearly.
  - smoke and steam catch warm light when near fire or lava.
- Add optional high-detail renderer mode for visual polish experiments.
- Add visual QA screenshots for desktop and mobile after every major material batch.
- Keep the simulation rules stable unless a visual idea needs a real new behavior.

Completed in this phase:

- Added reusable edge and nearby-light helpers to the shape-language renderer.
- Extended renderer treatment to more materials instead of keeping Phase 4 as isolated one-off tweaks.
- First realism pass:
  - Ice has stronger cube facets, corner highlights, darker edges, and internal crack marks.
  - Stone has chunkier block shading and darker fracture marks.
  - Wall has stronger mortar and exposed-edge structure.
  - Fire, lava, and meteor have dedicated heat rendering instead of relying only on palette pulsing.
  - Smoke and steam have larger puff/rim treatment.
  - Water, moonwater, and oil have clearer surface, edge, and ripple cues.
  - Moss, fungus, and wood now have basic organic/woodgrain texture treatment.
  - Nearby fire/lava/meteor and stardust/moonwater tint adjacent cells with subtle local light.
  - Fungus and moonwater received a second pass: cap/gill/spore structure, crescent highlights, and life/heat contact shimmer.
  - Renderer-level interaction cues started for water/fire, water/lava, moonwater/life, and cooling stone edges.
- Completion pass:
  - Sand, soil, seed, moss, oil, wood, smoke, steam, stardust, moonwater, and ice all received sharper material-specific identity rules.
  - Interaction visuals were expanded for heat on ice/oil, moonwater near life, stardust near moonwater, and cosmic light through vapor.
  - Added repeatable visual QA capture through `.\scripts\visual-qa.ps1`, including a controlled material scene and responsive layout metrics.
  - Confirmed the responsive control panel does not overflow the QA mobile viewport.

Phase 4 is now closed. Further realism experiments belong in later polish passes unless they directly support Phase 5 sharing.

## Phase 5: Sharing

Status: done.

Completed in this phase:

- Exported and locally saved scene files now use the `CXS2` marker with share metadata for room, sound mood, and safe sound source.
- Imports still accept legacy `CXS1` files, while `CXS2` imports restore room and mood context when metadata is present.
- Added a compact Share control group for scene JSON export/import, postcard export, short clip export, and share-note copy.
- Postcards now include scene title, room, mood, sound source, sim source, tick, and save context.
- Short WebM clip export records the rendered sandbox layers for quick sharing when the browser supports `MediaRecorder`.
- Desk Radio is available as an optional visible YouTube mini-player for user-provided video or playlist links.
- Native ambience stays the default and fallback when Desk Radio has no validated source, the user clears it, or YouTube blocks in-game playback.
- The app does not use YouTube search, Data API keys, scraping, hidden playback, server-side playback handling, accounts, or a backend.
- Shared scenes preserve the Desk Radio source only when it comes from validated user-controlled metadata that loads as an embeddable player.
- Blocked Desk Radio links now keep the attempted URL editable while native ambience resumes, making YouTube embed limits clearer.
- Water and moonwater now hydrate seeds, moss, fungus, and soil so basic life interactions feel more responsive.
- Browser smoke coverage checks the share controls, Desk Radio validation path, blocked-embed fallback, and scene metadata round-trips through import.
- Browser QA captures the current built UI and a painted material scene from a running preview server so stale-preview issues are easier to diagnose.
- Preview/QA URLs can show a top-center build badge with the current JS and CSS bundle names, making stale browser sessions obvious during manual review.

Phase 5 is now closed. Further sharing work should be framed as product polish rather than a missing foundation.

## Phase 6: Living Ecology Interactions

Status: Phase 6 complete.

Goal: make the sandbox feel more alive by giving materials distinct ecological roles instead of one generic growth reaction.

### Phase 6A: Ecology Core

Status: complete.

- Added generated-only Flower as a visible seed success outcome, not a toolbar material.
- Added wet/rooted/cosmic cell flags shared by rendering and the JavaScript fallback.
- Seeds now behave as potential: they hydrate, root, bloom on damp soil, get overtaken by moss beds, or rot near fungus.
- Moss now behaves as carpet: it hydrates and spreads across damp soil/wood without becoming flowers.
- Fungus now behaves as decay pressure: it can rot wet seeds and overtake old wet moss.
- Soil stores moisture and can green up after water moves away.
- Browser QA paints a watered seed bed so the current visual captures exercise the ecology rules.

### Phase 6B: Temperature Core

Status: complete.

- Added frozen/scorched cell flags shared by WASM, JS fallback, renderer, and smoke tests.
- Ice now freezes nearby water, condenses steam into frost, and can put seeds, moss, fungus, flowers, soil, wood, and oil into dormant frozen states.
- Frozen seeds/growth pause their living reactions instead of blooming, spreading, or rotting immediately.
- Heat now thaws frozen cells and dries wet scorchable cells before it can ignite them, so wet moss/wood/seed reads as a state change first.
- Renderer state polish tints frozen and scorched seed, moss, fungus, flower, soil, wood, and oil cells.
- Browser QA now loads a deterministic temperature showcase with frost, frozen growth, steam, fire, and scorched wood/moss.

### Phase 6C: Substrate + Smother

Status: complete.

- Sand, wall, stone, and wood now hold dampness from water/moonwater instead of staying visually inert.
- Wet sand clumps by moving more slowly and rendering darker/muddier.
- Moss now colonizes damp stone/wall at a slower rate than soil/wood, giving hard surfaces a living edge case without making them the main growth path.
- Oil smothers nearby hydratable materials by stripping wet state and reducing energy.
- Plain water hydration is blocked when oil coats the target, while moonwater can still punch through as the special cosmic liquid.
- The deterministic browser showcase now includes wet sand, damp wall moss, oil-smothered seeds, frost, steam, fire, and scorched wood/moss.

### Phase 6D: Cosmic Outcomes

Status: complete.

- Stardust touching ordinary water now charges it into moonwater.
- Stardust can energize/cosmic-mark soil and fungus, expanding it beyond seed/flower boosting.
- Moonwater can clean oil into stardust instead of being blocked by oil like ordinary water.
- Meteor contact with moonwater now creates a stardust burst, making the cosmic/impact case visually distinct from normal fire.
- WASM smoke checks and sim tests cover stardust-water, moonwater-oil, and meteor-moonwater outcomes.

### Phase 6E: Visual State Polish

Status: complete.

- Wet, rooted, frozen, scorched, and cosmic state flags now all have visible rendering cues before a material transforms.
- Cosmic flags tint soil, moss, fungus, and wood even when moonwater is no longer directly touching them.
- The deterministic browser showcase exercises the main readable states together: frost, wet sand, damp wall moss, oil smothering, cosmic water/stardust, fire drying, and generated flowers.

## Phase 7: Material Realism + Codebase Hardening

Status: complete.

Goal: make basic and heat materials feel as considered as the new ecology rules, while tightening the code paths that will carry future behavior.

Phase 7 should not add a big new mode first. The sandbox needs one more grounding pass: oil, sand, stone, wall, wood, ice, fire, lava, and ordinary water should react in ways that feel readable and physically motivated before higher-level goals or galleries are layered on top.

### Phase 7A: Audit Cleanup

- Imported cell flags are masked in both WASM and JS fallback load paths before scene data is accepted.
- JS fallback smoke coverage now checks the main Phase 6 state rules directly.
- The unused Desk Radio embed helper was removed after the safer watch-link path replaced embedded playback.
- Repo-level `AGENTS.md` guidance and `docs/CODE_REVIEW.md` now encode the build/test commands, architecture boundaries, review checklist, and no-slop expectations for future Codex work.
- `docs/HARNESS.md` now captures the project's feedback loops, golden principles, and rules for promoting repeated review issues into scripts, smoke checks, deterministic scenes, or source-of-truth docs.
- Browser QA paths now cover Chrome and Firefox against a served production build, with stale-preview bundle badges visible in captures.

### Phase 7B: Basic Material Realism

- Oil now rises above water/moonwater, sheets sideways when supported, and keeps its smothering/coating pressure on hydratable neighbors.
- Wet sand now drains its stored moisture and clears the wet flag instead of staying permanently clumped.
- Sand, stone, wall, and wood now participate in frost/scorch state cues through the existing wet/frozen/scorched flags.
- Sim, WASM smoke, and JS fallback smoke checks cover oil density, wet-sand drying, and hard-material heat stress.
- Wall and stone are now intentionally split: wall is a sealed construction barrier; stone is a natural weatherable hard substrate that hosts moss and condensation more readily.
- Steam condenses on hard surfaces, smoke leaves soot/scorch marks, and moss needs extra energy to cross a soaked wall.
- Visual, Chrome, and Firefox QA now share a deterministic material showcase scene instead of reusing the Phase 6 ecology showcase.

### Phase 7C: Heat + Cold Interactions

- Ordinary water now flashes into steam against lava and meteor, cools low-energy lava into scorched stone, and shocks meteor into scorched stone.
- Moonwater keeps the special cosmic path: moonwater/oil can clean into stardust and moonwater/meteor bursts into stardust.
- Ice now gives damp stone and wall deterministic frost stress through the frozen flag instead of relying only on random generic freezing.
- Wet wood and wet growth now dry/scorch before they ignite, and wet wood vents steam into nearby empty air so drying reads as an event.

### Phase 7D: Life Balance Pass

- Seeds remain potential: water helps rooting and bloom, moss can overtake wet seeds, and fungus can rot wet seeds instead of every watering path being positive.
- Fungus stays moisture/decay driven and visually changes by role: seed rot, moss takeover, wood decay, soil decomposition, cosmic charge, freezing, and scorching.
- Moss remains a carpet/surface colonizer with slower hard-surface spread; flowers remain generated success outcomes, not toolbar materials.

### Phase 7E: Visual + QA Closeout

- Added the deterministic material showcase for oil-over-water, wet/dry sand, scorched/wet wood, cracked stone/wall, frost, ordinary water/lava steam, ordinary water/meteor shock, and moonwater cosmic outcomes.
- Added Rust sim tests, WASM smoke checks, and JS fallback checks for the new Phase 7 rules.
- Material audit decisions are documented in `docs/MATERIAL_AUDIT.md`, including future removal triggers for overlapping materials.
- Phase 7 closure checks passed through the full `.\scripts\check.ps1` wrapper after the wrapper was made step-based and no longer rebuilt the sim twice.

After Phase 7, higher-level world goals, optional prompts/challenges, or a calmer save-gallery experience become safer product directions.

## Phase 8: Sound + Desk Radio Polish

Status: shipped; open only on a subjective listening pass. Every deliverable below is built and gated by `npm run audio:qa`; what remains is a taste judgment about the mix, not work with a definition of done.

Goal: make the sandbox sound more intentional while letting users play their own YouTube videos or playlists from the visible Desk Radio when YouTube allows embedding.

Guardrails:

- Native ambience stays local, procedural, and default.
- There is no generated lo-fi music bed.
- Desk Radio remains user-controlled and visible.
- The app must not search YouTube, auto-pick playlists, scrape pages, hide playback, add accounts, add API keys, or add a backend.
- If YouTube blocks embedded playback, native ambience resumes and the user can edit the attempted link.

Started:

- The generated lo-fi music experiment was removed after listening review because it stayed too boring for the toy.
- Mood presets now focus on concrete ambience: Rain, Purr, and Fire.
- Native ambience now uses local credited recordings (`rain.mp3`, `cat-purr.mp3`, `fire-crackle.mp3`) with generated room tone, fallback layers, and sparse drips.
- Painting now produces subtle native material cues through the ambience channel, throttled so drag-painting does not flood the audio graph.
- Desk Radio now accepts regular YouTube URLs, `youtu.be` links, raw 11-character video IDs, playlists, embed/live/shorts links, `youtube-nocookie.com` links, and timestamped video links.
- Timestamped video sources are preserved in local Desk Radio state and passed into the YouTube player.
- Desk Radio shows a compact ready row for the current embeddable source, including timestamp labels and a clear open-on-YouTube action.
- Browser smoke coverage now checks timestamped YouTube embed parsing, radio playlist links, player start time, saved metadata, blocked-embed fallback, and native ambience restore.
- Browser smoke coverage now verifies the local ambience recordings are served from `dist` and decode in Chromium.
- `.\scripts\audio-qa.ps1` writes a native ambience QA manifest covering asset presence, loop targets, and mood balances.
- Reaction-driven native cues now observe visible post-tick transitions for steam flashes, blooms, cosmic charges, moonwater/oil cleaning, and meteor bursts without changing sim behavior.
- Audio reaction smoke coverage now checks detector priority, duplicate collapse, and false-positive avoidance for ordinary steam movement.
- Renderer-only visual cues for damp, frozen, scorched, cosmic, and plant contact states are stronger on wall, stone, moss, fungus, and wood.

Next:

- Listen through the audio QA references and live ambience so "better sound" has a repeatable bar beyond build success.

## Phase 9: Room-Linked Ambience

Status: complete.

Goal: make room backdrops carry richer ambience variation without making the sound controls heavier.

Completed:

- Added internal room ambience profiles for Rain Desk, Moonlit Garden, Stardust Hearth, Cozy Fireplace, Forest Hut, and Snow Window.
- Kept the existing mood/provider controls; room selection quietly biases ambience details instead of adding another control row.
- Rain Desk stays close-rain and window-drip forward.
- Moonlit Garden adds cooler outdoor air, sparse night ticks, and a small cosmic chime layer.
- Stardust Hearth adds airy shimmer, warm room tone, and restrained crackle accents without becoming a synthetic pad.
- Cozy Fireplace leans into warm room tone and subtle crackle while keeping rain nearly out of the way.
- Forest Hut uses filtered rain, lower room hum, outdoor air, and occasional branch/leaf movement.
- Snow Window uses softer damped hush, lighter drips, colder room tone, and sparse frost ticks.
- The audio controller now tracks the active room separately from saved audio preferences, so imported scenes and live room changes update ambience without changing the scene file format.
- `.\scripts\audio-qa.ps1` now covers per-room ambience balances in its manifest.

## Phase 10: Element Variation + Identity

Status: complete.

Goal: give each toolbar element 1-2 unique behavior or visual identity features, and add more visible interaction variation to existing materials before adding new elements.

Direction:

- Build a material identity matrix covering unique sim behavior, unique visual change, player purpose, and keep/merge/remove decision.
- Prioritize visible state changes from interactions: fungus color shifts from rot/cosmic/freeze/scorch paths, plants reacting differently to water/moonwater/oil, and hard materials showing weathering/scorch/frost without hiding sim rules in the renderer.
- Keep renderer-only changes presentational. Any new user-visible sim rule must stay in Rust and JS fallback parity with tests.
- Use `docs/MATERIAL_AUDIT.md` as the starting point, then tighten weak overlaps instead of adding more materials by default.

Completed:

- Added source-level identity traits for every material, including generated-only Flower.
- Added `npm run material:audit` and wired it into `.\scripts\check.ps1` so future materials must keep two concrete identity features.
- Expanded renderer-only interaction cues without adding heavier controls:
  - Ordinary water now picks up earth, plant, and oil contact ripples.
  - Moonwater now reads more cosmic near hard surfaces and oil.
  - Seeds and flowers show oil smothering separately from wet/cosmic feeding.
  - Moss darkens under oil and warms near heat before scorch/freeze states take over.
  - Fungus has stronger role colors for seed rot, wood digestion, moss takeover, soil decomposition, moonwater/stardust charge, oil contact, heat, freeze, and scorch.
- Extended the deterministic material showcase so visual, Chrome, and Firefox QA can capture the Phase 10 identity states.
- Updated `docs/MATERIAL_AUDIT.md` with the Phase 10 identity matrix and current keep/merge/remove decisions.

## Phase 11: Element Depth + Visual Payoff

Status: complete.

Completed:

- 11A: Smoke and Steam left the toolbar as generated-only vapors; the toolbar went from 19 to 17 paint choices with no sim loss.
- 11B: Sand vitrifies into generated-only Glass under strong heat; stardust snuffs fire into sparkle bursts and etches constellations onto stone/wall; walls crack and crumble into stone under accumulated freeze-thaw stress; wood burns through a glowing Ember arc into relightable char.
- 11C: every new interaction shipped with its renderer moment, and the deterministic showcase now covers the glass, ember, freeze-thaw, and constellation states alongside the existing wet/frozen/scorched/cosmic captures.
- 11D: `npm run material:audit` now requires 4-6 documented interaction roles per toolbar material (generated-only outcomes and the Eraser stay at 1-3), and the audit matrix documented the new bar for all 17 toolbar materials of the time. Phase 17 later added Rocket and Wellspring under the same bar, so the matrix covers 19 today.

The bar this phase established: a "special interaction" is a distinct, player-visible sim reaction with another material or state. Movement style alone does not count, and a shared flag treatment counts once, not once per flag. Elements that fall below 4 interactions get combined, demoted to generated-only, or removed instead of padded; `docs/MATERIAL_AUDIT.md` is the enforcement point.

## Phase 13: Element Color Uniqueness

Status: first pass complete; enforcement live.

`scripts/material-contrast.mjs` ranks every material pair by palette distance so uniqueness work is measured instead of eyeballed. The first report found the cool pale family badly clustered: stardust and moonwater sat at distance 19 (near-identical), glass and ice at 25, and ember char near oil at 42.

Completed:

- Spread the cool family across hue anchors: steam went neutral gray, ice stays the cyan-blue anchor, glass shifted green-teal, moonwater kept silver-lavender, and stardust deepened to violet with gold flecks. Ember char warmed away from oil's green slick, and seed leaned greener away from wood.
- The closest pair rose from 19 to 49, and `npm run material:contrast` now gates `npm run check` with a distance floor of 45 so palettes cannot silently drift back together.

Remaining review target when taste says so: Ember vs Oil darks, still the closest pair at 49, relying on motion, glow, and shape to separate — which currently reads fine in play. (Fungus vs Stardust was on this list at distance 53; later palette work pushed it to 92, so it is no longer a concern. Re-run `npm run material:contrast` before trusting any number here.)

Follow-up from live testing: palettes alone were not enough for stardust vs moonwater because both bloomed nearly identical lavender glow halos. Stardust now glows warm gold starlight (glow, twinkle, and air sparkle all lean gold over violet) while moonwater glows cool silver-blue moonlight.

## Phase 14: Living Touches

Status: complete.

Interactions grounded in real life or cozy invention, each with a visible or audible moment:

- Dew: freshly watered moss beads with bright dew glints and plays a soft double-plink cue; soil joins the cue when it first turns wet.
- Rain rinse: flowing water gradually washes soot and scorch marks off wall and stone.
- Petrichor: the first water landing on long-dry soil breathes out a single moist wisp.
- Dew drip: saturated moss hanging over open air sheds occasional droplets that spend its stored water, so drips are self-limiting.
- Frost ferns: frozen wall, stone, sand, soil, and wood grow branching frost veins instead of a flat cold tint.
- Moon blessing: moonwater-fed cosmic moss glows softly from its tips through a flag-aware glow path.
- Ember pop: the air above hot embers flickers with occasional golden spark pixels.
- Charcoal ink: running water crumbles cold char away while picking up a sooty murk, and only hot embers hiss steam.
- Glass chime: meteor impact shatters existing glass back to sand with a bright chime, closing the sand-glass-sand loop.
- Pollen drift: mature, healthy flowers spend energy releasing rare golden pollen motes that drift, settle, and can take root as seeds on damp soil, letting a tended garden slowly spread on its own.
- Boiling: water's stored energy is temperature. Sustained flame simmers it (warm bubbling visuals, steam wisps that cool it back), then boils it away to steam; hot water melts ice and resists freezing; lava and meteor keep their instant flash; moonwater never boils. A state, not a new toolbar element.
- Polish pass: exposed lava crusts into stone edge-inward so nothing stays molten forever, oil surfaces carry an iridescent sheen, fungus decays at twice the old pace and shifted pink-magenta away from stardust, and steam fogs glass panes.

## Phase 15: Geology

Status: complete.

Completed:

The headline cycle this phase closed: wall weathers into stone (freeze-thaw), stone erodes into sand, sand fuses into glass under heat, glass shatters back to sand under impact. Every mineral is a stage in one loop the player can push in either direction with water, cold, and heat.

- 15A: stone fully saturated by touching water now erodes rarely into wet sand that keeps the stone's variant, with per-water-neighbor rolls so heavier flow wears faster. Damp stone without water contact never erodes and sealed wall is exempt, both pinned by sim tests, and erosion plays a soft grinding cue.
- 15B: larger stone masses carry rare clustered mineral vein glints, so cliffs read as strata instead of uniform gray; single pebbles stay plain.
- 15C: walls age visibly through the cell age field: mortar darkens, faces stain, and corners chip on long-standing builds.

## Phase 16: Watering Payoff

Status: complete.

Watering the garden now answers back at every step of the growth arc:

- Seeds join the dew cue when they first turn wet, play a soft sprout cue at the moment they root, and show a visible germination arc: the shoot climbs and pales toward a bud as the seed feeds toward bloom, so progress reads before the flower pops.
- Well-watered moss (energy above 150) colonizes two patches per pass instead of one, so a generous watering visibly surges the carpet outward while modest watering keeps the old patient pace, pinned by a sim test.
- Real stalked plants: rooted, fed seeds germinate into a generated-only Stem that climbs upward cell by cell (height varies per seed, taller with cosmic feeding) and blooms a flower at its tip, so gardens become stands of flowers at different heights that reseed themselves through pollen. Unsupported stalk segments fall, so cut plants collapse; stems burn, freeze, and scorch like living growth. Mature damp moss raises tiny sporophyte tufts, keeping its carpet identity while reading plant-like up close.
- Sandbox-classic feel, learned from the game that inspired this project: paint strokes interpolate into continuous lines, powders and liquids sprinkle as grains while solids paint dense, and a quarter of expiring steam condenses back into falling droplets.

## Phase 17: Rocket and Wellspring

Status: complete. Cozy translations of the two classic sandbox elements the project's inspiration is loved for: the rocket and the cloner. Both shipped as toolbar elements in the cosmic family carrying the 4-role audit bar.

### Phase 17B: Rocket (the firework powder) — shipped first

- Inert crimson powder with paper flecks that falls and piles calmly, so charges and fuse lines can be laid without accidents.
- Any flame (fire, lava, hot ember, meteor) lights a grain's fuse instead of burning it: the lit grain climbs skyward with sway and a smoke trail, rendered as a bright firework head.
- Bursts at fuse end or against a ceiling into a real firework: a multicolor shell of generated-only Spark cells (direction stored in the variant) that fly outward, droop with gravity, twinkle in gold/rose/mint/sky/magenta, cast warm light, and fade — occasionally leaving a stardust glint. Sparks landing on rocket powder light its fuse, so bursts chain-light piles grain by grain. The burst center stays stardust, keeping the impact-burst cue.

### Phase 17A: Wellspring (the cozy cloner)

- A rune-carved block that drinks the identity of the first source material to touch it (consuming that cell, with a cosmic-charge chime) and stores it in the energy field as a material id.
- Three rune states, separated by BRIGHTNESS rather than hue, because attunement already
  borrows every material's colour. Attuned runes glow with the remembered material; dormant
  runes are flat pewter, deliberately desaturated rather than silver so an unlit block cannot
  be mistaken for the palest attunement; and a spring held under ice goes dark under frost
  pips, which is Phase 19's answer to the state below being invisible (see `VISUAL_PIPELINE.md`
  for the measurements).
- Gently pours the remembered material from open faces forever (rare per-tick chance per face), so eternal waterfalls, everlasting hearths, and meteor-shower windows are one-block scenes. Sources: sand, water, soil, fire, lava, oil, seed, stardust, meteor, moonwater, rocket.
- Nearby ice stills the spring — and reopens its drinking branch, so a chilled spring re-drinks whatever touches it next (Phase 18). Attunement is re-teachable rather than a permanent first-touch commitment. Eraser clears it like anything else.

## Phase 12: Heat Identity + Discovery Moments

Status: 12A and 12B complete; 12C shipped, then removed after play testing; 12D and 12E shipped 2026-08.

Completed:

- 12A: fire, lava, and meteor have separate renderers and split palettes: hot yellow-white airy fire with tongue silhouettes, deep basalt lava with crusted glowing seams and a slow pulse, and a white-hot meteor head with a trail shimmer. Moonwater shifted silver-lavender, and the showcase gained a side-by-side heat lineup.
- 12B: the post-tick reaction detector grew six transformation cues (vitrify ting, starfire shimmer, ember-glow catch, quench sizzle, crumble rubble, frost tick) alongside the original five, each with its own cooldown and priority. Fresh flowers and fresh glass flash bright for their first ticks so blooms and vitrification pop visually as well.
- 12C: a discovery journal shipped (14 first-time interaction moments with toasts, a journal drawer, timestamps, and postcard stamps) and was removed after play testing: it added UI weight without earning its place in the toy. The post-tick transition detector it shared with audio reactions stays. If celebration returns, it should go through 12B's sound and renderer moments instead of more UI.

Goal: make every element recognizable at a glance, starting with the heat family, then turn the interaction web itself into visible, celebrated gameplay.

### Phase 12A: Heat Family Visual Split

Fire, lava, and meteor currently share one `heatColor` renderer path and neighboring orange palettes, so the two most-painted heat materials read as the same thing.

- Fire reads as burning air: flame-tongue silhouettes on top edges, a white-yellow core while young, stronger flicker, and more transparency toward the backdrop. Light, vertical, bodiless.
- Lava reads as molten rock: exposed surface cells grow a dark basalt crust with bright cracking seams, the interior stays deep red-black with a slow pulse, and flowing edges get a heavy meniscus. Dark, horizontal, weighty.
- Meteor reads as a streak: bright head plus a short shimmering trail while falling, so impacts feel aimed rather than dropped.
- Ember stays the family's settled state: charcoal body with a breathing glow (already distinct).
- Similar-element watchlist handled in the same pass: Ice vs Glass (frosted facets vs smooth specular pane), Water vs Moonwater (push moonwater silver-lavender), Seed vs Moss greens.
- The deterministic showcase gains a heat-family lineup so fire, lava, ember, and meteor are captured side by side in visual QA.

### Phase 12B: Transformation Moments

Interactions should pop at the instant they happen instead of quietly swapping pixels.

- One-shot renderer flashes (3-6 ticks, keyed off young cell age after a kind transition) for vitrify, starfire, quench, wall crumble, bloom, and moonwater oil-cleaning.
- Matching sparse native audio cues through the existing post-tick reaction detector: glass ting, quench hiss, starfire chime, crumble grumble, bloom note. Audio stays optional, throttled, and recorded/generated-cue based per the Phase 8 guardrails.

### Phase 12D: Room Weather Play — shipped

- An "open window" toggle (`app/src/weather.ts`) lets the backdrop weather lean into the tray as real cells: drizzle in Rain Desk, snow settling in Snow Window, rare meteors over Stardust Hearth, moon-drips in the Moonlit Garden, the odd falling seed by the Forest Hut. The Cozy Fireplace stays indoors on purpose.
- Shipped ON by default, revisiting the original off-by-default plan: an opt-in ambience feature does not drive return visits, and the rates are a whisper. Every drop type carries a cell-count ceiling so an open window left overnight reaches a drizzly equilibrium instead of flooding the toy. The toggle persists, and shut means shut.
- Tonight's sky is seeded by the local date, so each day has its own temperament per room with no server involved — the daily-visit rhythm the album club already lives by.

### Phase 12E: The Slow World — shipped

The return-visit mechanic, separated from the weather it had been confused with. Weather is
ambience; what makes a terrarium worth coming back to is that it changed while you were
gone. Ticks could not express that — catch-up saturates after ~66 minutes, and a ten-minute
session runs four times more ticks than any absence can buy — so absence got its own unit.

- `Universe::slow_step` (mirrored in `engine.ts`, parity-gated) runs only at wake, on a
  count derived from hours away: 1h earns 4 steps, a day 18, capped at 24. Two rules so
  far — cold char that is not under water settles into fresh soil, and a spent seed head sows a seed
  clear of its own shadow, displacing the one patch of moss it lands on so the grain can
  actually root.
- Slow steps run **before** the tick catch-up, so the sim plays the new conditions forward
  and the player arrives to a garden rather than to a diff.
- `npm run slow-world:audit` is the gate, because every other sim check passes happily on a
  correct-and-invisible rule. Measured on a watered garden beside a burned-out hearth: a day
  away visibly changes 127 cells at median contrast 283 (against 77 for an hour) and grows
  the garden into 9 columns it did not stand in before. A scene with nothing alive in it
  comes back byte-identical. (Those figures are post-Phase-19; before the wake learned to
  stop on an open bloom they were 105 and 267 — fewer visible cells for MORE ticks spent,
  because the change was water sloshing rather than flowers.)
- Rain Desk and Snow Window were cut back in the same change — one drop every 7.6s and 9.4s
  respectively, from 1.8s and 2.8s, with their cell caps cut to 2% and 1.5%. They had been
  an order of magnitude busier than every other room, which read as constant weather rather
  than weather, and confused ambience with the growth mechanic above.

## Phase 18: Living-World Batch (design-feedback pass)

Status: complete.

A roster-wide design review (interaction depth, visual identity, uniqueness, combos)
produced 12 owner-approved items, shipped in five gated commits. The full batch record — specs,
measurements, fixture fallout — was `docs/PHASE_18_HANDOFF.md`, retired on 2026-09-27 once
everything still live in it had moved into `CLAUDE.md` and `docs/`; `git show 7b6c76c:docs/PHASE_18_HANDOFF.md`
recovers it.

- Batch 1 (garden lineage) — `fbaafae`: revived the dead pollen loop; cosmic flowers breed
  cosmic pollen into cosmic seeds so moonlit gardens breed true.
- Batch 2 (terrarium & hearth) — `e5cfebe`: glass dew re-waters a sealed terrarium; hearth
  walls dry and thaw their nook beside a flame; sparks hiss to steam over water.
- Batch 3 (geology) — `a95168c`: unsupported stone falls while wall never moves, settling
  the Wall/Stone overlap and making erosion, crust, and meteor-stone visible drama;
  freeze-thaw crumble retuned 200→150 with spatially coherent fracture veins.
- Batch 4 (cycles & rituals) — `d5d8f37`: wellspring re-attunement via ice; fairy-ring
  cosmic fungus; fungus→soil collapse; meteor spark trail; ember doc-honesty note.
- Batch 5 (visual lens, renderer only) — `7ebb3be` and `05c2b30`: state-gated glows reach
  the glow layer (attuned wellspring, lit rocket, vitrify flash, etched stone), steam stops
  out-glowing its own flame, the wellspring reads as carved at night, and glass became a
  see-through pane with a beaded, streaked condensation field instead of a grey wash.

The most valuable finding of the phase was not a material rule: `saveSandboxComposite` in
`scripts/visual-qa.mjs` had been drawing the glow layer *underneath* the opaque base canvas,
so every visual-QA capture reviewed the night lights as though they did not exist. Four of
batch 5's five findings had survived earlier review passes for that reason alone.

## Phase 19: Knowing What Production Is Doing

Status: complete.

The phase started as a routine live check and turned into the discovery that this project
could not answer its most basic deployment question. A browser check — the one that plants a
garden through the tray and asserts a bloom opens — passed locally on every run and failed
against `pixelfun.littlealbumclub.net`. Before the real cause could be looked for, "is the
deployed binary even the same code" had to be answered by hand, by downloading the wasm and
running a scenario through it, because the app carried no build identity at all.

- **Build identity.** Vite stamps `__COZY_COMMIT__` from `COZY_COMMIT`; the Dockerfile feeds
  it Railway's `RAILWAY_GIT_COMMIT_SHA` through `ARG`, which is the only way a Dockerfile
  sees a build variable; the app carries it as `data-cozy-commit`. `npm run deploy:verify`
  reads it back and checks four things, each a way a deploy is wrong while looking normal:
  the page boots and reports a commit, that commit is the expected one, the wasm arrives as
  `application/wasm`, and the app is on the wasm engine rather than the JS fallback. A build
  with no commit stamps `dev`, which the gate fails on. `npm run qa:live` is that plus
  browser and visual QA against the deployment.
- **The check was at fault, not the code.** Painting is a sprinkle — `PAINT_DENSITY` leaves
  powders at 55 — so every stroke draws on engine RNG, and how far that RNG has advanced
  depends on how many ticks ran before the click landed. The same five clicks laid 138 soil
  and 26 seed locally against 107 and 35 live, which grew a different number of plants. On
  top of that the target was transient: 14 flower cells at peak, 1 nine seconds later. The
  fixture now plants a bed rather than a plot, and was certified on five consecutive runs
  against each of local and production rather than one lucky run.
- **You arrive in flower.** `catchUpTicks` saturates at 4,000 and a bloom runs about that
  same length end to end, so any absence over an hour spent the whole flowering inside an
  invisible fast-forward whose first 3,400 ticks run 250 to a frame. A player back after two
  days found two or three Flower cells — spent crowns, which read as sticks. The wake now
  stops once a head opens and plays a 600-tick tail on screen. Measured live, a day away
  arrives at 21-36 flower cells with an open crown, against 2-3 before.
- **Hearth warmth became real conduction.** A wall beside a flame dried exactly one cell,
  because only ever one brick touched both the flame and the damp. Warmth now conducts one
  brick along the stonework; thawing still needs contact, since giving it the same reach
  melted the ice around every wall near a flame.
- An adversarial review of the whole phase filed five findings and every one was real,
  including that "carries along the masonry" had been implemented as a 5x5 proximity scan,
  and that a bloom the player *left* open cancelled their next absence on its first chunk.

- **A design pass over the roster, both lenses.** Three findings, each measured on rendered
  pixels rather than palettes, because `material:contrast` averages a whole material and
  cannot see inside one. Moss and fungus were the same fabric — luminance 176 +/- 31 against
  169 +/- 31 with an identical cell-to-cell step of 33, so with colour removed there was no
  boundary between them and a fungus overtaking a carpet read as a recolour; fungus caps now
  cluster on a half-resolution hash (step 27). Three of the eight flower species were blue,
  sitting 77/107/126 apart while every other pairing was 168+; the bluebell went deep and the
  forget-me-not became a magenta **cosmos**, lifting the worst pair to 140. And a spring held
  under ice — the least discoverable rule in the game at ~57 seconds of setup for a
  1.9-second event (audit ticks read at 60 a second, where the app runs about 20; and
  docs/MATERIAL_AUDIT.md has the real cost, two gestures) — now shows a third rune state.
- **The skills live in the repo now.** `/adversarial-review` and `/design-review` sit
  complete under `.claude/skills/`, including the `brain/` principles the reviewer text
  depends on. Two copies of the first one had been drifting 175 lines apart, and the tracked
  one — better tailored to this repo — had never executed once while `AGENTS.md` described it
  as the reviewer this project spawns. One copy, backed up by the same push that ships the
  game.

## Between 19 and 20: September design passes

Status: complete. Each pass was measured through the real renderer or engine, gated in
`npm run renderer:probe`, `interaction:audit` or `slow-world:audit`, and closed with an
adversarial review whose findings were fixed before moving on.

- **Meteor reads as a cold rock in a warm halo** (`c470970`, review fixes `4b7b963`). It had
  rendered a median 53 redmean from the fire its own impact makes. A hot leading face added
  in the same pass regressed the meteor/spark pair to 29 and was removed; the gate now sweeps
  position, variant, flight medium and mass geometry. See VISUAL_PIPELINE, Meteor.
- **Soil beds horizontally** so it stops sharing wood's diagonal fabric (`6d23702`), with the
  fabric gate moved to a 72x40 board once the 26x14 one proved to overstate it (`63c0c96`).
- **Railway config as code** (`3e7ca01`): `railway.json` replaced by `.railway/railway.ts`,
  which does NOT apply itself — `npm run config:drift` says whether it is live. See EMBEDDING.
- **The rock cycle closes: sandstone** (`c75b426`, review fixes `2647d51`). A flooded sand bed
  compacts into bedded stone while you are away; a stone lid is construction and protects the
  sand under it; the colour gate scores touching cells, not field means. A rain-filled
  sand basin turning to rock is geology, by the owner's decision (`dbbbe44`).
- **Things sink** (`ffd5227`): grains settle through water and oil, which is what made a
  poured lake bed — and so sandstone — reachable at all. A grain never deletes a liquid.
- A debt pass after the first four (`3885005`) and a docs dedupe (`6cb94ce`).

## Phase 20: The Water Budget

Status: done — 20A, 20B, the triage of what 20B moved, 20D and 20E (20B absorbed what the
plan called 20C). What the clobber still does is listed, class by class, in docs/HARNESS.md. The working plan is `docs/HANDOFF.md`.

**No rule in the sim decides how much water a scene holds.** The move clobber does: a mover
may overwrite a cell another mover filled earlier the same tick, and when water flows into
water that deletes it. Measured across all 124 interaction-audit scenes, liquid deleting
liquid is 82% of every overwrite. So ponds keep their water, a pour loses 16%, and a
fountain loses nearly everything — which is also the ONLY thing bounding a water wellspring
(about 280 cells on the 220x140 board, against 8,837 once water stops deleting itself;
nothing in the game drinks standing water). And it explains the old "garden dies" result:
with the clobber closed, cold char still turns to soil, and the surviving water greens all
of it into moss, where nothing roots.

The goal is to replace that accident with a deliberate, visible water cycle, then let water
be conserved in movement. Two decisions from the owner shape it: **the sink is VISIBLE mist**,
not a silent delete; and **no cheap fixes** — every change has to be meaningful on its own
and must not create problems later, so nothing opportunistic rides along with a step.

- **20A — instruments. Done.** `npm run audit:drift` replays every audit scene over N seeds
  on two builds and reports only moves the seed spread cannot explain (against the commit
  before sinking: 5 of 124, where the one-seed table said 26). `npm run clobber:census`
  counts every overwrite by mover, victim and origin. `npm run water:budget` measures a
  spring, a pour, and sand poured into a pond on the shipped build. The eight harnesses that
  compiled the app's TypeScript share `scripts/compile-app.mjs`, and the audit's scenes are
  a shared module so all three tools measure the same scenes. Starting numbers: spring 0.9%
  of the board, pour 600 of 716 kept, pond 207 of 392 kept after sand sinks through it.
- **20B — moving water throws mist, and liquids stop deleting liquids. Done.** Three
  decisions from the owner shaped it: **lakes are a feature** (a spring settles into a real
  pond, ~7% of the board, that stops growing), **puddles dry** (a puddle on open ground
  evaporates in 15-30 s (ticks read at 60 a second; the app runs about 20, so in play it is
  roughly twenty seconds to two minutes — corrected 2026-09-29) while a pond that fills its basin keeps every drop — one knob sets
  both, and 1-in-450 keeps a pour close to today's 84% — 82%, once mist stopped raining back), and the mist stays visible, which an
  interaction-audit check now enforces.

  Two plan assumptions were wrong, and measurement caught both. Mist could not ship before
  conservation: on its own it is a second drain (a spring fell from 0.9% to 0.4%), so 20B
  took what the plan had filed as 20C. And spray from the air alone does not bound a spring,
  which pours through its own pool; "moving water throws mist" does, and it is also the
  faithful replacement, because the clobber only ever deleted moving water.

  The wetter world broke what leaned on vanishing water, and each break was taken to a cause
  and retuned in its own commit on eight seeds: erosion fixtures resized to the board a
  spring's lake needs; only moonwater-charged moss takes a wall (plain moss beside a pond was
  eating walls — and had been eating the audit's own scaffolding all along); soot rinse and
  char wash need running water, and condensation no longer scrubs soot; three audit scenes
  and two parity scenarios re-staged or re-witnessed; the steam field note needs heat. Against
  `main`, the multi-seed drift before those retunes read 25 checks better, 15 worse, 15 mixed.
  Numbers now: spring 7.1%, oil spring 1.2% (unchanged), pour 82% kept, pond after sand 94% (was 53%), liquid-on-liquid
  overwrites 0 (was 29,424 across the audit scenes).
- **Triage of what 20B moved. Done — no regressions.** `audit:drift` against `8dc123b` flagged
  17 checks as worse. Each was taken to a cause by classifying every outcome cell by what the
  scene painted there and where it sits against the audit's Wall floor, then re-run on 32
  seeds. They fall into four groups, and none is a player-visible loss:
  - **Dice (10).** At 32 seeds `fire.softens`, `ice.melts`, `fire.dries`, `moss.dries`,
    `flower.wilts`, `pollen.drifts`, `wood.feeds`, `fungus.rots`, `stem.burns` and
    `ember.quenched`'s cell count stop moving. `wood.feeds` is the clean example: its bite has
    no wetness gate at all, and the per-seed first ticks were {2,4,10,14,17,25,34,78} against
    {6,16,27,29,30,32,47,77} — two draws of one geometric wait. Eight seeds can separate the
    middle halves of a distribution that wide by chance.
  - **Scaffold (5).** `seed.settles`, `soil.feeds`, `fungus.cosmic`, `fungus.overtakes` and
    `moss.overtaken` were counting the audit's own Wall floor, which plain moss ate before 20B.
    On the cells each rule acts on they are flat: seeds 8 -> 8, soil 28 -> 28, cosmic fungus
    15 -> 15, moss overtaken on the painted mat 284 -> 256 over eight seeds. The overtake
    drop looked real beyond the walls and was not: 219 of its 269 extra cells lay BELOW the
    floor, reached only once moss had breached it, and the ~4 mat cells per seed fungus no
    longer takes are islands touching nothing but Wall and air — fungus used to reach them
    across moss growing on the floor. Re-watering the scene does not restore the old
    numbers, which rules out the drier-world hypothesis the handoff started from.
  - **Witness changed (1) — and this one was wrong, found later.** `water.boils` now counts
    only steam hotter than mist, by design, and the drop was filed as that alone. It was half
    of it: the water above the pan had been landing on the steam it boiled, and closing that
    in 20E took the check back to its pre-20B contrast (115 -> 423). A witness change can hide
    a real loss behind a legitimate one; measure what the new witness sees before accepting it.
  - **Better, measured as worse (1).** `stone.blocks` contrast 391 -> 337 because the basin
    holds 12 cells instead of 8 — a deeper pool has more shadowed body than lit rim.

  Two gains the 8-seed table hid: `ember.quenched` is on screen **18 ticks -> the whole
  scene** at 32 seeds (a quenched hearth now stays under a still pond; 18 was under the
  audit's own 30-tick floor, so the base had been passing on one lucky seed), and
  `fungus.cosmic` contrast rose 87 -> 90. `ice.melts` deserves one sentence: that scene's
  fire melts only 1-4 cells of the block in either build, so what moved was how long a
  two-cell drip lingers, which is the owner's "puddles dry". The melt being that small
  predates 20B.

  Two things the handoff asked to watch were measured afterwards, and both hold. **Plants
  watered once are not shorter** at player scale: a Wall planter on the 220x140 board at the
  default brush, seeded in a row and given one pass of water, grows 12-16 plants with a
  median stalk of 4 before and after 20B, tallest (7) on 8 of 107 before and 15 of 114 now,
  and 98 peak flower cells against 83. The shortfall recorded at `stem.climbs` is a property
  of that small scene's pour. What the planter does show predates 20B and is unchanged by
  it: one watering leaves most plants at the minimum stalk and 58% of them leafless in both
  builds. **The slow-world garden still grows 18 new columns** in a day.
- **20D — a gas never deletes a gas. Done.** Smoke deleting smoke was 37% of the overwrites
  left after 20B, and gases were the one class that needed no new sink: smoke and steam
  already expire by age. Measured on the 220x140 board over eight seeds, against the build
  before it:

  | scene | smoke peak | smoke mean | steam peak |
  | --- | --- | --- | --- |
  | an open log pile | 368 -> 391 | 23 -> 28 | — |
  | a lidded hearth | **146 -> 264** | 10 -> 19 | — |
  | a fire under a pan | 54 -> 108 | 4 -> 8 | 5 -> 5 |
  | water poured on lava | — | — | 130 -> 137 |

  Open fires barely change, because smoke disperses before it can collide; a confined fire
  roughly doubles its smoke, which pools under the lid as a ceiling layer rather than fogging
  the box. **The owner kept it as-is** over shortening smoke's lifetime or reverting, having
  seen the two hearths side by side. How long smoke stays on screen is set by the fire and did
  not move. The water budget is identical to the last digit — a spring's mist is too sparse to
  meet another gas — but the census's steam-over-water class doubled (615 -> 1,343), since
  mist that other gas used to delete now lives to meet water. That is 20E's to close.
- **20E — the rest of the clobber. In progress.**
  - **A gas never deletes water. Done.** Steam rising into water that had just flowed into its
    path — the last leak of the old water sink — was 615 overwrites after 20B and 1,343 after
    20D, since mist that other gas used to delete then lived to meet water. It is 0 now, the
    census falls from 4,970 to 3,058, and the spring holds the accepted ~7% (7.4% at 4,000
    ticks, 6.8% at 16,000; pour and pond unchanged). No audit check moves at 32 seeds.
  - **Water never deletes a gas that arrived this tick. Done.** Steam a reaction had just
    vented into an empty cell was overwritten by the water falling into it (1,836). Water may
    still sink through gas that sat there all tick, so a vent never becomes a lid. The census
    falls to 942 with nothing left between water and gas. Where steam is boiled off water it is
    far more visible — `water.boils` contrast 115 -> 423 on 32 seeds, its pre-20B value, which
    corrects the triage: that drop was only partly a changed witness. Where water is poured on
    lava there is less steam (peak 144 -> 71), because falling water waits a tick above a fresh
    vent and fewer cells boil away; rendered, the two pours are nearly indistinguishable. The
    water budget is unchanged.
  - **A mote never deletes water. Done.** Pollen and stardust float instead of sinking, so a
    mote landing on water that had just flowed into its path overwrote it: 109 pollen over
    water, 86 stardust over moonwater. Both are 0; the water budget is identical and at 32
    seeds only gains move. The census closes at 787 overwrites of 3.6 million moves. The
    slow-world headline moved and is worth reading correctly: every absence now changes more
    cells (an hour 83 -> 127, a day 150 -> 175), but the garden did not — a day still opens 47
    flower and 14 stem cells, turns 40 char to moss and grows 18 new columns. The extra is
    WATER sitting somewhere else (empty -> water 29 -> 41), since pollen no longer deletes it;
    "cells changed" counts water that moved as change. The hour is not itemised by the audit,
    so its +44 is attributed by analogy, not measured.
  - **Everything else is documented as intended**, by the owner's decision, in
    docs/HARNESS.md ("The move clobber, and what is left of it"): a material over itself
    (the grain-over-grain guard was rejected earlier as a cheap fix), water winning over a mote
    or grain, firework debris, and 19 oil/lava-over-water overwrites left because oil has no
    sink.

Each step is one commit, closed with the full gate, a live deploy check, and an adversarial
review.

### After Phase 20: bubbles

Status: done. `audit:drift --per-seed` found `water.boils` passing on 20 seeds of 32: steam made
under water was deleted by the water sinking into it (`can_sink_through_gas`), so boiled steam
mostly never surfaced. Gas hotter than mist now trades places with whatever sinks into it, and
boiling steam surfaces on every seed (32/32). Mist is excluded because bubbling it flooded a
spring from 7.2% of the board to 29.5%; with the exclusion the water budget is unchanged.
`lava.scorches` falls 32 -> 29 of 32, explained in docs/HARNESS.md ("Bubbles").
