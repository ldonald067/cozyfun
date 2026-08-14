# Visual Pipeline

The sandbox renders as a grid of cells, but the grid does not need to look flat. Neighbor-aware color rules make materials recognizable by texture and silhouette, with facets, puffs, heat seams, liquid surfaces, and subtle local light layered on the same renderer boundary.

## Layers

- Base canvas: crisp pixel data for the simulation.
- Glow canvas: blurred additive-feeling light for fire, lava, ember, steam, stardust, meteor, moonwater, pollen, flowers, cosmic moss, and firework sparks. Four materials reach it only in a particular state — an attuned wellspring, a lit rocket grain, glass while the vitrify flash is still cooling (`age < 70`), and constellation-etched stone — so `hasGlow` is a predicate over `(kind, flags, energy, age)`, not a set membership test.
- Motes canvas: full-screen room dust, separate from the simulation.

Steam is deliberately the dimmest thing on the glow layer. It is lit *by* sources rather than being one, and an earlier shared floor had a kettle out-glowing the fire boiling it.

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
- Glass: a mostly see-through pane — the interior starts from the night sky and takes only a whisper of mint (0.085 of the palette colour, which puts it ~42 redmean from the night behind it; at 0.18 it sat at ~90, twice the distance the contrast gate demands between two different materials, and a sealed dome went murky), so the rims and a drifting diagonal sheen band carry the identity rather than the fill. Fresh panes flash warm as they vitrify. Condensation (steam nearby, or the wet flag) is a thin haze plus scattered beads streaked by vertical clear runs, which read *darker* than the fog because the drop has wiped the pane behind it — not a flat grey wash.
- Pollen/Stem/Flower: bobbing golden motes; climbing stalks whose leaves are real cells, drawn as a flatter deeper green than the lit stalk beside them; and blooms built from a cluster of Flower cells. A bloom cell's role is read off state the sim already keeps, not off new cell data: no Flower neighbours means an unopened bud, the rooted crown with petals around it is the golden disc, and everything else is a petal. Petal hue comes from the cell's `variant` alone — one flat garden hue per plant — because deriving it from a per-cell hash turned a multi-cell head into confetti. Counting neighbours cannot find the disc on its own: the stem takes one of the crown's four cardinal sides, so no cell in a real head ever has four Flower neighbours.
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
- Water soaks down through a seed bed, and a wet seed is grounded by soil *or* by another grounded seed, so a bed roots as a whole and sprouts from its surface. Only a seed with something growable above it germinates, since a buried one would make a stalk that can never climb. This is what actually makes flowers reachable: measured on a hand-painted planter, the old rules produced **zero** rooted seeds in 3600 ticks, because the seeds touching soil were buried out of the water's reach while the seeds the water reached were sitting on other seeds.
- Growth pushes up through standing water as well as open air. A watered garden pools, and requiring bare air left a bed sprouting only around the pond's dry margins while its whole middle stayed bare — which is exactly what a player who waters generously sees.
- Ground a living seed is standing on stops greening into moss, and moss cannot spread into it from the side either. Guarding only the soil's own greening left the claim porous: the bed still carpeted over, just from a neighbour. The claim is released when the seed dries out, so an abandoned bed still completes the soil → moss → fungus → soil loop.
- A stalk climbs four to seven cells and unfurls leaves on alternating sides. It stands on its own base or clings to a neighbouring stalk cell that has one, so leaves stay attached while a cut stalk still collapses whole.
- A bloom arrives as a closed bud and opens petal by petal into a head around the rooted crown, dusts pollen from the head's open faces, then sheds spent petals as drifting motes and leaves the crown standing as a seed head.
- A plant is one of **eight species**, chosen by `variant & 7`: cornflower, poppy, daisy, sunflower, tulip, lavender, bluebell, forget-me-not. Cornflower and poppy were the closest pair with colour removed — both solid caps — so the cornflower's crest is notched into a frilled rosette and the poppy's outer petals droop below its rim. Silhouette lives in `BLOOM_SHAPES` (`sim/src/lib.rs`); hue and centre live in `SPECIES` (`shapeLanguage.ts`). **The two tables are indexed by the same number and MUST stay in the same order** — swap one and plants get a sunflower's shape with a bluebell's colour.
- Heads are up to **five cells across**, the smallest head that can hold a shape at all: at three there are too few pixels to be anything but a block or a cross. Two silhouettes were redrawn after looking at captures rather than reasoning — a filled 5x2 poppy read as a red bar until its top corners came off, and a notch at the poppy's crest split the head into two separate blocks because the dark eye already cuts the row below it.
- A petal may open through the head's own drifting pollen. A mote that lands on top of a bloom is wedged — the bloom is underneath it, so it cannot fall — and it otherwise holds the last petal site until it ages out, leaving large heads permanently one petal short at the crest.
- A seed will not germinate within `PLANT_SPACING` of an existing plant. Without that every cell of a watered bed sprouts and the meadow is one continuous wall of petals with no silhouette at all. The spacing tracks the head size: five-wide heads need five cells of clearance to keep a visible gap.
- Watered moss uses that energy to spread into nearby soil or wood more readily.
- Watered soil stores moisture briefly and can green up into moss even after the water has moved away.
- Fungus can rot wet seeds or overtake old wet moss, keeping decay distinct from plant growth.
- A fungus that has run out of anything to eat eventually collapses back into fresh soil, closing the soil → moss → fungus → soil loop so a terrarium recovers instead of ending as a dead mat.
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
- Stone and wall split their roles along two axes. Stone is the natural hard substrate: it weathers, takes condensation more strongly, and **falls straight down when nothing supports it**. Wall is sealed construction that stains but resists casual moss, and never moves under any circumstance. Wall is therefore the only material that can hold a scaffold, frame, basin, or ceiling in place — build test fixtures and showcase stands out of it.
- Damp stone can be colonized by moss more readily than wall, while wood remains the faster soft substrate.
- Oil strips nearby wet flags and blocks plain water hydration, creating a smothering boundary around life.
- Smoke leaves soot/scorch flags on wall, stone, and wood. Steam condenses into wet flags on hard surfaces and still frosts near ice.

