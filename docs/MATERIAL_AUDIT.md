# Material Audit

Every toolbar material is a product choice. Each material in `app/src/materials.ts` carries exactly two compact identity traits, and this doc keeps one to three concrete interaction roles for each material. `npm run material:audit` fails when material definitions or this matrix drift. A material stays only when it has a distinct behavior, interaction, visual identity, or player purpose. Generated-only outcomes can stay in the simulation without becoming toolbar materials.

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

## Interaction Matrix

| Material | Interaction roles | Coverage |
| --- | --- | --- |
| Eraser | Clears cells without adding state. | Brush mode, not a simulation material. |
| Wall | Blocks flow; resists casual moss; takes damp/soot/frost states. | Rust, WASM, JS fallback, and visual QA cover hard-surface differences. |
| Stone | Blocks flow; weathers and condenses harder than wall; receives cooled lava or meteor. | Rust, WASM, JS fallback, and visual QA cover natural hard-surface behavior. |
| Sand | Falls as powder; clumps when wet; dries loose again. | Rust and JS fallback cover falling, wet clumping, and drying. |
| Water | Flows and spreads; hydrates life/soil/sand; cools heat into steam or stone. | Rust, WASM, and JS fallback cover hydration, oil blocking, lava, meteor, and spread. |
| Moonwater | Moves like water; supercharges growth; cleans oil or meteor into stardust. | Rust, WASM, JS fallback, audio reactions, and visual QA cover cosmic outcomes. |
| Smoke | Rises and fades; soots hard surfaces. | Rust and JS fallback cover soot distinct from condensation. |
| Steam | Rises and fades; condenses on hard surfaces; frosts near ice. | Rust and JS fallback cover condensation and frost. |
| Soil | Falls as substrate; stores water; greens into moss. | Rust and JS fallback cover wet soil greening and substrate behavior. |
| Wood | Burns as fuel; wet wood vents steam; feeds moss and fungus. | Rust and JS fallback cover wet-wood heat behavior; visual QA covers damp/char states. |
| Fire | Short-lived heat; dries before burning; makes smoke or steam. | Rust and JS fallback cover wet buffering, steam, smoke, and scorch states. |
| Lava | Moves as slow hot liquid; ignites fuel; cools into scorched stone. | Rust and JS fallback cover moonwater cooling and water quenching. |
| Ice | Freezes water; pauses life; frost-stresses damp hard cells. | Rust and JS fallback cover frozen seeds, trapped water, and hard-surface frost. |
| Moss | Spreads over damp substrate; crosses walls only when strongly fed; stays carpet instead of bloom. | Rust and JS fallback cover damp stone, wall resistance, and heat drying. |
| Seed | Roots in soil; blooms when wet; waits when frozen. | Rust and JS fallback cover rooted bloom and frozen dormancy. |
| Flower | Marks successful seeded growth; reacts visually to wet and cosmic states. | Generated-only outcome covered by seed tests and visual QA. |
| Fungus | Rots wet seeds; overtakes old or wet moss; feeds on wood or soil. | Rust and JS fallback cover wet seed rot; visual QA covers contact-colored states. |
| Oil | Floats over water; blocks hydration; burns readily. | Rust, WASM, and JS fallback cover float, hydration block, and moonwater cleanup. |
| Stardust | Drifts as cosmic powder; charges water into moonwater; marks life/soil/fungus cosmic. | Rust, JS fallback, audio reactions, and visual QA cover cosmic charge. |
| Meteor | Falls as impact heat; becomes stone/fire on impact; bursts with moonwater to stardust. | Rust and JS fallback cover water shock and moonwater burst. |

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
