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
- Moss/Fungus/Wood: leafy clusters, fungus cap/gill/spore role colors clustered on a half-resolution hash so the mat reads lumpier than a grain — moss and fungus were measurably the same fabric (luminance 176 +/- 31 against 169 +/- 31, cell-to-cell step 33 apiece) and with colour removed had no boundary between them at all. **The clustering is a nudge, not a solution, and the honest numbers are small**: on the current showcase the two mats sit at 17% against 14% of adjacent cell pairs repeating their neighbour, and mean steps of 27 against 32. Colour still carries this distinction (155 redmean apart) and the texture is a faint second channel. Pushing it further has been tried and made things worse — moving the cap/gill LATTICE to half resolution as well, so a 2x2 patch shares its role outright, dropped fungus to 13% against moss's 15%, because hard 2-cell bands step harder at their boundaries than speckle does and the per-cell palette pick underneath is the real grain. If this is ever worth another attempt, it starts at the palette lookup, not at the role marks. Also: oil/heat/cosmic contact cues, damp moonwater tint, char/damp contact cues, end-grain, and woodgrain lines.
- Ember: pulsing heat cores that dim into cold char, with spark flecks above hot beds. **A bed that goes out wears ash.** Cold char measured **52 redmean from the EMPTY TRAY** — under the 45 palette floor's neighbourhood, while every other element in the roster sits 185-578 from the night — so a burnt-out hearth read as erased rather than as spent, and `ember.cools` promised relightable fuel a player could not find. Ash builds continuously as the bed cools, reaching full at the sim's own `COLD_CHAR_ENERGY`, and forms only where the bed meets air, so a deep pile keeps a dark mass under a powdered crust instead of turning into a grey slab. Measured on the one-cell-deep bed a burnt log actually leaves, char went from 54 to **150** from the background, and wet char pulled apart from dry char from **6 to 30** — the `ember.quenched` distinction had been below the audit's own visibility floor. The trade is deliberate and shows in the gate: `ember.cools` drops from 183 to 132 contrast, because ash is a smaller step down from a hot ember than black was. Being findable in the scene is worth more than being maximally different from the state before it. Ash is matte and lands on the base layer only — an ember at zero energy still emits no glow, so a dead hearth never reads as lit.
- Glass: a mostly see-through pane — the interior starts from the night sky and takes only a whisper of mint (0.085 of the palette colour, which puts it ~42 redmean from the night behind it; at 0.18 it sat at ~90, twice the distance the contrast gate demands between two different materials, and a sealed dome went murky), so the rims and a drifting diagonal sheen band carry the identity rather than the fill. Fresh panes flash warm as they vitrify. Condensation (steam nearby, or the wet flag) is a thin haze plus scattered beads streaked by vertical clear runs, which read *darker* than the fog because the drop has wiped the pane behind it — not a flat grey wash.
- Pollen/Stem/Flower: bobbing golden motes; climbing stalks whose leaves are real cells, drawn as a flatter deeper green than the lit stalk beside them; and blooms built from a cluster of Flower cells. A bloom cell's role is read off state the sim already keeps, not off new cell data: a rooted crown past `PETAL_SHED_AGE` with its budget under `POLLEN_RESERVE` is a dry seed head, a rooted crown with no Flower neighbours is an unopened bud, the rooted crown with petals around it is the golden disc, and everything else is a petal. **Spent is the sim's own three-term test, not "has no petals left"** — the same three terms `slow_step` reads before it sows, so what looks like a seed head is exactly what sows while you are away. A bare-crown test would draw one essentially never: measured on a real garden, a crown runs its budget to zero by ~1200 ticks but the head almost always keeps a stubborn petal, which is the identical trap that left the sow rule dead on arrival. The seed head deliberately carries **no species hue** — every plant's ending is the same dry husk, which is what makes it read as an ending rather than as a ninth flower colour. Before it had a branch of its own, a bud and a spent crown of the same species rendered **52-66 redmean apart** at the cell, barely over the distance the contrast gate demands between two different *materials*, so the two ends of a plant's life were one picture; they now sit 118-216 apart, and a spent crown measures 3 from a bare one whether or not petals are still hanging on it. Petal hue comes from the cell's `variant` alone — one flat garden hue per plant — because deriving it from a per-cell hash turned a multi-cell head into confetti. Counting neighbours cannot find the disc on its own: the stem takes one of the crown's four cardinal sides, so no cell in a real head ever has four Flower neighbours.
- Rocket: crimson grains with paper flecks when inert, a bright white-gold firework head when lit.
- Spark: white-hot birth, a firework hue (gold, rose, mint, sky) that reads apart from cool Stardust, glitter blinks, and an ember-red fade. **The hue belongs to the spark, not to the cell it is standing in.** It used to be keyed on position, so a spark re-rolled its colour every time it moved and a shell had no colour identity at all — proved on a board of spark cells with identical kind, variant, age and energy laid out in a row, which came out a rainbow. It now rides on `variant`, the birth direction and the one thing constant for a spark's whole flight. `SPARK_DIRS` is a compass in order, so indexing the four hues by `variant & 3` gives opposite arms of a shell the same colour and neighbouring arms different ones: the burst reads as a four-fold starburst instead of confetti. One hue for the WHOLE shell would be truer still and is deliberately not done — `variant` is a 3-bit field by contract (`load_cells` masks imported bytes to `& 7`) and it is already spent on direction, so a per-shell identity would need new cell state for a 0.6-second effect. Four hues rather than five is load-bearing for the symmetry; the magenta that went was also the closest of the set to Stardust, which a burst throws into its own shell. Dropping it pulled Spark's averaged palette to 42 from Steam, under the 45 floor — `material:contrast` catching a change made for reasons it cannot see — so the sky deepened from `#a4c6ff` to `#7fb0ff`, which puts that pair at 50 and leaves the roster's closest pair unmoved.
- Wellspring: dark **basalt** rune-carved block with THREE rune states, separated by brightness rather than hue because attunement already borrows every material's colour. Dormant shimmers pewter, attuned runes GLOW with the remembered material rather than being painted in it, and a spring held under ice goes dark under a rime of frost pips — it is listening, and will re-drink the next source to touch it. That last one was first drawn as a pale blue glow and measured 22 from a water-attuned spring, i.e. a chilled dormant block read as already attuned; dark and frosted measures 219 from attuned and 195 from dormant. Both halves of that are measured corrections. The block's palette used to be blue (`#41598c`), so an attuned water spring sat in the same hue family as its own fountain; and mixing the raw material colour into the runes at any strength simply made the block that material — a water spring measured 25-77 redmean from the water it poured, i.e. the source was invisible in the output. Lifting the tint 55% toward white before mixing gives a lit-from-within stone that stays ≥104 from the water and ≥99 from a dormant block.
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
- A bloom arrives as a closed bud and opens petal by petal into a head around the rooted crown, dusts pollen from the head's open faces, then sheds spent petals as drifting motes and leaves the crown standing as a seed head. The bud wears the colour it is about to open; the seed head is dry husk in every species. That contrast is the garden's clock, and it is the one a returning player reads first — an absence ends on a bed of buds or a bed of husks, and those must not be the same picture.
- A plant is one of **eight species**, chosen by `variant & 7`: cornflower, poppy, daisy, sunflower, tulip, lavender, bluebell, cosmos. Cornflower and poppy were the closest pair with colour removed — both solid caps — so the cornflower's crest is notched into a frilled rosette and the poppy's outer petals droop below its rim. Colour crowding was a separate problem, found by measuring rendered heads rather than palettes: slots 0, 6 and 7 were three blues sitting 77, 107 and 126 apart while every other pairing was 168 or more, so a third of the garden's variety went to one hue. The bluebell went deep and the eighth species became a magenta COSMOS, which lifts the worst pair in the row to 140. Silhouette lives in `BLOOM_SHAPES` (`sim/src/lib.rs`); hue and centre live in `SPECIES` (`shapeLanguage.ts`). **The two tables are indexed by the same number and MUST stay in the same order** — swap one and plants get a sunflower's shape with a bluebell's colour.
- **A petal exposed both above and below is a bell hanging free, not the edge of a mass.** The rim rule darkens a petal in proportion to how little of the head it touches, and the top-crest highlight and underside shade each need one side attached — so a free-hanging petal took the deepest rim and neither cue. Measured head brightness against each plant's own stalk (p90 of the head's lit pixels against p90 of the stem below it), the bluebell came out at **94 against 188**: the only bloom in the row that was half the brightness of the green it stood on, which is why it read as damage rather than as a flower. Lighting a free bell like a crest takes the bluebell to 130 and the lavender from 126 to 160, and leaves poppy, tulip, cornflower, sunflower and cosmos where they were. What is left of the bluebell's gap is the **price of its deep hue and is deliberate**: every blue-violet bright enough to clear a green stalk lands within 115-133 of the cornflower, well under the separation the deep hue buys, so re-brightening it would undo the measured Phase 19 fix that broke up the blue trio. A deep-blue flower reading darker than foliage is honest.
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
- Wellspring blocks drink the first touching source material and pour it back out, feeding
  *through* their own pool rather than only into bare faces. A spring submerges itself within
  seconds, and an adjacent-empty rule then blocks every face and stops the source dead —
  measured at a permanent 3-4 cells of standing water. There is deliberately no output cap:
  one was tried and no scene could be built where it changed the outcome, because the pour is
  already bounded by filling only empty cells and by every substrate drinking standing water. Nearby ice stills the flow *and* reopens the drinking branch, so a chilled spring re-drinks whatever touches it next: attunement is re-teachable rather than a permanent first-touch commitment.

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
- **You arrive while it is in flower.** The catch-up saturates at the same length a bloom
  takes end to end, so any absence over an hour used to spend the whole flowering
  invisibly — measured against the live deployment, a player back after two days found two
  or three Flower cells, which are spent crowns and read as sticks. The wake now stops its
  fast-forward once a crown is ringed by petals and plays out a short tail on screen. An
  open head is an ADJACENCY question, not a count: a spent crown is still a Flower cell, and
  the first version of the gate for this passed with the rule sabotaged for exactly that
  reason. Measured on the audit's garden, a day away arrives with 23 new flower cells
  against 3 before.
