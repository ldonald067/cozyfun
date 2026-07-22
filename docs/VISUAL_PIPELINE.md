# Visual Pipeline

The sandbox renders as a grid of cells, but the grid does not need to look flat. Neighbor-aware color rules make materials recognizable by texture and silhouette, with facets, puffs, heat seams, liquid surfaces, and subtle local light layered on the same renderer boundary.

## Layers

- Base canvas: crisp pixel data for the simulation.
- Glow canvas: blurred additive-feeling light for fire, lava, ember, steam, stardust, meteor, moonwater, pollen, flowers, cosmic moss, and firework sparks.
- Motes canvas: full-screen room dust and atmosphere, separate from the simulation.

## Cell Rendering

Each frame, `renderer.ts` asks `materialColor.ts` for a color per cell. That color is built in three stages:

1. Palette lookup from `materials.ts`.
2. Broad animation and state treatment, such as fire pulse, water shimmer, smoke fade, or seed sprout tint.
3. Shape-language treatment in `shapeLanguage.ts`, such as ice facets or stone cracks.

## Shape Language

Shape language is intentionally procedural:

- Sand: grain speckles, warmer exposed surfaces, and damp/heat contact tint.
- Soil: darker clumps, roots, organic pockets, damp contact, and occasional moss/moonwater-adjacent green.
- Seed: chestnut body, darker edges, oval silhouette, grounded lower edge, sprout flecks, and moonwater-fed highlights.
- Ice: cube facets, bright top-left edges, darker bottom-right edges, and crack pixels.
- Wall: brick-like tile structure with mortar lines, lit exposed edges, chips, and heat/wet/plant staining.
- Stone: chunky block shading, facet shifts, dark crack marks, damp edge staining, lichen flecks, and warm heat contact.
- Smoke/Steam: edge-softened puff clusters with age fade, plus distinct dry soot cues for smoke and wet condensation/frost cues for steam.
- Water/Moonwater: connected surface highlights, lower shadow, heat-contact brightness, ordinary water earth/oil/life contact ripples, and moonwater hard-surface/oil/life shimmer.
- Stardust: bright twinkles, nearby star glints, and a brighter violet treatment near moonwater.
- Fire/Lava/Meteor: heat cores, exposed flame tips, cooling crust, glowing seams, and ember-dark edges.
- Moss/Fungus/Wood: leafy clusters, fungus cap/gill/spore role colors, oil/heat/cosmic contact cues, damp moonwater tint, char/damp contact cues, end-grain, and woodgrain lines.
- Ember: pulsing heat cores that dim into cold char, with spark flecks above hot beds.
- Glass: teal translucency, fresh warm flash, and fog film near steam.
- Pollen/Stem/Flower: bobbing golden motes, leaf-nubbed climbing stalks with pale growing tips, and petal variety on blooms.
- Rocket: crimson grains with paper flecks when inert, a bright white-gold firework head when lit.
- Spark: white-hot birth, per-cell firework hue (gold, rose, mint, sky, magenta) that reads apart from cool Stardust, glitter blinks, and an ember-red fade.
- Wellspring: dark rune-carved block; dormant runes shimmer silver, attuned runes pulse in the remembered material's tint.
- Nearby light: hot and cosmic materials (including flying sparks) can tint adjacent cells without changing simulation state.
- Interaction cues: water near heat brightens toward steam, ordinary water picks up earth/plant/oil contact, oil warms at hot edges, lava near cool liquids darkens into crust, moonwater near life or hard surfaces becomes pearly blue-violet, and newly cooled stone picks up a faint wet edge.

Rules can inspect neighboring cells through `cells.ts`, but they should not modify simulation state. Shared edge/contact helpers such as `edgeInfo` and `contactInfo` belong in `cells.ts`; material-specific palette choices stay in `shapeLanguage.ts`.

## Simulation Feel

Material behavior belongs in `sim/src/lib.rs`, with the JavaScript fallback mirrored in `app/src/engine.ts`. Keep these changes direct and legible: a user action should produce an understandable response, but not turn every contact into an explosive reaction.

Current life/water rules:

- Water and moonwater hydrate seeds, moss, fungus, and soil by raising cell energy.
- Watered rooted seeds can bloom into generated flowers.
- Watered moss uses that energy to spread into nearby soil or wood more readily.
- Watered soil stores moisture briefly and can green up into moss even after the water has moved away.
- Fungus can rot wet seeds or overtake old wet moss, keeping decay distinct from plant growth.
- Flowers are generated outcomes, not toolbar materials. They mark seed success, while moss remains surface carpet.

