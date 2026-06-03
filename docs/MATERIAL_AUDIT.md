# Material Audit

Phase 7 treated every toolbar material as a product choice. Phase 10 turns that into a maintained identity contract: each material in `app/src/materials.ts` now carries exactly two identity traits, and `npm run material:audit` fails when a material is missing them. A material stays only when it has a distinct behavior, interaction, visual identity, or player purpose. Generated-only outcomes can stay in the simulation without becoming toolbar materials.

## Decisions

| Material | Decision | Reason |
| --- | --- | --- |
| Eraser | Keep | Tool action, not a simulation material. |
| Wall | Specialize | Built barrier. Blocks flow, stains slowly, resists casual moss, and exists for deliberate construction. |
| Stone | Specialize | Natural hard material. Blocks flow like wall, but weathers harder, condenses steam harder, hosts damp moss more readily, and is produced by cooled lava/meteor impact. |
| Sand | Keep | Falling powder with wet clumping and drying behavior. |
| Water | Keep | Ordinary flowing hydration/cooling liquid. Blocked by oil. |
| Moonwater | Keep | Cosmic liquid. Stronger growth, cosmic flags, oil cleaning into stardust, and moonwater/meteor outcomes. |
| Smoke | Specialize | Dry fire vapor. Rises, fades, and leaves soot/scorch flags on wall, stone, and wood. |
| Steam | Specialize | Wet heat vapor. Rises, condenses on hard surfaces, and frosts near ice. |
| Soil | Keep | Organic falling substrate that stores moisture and can green into moss. |
| Wood | Keep | Soft flammable substrate for moss/fungus, with damp and char states. |
| Fire | Keep | Short-lived heat source for drying, burning, steam, and smoke. |
| Lava | Keep | Slow hot liquid that ignites fuel and cools into stone. |
| Ice | Keep | Cold solid that freezes water, pauses life, and condenses steam to frost. |
| Moss | Keep | Surface colonizer. Spreads over damp substrates; does not bloom. |
| Seed | Keep | Rooting growth unit. Needs water plus soil to produce generated flowers. |
| Flower | Generated only | Outcome of successful seeded growth; not selectable. |
| Fungus | Keep | Decomposer. Rots wet seeds, overtakes old/wet moss, and feeds on wood/soil. |
| Oil | Keep | Floating smothering liquid. Blocks hydration, strips wet flags, burns readily. |
| Stardust | Keep | Cosmic powder. Charges water, energizes life/soil/fungus, and produces visual sparkle. |
| Meteor | Keep | Falling cosmic heat. Impacts into stone/stardust/fire and reacts with moonwater. |

## Phase 10 Identity Matrix

| Material | Identity features | Distinction check |
| --- | --- | --- |
| Eraser | Tool action; clears cells. | It is a brush mode, not a simulation material. |
| Wall | Sealed construction barrier; brick pattern stains slowly. | Built barrier that resists casual moss and absorbs less than stone. |
| Stone | Natural weatherable hard block; condenses and hosts moss readily. | Natural hard substrate produced by cooling and impacts. |
| Sand | Falling loose powder; wet clumps dry loose again. | Powder motion changes when wet instead of becoming a generic solid. |
| Water | Practical hydration and cooling; earthy and oily contact ripples. | Ordinary liquid that oil can block and heat can flash into steam. |
| Moonwater | Cosmic growth liquid; cleans oil into stardust. | Water-like movement, but cosmic outcomes and stronger growth. |
| Smoke | Dry rising vapor; soots hard surfaces. | Dry fire residue, visually darker and behaviorally different from steam. |
| Steam | Wet rising vapor; condenses or frosts. | Wet heat vapor that leaves moisture or ice-side frost. |
| Soil | Moisture-storing substrate; greens into moss. | Organic powder that stores water and can become surface life. |
| Wood | Soft fuel substrate; wet wood vents steam. | Fuel plus life substrate, with visible damp and char states. |
| Fire | Short-lived heat; dries before ignition. | Temporary heat source that creates smoke/steam and burns only after wet buffers. |
| Lava | Slow hot liquid; cools into scorched stone. | Heavy heat liquid with crust/seams and cooling outcomes. |
| Ice | Cold solid; freezes liquid and pauses life. | Temperature material that freezes cells instead of hydrating or burning them. |
| Moss | Damp surface carpet; leafy patches spread over substrate. | Carpet growth that spreads over damp surfaces but does not bloom. |
| Seed | Rooting potential; blooms only when fed and grounded. | A potential state that needs soil and water before it becomes Flower. |
| Flower | Generated bloom outcome; petals react to wet and cosmic states. | Success outcome only, never a toolbar choice. |
| Fungus | Decay pressure; contact-colored caps and spores. | Rot/decomposition role with different colors near seed, moss, wood, soil, oil, heat, or cosmic contact. |
| Oil | Floating coating liquid; smothers water-fed growth. | Liquid coating that rises over water, blocks hydration, and burns readily. |
| Stardust | Cosmic drifting powder; charges water and life. | Powder with twinkle visuals and cosmic energy/transformation paths. |
| Meteor | Falling cosmic impact; crashes into fire, stone, or stardust. | Impact object, not just hot lava or a static rock. |

## Current Cuts

No toolbar material was removed in this pass. The audit found overlap, but the better fix was specialization and clearer interaction visuals:

- Wall and stone are no longer equal hard blocks. Wall is sealed construction; stone is natural, weatherable substrate.
- Smoke and steam are no longer just two gas colors. Smoke soots; steam condenses and frosts.
- Moss and seed remain separate. Moss is surface spread; seed is rooted bloom.
- Water and moonwater remain separate. Water is practical hydration/cooling; moonwater is cosmic transformation.
- Fungus remains separate from moss because it is decay pressure, not carpet growth, and now has explicit contact-colored role states.

## Future Removal Triggers

Remove or merge a material when one of these becomes true:

- It has no unique simulation rule.
- It has no unique visual state beyond palette.
- It is only a generated outcome but still appears in the toolbar.
- It can be represented as a state flag on another material without losing a user decision.

Likely future review targets:

- Meteor: keep only if falling impact remains fun and readable.
- Steam or Smoke: merge only if condensation/soot rules are removed.
- Wall: downgrade to a build mode only if stone becomes the sole hard material.
