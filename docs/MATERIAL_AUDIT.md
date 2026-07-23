# Material Audit

Every toolbar material is a product choice. Each material in `app/src/materials.ts` carries exactly two compact identity traits, and this doc documents each toolbar material's special interactions: distinct, player-visible sim reactions with other materials or states. The bar is 4-6 interaction roles per toolbar material; generated-only outcomes and the Eraser tool document 1-3. `npm run material:audit` fails when material definitions or this matrix drift. A material stays only when it earns that bar; overlapping materials get merged, demoted to generated-only, or removed.

## Decisions

| Material | Decision | Reason |
| --- | --- | --- |
| Eraser | Keep | Tool action, not a simulation material. |
| Wall | Specialize | Built barrier. Blocks flow, stains slowly, resists casual moss, radiates hearth warmth beside a live flame, and exists for deliberate construction. |
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
| Ember | Generated only | Outcome of burning wood; glowing remains that cool into relightable char, not selectable. |
| Pollen | Generated only | Golden motes released by mature flowers; drift, settle, and can seed damp soil, not selectable. |
| Stem | Generated only | Plant stalk grown from a rooted seed; climbs cell by cell and blooms a flower at its tip, not selectable. |
| Fungus | Keep | Decomposer. Rots wet seeds, overtakes old/wet moss, and feeds on wood/soil. |
| Oil | Keep | Floating smothering liquid. Blocks hydration, strips wet flags, burns readily. |
| Stardust | Keep | Cosmic powder. Charges water, energizes life/soil/fungus, and produces visual sparkle. |
| Meteor | Keep | Falling cosmic heat. Impacts into stone/stardust/fire and reacts with moonwater. |
| Rocket | Keep | Festival firework powder. Inert until any flame lights it, then it launches skyward and bursts into sparks. |
| Wellspring | Keep | Identity-drinking carved block. Absorbs the first touching source material and pours it back out from open faces forever. |
| Spark | Generated only | Firework spark thrown by a rocket burst; flies outward, droops, twinkles out, not selectable. |

## Interaction Matrix

