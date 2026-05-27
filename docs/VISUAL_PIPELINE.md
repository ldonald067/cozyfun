# Visual Pipeline

The sandbox still renders as a grid of cells, but the grid does not need to look flat. Phase 2 used neighbor-aware color rules to make materials recognizable by texture and silhouette before adding heavier art systems. Phase 4 builds on the same renderer boundary with stronger facets, puffs, heat seams, liquid surfaces, and subtle local light.

## Layers

- Base canvas: crisp pixel data for the simulation.
- Glow canvas: blurred additive-feeling light for fire, lava, steam, stardust, meteor, and moonwater.
- Motes canvas: full-screen room dust and atmosphere, separate from the simulation.

## Cell Rendering

Each frame, `renderer.ts` asks `materialColor.ts` for a color per cell. That color is built in three stages:

1. Palette lookup from `materials.ts`.
2. Broad animation and state treatment, such as fire pulse, water shimmer, smoke fade, or seed sprout tint.
3. Shape-language treatment in `shapeLanguage.ts`, such as ice facets or stone cracks.

## Shape Language

Shape language is intentionally procedural:

- Sand: grain speckles, warmer exposed surfaces, and damp/heat contact tint.
- Soil: darker clumps, roots, organic pockets, and occasional moss/moonwater-adjacent green.
- Seed: chestnut body, darker edges, oval silhouette, sprout flecks, and moonwater-fed highlights.
- Ice: cube facets, bright top-left edges, darker bottom-right edges, and crack pixels.
- Wall: brick-like tile structure with mortar lines and lit exposed edges.
- Stone: chunky block shading, facet shifts, and dark crack marks.
- Smoke/Steam: edge-softened puff clusters with age fade, warm light near fire or lava, and cool cosmic tint near stardust or moonwater.
- Water/Moonwater: connected surface highlights and lower shadow.
- Stardust: bright twinkles, nearby star glints, and a brighter violet treatment near moonwater.
- Fire/Lava/Meteor: heat cores, exposed flame tips, cooling crust, glowing seams, and ember-dark edges.
- Moss/Fungus/Wood: leafy clusters, fungus cap/gill/spore marks, damp moonwater tint, char/damp contact cues, and woodgrain lines.
- Nearby light: hot and cosmic materials can tint adjacent cells without changing simulation state.
- Interaction cues: water near heat brightens toward steam, lava near cool liquids darkens into crust, moonwater near life becomes pearly green-violet, and newly cooled stone picks up a faint wet edge.

Rules can inspect neighboring cells through `cells.ts`, but they should not modify simulation state. Shared edge/contact helpers belong in `cells.ts`; material-specific palette choices stay in `shapeLanguage.ts`.

## When To Add A Rule

Add a shape-language rule when a material cannot be identified quickly from color alone. If palette and glow already communicate the material, keep the rule simple.

Good candidates:

- Silhouette or edge treatment.
- Small internal texture marks.
- Neighbor-aware surface highlights.
- Deterministic shimmer or sparkle.

Avoid:

- Randomness that changes every frame without intention.
- Large per-pixel branches that do not affect readability.
- Simulation behavior hidden inside renderer code.

## Visual QA

For every visual batch:

1. Build the app.
2. Paint a controlled scene with the changed materials side by side.
3. Check that the material reads at normal zoom, not only when inspected closely.
4. Run browser smoke tests.

Temporary visual captures should go in `.tmp/` so they stay out of commits.

Useful commands:

```powershell
.\scripts\build.ps1
.\scripts\visual-qa.ps1
.\scripts\test-browser.ps1
```

## Phase 2 Baseline

The current baseline covers the first readability batch: sand, soil, wall, smoke, steam, seed, ice, stone, water, moonwater, and stardust all have renderer-level shape treatment. More realistic silhouettes, local lighting, and high-detail experiments belong in Phase 4 so Phase 3 can keep moving on atmosphere without destabilizing the simulation.

`.\scripts\visual-qa.ps1` saves a controlled material capture to `.tmp/visual-qa/phase4-materials.png`, responsive layout metrics to `.tmp/visual-qa/phase4-layout.json`, and room backdrop captures for every scene environment.

The room captures are part of the visual QA contract. They should stay calm behind the sandbox and panels: if a photo becomes too busy, literal, or high-contrast, tune the scene metadata in `sceneEnvironments.ts` or replace the asset and update `ASSET_CREDITS.md` in the same change.

## Phase 4 Completion

Phase 4 keeps rendering inside `shapeLanguage.ts` and avoids changing simulation behavior. It adds reusable helpers for exposed edges and nearby light, then applies them to ice, stone, wall, fire, lava, meteor, smoke, steam, water, moonwater, oil, moss, fungus, wood, sand, soil, seed, and stardust.

This is still procedural pixel art, not photorealism. The target is faster material recognition at normal play zoom: ice should feel faceted, lava should read as hot cracked crust, vapor should feel soft and puffy, and liquids should have connected surfaces.

The completion pass expands visual interaction language. These cues are renderer-only: they describe contact between materials without adding new simulation state. Use this for gentle, readable feedback; keep actual chemistry and movement rules in Rust/engine code.

Phase 4 is closed when build, browser smoke, WASM smoke, and visual QA all pass. Future realism work should be treated as targeted polish, not as a reason to keep widening the renderer surface.
