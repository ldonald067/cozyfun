# Cozy Pixel Sandbox Roadmap

This roadmap keeps the project focused: make the toy feel good, keep the codebase stable, and add atmosphere without turning the project into a giant platform too early.

## Done So Far

- Playable browser sandbox with React/Vite UI and Rust/WASM simulation.
- JavaScript fallback engine for local resilience while developing.
- 18 V0 materials, including cozy/cosmic materials: Stardust, Meteor, and Moonwater.
- Manual painting, brush size, pause/play, clear, local save/load, JSON export/import, and postcard export.
- Soft reaction style: fire/water becomes glowing steam, lava cools near water, fire burns flammables over time.
- Procedural Web Audio foundation with master, ambience, music, and effects channels.
- Audio code split into reusable modules for mixer, preferences, ambience, music, effects, buffers, and controller lifecycle.
- Sound moods added for Rain, Window, and Stardust variations.
- Non-destructive room backdrops added for Rain Desk, Moonlit Garden, and Stardust Hearth.
- Local credited room images added for those backdrops, with procedural lighting and weather still layered on top.
- Painted scene seeds kept as internal QA/dev helpers instead of visible user-facing presets.
- External music provider boundary added with generated music as the default and a planned Desk Radio slot for Phase 5.
- Reaction audio cues added for steam, cooling lava, growth, and cosmic sparkle events.
- Postcard export now includes scene, mood, music source, sim source, and tick context.
- Browser, build, and WASM smoke checks wired into local scripts and GitHub CI.
- Renderer cleanup: canvas orchestration is separate from reusable material color, glow, and shape-language helpers.
- Architecture and visual pipeline docs added under `docs/`.
- MIT license added for simple sharing and remixing.

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

Status: foundation done.

Done:

- Procedural Web Audio foundation with master, ambience, music, and effects channels.
- Optional sound enable flow that respects browser autoplay rules.
- Rainy lo-fi music bed with soft chords, brushed percussion, low thump, and vinyl dust.
- Reusable audio module boundaries for mixer, preferences, ambience, music, effects, buffers, and controller lifecycle.
- Simple sound mood controls for Rain, Window, and Stardust.
- Material paint sounds and basic UI cues.
- Rain/window ambience polish with room hush and occasional window drip accents.
- Reaction sounds beyond paint cues: steam, lava cooling, growth, and cosmic sparkle.
- Sound mood tuning toward rainy lo-fi jazz rather than dramatic ambient pads.
- External music provider foundation:
  - Generated music remains the live provider.
  - Desk Radio appears as a planned provider slot for Phase 5.
  - Preferences already understand provider selection without requiring accounts, API keys, or a backend.
  - Procedural ambience/effects remain native and separate from the music source.
- Softer UI control treatment through reusable segmented controls, focus states, panel scrolling, and compact room controls.
- Better postcard export composition with contextual scene, sound, and simulation metadata.
- Room/backdrop switching that changes atmosphere and audio mood without replacing the sandbox.
- Room photos now load locally from `app/public/rooms` with source tracking in `ASSET_CREDITS.md`.

Remaining before Phase 4:

- Listening pass on real speakers/headphones after more play time.
- Visual pass on the sourced room photos after more play time, replacing any image that feels too literal, muddy, or distracting.
- Small UI polish only if the added controls feel crowded during normal play.

## Phase 4: Sharper Realistic Visuals

Status: planned.

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

## Phase 5: Sharing

Status: planned.

- Shareable exported scene files.
- Better screenshot/postcard workflow.
- Optional GIF or short clip export.
- Optional YouTube desk radio:
  - Add a visible mini-player/drawer for YouTube lo-fi jazz or user-provided playlist links.
  - Use the YouTube IFrame Player API as an external music provider.
  - Keep generated music as the default and fallback.
  - Do not use YouTube search, Data API keys, scraping, hidden playback, or server-side music handling.
  - Make shared scenes preserve the selected music source only when it is safe and user-controlled.
- No accounts or backend unless the product direction clearly needs them.