Current temperature rules:

- Ice freezes nearby water, condenses steam into frost, and marks nearby living/substrate cells as frozen.
- Frozen seeds and growth stay dormant until they thaw.
- Heat thaws frozen cells first, then dries wet scorchable cells, then burns only after that buffer is gone.
- Frozen and scorched flags are renderer cues too: they tint seeds, moss, fungus, flowers, soil, wood, and oil before a material changes.

Current substrate rules:

- Sand, wall, stone, and wood can hold short-lived dampness from water or moonwater.
- Damp sand reads darker and moves more slowly, making it clump instead of behaving like dry loose grains.
- Wet sand drains back to loose sand when its stored moisture is gone.
- Oil rises over water/moonwater, sheets sideways when supported, and keeps its smothering boundary around hydratable materials.
- Stone and wall now split their roles: stone is the natural hard substrate that weathers and takes condensation more strongly, while wall is a sealed construction barrier that stains but resists casual moss.
- Damp stone can be colonized by moss more readily than wall, while wood remains the faster soft substrate.
- Oil strips nearby wet flags and blocks plain water hydration, creating a smothering boundary around life.
- Smoke leaves soot/scorch flags on wall, stone, and wood. Steam condenses into wet flags on hard surfaces and still frosts near ice.

Current cosmic rules:

- Stardust touching ordinary water charges it into moonwater.
- Moonwater can clean oil into stardust instead of being blocked like ordinary water.
- Meteor contact with moonwater produces a stardust burst, giving cosmic materials a visible special-case outcome.
- Rocket powder is inert until any flame lights its fuse; the lit grain climbs fast and bursts into a spark shell that droops, twinkles out, and can light more powder.
- Wellspring blocks drink the first touching source material and pour it back out from open faces; nearby ice stills the flow.

Visual state polish:

- Wet, rooted, frozen, scorched, and cosmic flags are intentionally visible before a cell changes kind.
- Cosmic flags now tint soil, moss, fungus, and wood even when moonwater is no longer directly adjacent.
- Hard and living materials use stronger renderer-only state cues where subtle contact was getting lost at play zoom: wall and stone show clearer damp rims, frost highlights, scorch cracks, plant staining, and moonwater/cosmic flecks; seeds and flowers show oil smothering separately from wet/cosmic feeding; moss, fungus, and wood show clearer wet, frozen, charred, decomposer, and cosmic colors.

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

Useful commands (macOS/Linux; Windows uses the matching `scripts\*.ps1` wrappers):

```sh
npm run build
npm run visual:qa
npm run test:browser
```

## QA Contract

`npm run visual:qa` saves a controlled current-material capture to `.tmp/visual-qa/current-materials.png`, a deterministic material identity showcase to `.tmp/visual-qa/material-identity-showcase.png`, responsive layout metrics to `.tmp/visual-qa/current-layout.json`, and room backdrop captures for every scene environment.

The material showcase is shared by visual, Chrome, and Firefox QA through `scripts/material-showcase.mjs`. It should cover oil-over-water, wet/dry/scorched/frozen sand, damp/frozen/scorched hard materials, wet wood steam, ordinary water/lava and water/meteor shock, water/moonwater contact contrast, oil-smothered plants, distinct fungus life/cosmic/heat clusters, freeze-thaw wall stress, a grown stalked plant, veined stone and patinated wall, constellation etching, a pouring wellspring basin beside a dormant block, and a rocket charge with a lit grain in flight.

The room captures are part of the visual QA contract. They should stay calm behind the sandbox and panels: if a photo becomes too busy, literal, or high-contrast, tune the scene metadata in `sceneEnvironments.ts` or replace the asset and update `ASSET_CREDITS.md` in the same change.

This is still procedural pixel art, not photorealism. The target is fast material recognition at normal play zoom: ice should feel faceted, lava should read as hot cracked crust, vapor should feel soft and puffy, and liquids should have connected surfaces. Contact cues are renderer-only: they describe interaction between materials without adding new simulation state. Keep actual chemistry and movement rules in Rust/engine code, and treat realism work as targeted polish rather than a reason to keep widening the renderer surface.