| Material | Interaction roles | Coverage |
| --- | --- | --- |
| Eraser | Clears cells without adding state. | Browser smoke: `clear, save, and load update scene state`; not a simulation material. |
| Wall | Blocks flow as sealed construction; resists casual moss crossing; takes damp, soot, and frost stains; as hearth masonry beside a live flame or hot ember it dries and thaws its neighbors without ever igniting them; accumulated freeze-thaw stress cracks and crumbles it into stone. | Tests: `water_weathers_stone_more_than_sealed_wall`, `moss_needs_extra_energy_to_cross_wall`, `ice_frost_stresses_damp_hard_materials`, `hearth_wall_dries_and_thaws_its_nook`, `accumulated_freeze_thaw_crumbles_wall_into_stone`, `first_thaw_keeps_wall_standing`. |
| Stone | Blocks flow as natural hard substrate; weathers and condenses harder than sealed wall; hosts damp moss colonization; born from cooled lava, shocked meteor, and crumbled wall; sustained soaking by water slowly erodes it into wet sand. | Tests: `water_weathers_stone_more_than_sealed_wall`, `moss_colonizes_damp_stone`, `water_quenches_lava_into_steam_and_stone`, `accumulated_freeze_thaw_crumbles_wall_into_stone`, `sustained_water_erodes_saturated_stone_into_sand`, `damp_stone_without_water_contact_never_erodes`. |
| Sand | Pours fast as dry powder, two cells per tick; clumps and slows when wet; drains dry back to loose grains; strong heat fuses dry grains into glass. | Tests: `sand_falls`, `dry_sand_falls_two_cells_when_clear`, `wet_sand_still_falls_slowly`, `water_wets_sand_into_clumps`, `lava_vitrifies_dry_sand_into_glass`. |
| Water | Flows and pools; hydrates soil, sand, and life; quenches lava and shocks meteor into scorched stone; simmers, bubbles, and boils away to steam over sustained flame, while hot water melts ice instead of freezing; rinses soot from scorched wall and stone; blocked from feeding life by oil coating. | Tests: `water_spreads_when_blocked`, `rooted_seed_grows_a_stalk_that_blooms`, `water_quenches_lava_into_steam_and_stone`, `sustained_flame_simmers_then_boils_water`, `hot_water_melts_ice_and_resists_freezing`, `water_rinses_soot_from_hard_surfaces`. |
| Moonwater | Moves like water with supercharged growth; marks touched cells cosmic; cleans oil into stardust; bursts meteor contact into stardust; freezes into cosmic ice. | Tests: `moonwater_cleans_oil_into_stardust`, `meteor_moonwater_contact_bursts_to_stardust`, `lava_cools_near_moonwater`; visual QA: `material-identity-showcase`. |
| Smoke | Rises and fades; soots hard surfaces. | Tests: `smoke_leaves_soot_instead_of_condensation`; source: `update_gas` owns rise/fade. |
| Steam | Rises and fades; condenses on hard surfaces; frosts near ice. | Tests: `steam_condenses_on_hard_surfaces`, `steam_frosts_against_ice`, `water_fire_creates_steam_glow_instead_of_instant_delete`; source: `update_gas` owns rise/fade. |
| Soil | Falls as organic substrate; stores moisture and greens into moss; breathes a petrichor mist when watered after a long dry spell; roots wet seeds for blooming; feeds fungus decomposition. | Tests: `watered_soil_greens_up`, `rooted_seed_grows_a_stalk_that_blooms`, `first_water_on_dry_soil_breathes_mist`; source: `update_soil` and `update_fungus` own substrate behavior. |
| Wood | Burns through the wet, dry, ember, char arc instead of vanishing; wet wood vents steam before igniting; hosts moss spread; feeds fungus digestion. | Tests: `heat_steams_wet_wood_before_burning`, `wood_ignites_into_ember_instead_of_bare_flame`; source: `update_moss` and `update_fungus` handle organic contact; visual QA: damp/char states. |
| Fire | Ignites fuel with per-material burn odds; dries and scorches wet cells first; softens into steam against water; thaws frozen cells; vitrifies dry sand while young and hot. | Tests: `heat_dries_wet_growth_before_burning`, `water_fire_creates_steam_glow_instead_of_instant_delete`, `heat_steams_wet_wood_before_burning`, `wet_sand_takes_scorch_before_vitrifying`; source: `update_fire`. |
| Lava | Flows slowly and ignites fuel; quenched by water into scorched stone; vitrifies dry sand into glass; dries, scorches, and thaws its neighbors; cools into a stone crust on its own once its edges lose heat. | Tests: `lava_cools_near_moonwater`, `water_quenches_lava_into_steam_and_stone`, `lava_vitrifies_dry_sand_into_glass`, `isolated_lava_crusts_into_stone_over_time`; source: `update_liquid` owns movement. |
| Ice | Freezes nearby cool water and moonwater, but hot water resists and melts it; condenses steam into frost ice; frost-stresses damp stone and wall; pauses life in frozen dormancy; melts back to water near heat. | Tests: `ice_freezes_trapped_water`, `hot_water_melts_ice_and_resists_freezing`, `frozen_seed_waits_instead_of_blooming`, `ice_frost_stresses_damp_hard_materials`, `steam_frosts_against_ice`. |
| Moss | Spreads across damp soil and wood, bursting to two patches at once when well watered; colonizes damp stone slowly and soaked wall only when strongly fed; beads with visible dew when freshly watered and sheds droplets from overhangs; overtaken by fungus when old or wet; dries and scorches before burning. | Tests: `moss_colonizes_damp_stone`, `well_watered_moss_spreads_in_a_burst`, `moss_needs_extra_energy_to_cross_wall`, `saturated_moss_drips_dew`, `heat_dries_wet_growth_before_burning`; visual QA: `material-identity-showcase` dewy moss. |
| Seed | Roots on soil when wet with a soft sprout cue and a visibly growing shoot; germinates into a climbing stalk that blooms a flower at its tip, taller with cosmic feeding; settles into the carpet when it lands wet on moss; rots into fungus under decay pressure; waits dormant when frozen; smothered by oil coating. | Tests: `rooted_seed_grows_a_stalk_that_blooms`, `cosmic_fed_seed_grows_a_taller_stalk`, `frozen_seed_waits_instead_of_blooming`, `fungus_can_rot_wet_seed`, `oil_blocks_plain_water_hydration`; source: `update_seed` owns the moss-settle path. |
| Flower | Marks successful seeded growth; reacts visually to wet and cosmic states; spends energy releasing pollen motes within its bloom's energy arc, so untended gardens still seed gently and cosmic blooms release more often. | Tests: `rooted_seed_grows_a_stalk_that_blooms`, `mature_flower_releases_pollen`, `untended_garden_still_releases_pollen_within_its_energy_arc`; visual QA: `material-identity-showcase`; generated-only outcome. |
| Pollen | Drifts down as golden motes and settles where it lands; can take root as a seed on damp soil, carrying the cosmic spark from moonlit flowers so their gardens breed true; fades quietly in the air. | Tests: `mature_flower_releases_pollen`, `pollen_seeds_wet_soil`, `cosmic_flower_pollen_breeds_a_cosmic_seed`; visual QA: `material-identity-showcase`. |
| Stem | Climbs upward cell by cell from a rooted seed and blooms a flower at its tip; unsupported segments fall so cut plants collapse; burns and freezes like living growth. | Tests: `rooted_seed_grows_a_stalk_that_blooms`, `cut_stalk_segments_fall`; visual QA: `material-identity-showcase`. |
| Glass | Forms as a translucent pane where strong heat fuses dry sand; fogs with dew and beads steam back into water so a sealed glass terrarium keeps its moisture cycling; shatters back to sand with a chime under meteor impact. | Tests: `lava_vitrifies_dry_sand_into_glass`, `meteor_impact_vitrifies_nearby_sand`, `meteor_impact_shatters_glass_to_sand`, `glass_dew_fogs_the_pane_and_beads_into_water`; visual QA: `material-identity-showcase`. |
| Ember | Glows while hot and weakly spreads fire; cools into inert char that relights near heat; quenches wet under water, and running water washes crumbling cold char away with an inky murk. | Tests: `wood_ignites_into_ember_instead_of_bare_flame`, `ember_cools_into_inert_char`, `water_quenches_hot_ember`, `water_washes_cold_char_away`; visual QA: `material-identity-showcase`. |
| Fungus | Rots wet seeds; overtakes old or wet moss; digests wood and soil; charges cosmic near stardust and moonwater. | Tests: `fungus_can_rot_wet_seed`; source: `update_fungus` handles moss/wood/soil contact; visual QA: contact-colored states. |
| Oil | Floats above water and sheets sideways when supported; smothers hydration and strips wet state; ignites readily near heat; cleaned into stardust by moonwater. | Tests: `oil_rises_above_water`, `oil_blocks_plain_water_hydration`, `moonwater_cleans_oil_into_stardust`; source: `update_oil` owns burn readiness. |
| Stardust | Charges water into moonwater; energizes life, soil, and fungus with cosmic marks; snuffs fire into sparkle bursts; etches constellation marks onto stone and wall. | Tests: `stardust_charges_water_into_moonwater`, `stardust_snuffs_fire_into_sparkle`, `stardust_etches_constellations_on_stone`; visual QA: `material-identity-showcase`. |
| Meteor | Falls as impact heat; impacts into stone, stardust, and a fire ring; shocked into scorched stone by water; bursts into stardust against moonwater; vitrifies nearby sand on impact. | Tests: `water_shocks_meteor_into_steam_and_stone`, `meteor_moonwater_contact_bursts_to_stardust`, `meteor_impact_vitrifies_nearby_sand`; source: `update_meteor` owns fall and impact heat. |
| Rocket | Falls and piles as inert powder so charges and fuse lines can be laid calmly; any flame (fire, lava, hot ember, meteor) lights its fuse instead of burning it in place; a lit grain climbs fast with sway and a glittering smoke trail; bursts at fuse end or against a ceiling into a multicolor firework shell of sparks plus stardust, chain-lighting neighboring powder. | Tests: `rocket_powder_falls_inert_without_flame`, `flame_launches_rocket_skyward`, `lit_rocket_bursts_into_sparks_and_stardust`, `rocket_burst_blooms_a_spark_shell_that_fades`, `rocket_bursts_when_it_hits_a_ceiling`; source: `update_rocket` owns flight, `burst_rocket` owns the burst. |
| Spark | Flies outward from a rocket burst then droops and fades, twinkling in firework hues and casting warm light; reaching rocket powder during its outward flight lights its fuse; hisses out into a wisp of steam when it meets water, so fireworks sizzle over a pond. | Tests: `rocket_burst_blooms_a_spark_shell_that_fades`, `spark_hisses_into_steam_on_water`; source: `update_spark` owns expansion, droop, and fade. |
| Wellspring | Drinks the identity of the first source material that touches it, consuming that cell with a rune-glow attunement; endlessly pours the remembered material from its open faces; blocks flow like sealed construction while dormant or between pours; nearby ice stills the spring until the cold is removed. | Tests: `wellspring_drinks_first_touch_identity`, `attuned_wellspring_emits_its_material`, `unattuned_wellspring_stays_dormant`, `ice_stills_the_spring`; source: the wellspring arm in `apply_reactions` owns absorb and emit. |

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
