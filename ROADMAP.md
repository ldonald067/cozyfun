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
- `.\scripts\audio-qa.ps1` renders deterministic WAV references for native ambience listening review.
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
- `.\scripts\audio-qa.ps1` now renders deterministic per-room ambience references.

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

Status: 11A complete; 11B in progress.

Goal: every toolbar element earns its slot with at least 4 special interactions, each landing with a distinct visible moment. Elements that stay too similar get combined or removed instead of padded.

A "special interaction" is a distinct, player-visible sim reaction with another material or state. Movement style alone does not count, and a shared flag treatment (generic wet/frozen/scorched tinting) counts once, not once per flag.

Current interaction counts from `sim/src/lib.rs`:

| Passes the bar (4+) | Count | Below the bar | Count |
| --- | --- | --- | --- |
| Water | 8 | Wood | 3 |
| Seed | 6 | Wall | 3 |
| Ice, Fire, Moonwater, Oil | 5 | Steam | 2 |
| Meteor, Moss, Fungus, Soil, Stone, Lava | 4 | Sand | 2 |
| | | Stardust | 2 |
| | | Smoke | 1 |

### Phase 11A: Combine/Remove Pass

- Demote Smoke and Steam from the toolbar to generated-only vapors, like Flower. All sim rules stay (rise/fade, soot, condensation, frost); players keep creating them through fire and water play, they just stop being paint choices with near-identical movement and 1-2 interactions each. Toolbar goes 19 to 17.
  - Fallback option if painting vapor turns out to be missed: one combined "Vapor" toolbar entry that paints steam.
- Wall stays for now as the deliberate construction material, on the condition that Phase 11B gives it real weathering. If it still reads as "stone minus interactions" afterward, the existing removal trigger in `docs/MATERIAL_AUDIT.md` fires.

### Phase 11B: New Interactions To Reach the Bar

One material per atomic pass, each with Rust + JS fallback parity, tests, and a showcase update:

- Sand: strong heat (lava, meteor, dense fire) vitrifies sand into Glass, a new generated-only material with translucent pane rendering and heat-shimmer edges. Sand then holds: wet clumping, drying, vitrify, frost. Glass stays out of the toolbar.
- Stardust: fire contact becomes a starfire flare that transmutes the fire cell into a brief harmless sparkle burst (cosmic fire suppression); resting stardust etches constellation glitter veins onto stone and wall via the cosmic flag. Stardust then holds: charge water to moonwater, energize life/soil/fungus, starfire, etching.
- Wall: freeze-thaw weathering. A frozen wall cell that later thaws near heat gains crack stages and can eventually crumble into stone, so sealed construction has a slow natural decay arc. Wall then holds: sealed blocking, soot staining, freeze-thaw crumble, moss resistance.
- Wood: burned wood leaves glowing Ember cells that cool through char instead of vanishing, giving fire an afterglow state. Wood then holds: the wet, dry, char, ember arc; steam venting; moss host; fungus food.

### Phase 11C: Visual Payoff Pass

- No interaction ships without its visible moment: each 11B rule lands with a renderer cue (transformation flash, texture change, or contact accent) in the same pass as the sim rule.
- State readability audit: capture every toolbar material in wet, frozen, scorched, and cosmic states in the deterministic showcase, and rework any state that reads as only a palette tint.

### Phase 11D: Bar Enforcement

- Raise `npm run material:audit` to require 4 documented interaction roles per toolbar material (generated-only materials exempt) once 11A-11B land.
- Update `docs/MATERIAL_AUDIT.md` with the new matrix, the Smoke/Steam demotion, and the Glass/Ember generated-only entries.

Order: 11A first (smallest diff, immediate toolbar clarity), then 11B one material at a time with 11C riding along, and 11D last so the audit never blocks mid-phase work.