Current cosmic rules:

- Stardust touching ordinary water charges it into moonwater.
- Moonwater can clean oil into stardust instead of being blocked like ordinary water.
- Meteor contact with moonwater produces a stardust burst, giving cosmic materials a visible special-case outcome.
- A falling meteor sheds sparks in its wake, so a shower streaks instead of dropping silently — and those sparks can light rocket fuses on the way down, or hiss into steam over water.
- A cosmic-charged fungus sows a stardust grain instead of spreading as it digests, spending the charge: the fairy ring.
- Rocket powder is inert until any flame lights its fuse; the lit grain climbs fast and bursts into a spark shell that droops, twinkles out, and can light more powder.
- Wellspring blocks drink the first touching source material and pour it back out from open faces. Nearby ice stills the flow *and* reopens the drinking branch, so a chilled spring re-drinks whatever touches it next: attunement is re-teachable rather than a permanent first-touch commitment.

The slow world (between sessions only):

- Two rules run on their own clock at wake, never during play: cold char that is not
  under water
  settles into fresh soil, and a spent seed head sows a seed clear of its own shadow.
  Both live in `Universe::slow_step`, are mirrored in `engine.ts`, and consume the same
  RNG stream as `tick()`, so parity applies to them exactly as it does to movement.
- **Absence needs its own unit because ticks cannot express it** — the argument is
  written out once, in `app/src/slowWorld.ts`, which owns the whole absence policy.
  The curve: 1h earns 4 steps, a day 18, capped at 24 so a week away does not erase what
  you built. Under an hour earns none — that is a reload, not an absence.
- **Only what you left living changes.** The slow world leaves a scene of walls, sand
  and glass byte-identical — a cargo test and the audit's raw-byte inert check both say
  so. (The ordinary catch-up ticks that follow are a separate thing and will still
  settle anything mid-fall, as they would during play.) Char under water is spared too:
  a quenched hearth is a look somebody chose.
- A sown seed **displaces the one patch of moss it lands on back to soil**. A watered bed
  is a solid moss carpet within about twenty seconds of play and moss does not root a
  seed, so without that the whole arm produced inert grains — measured, not reasoned.
  It opens a planting hole, it does not strip a carpet.
- The payoff is conditional by design: a seed only comes up in damp ground, so a tended
  garden travels across visits and an abandoned one holds still. Measured on a watered
  bed left overnight, the garden grows into nine columns it did not stand in before.

Idle life:

- Settled scenes keep breathing on the renderer's own clock, cheaply: scattered cold-char
  cells wink a dim orange memory of fire, and old damp moss blinks an occasional firefly.
  Both are deterministic (time + cell hash), far below source-glow brightness, and sparse
  by construction — a dead hearth must never read as lit, and a carpet must not strobe.

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

The material showcase is shared by visual, Chrome, and Firefox QA through `scripts/material-showcase.mjs`. It should cover oil-over-water, wet/dry/scorched/frozen sand, damp/frozen/scorched hard materials, wet wood steam, ordinary water/lava and water/meteor shock, water/moonwater contact contrast, oil-smothered plants, distinct fungus life/cosmic/heat clusters, freeze-thaw wall stress up to a near-crumble frost-stressed wall, a grown stalked plant, veined stone and patinated wall, constellation etching, a pouring wellspring basin beside a dormant block, a one-cell attuned/dormant wellspring pair, the glass set (an age-0 vitrify flash clear of the lava pool, a cooled see-through pane, a deeper pane with real interior, and a dewed pane), and a rocket charge with a lit grain in flight.

Four traps in this scene, all learned the hard way. Display stands must be **Wall**, since stone now falls — and that includes planters: soil is a powder, so a garden bed with nothing under it drops the instant the capture's sim starts and takes the whole plant with it. The garden row also has to sit clear of any column that loose material falls down: its first home in the bottom band was directly under the sand pile, and the capture showed two exhibits buried. A glass bloom placed beside the lava pool cannot evidence anything — it sits inside lava's own halo — so the vitrify exhibit is deliberately somewhere else. And the showcase is a *live* scene: it is loaded into the running app and captured a beat later, so an exhibit painted in a state the sim will immediately leave does not survive to the picture. The garden row's crown energies sit below `CROWN_RESERVE` and above the shed floor for exactly this reason — otherwise the bud exhibit opens into a head before the shutter.

The composite that visual QA saves must draw the glow layer *over* the base canvas with the live layer's settings (screen blend, `blur(16px) saturate(1.35)`, alpha 0.9). It once drew glow underneath the opaque base, which silently reviewed every night light as though it did not exist; keep `saveSandboxComposite` in `scripts/visual-qa.mjs` in sync with `.glow-canvas` in `styles.css`.

The room captures are part of the visual QA contract. They should stay calm behind the sandbox and panels: if a photo becomes too busy, literal, or high-contrast, tune the scene metadata in `sceneEnvironments.ts` or replace the asset and update `ASSET_CREDITS.md` in the same change.

This is still procedural pixel art, not photorealism. The target is fast material recognition at normal play zoom: ice should feel faceted, lava should read as hot cracked crust, vapor should feel soft and puffy, and liquids should have connected surfaces. Contact cues are renderer-only: they describe interaction between materials without adding new simulation state. Keep actual chemistry and movement rules in Rust/engine code, and treat realism work as targeted polish rather than a reason to keep widening the renderer surface.