- The payoff is conditional by design: a seed only comes up in damp ground, so a tended
  garden travels across visits and an abandoned one holds still. Measured on a watered
  bed left overnight, the garden grows into nine columns it did not stand in before.

Idle life:

- Settled scenes keep breathing on the renderer's own clock, cheaply: scattered cold-char
  cells wink a dim orange memory of fire, old damp moss blinks an occasional firefly, and a
  spent seed head gleams on a ripe pip. All three are deterministic (time + cell hash), far
  below source-glow brightness, and sparse by construction — a dead hearth must never read
  as lit, and a carpet must not strobe. The seed-head gleam is one cell per finished plant
  and says the thing brown alone cannot: the head is not merely over, it is FULL.

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

The material showcase is shared by visual, Chrome, and Firefox QA through `scripts/material-showcase.mjs`. It should cover oil-over-water, wet/dry/scorched/frozen sand, damp/frozen/scorched hard materials, wet wood steam, ordinary water/lava and water/meteor shock, water/moonwater contact contrast, oil-smothered plants, distinct fungus life/cosmic/heat clusters, freeze-thaw wall stress up to a near-crumble frost-stressed wall, a grown stalked plant, a spent seed head standing next to an unopened bud of the same species (the arc's two ends, whose only difference is the tip) plus a spent crown still holding its last petals, veined stone and patinated wall, constellation etching, a pouring wellspring basin beside a dormant block, a one-cell attuned/dormant wellspring pair, the glass set (an age-0 vitrify flash clear of the lava pool, a cooled see-through pane, a deeper pane with real interior, and a dewed pane), and a rocket charge with a lit grain in flight.

Four traps in this scene, all learned the hard way. Display stands must be **Wall**, since stone now falls — and that includes planters: soil is a powder, so a garden bed with nothing under it drops the instant the capture's sim starts and takes the whole plant with it. The garden row also has to sit clear of any column that loose material falls down: its first home in the bottom band was directly under the sand pile, and the capture showed two exhibits buried. A glass bloom placed beside the lava pool cannot evidence anything — it sits inside lava's own halo — so the vitrify exhibit is deliberately somewhere else. And the showcase is a *live* scene: it is loaded into the running app and captured a beat later, so an exhibit painted in a state the sim will immediately leave does not survive to the picture. The garden row's crown energies sit below `CROWN_RESERVE` and above the shed floor for exactly this reason — otherwise the bud exhibit opens into a head before the shutter. The two spent exhibits are the deliberate exception: their crowns sit *under* `POLLEN_RESERVE` because that is what makes them seed heads, and only the crown does. Their petals stay pinned at the shed floor of 45, so the head cannot start dropping petals mid-capture.

The composite that visual QA saves must draw the glow layer *over* the base canvas with the live layer's settings (screen blend, `blur(16px) saturate(1.35)`, alpha 0.9). It once drew glow underneath the opaque base, which silently reviewed every night light as though it did not exist; keep `saveSandboxComposite` in `scripts/visual-qa.mjs` in sync with `.glow-canvas` in `styles.css`.

The room captures are part of the visual QA contract. They should stay calm behind the sandbox and panels: if a photo becomes too busy, literal, or high-contrast, tune the scene metadata in `sceneEnvironments.ts` or replace the asset and update `ASSET_CREDITS.md` in the same change.

This is still procedural pixel art, not photorealism. The target is fast material recognition at normal play zoom: ice should feel faceted, lava should read as hot cracked crust, vapor should feel soft and puffy, and liquids should have connected surfaces. Contact cues are renderer-only: they describe interaction between materials without adding new simulation state. Keep actual chemistry and movement rules in Rust/engine code, and treat realism work as targeted polish rather than a reason to keep widening the renderer surface.
