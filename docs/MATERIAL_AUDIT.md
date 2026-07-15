# Material Audit

Every toolbar material is a product choice. Each material in `app/src/materials.ts` carries exactly two compact identity traits, and this doc keeps one to three concrete interaction roles for each material. `npm run material:audit` fails when material definitions or this matrix drift. A material stays only when it has a distinct behavior, interaction, visual identity, or player purpose. Generated-only outcomes can stay in the simulation without becoming toolbar materials.

Planned direction (see the element depth plan in `ROADMAP.md`): the bar rises to 4 special interactions per toolbar material, Smoke and Steam are demoted to generated-only vapors, and Sand/Stardust/Wall/Wood gain new interactions to reach the bar. The audit script's role count moves from 1-3 to 4 once those interactions land.

## Decisions

| Material | Decision | Reason |
| --- | --- | --- |
| Eraser | Keep | Tool action, not a simulation material. |
| Wall | Specialize | Built barrier. Blocks flow, stains slowly, resists casual moss, and exists for deliberate construction. |
| Stone | Specialize | Natural hard material. Blocks flow like wall, but weathers harder, condenses steam harder, hosts damp moss more readily, and is produced by cooled lava/meteor impact. |
| Sand | Keep | Falling powder with wet clumping and drying behavior. |
| Water | Keep | Ordinary flowing hydration/cooling liquid. Blocked by oil. |
| Moonwater | Keep | Cosmic liquid. Stronger growth, cosmic flags, oil cleaning into stardust, and moonwater/meteor outcomes. |
| Smoke | Generated only | Dry fire vapor. Rises, fades, and soots wall, stone, and wood. Produced by fire; no longer a paint choice because its movement duplicates steam and it has one interaction. |
| Steam | Generated only | Wet heat vapor. Rises, condenses on hard surfaces, and frosts near ice. Produced by water/heat play; no longer a paint choice for the same overlap reason. |
| Soil | Keep | Organic falling substrate that stores moisture and can green into moss. |
| Wood | Keep | Soft flammable substrate for moss/fungus, with damp and char states. |
| Fire | Keep | Short-lived heat source for drying, burning, steam, and smoke. |
| Lava | Keep | Slow hot liquid that ignites fuel and cools into stone. |
| Ice | Keep | Cold solid that freezes water, pauses life, and condenses steam to frost. |
| Moss | Keep | Surface colonizer. Spreads over damp substrates; does not bloom. |
| Seed | Keep | Rooting growth unit. Needs water plus soil to produce generated flowers. |
| Flower | Generated only | Outcome of successful seeded growth; not selectable. |
| Glass | Generated only | Outcome of strong heat fusing dry sand; translucent pane, not selectable. |
| Fungus | Keep | Decomposer. Rots wet seeds, overtakes old/wet moss, and feeds on wood/soil. |
| Oil | Keep | Floating smothering liquid. Blocks hydration, strips wet flags, burns readily. |
| Stardust | Keep | Cosmic powder. Charges water, energizes life/soil/fungus, and produces visual sparkle. |
| Meteor | Keep | Falling cosmic heat. Impacts into stone/stardust/fire and reacts with moonwater. |

## Interaction Matrix

