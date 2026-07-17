# Cozy Pixel Sandbox Roadmap

This roadmap keeps the project focused: make the toy feel good, keep the codebase stable, and add atmosphere without turning the project into a giant platform too early.

## Status Snapshot

Phases 0-7, 9, and 10 are complete; Phase 8 is in progress. The sandbox is a playable browser toy: React/Vite UI, Rust/WASM sim with a JS fallback, 19 toolbar materials plus generated flowers, six credited room backdrops with room-linked native ambience, optional YouTube Desk Radio, local save/share/postcard/clip export, and deterministic sim/browser/visual/audio QA wired into local scripts and CI. Details live in the phase sections below.

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

Status: started.

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
- Native ambience now uses local credited recordings (`rain.mp3`, `cat-purr.mp3`, `fire-crackle.wav`) with generated room tone, fallback layers, and sparse drips.
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
- 11D: `npm run material:audit` now requires 4-6 documented interaction roles per toolbar material (generated-only outcomes and the Eraser stay at 1-3), and the audit matrix documents the new bar for all 17 toolbar materials.

The bar this phase established: a "special interaction" is a distinct, player-visible sim reaction with another material or state. Movement style alone does not count, and a shared flag treatment counts once, not once per flag. Elements that fall below 4 interactions get combined, demoted to generated-only, or removed instead of padded; `docs/MATERIAL_AUDIT.md` is the enforcement point.

## Phase 13: Element Color Uniqueness

Status: first pass complete; enforcement live.

`scripts/material-contrast.mjs` ranks every material pair by palette distance so uniqueness work is measured instead of eyeballed. The first report found the cool pale family badly clustered: stardust and moonwater sat at distance 19 (near-identical), glass and ice at 25, and ember char near oil at 42.

Completed:

- Spread the cool family across hue anchors: steam went neutral gray, ice stays the cyan-blue anchor, glass shifted green-teal, moonwater kept silver-lavender, and stardust deepened to violet with gold flecks. Ember char warmed away from oil's green slick, and seed leaned greener away from wood.
- The closest pair rose from 19 to 49, and `npm run material:contrast` now gates `npm run check` with a distance floor of 45 so palettes cannot silently drift back together.

Remaining review targets when taste says so: Fungus vs Stardust purples (53) and Ember vs Oil darks (49) both rely on motion, glow, and shape to separate, which currently reads fine in play.

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

Status: planned.

Stone and wall are the only reactive-only toolbar elements: everything happens to them and nothing happens because of them. This phase gives the mineral family one circular story instead of bolted-on behaviors.

The headline cycle: wall weathers into stone (freeze-thaw, shipped), stone erodes into sand (new), sand fuses into glass under heat (shipped), glass shatters back to sand under impact (shipped). Every mineral becomes a stage in one loop the player can push in either direction with water, cold, and heat.

### Phase 15A: Water Erosion

- Stone that stays fully saturated by moving water very slowly wears into sand. The wear accumulator is stone's existing stored dampness: only sustained soaking near the energy cap qualifies, with a rare per-tick chance tuned so erosion takes minutes of continuous flow.
- Guardrails: standing dampness alone never erodes (buildings beside ponds are safe), wall is exempt entirely (sealed construction; its decay stays freeze-thaw), and eroded sand inherits the stone's variant so a worn cliff sheds matching grains.
- A soft audio cue and the existing sand-fall motion carry the moment; no new UI.

### Phase 15B: Mineral Veins

- Renderer-only: rare hash-clustered glinting veins run through larger stone masses, so cliffs and caves read as rock strata instead of uniform gray. Natural veins sit beside the cosmic etching marks without competing with them.

### Phase 15C: Wall Patina

- Renderer-only: bricks age visibly using the cell age field: mortar darkens, corners chip, and long-standing walls read as lived-in. Pairs with damp moss crossings for abandoned-garden-wall scenes.

Order: 15A first since it completes the cycle and is the only sim change, then 15B and 15C as one visual pass.

## Phase 12: Heat Identity + Discovery Moments

Status: 12A and 12B complete; 12C shipped, then removed after play testing; 12D open.

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

### Phase 12C: Discovery Journal

The sandbox now has dozens of distinct interactions, but nothing tells the player the web exists. Make discovering it the game.

- A local discoveries list (localStorage, no accounts, no backend): first time a session triggers vitrify, starfire, char relight, freeze-thaw crumble, flower bloom, moss-on-stone, fungus takeover, moonwater cleaning, meteor stardust burst, or steam frost, it lights up.
- A quiet toast plus journal entry on first trigger; postcards can carry a discovery-count stamp.
- Reuses the same post-tick transition detector as audio reactions, so simulation rules stay untouched.

### Phase 12D: Room Weather Play

- An optional, off-by-default "open window" toggle lets the backdrop weather lean into the tray: light rain drizzle in Rain Desk, snow specks in Snow Window, rare meteor streaks in Stardust Hearth.
- Strictly opt-in so room backdrops stay non-destructive; painting remains the core verb.

Order: 12A first (it answers the live-session feedback directly), 12B alongside it since flashes reuse the same transition detection, 12C as the headline gameplay feature, and 12D last as the atmosphere bonus.
