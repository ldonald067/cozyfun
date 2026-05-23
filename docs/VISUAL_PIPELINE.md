# Visual Pipeline

The sandbox still renders as a grid of cells, but the grid does not need to look flat. Phase 2 uses neighbor-aware color rules to make materials recognizable by texture and silhouette before adding heavier art systems.

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

- Sand: grain speckles and warm surface highlights.
- Seed: chestnut body, darker edges, and green flecks.
- Ice: cube facets, bright top-left edges, darker bottom-right edges, and crack pixels.
- Stone: chunky block shading and dark crack marks.
- Water/Moonwater: connected surface highlights and lower shadow.
- Stardust: bright twinkles and nearby star glints.

Rules can inspect neighboring cells through `cells.ts`, but they should not modify simulation state.

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

Useful commands:

```powershell
.\scripts\build.ps1
.\scripts\test-browser.ps1
```