| Material | Interaction roles | Coverage |
| --- | --- | --- |
| Eraser | Clears cells without adding state. | Browser smoke: `clear, save, and load update scene state`; not a simulation material. |
| Wall | Blocks flow; resists casual moss; takes damp/soot/frost states. | Tests: `water_weathers_stone_more_than_sealed_wall`, `moss_needs_extra_energy_to_cross_wall`, `smoke_leaves_soot_instead_of_condensation`, `ice_frost_stresses_damp_hard_materials`. |
| Stone | Blocks flow; weathers and condenses harder than wall; receives cooled lava or meteor. | Tests: `water_weathers_stone_more_than_sealed_wall`, `steam_condenses_on_hard_surfaces`, `moss_colonizes_damp_stone`, `water_quenches_lava_into_steam_and_stone`, `water_shocks_meteor_into_steam_and_stone`. |
| Sand | Falls as powder; clumps when wet; dries loose again, and strong heat fuses dry grains into glass. | Tests: `sand_falls`, `water_wets_sand_into_clumps`, `wet_sand_drains_back_to_loose_sand`, `lava_vitrifies_dry_sand_into_glass`. |
| Water | Flows and spreads; hydrates life/soil/sand; cools heat into steam or stone. | Tests: `water_spreads_when_blocked`, `wet_seed_on_soil_blooms`, `watered_soil_greens_up`, `water_fire_creates_steam_glow_instead_of_instant_delete`, `water_quenches_lava_into_steam_and_stone`. |
| Moonwater | Moves like water; supercharges growth; cleans oil or meteor into stardust. | Tests: `moonwater_cleans_oil_into_stardust`, `meteor_moonwater_contact_bursts_to_stardust`, `lava_cools_near_moonwater`; visual QA: `material-identity-showcase`. |
| Smoke | Rises and fades; soots hard surfaces. | Tests: `smoke_leaves_soot_instead_of_condensation`; source: `update_gas` owns rise/fade. |
| Steam | Rises and fades; condenses on hard surfaces; frosts near ice. | Tests: `steam_condenses_on_hard_surfaces`, `steam_frosts_against_ice`, `water_fire_creates_steam_glow_instead_of_instant_delete`; source: `update_gas` owns rise/fade. |
| Soil | Falls as substrate; stores water; greens into moss. | Tests: `watered_soil_greens_up`, `wet_seed_on_soil_blooms`; source: `update_soil` and `density` own substrate behavior. |
| Wood | Burns as fuel; wet wood vents steam; feeds moss and fungus. | Tests: `heat_steams_wet_wood_before_burning`; source: `update_moss` and `update_fungus` handle organic contact; visual QA: damp/char states. |
| Fire | Short-lived heat; dries before burning; makes smoke or steam. | Tests: `heat_dries_wet_growth_before_burning`, `water_fire_creates_steam_glow_instead_of_instant_delete`, `heat_steams_wet_wood_before_burning`; source: `update_fire`. |
| Lava | Moves as slow hot liquid; ignites fuel; cools into scorched stone. | Tests: `lava_cools_near_moonwater`, `water_quenches_lava_into_steam_and_stone`; source: `update_lava` owns movement and ignition. |
| Ice | Freezes water; pauses life; frost-stresses damp hard cells. | Tests: `ice_freezes_trapped_water`, `frozen_seed_waits_instead_of_blooming`, `ice_frost_stresses_damp_hard_materials`, `steam_frosts_against_ice`. |
| Moss | Spreads over damp substrate; crosses walls only when strongly fed; stays carpet instead of bloom. | Tests: `moss_colonizes_damp_stone`, `moss_needs_extra_energy_to_cross_wall`, `heat_dries_wet_growth_before_burning`; source: `update_moss` keeps moss distinct from seed bloom. |
| Seed | Roots in soil; blooms when wet; waits when frozen. | Tests: `wet_seed_on_soil_blooms`, `frozen_seed_waits_instead_of_blooming`, `fungus_can_rot_wet_seed`. |
| Flower | Marks successful seeded growth; reacts visually to wet and cosmic states. | Tests: `wet_seed_on_soil_blooms`; visual QA: `material-identity-showcase`; generated-only outcome. |
| Glass | Marks where strong heat fused dry sand; stays as an inert translucent pane. | Tests: `lava_vitrifies_dry_sand_into_glass`, `meteor_impact_vitrifies_nearby_sand`, `wet_sand_takes_scorch_before_vitrifying`; visual QA: `material-identity-showcase`. |
| Fungus | Rots wet seeds; overtakes old or wet moss; feeds on wood or soil. | Tests: `fungus_can_rot_wet_seed`; source: `update_fungus` handles moss/wood/soil contact; visual QA: contact-colored states. |
| Oil | Floats over water; blocks hydration; burns readily. | Tests: `oil_rises_above_water`, `oil_blocks_plain_water_hydration`, `moonwater_cleans_oil_into_stardust`; source: `update_oil` owns burn readiness. |
| Stardust | Drifts as cosmic powder; charges water into moonwater; marks life/soil/fungus cosmic. | Tests: `stardust_charges_water_into_moonwater`; source: `update_stardust` handles drift and cosmic marking; visual QA: sparkle/cosmic states. |
| Meteor | Falls as impact heat; becomes stone/fire on impact; bursts with moonwater to stardust. | Tests: `water_shocks_meteor_into_steam_and_stone`, `meteor_moonwater_contact_bursts_to_stardust`; source: `update_meteor` owns fall and impact heat. |

## Current Cuts

Smoke and Steam left the toolbar in the element depth pass: they share the same gas movement, each had only one or two interactions, and both appear naturally from fire and water play. They remain full simulation materials and generated outcomes, like Flower. Earlier passes preferred specialization:

- Wall and stone are no longer equal hard blocks. Wall is sealed construction; stone is natural, weatherable substrate.
- Smoke and steam stayed distinct as sim materials. Smoke soots; steam condenses and frosts.
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
- Wall: downgrade to a build mode only if stone becomes the sole hard material after the freeze-thaw weathering work.
