use super::*;

fn kind_at(u: &Universe, x: u32, y: u32) -> u8 {
    u.cells[u.idx(x, y)].kind
}

fn flags_at(u: &Universe, x: u32, y: u32) -> u16 {
    u.cells[u.idx(x, y)].flags
}

fn energy_at(u: &Universe, x: u32, y: u32) -> u16 {
    u.cells[u.idx(x, y)].energy
}

fn set_cell(u: &mut Universe, x: u32, y: u32, material: Material) {
    let idx = u.idx(x, y);
    u.cells[idx] = Cell::new(material as u8, 0, starting_energy(material as u8));
}

fn set_cell_state(
    u: &mut Universe,
    x: u32,
    y: u32,
    material: Material,
    age: u16,
    energy: u16,
    flags: u16,
) {
    let idx = u.idx(x, y);
    u.cells[idx] = Cell {
        kind: material as u8,
        variant: 0,
        age,
        energy,
        flags,
    };
}

#[test]
fn sand_falls() {
    let mut u = Universe::new(16, 16, 7);
    u.paint(8, 2, 1, Material::Sand as u8, 100);
    u.tick();
    assert_eq!(kind_at(&u, 8, 3), Material::Sand as u8);
}

/// A sealed one-cell shaft, so every cell stays accounted for and a test can assert
/// exact conservation rather than "roughly the same". Both halves of the seal were
/// learned by watching water leave: the walls are TWO thick because a liquid side-hops
/// two cells and jumps a single wall, and the floor runs under them because a one-cell
/// floor lets water drain out diagonally.
fn shaft(u: &mut Universe, x: u32, top: u32, bottom: u32) {
    for y in top..=bottom + 1 {
        for wx in [x - 2, x - 1, x + 1, x + 2] {
            set_cell(u, wx, y, Material::Wall);
        }
    }
    set_cell(u, x, bottom + 1, Material::Wall);
}

/// Seals the listed cells in Wall two thick on every side (liquids hop a one-cell wall),
/// so nothing placed in them can move.
fn pocket(u: &mut Universe, cells: &[(u32, u32)]) {
    for &(x, y) in cells {
        for dy in -2i32..=2 {
            for dx in -2i32..=2 {
                let (nx, ny) = ((x as i32 + dx) as u32, (y as i32 + dy) as u32);
                if !cells.contains(&(nx, ny)) {
                    set_cell(u, nx, ny, Material::Wall);
                }
            }
        }
    }
}

/// Steam under water bubbles up through it; mist does not. One shaft each, so straight down
/// is the only move the water has: steam that sat in the cell below all tick, with water
/// directly above it.
#[test]
fn hot_steam_bubbles_up_through_water_but_mist_does_not() {
    let run = |energy: u16| {
        let mut u = Universe::new(12, 16, 7);
        shaft(&mut u, 5, 2, 12);
        set_cell_state(&mut u, 5, 12, Material::Steam, 0, energy, 0);
        set_cell(&mut u, 5, 11, Material::Water);
        u.tick();
        (kind_at(&u, 5, 12), kind_at(&u, 5, 11), count_kind(&u, Material::Steam))
    };
    let (bottom, above, _) = run(180);
    assert_eq!(bottom, Material::Water as u8, "the water should sink into the steam's cell");
    assert_eq!(above, Material::Steam as u8, "and the steam should bubble up into the cell it left, not vanish");

    // Mist keeps its old fate: the water sinks into it and it is gone. Letting mist bubble
    // too flooded a spring's lake from 7.2% of the board to 29.5% (see try_move).
    let (bottom, _, steam) = run(MIST_ENERGY);
    assert_eq!(bottom, Material::Water as u8, "the water should sink into the mist's cell");
    assert_eq!(steam, 0, "and the mist should be gone, not bubbled up");
}

/// Dry sand falls two cells a tick, so it can bubble through two stacked gas cells at once.
/// The second displaced cell lands where the first gas started the tick, so the gas pass
/// moves it again — one extra cell of rise. That is accepted rather than prevented,
/// because preventing it means deleting the gas, which is what bubbles exist to stop; what
/// this pins is that both cells survive. (Found by adversarial review.)
#[test]
fn dry_sand_falling_through_two_steam_cells_keeps_both() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 6, Material::Sand);
    set_cell_state(&mut u, 8, 7, Material::Steam, 0, 180, 0);
    set_cell_state(&mut u, 8, 8, Material::Steam, 0, 180, 0);
    u.tick();
    assert_eq!(count_kind(&u, Material::Sand), 1, "the sand should still be there");
    // Hot steam billows into puffs in open air (`billow`); the two wisps are what must survive.
    let wisps = u.cells.iter().filter(|c| c.kind == Material::Steam as u8 && c.flags & FLAG_PUFF == 0).count();
    assert_eq!(wisps, 2, "both steam cells should survive the sand falling through them");
    assert_eq!(kind_at(&u, 8, 8), Material::Sand as u8, "and the sand should have fallen through both");
}

/// Everything that falls as a grain settles through a pond to the bed, and the water it
/// displaces comes up on top — none of it lost on the way.
#[test]
fn every_grain_sinks_through_a_pond_and_lifts_it() {
    for grain in [Material::Sand, Material::Soil, Material::Stone, Material::Seed, Material::Rocket] {
        let mut u = Universe::new(12, 26, 7);
        shaft(&mut u, 5, 2, 22);
        for y in 12..=22 {
            set_cell(&mut u, 5, y, Material::Water);
        }
        set_cell(&mut u, 5, 6, grain);
        for _ in 0..600 {
            u.tick();
        }
        // At least, not exactly: soil soaked this long greens into moss, and moss sheds
        // dew. The promise under test is that sinking never LOSES water.
        let water = count_kind(&u, Material::Water);
        assert!(water >= 11, "{grain:?} lost water sinking through it: {water} of 11 left");
        assert_ne!(kind_at(&u, 5, 22), Material::Water as u8, "{grain:?} never reached the bed");
        assert_eq!(kind_at(&u, 5, 12), Material::Water as u8, "the displaced water should sit on top");
    }
}

/// Density is an ORDER, not a flag: sand goes through an oil slick and then the water under
/// it, and the oil still ends up floating on the water.
#[test]
fn sand_sinks_through_an_oil_film_and_the_water_under_it() {
    let mut u = Universe::new(12, 26, 7);
    shaft(&mut u, 5, 2, 22);
    for y in 16..=22 {
        set_cell(&mut u, 5, y, Material::Water);
    }
    for y in 13..=15 {
        set_cell(&mut u, 5, y, Material::Oil);
    }
    set_cell(&mut u, 5, 8, Material::Sand);
    for _ in 0..900 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 5, 22), Material::Sand as u8, "sand should rest on the bed");
    assert_eq!((count_kind(&u, Material::Water), count_kind(&u, Material::Oil)), (7, 3));
    let top_of = |m: Material| (0..26).find(|&y| kind_at(&u, 5, y) == m as u8).unwrap();
    assert!(top_of(Material::Oil) < top_of(Material::Water), "oil must still float on the water");
}

/// Pollen is light on purpose — motes floating on a pond is the right picture.
#[test]
fn pollen_stays_on_the_surface_of_a_pond() {
    let mut u = Universe::new(12, 26, 7);
    shaft(&mut u, 5, 2, 22);
    for y in 12..=22 {
        set_cell(&mut u, 5, y, Material::Water);
    }
    set_cell(&mut u, 5, 10, Material::Pollen);
    for _ in 0..60 {
        u.tick();
        for y in 13..=22 {
            assert_ne!(kind_at(&u, 5, y), Material::Pollen as u8, "pollen sank into the pond");
        }
    }
}

/// The one promise `try_fall` adds over `try_move`: a grain never overwrites a liquid.
/// `try_move` counts a cell as free if it was empty at the START of the tick, so water
/// that flows into it first used to be deleted by a grain landing on the same cell —
/// which sinking made common, because every grain that sinks pushes water up into the
/// path of the next one. Here the only place the water can go is the cell the grain is
/// about to fall into.
#[test]
fn a_falling_grain_never_deletes_water_that_just_flowed_under_it() {
    for start in 0..6 {
        let mut u = Universe::new(12, 12, 7);
        for x in 0..12 {
            set_cell(&mut u, x, 7, Material::Wall);
        }
        set_cell(&mut u, 4, 6, Material::Wall);
        set_cell(&mut u, 7, 6, Material::Wall);
        set_cell(&mut u, 6, 6, Material::Water);
        set_cell(&mut u, 5, 5, Material::Sand);
        // Vary which tick the two meet on, so the tick-parity gates all get exercised.
        u.tick_count = start;
        for _ in 0..12 {
            u.tick();
            assert_eq!(count_kind(&u, Material::Water), 1, "the water was deleted (start {start})");
            assert_eq!(count_kind(&u, Material::Sand), 1, "the sand was deleted (start {start})");
        }
    }
}

/// The same race for a seed gliding off a flower: it moves on its own path, not
/// `try_fall`, and every gesture that waters a garden puts water under seeds in the air.
#[test]
fn a_gliding_seed_never_deletes_water_that_just_flowed_under_it() {
    for start in 0..6 {
        let mut u = Universe::new(12, 12, 7);
        for x in 0..12 {
            set_cell(&mut u, x, 7, Material::Wall);
        }
        set_cell(&mut u, 4, 6, Material::Wall);
        set_cell(&mut u, 7, 6, Material::Wall);
        set_cell(&mut u, 6, 6, Material::Water);
        set_cell_state(&mut u, 4, 5, Material::Seed, 0, SET_SEED_ENERGY, FLAG_WINDBORNE | FLAG_DRIFT_EAST);
        u.tick_count = start;
        for _ in 0..12 {
            u.tick();
            assert_eq!(count_kind(&u, Material::Water), 1, "the water was deleted (start {start})");
            assert_eq!(count_kind(&u, Material::Seed), 1, "the seed was deleted (start {start})");
        }
    }
}

#[test]
fn dry_sand_falls_two_cells_when_clear() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 2, Material::Sand);
    u.tick();
    assert_eq!(kind_at(&u, 8, 4), Material::Sand as u8);
    assert_eq!(kind_at(&u, 8, 3), Material::Empty as u8);
}

#[test]
fn wet_sand_still_falls_slowly() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 2, Material::Sand, 4, 90, FLAG_WET);
    u.tick();
    u.tick();
    assert!(kind_at(&u, 8, 3) == Material::Sand as u8 || kind_at(&u, 8, 4) == Material::Sand as u8);
    assert_ne!(kind_at(&u, 8, 6), Material::Sand as u8);
}

#[test]
fn wellspring_drinks_first_touch_identity() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Wellspring);
    set_cell(&mut u, 8, 7, Material::Water);
    u.tick();
    assert_eq!(
        energy_at(&u, 8, 8),
        Material::Water as u16,
        "the first touching source should attune the wellspring"
    );
    assert_eq!(
        kind_at(&u, 8, 7),
        Material::Empty as u8,
        "the absorbed droplet should be drunk by the block"
    );
}

#[test]
fn attuned_wellspring_emits_its_material() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Wellspring, 0, Material::Water as u16, 0);
    for _ in 0..120 {
        u.tick();
    }
    let water = u
        .cells
        .iter()
        .filter(|c| c.kind == Material::Water as u8)
        .count();
    assert!(water > 2, "an attuned wellspring should keep emitting water, found {water}");
    assert_eq!(
        energy_at(&u, 8, 8),
        Material::Water as u16,
        "emission should not spend the attunement"
    );
}

#[test]
fn unattuned_wellspring_stays_dormant() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Wellspring);
    for _ in 0..60 {
        u.tick();
    }
    let occupied = u.cells.iter().filter(|c| !c.is_empty()).count();
    assert_eq!(occupied, 1, "an unattuned wellspring should create nothing on its own");
}

#[test]
fn ice_stills_the_spring() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Wellspring, 0, Material::Water as u16, 0);
    set_cell(&mut u, 9, 9, Material::Ice);
    for _ in 0..100 {
        u.tick();
    }
    let water = u
        .cells
        .iter()
        .filter(|c| c.kind == Material::Water as u8)
        .count();
    assert_eq!(water, 0, "nearby ice should pause the spring's flow");
}

#[test]
fn glass_dew_fogs_the_pane_and_beads_into_water() {
    let mut u = Universe::new(16, 16, 7);
    // A steam pocket trapped under a glass ceiling, sealed by walls.
    for x in 6..=10 {
        set_cell(&mut u, x, 6, Material::Glass);
    }
    for y in 7..=9 {
        set_cell(&mut u, 6, y, Material::Wall);
        set_cell(&mut u, 10, y, Material::Wall);
    }
    for x in 6..=10 {
        set_cell(&mut u, x, 10, Material::Wall);
    }
    set_cell_state(&mut u, 8, 7, Material::Steam, 0, 160, 0);
    set_cell_state(&mut u, 9, 7, Material::Steam, 0, 160, 0);
    let mut fogged = false;
    let mut beaded = false;
    for _ in 0..120 {
        u.tick();
        if (6..=10).any(|x| {
            kind_at(&u, x, 6) == Material::Glass as u8 && flags_at(&u, x, 6) & FLAG_WET != 0
        }) {
            fogged = true;
        }
        if u.cells.iter().any(|c| c.kind == Material::Water as u8) {
            beaded = true;
        }
        if fogged && beaded {
            break;
        }
    }
    assert!(fogged, "steam under a glass pane should fog it with a wet film");
    assert!(beaded, "fogged glass should bead steam back into water droplets");
}

#[test]
fn hearth_wall_dries_and_thaws_its_nook() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Wall);
    // Flame on one side of the wall; the damp and frozen cells sit on the
    // far side, out of the flame's own reach.
    set_cell_state(&mut u, 9, 8, Material::Fire, 0, 240, 0);
    set_cell_state(&mut u, 7, 8, Material::Soil, 10, 80, FLAG_WET);
    set_cell_state(&mut u, 7, 9, Material::Soil, 10, 80, FLAG_FROZEN);
    set_cell(&mut u, 7, 10, Material::Wall);
    set_cell(&mut u, 8, 9, Material::Wall);
    let mut dried = false;
    let mut thawed = false;
    for _ in 0..60 {
        u.tick();
        if flags_at(&u, 7, 8) & FLAG_WET == 0 {
            dried = true;
        }
        if flags_at(&u, 7, 9) & FLAG_FROZEN == 0 {
            thawed = true;
        }
        if dried && thawed {
            break;
        }
    }
    assert!(dried, "a hearth wall should dry the damp cell in its nook");
    assert!(thawed, "a hearth wall should thaw the frozen cell in its nook");
}

/// Warmth carries along the masonry, so a chimney breast dries a nook the flame
/// itself never reaches. Thawing deliberately does not: heat enough to melt ice
/// is a different thing from radiant warmth, and giving thaw the same reach made
/// every wall within two cells of a flame melt the ice around it.
#[test]
fn hearth_warmth_carries_along_masonry_but_thawing_needs_contact() {
    let mut u = Universe::new(16, 16, 11);
    // A masonry run with the flame at one end. The brick at x=8 is two cells from
    // the fire — warm, but not touching it.
    for x in 6..=9 {
        set_cell(&mut u, x, 8, Material::Wall);
    }
    set_cell(&mut u, 7, 10, Material::Wall);
    set_cell_state(&mut u, 10, 8, Material::Fire, 0, 240, 0);
    // Both sit against that warm brick and against nothing else hot.
    set_cell_state(&mut u, 7, 7, Material::Soil, 10, 200, FLAG_WET);
    set_cell_state(&mut u, 7, 9, Material::Soil, 10, 200, FLAG_FROZEN);
    let mut dried = false;
    let mut thawed = false;
    for _ in 0..120 {
        u.tick();
        // Dried WHILE STILL HOLDING moisture: a wet flag also clears on its own once
        // a cell's energy drains, so without this the assertion would pass with no
        // hearth in the scene at all.
        if kind_at(&u, 7, 7) == Material::Soil as u8
            && flags_at(&u, 7, 7) & FLAG_WET == 0
            && energy_at(&u, 7, 7) > 0
        {
            dried = true;
        }
        if kind_at(&u, 7, 9) == Material::Soil as u8 && flags_at(&u, 7, 9) & FLAG_FROZEN == 0
        {
            thawed = true;
        }
        if dried {
            break;
        }
    }
    assert!(dried, "warmth two cells along the masonry should dry the far nook");
    assert!(!thawed, "thawing should still need a cell actually touching the flame");
}

/// The finding an adversarial review filed against the first version of this rule: it
/// scanned a 5x5 square for flame, so a lone brick across an air gap warmed its
/// neighbour exactly like a chimney breast. Warmth conducts through masonry or it is
/// not masonry warmth.
#[test]
fn hearth_warmth_does_not_jump_an_air_gap() {
    let mut u = Universe::new(16, 16, 11);
    // One brick, two cells from the flame, with nothing but air between them.
    set_cell(&mut u, 6, 8, Material::Wall);
    set_cell_state(&mut u, 9, 8, Material::Fire, 0, 240, 0);
    set_cell(&mut u, 5, 10, Material::Wall);
    set_cell_state(&mut u, 5, 9, Material::Soil, 10, 200, FLAG_WET);
    for _ in 0..120 {
        u.tick();
        if kind_at(&u, 5, 9) != Material::Soil as u8 {
            break;
        }
        assert!(
            flags_at(&u, 5, 9) & FLAG_WET != 0 || energy_at(&u, 5, 9) == 0,
            "a brick with an air gap to the flame is not hearth masonry",
        );
    }
}

#[test]
fn spark_hisses_into_steam_on_water() {
    let mut u = Universe::new(16, 16, 7);
    for x in 6..=10 {
        set_cell(&mut u, x, 10, Material::Wall);
    }
    // Basin walls seal the pond against liquid side-hops.
    set_cell(&mut u, 6, 9, Material::Wall);
    set_cell(&mut u, 10, 9, Material::Wall);
    for x in 7..=9 {
        set_cell(&mut u, x, 9, Material::Water);
    }
    // A drooping spark (past its expansion phase) resting on the pond.
    set_cell_state(&mut u, 8, 8, Material::Spark, 10, 200, 0);
    let mut hissed = false;
    for _ in 0..20 {
        u.tick();
        if u.cells.iter().any(|c| c.kind == Material::Steam as u8) {
            hissed = true;
            break;
        }
    }
    assert!(hissed, "a spark settling onto water should hiss out as steam");
}

#[test]
fn rocket_powder_falls_inert_without_flame() {
    let mut u = Universe::new(16, 21, 7);
    for x in 0..16 {
        set_cell(&mut u, x, 20, Material::Stone);
    }
    set_cell(&mut u, 8, 4, Material::Rocket);
    for _ in 0..40 {
        u.tick();
    }
    let landed = (0..16).any(|x| {
        kind_at(&u, x, 19) == Material::Rocket as u8 && energy_at(&u, x, 19) == 0
    });
    assert!(landed, "unlit rocket powder should pile on the floor, still unlit");
}

#[test]
fn flame_launches_rocket_skyward() {
    let mut u = Universe::new(16, 41, 7);
    for x in 0..16 {
        set_cell(&mut u, x, 40, Material::Stone);
    }
    set_cell(&mut u, 8, 39, Material::Rocket);
    set_cell(&mut u, 7, 39, Material::Fire);
    let mut lifted = false;
    for _ in 0..60 {
        u.tick();
        for y in 0..36 {
            for x in 0..16 {
                if kind_at(&u, x, y) == Material::Rocket as u8 && energy_at(&u, x, y) > 0 {
                    lifted = true;
                }
            }
        }
        if lifted {
            break;
        }
    }
    assert!(lifted, "a lit rocket should climb well above its launch pad");
}

#[test]
fn lit_rocket_bursts_into_sparks_and_stardust() {
    let mut u = Universe::new(16, 48, 7);
    set_cell_state(&mut u, 8, 30, Material::Rocket, 0, 220, 0);
    for _ in 0..30 {
        u.tick();
    }
    assert!(
        !u.cells
            .iter()
            .any(|c| c.kind == Material::Rocket as u8),
        "the lit rocket should have burst by the end of its fuse"
    );
    assert!(
        u.cells.iter().any(|c| c.kind == Material::Stardust as u8),
        "a burst should leave a shimmer of stardust"
    );
}

#[test]
fn rocket_burst_blooms_a_spark_shell_that_fades() {
    let mut u = Universe::new(32, 48, 7);
    set_cell_state(&mut u, 16, 30, Material::Rocket, 0, 220, 0);
    let mut peak = 0;
    for _ in 0..40 {
        u.tick();
        let sparks = u
            .cells
            .iter()
            .filter(|c| c.kind == Material::Spark as u8)
            .count();
        peak = peak.max(sparks);
    }
    assert!(peak >= 6, "a burst should bloom a shell of sparks, saw at most {peak}");
    for _ in 0..80 {
        u.tick();
    }
    let lingering = u
        .cells
        .iter()
        .filter(|c| c.kind == Material::Spark as u8)
        .count();
    assert_eq!(lingering, 0, "sparks should twinkle out instead of lingering");
}

#[test]
fn rocket_bursts_when_it_hits_a_ceiling() {
    let mut u = Universe::new(16, 48, 7);
    for x in 0..16 {
        set_cell(&mut u, x, 24, Material::Wall);
    }
    set_cell_state(&mut u, 8, 27, Material::Rocket, 0, 220, 0);
    for _ in 0..12 {
        u.tick();
    }
    assert!(
        !u.cells
            .iter()
            .any(|c| c.kind == Material::Rocket as u8 && c.energy > 0),
        "a lit rocket pinned under stone should burst instead of hovering"
    );
}

/// A one-wide Wall shaft on a Wall floor, so a lit grain has nowhere to sway and must go
/// straight up through whatever is stacked above it.
fn rocket_shaft(u: &mut Universe, x: u32, top: u32, floor: u32) {
    for y in top..floor {
        set_cell(u, x - 1, y, Material::Wall);
        set_cell(u, x + 1, y, Material::Wall);
    }
    for dx in 0..3 {
        set_cell(u, x - 1 + dx, floor, Material::Wall);
    }
}

#[test]
fn a_lit_grain_shoves_up_through_its_own_powder_and_flame() {
    let mut u = Universe::new(16, 48, 7);
    // Left: a lit grain under five grains of its own unlit powder.
    rocket_shaft(&mut u, 4, 20, 40);
    for y in 34..39 {
        set_cell(&mut u, 4, y, Material::Rocket);
    }
    set_cell_state(&mut u, 4, 39, Material::Rocket, 0, 220, 0);
    // Right: a lit grain under the flame, which is the commonest ceiling a lit pile has.
    rocket_shaft(&mut u, 11, 20, 40);
    set_cell(&mut u, 11, 38, Material::Fire);
    set_cell_state(&mut u, 11, 39, Material::Rocket, 0, 220, 0);
    for _ in 0..8 {
        u.tick();
    }
    let lit_above = |x: u32, row: u32| {
        (0..row).any(|y| kind_at(&u, x, y) == Material::Rocket as u8 && energy_at(&u, x, y) > 0)
    };
    assert!(
        !u.cells.iter().any(|c| c.kind == Material::Stardust as u8),
        "neither grain should have burst: its own powder and the flame are not a ceiling"
    );
    assert!(lit_above(4, 34), "the grain should have climbed out through the powder stacked on it");
    assert!(lit_above(11, 36), "the grain should have climbed out through the flame above it");
    // The powder catches from the grain beneath it (`light_touching_powder`), so it is
    // lit and climbing too — but every grain is still there.
    let grains = u.cells.iter().filter(|c| c.kind == Material::Rocket as u8).count();
    assert_eq!(grains, 7, "shoving trades places with the charge; it must not delete any grain");
}

#[test]
fn a_following_grain_climbs_through_the_trail_of_the_one_ahead() {
    // The grain ahead leaves a spark or a puff of smoke in the cell it vacates, which is
    // exactly where the grain behind it is going. Over several seeds, so the trail is
    // actually laid on some of them, rather than trusting one seed to have rolled it.
    let mut trails = 0;
    for seed in 1..=16 {
        let mut u = Universe::new(16, 40, seed);
        rocket_shaft(&mut u, 8, 16, 34);
        set_cell_state(&mut u, 8, 32, Material::Rocket, 0, 220, 0);
        set_cell_state(&mut u, 8, 33, Material::Rocket, 0, 220, 0);
        u.tick();
        assert!(
            !u.cells.iter().any(|c| c.kind == Material::Stardust as u8),
            "seed {seed}: the following grain burst on the trail of the grain ahead"
        );
        let lit = u
            .cells
            .iter()
            .filter(|c| c.kind == Material::Rocket as u8 && c.energy > 0)
            .count();
        assert_eq!(lit, 2, "seed {seed}: both grains should still be in flight");
        // The trail the follower shoved past ends up where the follower started.
        let left = kind_at(&u, 8, 33);
        if left == Material::Spark as u8 || left == Material::Smoke as u8 {
            trails += 1;
        }
    }
    assert!(trails > 0, "no seed laid a trail in the follower's path, so this proved nothing");
}

#[test]
fn a_lit_grain_still_bursts_under_sand() {
    // Only the rocket's own charge is shoved aside. Sand is somebody else's lid.
    let mut u = Universe::new(16, 48, 7);
    rocket_shaft(&mut u, 8, 20, 40);
    for y in 34..39 {
        set_cell(&mut u, 8, y, Material::Sand);
    }
    set_cell_state(&mut u, 8, 39, Material::Rocket, 0, 220, 0);
    u.tick();
    assert_eq!(
        kind_at(&u, 8, 39),
        Material::Stardust as u8,
        "a lit grain under sand should burst where it is"
    );
    let sand = u.cells.iter().filter(|c| c.kind == Material::Sand as u8).count();
    assert_eq!(sand, 5, "the sand lid should be untouched");
}

/// A line of powder on a Wall floor, `from..=to` along row `y`, and a lit grain at `lit_x`.
fn fuse_line(u: &mut Universe, y: u32, from: u32, to: u32, lit_x: u32) {
    for x in 0..u.width {
        set_cell(u, x, y + 1, Material::Wall);
    }
    for x in from..=to {
        set_cell(u, x, y, Material::Rocket);
    }
    set_cell_state(u, lit_x, y, Material::Rocket, 0, 220, 0);
}

#[test]
fn a_lit_grain_lights_the_powder_it_touches() {
    // A line lit at one end burns its length, each grain lighting the next as it leaves.
    let mut u = Universe::new(32, 48, 7);
    fuse_line(&mut u, 39, 4, 27, 3);
    let mut furthest = 0;
    for _ in 0..40 {
        u.tick();
        for x in 0..32 {
            for y in 30..40 {
                if kind_at(&u, x, y) == Material::Rocket as u8 && energy_at(&u, x, y) > 0 {
                    furthest = furthest.max(x);
                }
            }
        }
    }
    assert!(furthest >= 26, "the light should run the length of the line, reached only x={furthest}");
}

#[test]
fn a_lit_grain_does_not_light_powder_it_is_not_touching() {
    // The same line with a two-cell gap before it: nothing jumps the gap.
    let mut u = Universe::new(32, 48, 7);
    fuse_line(&mut u, 39, 4, 27, 1);
    for _ in 0..30 {
        u.tick();
    }
    let unlit = (4..=27)
        .filter(|&x| kind_at(&u, x, 39) == Material::Rocket as u8 && energy_at(&u, x, 39) == 0)
        .count();
    assert_eq!(unlit, 24, "a grain that never touched the line should not have lit any of it");
}

/// The deliberate water sink (ROADMAP Phase 20): water throws mist only when it MOVES.
/// A pond that fills its basin has nowhere to go, so it keeps every cell forever; a lone
/// cell hopping about on open ground keeps moving, and turns to mist.
#[test]
fn moving_water_throws_mist_and_still_water_keeps_every_drop() {
    // Still: a basin filled to the brim, sealed two walls thick so nothing can move.
    let mut still = Universe::new(16, 16, 7);
    for y in 3..=13 {
        for x in 2..=13 {
            set_cell(&mut still, x, y, Material::Wall);
        }
    }
    for y in 5..=11 {
        for x in 4..=11 {
            set_cell(&mut still, x, y, Material::Water);
        }
    }
    for _ in 0..3000 {
        still.tick();
    }
    assert_eq!(count_kind(&still, Material::Water), 56, "a full, sealed pond keeps every drop");
    assert_eq!(count_kind(&still, Material::Steam), 0, "and throws no mist");

    // Moving: one cell on an open floor never settles, and sooner or later becomes mist.
    let mut moving = Universe::new(16, 16, 7);
    for x in 0..16 {
        set_cell(&mut moving, x, 15, Material::Wall);
    }
    set_cell(&mut moving, 8, 14, Material::Water);
    let mut misted = false;
    for _ in 0..4000 {
        moving.tick();
        if count_kind(&moving, Material::Steam) > 0 {
            misted = true;
            break;
        }
    }
    assert!(misted, "water that keeps moving should throw mist within 4,000 ticks at 1-in-{MIST_ODDS}");
    // And it is GONE, not recycled. Mist that kept the water's variant condensed back into
    // a droplet whenever `variant & 3 == 0` — review watched one make 62 round trips — so
    // a puddle never finished drying. The floor is wall, which takes condensation as a
    // stain rather than giving water back, so nothing here can return it.
    for _ in 0..400 {
        moving.tick();
    }
    assert_eq!(
        (count_kind(&moving, Material::Water), count_kind(&moving, Material::Steam)),
        (0, 0),
        "a droplet that turned to mist should disperse completely, not rain back"
    );
}

#[test]
fn a_gas_never_deletes_a_gas_and_still_fades_by_age() {
    // A sealed chamber with a column of smoke on its floor: the smoke rises and spreads
    // under the ceiling, which is exactly where one gas used to move into a cell another
    // had just filled and delete it. Smoke is never consumed by a reaction (it only
    // soots), so until it ages out every cell must still be there.
    let mut u = Universe::new(20, 24, 7);
    for y in 2..=21 {
        for x in 2..=17 {
            let edge = y == 2 || y == 21 || x == 2 || x == 17;
            if edge {
                set_cell(&mut u, x, y, Material::Wall);
            }
        }
    }
    // Narrower than the chamber, so it fans out sideways under the ceiling: a column
    // rising in a full-width block never collides with anything and proves nothing.
    for y in 12..=20 {
        for x in 7..=12 {
            set_cell(&mut u, x, y, Material::Smoke);
        }
    }
    let painted = count_kind(&u, Material::Smoke);
    for _ in 0..170 {
        u.tick();
    }
    assert_eq!(count_kind(&u, Material::Smoke), painted, "crowded smoke should keep every cell until it ages out");

    // And it still has its sink: conserving a gas is only safe because it expires.
    for _ in 0..30 {
        u.tick();
    }
    assert_eq!(count_kind(&u, Material::Smoke), 0, "smoke past its lifetime should be gone");
}

#[test]
fn water_never_deletes_steam_vented_this_tick_but_still_sinks_through_it() {
    // Lava beside a wet log vents steam into the empty cell above the log, in the
    // reaction pass, with no dice. Water directly above that cell falls into it in the
    // movement pass that follows — and because it was empty at the START of the tick, the
    // water used to land on the fresh steam and delete it.
    let mut u = Universe::new(16, 16, 3);
    for x in 0..16 {
        set_cell(&mut u, x, 12, Material::Wall);
    }
    set_cell(&mut u, 6, 11, Material::Wall);
    set_cell(&mut u, 7, 11, Material::Lava);
    set_cell_state(&mut u, 8, 11, Material::Wood, 0, 120, FLAG_WET);
    // A one-wide shaft, walled two thick because water side-hops two cells, so straight
    // down onto the vent is the ONLY move the water has. Without it the water slid
    // diagonally over the lava and this test passed without the rule ever being asked.
    for y in 8..=10 {
        for x in [5, 6, 7, 9, 10, 11] {
            set_cell(&mut u, x, y, Material::Wall);
        }
    }
    set_cell(&mut u, 8, 9, Material::Water);
    u.tick();
    assert_eq!(kind_at(&u, 8, 10), Material::Steam as u8, "the vent's steam should survive the water falling onto it");
    assert_eq!(kind_at(&u, 8, 9), Material::Water as u8, "and the water should wait above it, not vanish");

    // Only the clobber is closed. Steam that sat there all tick is gas the water may sink
    // through, as before — so a vent is never a lid.
    u.tick();
    assert_eq!(kind_at(&u, 8, 10), Material::Water as u8, "a tick later the water should sink through the steam");
}

#[test]
fn drifting_motes_never_delete_water() {
    // Pollen and stardust drifting down through a pour, in a sealed Wall chamber. They
    // float rather than sink, so they move with try_move, and one landing on water that had
    // just flowed into its path used to delete it. Nothing here is hot, cold or soil, and
    // stardust charging water into moonwater swaps one water-like cell for another, so water
    // should leave only as mist born this tick — with one exception that makes this a bound
    // rather than an identity. A mote may still land on mist thrown earlier the SAME tick
    // (the "pollen over steam" class Phase 20 left open), deleting the only evidence of the
    // water that made it. Measured on the JS mirror over six seeds: 0-2 such cells per 400
    // ticks with the guard, 238-297 with it removed.
    let mut u = Universe::new(32, 32, 5);
    for y in 1..=30 {
        for x in 1..=30 {
            if y == 1 || y == 30 || x == 1 || x == 30 {
                set_cell(&mut u, x, y, Material::Wall);
            }
        }
    }
    let water_like = |u: &Universe| count_kind(u, Material::Water) + count_kind(u, Material::Moonwater);
    let fresh_mist = |u: &Universe| {
        u.cells
            .iter()
            .filter(|c| c.kind == Material::Steam as u8 && c.age == 0 && c.energy == MIST_ENERGY)
            .count()
    };
    let mut met = 0;
    let mut unexplained = 0;
    for tick in 1..=400u32 {
        if tick < 300 && tick % 4 == 0 {
            u.paint(8 + (tick * 7 % 16) as i32, 4, 1, Material::Water as u8, 100);
        }
        if tick < 300 && tick % 3 == 0 {
            let mote = if tick % 2 == 0 { Material::Pollen } else { Material::Stardust };
            u.paint(6 + (tick * 5 % 20) as i32, 3, 1, mote as u8, 100);
        }
        let before = water_like(&u);
        u.tick();
        let after = water_like(&u);
        unexplained += before - after - fresh_mist(&u);
        // A mote resting directly on water: the two met.
        met += (0..u.cells.len() - 32)
            .filter(|&i| is_mote(u.cells[i].kind) && is_water_like(u.cells[i + 32].kind))
            .count();
    }
    assert!(met > 20, "the motes met the water only {met} times, so this proves nothing");
    assert!(unexplained <= 5, "{unexplained} water cells vanished beyond the mist they threw: a mote is landing on water");
}

#[test]
fn rising_steam_never_deletes_falling_water() {
    // A sealed Wall chamber: water falling from the top, steam rising from the bottom,
    // through each other. Liquids move before gases in a tick, so the only way steam can
    // meet a cell water has just flowed into is by rising into it — which used to delete
    // the water. Nothing here is hot or cold, nothing drinks water and Wall takes dew as a
    // stain, so the ONLY way water may leave is as mist, born this tick at age 0 and
    // MIST_ENERGY. Steam itself is not conserved here: hot steam bubbles up through water,
    // but mist does not, and water sinking into mist deletes it (see try_move).
    let mut u = Universe::new(24, 30, 11);
    for y in 1..=28 {
        for x in 1..=22 {
            if y == 1 || y == 28 || x == 1 || x == 22 {
                set_cell(&mut u, x, y, Material::Wall);
            }
        }
    }
    for y in 3..=8 {
        for x in 6..=17 {
            if (x + y) % 2 == 0 {
                set_cell(&mut u, x, y, Material::Water);
            }
        }
    }
    for y in 20..=26 {
        for x in 6..=17 {
            if (x + y) % 2 == 1 {
                set_cell(&mut u, x, y, Material::Steam);
            }
        }
    }
    let fresh_mist = |u: &Universe| {
        u.cells
            .iter()
            .filter(|c| c.kind == Material::Steam as u8 && c.age == 0 && c.energy == MIST_ENERGY)
            .count()
    };
    let mut water = count_kind(&u, Material::Water);
    let mut met = false;
    for tick in 1..=140 {
        u.tick();
        let now = count_kind(&u, Material::Water);
        assert_eq!(water - now, fresh_mist(&u), "water lost at tick {tick} beyond the mist it threw: rising steam deleted it");
        met |= u.cells.iter().any(|c| c.kind == Material::Steam as u8 && c.age > 0)
            && (0..u.cells.len()).any(|i| {
                u.cells[i].kind == Material::Water as u8
                    && i >= 24
                    && u.cells[i - 24].kind == Material::Steam as u8
            });
        water = now;
    }
    assert!(met, "the steam never reached the falling water, so this proves nothing");
}

#[test]
fn water_spreads_when_blocked() {
    let mut u = Universe::new(16, 16, 7);
    for x in 0..16 {
        u.paint(x, 10, 1, Material::Wall as u8, 100);
    }
    u.paint(8, 9, 1, Material::Water as u8, 100);
    u.tick();
    assert!(
        kind_at(&u, 7, 9) == Material::Water as u8
            || kind_at(&u, 9, 9) == Material::Water as u8
    );
}

#[test]
fn water_fire_creates_steam_glow_instead_of_instant_delete() {
    let mut u = Universe::new(16, 16, 7);
    u.paint(8, 8, 1, Material::Fire as u8, 100);
    u.paint(8, 7, 1, Material::Water as u8, 100);
    for _ in 0..8 {
        u.tick();
    }
    assert!(u.cells.iter().any(|c| c.kind == Material::Steam as u8));
}

#[test]
fn lava_cools_near_moonwater() {
    let mut u = Universe::new(16, 16, 7);
    u.paint(8, 8, 1, Material::Lava as u8, 100);
    u.paint(9, 8, 1, Material::Moonwater as u8, 100);
    for _ in 0..24 {
        u.tick();
    }
    assert!(u.cells.iter().any(|c| c.kind == Material::Stone as u8));
}

#[test]
fn rooted_seed_grows_a_stalk_that_blooms() {
    let mut u = Universe::new(16, 24, 7);
    set_cell_state(&mut u, 8, 12, Material::Seed, 40, 180, FLAG_WET);
    set_cell(&mut u, 8, 13, Material::Soil);
    for (x, y) in [(7, 13), (9, 13), (7, 14), (8, 14), (9, 14)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    let mut stalked = false;
    let mut bloomed = false;
    for _ in 0..400 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Stem as u8) {
            stalked = true;
        }
        if u.cells.iter().any(|cell| cell.kind == Material::Flower as u8) {
            bloomed = true;
            break;
        }
    }
    assert!(stalked, "a fed rooted seed should grow a visible stalk");
    assert!(bloomed, "the stalk should bloom a flower at its tip");
    assert!(
        kind_at(&u, 8, 12) == Material::Stem as u8,
        "the stalk base should stand where the seed was planted"
    );
}

#[test]
fn cut_stalk_segments_fall() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 5, Material::Stem, 30, 20, 0);
    u.tick();
    u.tick();
    assert_eq!(kind_at(&u, 8, 5), Material::Empty as u8, "unsupported stalk should fall");
    assert!(
        u.cells.iter().any(|cell| cell.kind == Material::Stem as u8),
        "the fallen segment should land, not vanish"
    );
}

#[test]
fn water_soaks_down_through_a_seed_bed() {
    // Without this the seeds touching soil are buried and never meet the water, while
    // the seeds the water reaches are standing on other seeds. Nothing ever roots.
    let mut u = Universe::new(16, 20, 3);
    for x in 0..16 {
        set_cell(&mut u, x, 16, Material::Wall);
    }
    set_cell(&mut u, 8, 15, Material::Soil);
    set_cell_state(&mut u, 8, 14, Material::Seed, 0, 0, 0);
    set_cell_state(&mut u, 8, 13, Material::Seed, 0, 0, 0);
    set_cell_state(&mut u, 8, 12, Material::Seed, 40, 250, FLAG_WET);
    for _ in 0..12 {
        u.tick();
    }
    assert!(
        energy_at(&u, 8, 14) > 70,
        "moisture should soak to the bottom of the bed, saw {}",
        energy_at(&u, 8, 14)
    );
    assert!(
        flags_at(&u, 8, 14) & FLAG_ROOTED != 0,
        "the soaked seed on soil should root"
    );
}

#[test]
fn a_seed_bed_sprouts_from_its_surface() {
    let mut u = Universe::new(16, 24, 5);
    for x in 0..16 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    set_cell(&mut u, 8, 19, Material::Soil);
    for y in [16, 17, 18] {
        set_cell_state(&mut u, 8, y, Material::Seed, 40, 200, FLAG_WET);
    }
    let mut sprouted = false;
    for _ in 0..400 {
        u.tick();
        if u.cells.iter().any(|c| c.kind == Material::Stem as u8) {
            sprouted = true;
            break;
        }
    }
    assert!(sprouted, "a wet, grounded seed bed should sprout");
    assert_eq!(
        kind_at(&u, 8, 16),
        Material::Stem as u8,
        "the seed with open sky above is the one that sprouts"
    );
    assert_eq!(
        kind_at(&u, 8, 17),
        Material::Seed as u8,
        "a buried seed should wait rather than germinate into a stalk that cannot climb"
    );
}

#[test]
fn a_capped_seed_never_sprouts() {
    // Pairs with the bed test: proves "sprouts from the surface" is a real gate and
    // not just an artefact of which cell happened to be checked first.
    let mut u = Universe::new(16, 24, 5);
    for x in 0..16 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    set_cell(&mut u, 8, 19, Material::Soil);
    set_cell_state(&mut u, 8, 18, Material::Seed, 40, 200, FLAG_WET);
    set_cell(&mut u, 8, 17, Material::Wall);
    for _ in 0..400 {
        u.tick();
    }
    assert_eq!(
        kind_at(&u, 8, 18),
        Material::Seed as u8,
        "a seed sealed under wall should stay a seed"
    );
}

#[test]
fn growth_pushes_up_through_standing_water() {
    let mut u = Universe::new(16, 24, 7);
    for x in 0..16 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    set_cell(&mut u, 8, 19, Material::Soil);
    set_cell_state(&mut u, 8, 18, Material::Seed, 40, 200, FLAG_WET);
    // A walled shaft so the water stays standing over the seed instead of draining.
    for y in 15..=20 {
        set_cell(&mut u, 7, y, Material::Wall);
        set_cell(&mut u, 9, y, Material::Wall);
    }
    set_cell_state(&mut u, 8, 17, Material::Water, 0, 60, 0);
    set_cell_state(&mut u, 8, 16, Material::Water, 0, 60, 0);
    let mut sprouted = false;
    for _ in 0..400 {
        u.tick();
        if u.cells.iter().any(|c| c.kind == Material::Stem as u8) {
            sprouted = true;
            break;
        }
    }
    assert!(
        sprouted,
        "a seed under shallow water should still send up a stalk — a watered bed pools, \
         and requiring bare air left the whole middle of a garden bare"
    );
}

#[test]
fn a_dried_out_seed_releases_its_ground() {
    // The claim is a loan, not a deed: an abandoned bed must still complete the
    // soil -> moss -> fungus -> soil loop.
    let mut u = Universe::new(16, 16, 11);
    for x in 0..16 {
        set_cell(&mut u, x, 10, Material::Wall);
    }
    set_cell_state(&mut u, 8, 9, Material::Soil, 16, 250, FLAG_WET);
    set_cell_state(&mut u, 8, 8, Material::Seed, 40, 0, FLAG_ROOTED);
    let mut greened = false;
    for _ in 0..300 {
        u.tick();
        if kind_at(&u, 8, 9) == Material::Moss as u8 {
            greened = true;
            break;
        }
    }
    assert!(greened, "a spent seed should release the ground it claimed");
}

/// Two wood planks on wall posts with a one-cell gap between them, moss on the end of the
/// left one at `energy`, and `gap` painted into the gap cell. True if moss reaches the right
/// plank in 400 ticks.
fn moss_crosses_gap(energy: u16, gap: Material) -> bool {
    let mut u = Universe::new(24, 16, 7);
    for x in 0..24 {
        set_cell(&mut u, x, 14, Material::Wall);
    }
    for x in 2..=9 {
        set_cell(&mut u, x, 10, Material::Wood);
    }
    for x in 11..=20 {
        set_cell(&mut u, x, 10, Material::Wood);
    }
    for x in [2, 9, 11, 20] {
        for y in 11..14 {
            set_cell(&mut u, x, y, Material::Wall);
        }
    }
    if gap != Material::Empty {
        set_cell(&mut u, 10, 10, gap);
        // Held in place, so the gap is still `gap` when the moss crosses it (review: loose
        // water drained out on the first tick and the test proved an air crossing).
        set_cell(&mut u, 10, 11, Material::Wall);
    }
    set_cell_state(&mut u, 9, 10, Material::Moss, 10, energy, FLAG_WET);
    (0..400).any(|_| {
        // Keep it fed, as a pond beside it would: the energy is the claim under test.
        let idx = u.idx(9, 10);
        if u.cells[idx].kind == Material::Moss as u8 {
            u.cells[idx].energy = energy;
        }
        let held = kind_at(&u, 10, 10) == gap as u8;
        u.tick();
        held && (11..=20).any(|x| kind_at(&u, x, 10) == Material::Moss as u8)
    })
}

#[test]
fn well_watered_moss_bursts_across_a_narrow_gap() {
    assert!(moss_crosses_gap(200, Material::Empty), "well-watered moss should burst across a one-cell gap");
    assert!(moss_crosses_gap(200, Material::Water), "and across a cell of water");
}

#[test]
fn damp_moss_never_crosses_a_gap_and_no_moss_crosses_a_wall() {
    assert!(!moss_crosses_gap(120, Material::Empty), "moss that is only damp should stop at a gap");
    assert!(!moss_crosses_gap(200, Material::Wall), "a spore crosses open air or water, never a wall");
}

/// A pile of rocket powder on a wall floor, lit by a meteor dropped onto it or by a flame
/// beside it. Returns (star sparks seen, stardust born from sparks, widest shell span).
fn firework_pile(by_meteor: bool) -> (usize, usize, i32) {
    let mut u = Universe::new(48, 80, 3);
    for x in 0..48 {
        set_cell(&mut u, x, 76, Material::Wall);
    }
    for x in 18..=30 {
        for y in 72..=75 {
            set_cell(&mut u, x, y, Material::Rocket);
        }
    }
    if by_meteor {
        set_cell(&mut u, 24, 66, Material::Meteor);
    } else {
        set_cell(&mut u, 24, 71, Material::Fire);
    }
    let (mut star, mut rained, mut span) = (0usize, 0usize, 0i32);
    for _ in 0..400 {
        let before = u.cells.clone();
        u.tick();
        let sparks: Vec<i32> = (0..u.cells.len())
            .filter(|&i| u.cells[i].kind == Material::Spark as u8)
            .map(|i| (i % 48) as i32)
            .collect();
        if let (Some(lo), Some(hi)) = (sparks.iter().min(), sparks.iter().max()) {
            span = span.max(hi - lo);
        }
        for i in 0..u.cells.len() {
            if u.cells[i].kind == Material::Spark as u8 && u.cells[i].flags & FLAG_COSMIC != 0 {
                star += 1;
            }
            if before[i].kind == Material::Spark as u8 && u.cells[i].kind == Material::Stardust as u8 {
                rained += 1;
            }
        }
    }
    (star, rained, span)
}

#[test]
fn a_meteor_lights_fireworks_as_star_shells_that_rain_stardust() {
    let (star, meteor_rain, _) = firework_pile(true);
    let (fire_star, fire_rain, _) = firework_pile(false);
    assert!(star > 0, "a meteor should light the powder it lands on as star rockets");
    assert_eq!(fire_star, 0, "a flame lights plain rockets");
    assert!(
        meteor_rain >= fire_rain * 2,
        "a meteor-lit charge should rain at least twice the stardust a fire-lit one does ({meteor_rain} vs {fire_rain})"
    );
}

#[test]
fn a_star_shell_blooms_wider_than_a_plain_one() {
    let shell = |flags: u16| {
        let mut u = Universe::new(64, 64, 3);
        set_cell_state(&mut u, 32, 32, Material::Rocket, 0, 100, flags);
        let mut span = 0;
        for _ in 0..30 {
            u.tick();
            let xs: Vec<i32> = (0..u.cells.len())
                .filter(|&i| u.cells[i].kind == Material::Spark as u8)
                .map(|i| (i % 64) as i32)
                .collect();
            if let (Some(lo), Some(hi)) = (xs.iter().min(), xs.iter().max()) {
                span = span.max(hi - lo);
            }
        }
        span
    };
    let (plain, star) = (shell(0), shell(FLAG_COSMIC));
    assert!(star >= plain + 6, "a star shell should bloom wider: {star} cells against {plain}");
}

#[test]
fn moss_cannot_spread_into_claimed_ground() {
    let mut u = Universe::new(16, 16, 13);
    for x in 0..16 {
        set_cell(&mut u, x, 10, Material::Wall);
    }
    set_cell_state(&mut u, 7, 9, Material::Moss, 40, 200, FLAG_WET);
    set_cell_state(&mut u, 8, 9, Material::Soil, 16, 250, FLAG_WET);
    set_cell_state(&mut u, 8, 8, Material::Seed, 40, 200, FLAG_WET | FLAG_ROOTED);
    // Capped so the seed stays a seed and keeps holding the claim for the whole run. The
    // run is shorter than the claim: the seed drains a point a tick and lets go of the
    // ground near tick 200, as a spent seed should. At 300 ticks this passed only while
    // the dice left the moss too dry to take the released soil in time.
    set_cell(&mut u, 8, 7, Material::Wall);
    for _ in 0..190 {
        u.tick();
    }
    assert!(u.soil_is_claimed(8, 9, &u.cells), "the seed should still hold its claim at the end of the run");
    assert_ne!(
        kind_at(&u, 8, 9),
        Material::Moss as u8,
        "moss should not spread into ground a living seed is standing on — guarding only \
         the soil's own greening left the claim porous from the side"
    );
}

#[test]
fn a_climbing_stalk_unfurls_side_leaves() {
    let mut u = Universe::new(16, 32, 7);
    set_cell_state(&mut u, 8, 20, Material::Seed, 40, 180, FLAG_WET);
    set_cell(&mut u, 8, 21, Material::Soil);
    for (x, y) in [(7, 21), (9, 21), (7, 22), (8, 22), (9, 22)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    let mut leafy = false;
    for _ in 0..600 {
        u.tick();
        // A leaf is the only way a stalk is ever two cells wide on one row.
        leafy = (0..32).any(|y| {
            (1..15).any(|x| {
                kind_at(&u, x, y) == Material::Stem as u8
                    && kind_at(&u, x + 1, y) == Material::Stem as u8
            })
        });
        if leafy {
            break;
        }
    }
    assert!(leafy, "a climbing stalk should unfurl a leaf beside itself");
}

#[test]
fn a_watered_seed_grows_a_seven_to_ten_cell_stalk_leafed_on_every_segment() {
    // The owner's pick (2026-10-29): each of the four budgets, a seed on soil with open sides,
    // grows a stalk of seven cells plus one per budget step, with a leaf on every row but the
    // top, alternating sides. The top row grows the crown instead of another segment.
    for variant in 0..4u8 {
        let mut u = Universe::new(16, 40, 7);
        set_cell_state(&mut u, 8, 30, Material::Seed, 40, 180, FLAG_WET);
        let seed = u.idx(8, 30);
        u.cells[seed].variant = variant;
        set_cell(&mut u, 8, 31, Material::Soil);
        for (x, y) in [(7, 31), (9, 31), (7, 32), (8, 32), (9, 32)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        let mut crown = None;
        for _ in 0..1500 {
            u.tick();
            crown = (0..30u32).find(|&y| kind_at(&u, 8, y) == Material::Flower as u8 && flags_at(&u, 8, y) & FLAG_ROOTED != 0);
            if crown.is_some() {
                break;
            }
        }
        let crown = crown.unwrap_or_else(|| panic!("variant {variant} never bloomed"));
        let rows: Vec<u32> = (crown + 1..=30).take_while(|&y| kind_at(&u, 8, y) == Material::Stem as u8).collect();
        assert_eq!(rows.len(), 7 + usize::from(variant), "variant {variant}'s stalk height");
        for &y in &rows[1..] {
            let side = if y % 2 == 0 { 7 } else { 9 };
            assert_eq!(kind_at(&u, side, y), Material::Stem as u8, "variant {variant} has no leaf at row {y}");
        }
    }
}

#[test]
fn a_stalk_saved_while_it_grows_reloads_its_whole_budget() {
    // `load_cells` held every energy to 255, and a stalk sprouts with 365 to 585, so a stalk
    // saved in the seconds it climbs came back five cells tall. Its budget now survives the
    // load; anything else is still held to 255.
    let mut u = Universe::new(16, 24, 7);
    for x in 0..16 {
        set_cell(&mut u, x, 22, Material::Wall);
    }
    set_cell(&mut u, 8, 21, Material::Soil);
    set_cell_state(&mut u, 8, 20, Material::Stem, 0, STEM_BUDGET_MAX, FLAG_ROOTED | FLAG_COSMIC);
    set_cell_state(&mut u, 2, 21, Material::Seed, 0, 400, 0);
    let bytes: Vec<u8> = u
        .cells
        .iter()
        .flat_map(|c| {
            let mut b = vec![c.kind, c.variant];
            b.extend_from_slice(&c.age.to_le_bytes());
            b.extend_from_slice(&c.energy.to_le_bytes());
            b.extend_from_slice(&c.flags.to_le_bytes());
            b
        })
        .collect();
    let mut reloaded = Universe::new(16, 24, 7);
    assert!(reloaded.load_cells(&bytes), "the saved board should load");
    assert_eq!(energy_at(&reloaded, 8, 20), STEM_BUDGET_MAX, "the stalk's budget was cut on load");
    assert_eq!(energy_at(&reloaded, 2, 21), 255, "any other energy is still held to 255");
    for _ in 0..200 {
        reloaded.tick();
    }
    let height = (0..=20u32).rev().take_while(|&y| kind_at(&reloaded, 8, y) == Material::Stem as u8).count();
    assert_eq!(height, 11, "the reloaded stalk should climb its whole budget");
}

#[test]
fn a_head_still_holds_its_petals_two_minutes_after_opening() {
    // Pairs with `a_spent_petal_sheds_as_a_drifting_mote`. A spent petal (budget under
    // POLLEN_RESERVE) two minutes old hangs on for the next minute: a head now holds its
    // petals for PETAL_SHED_AGE, about three minutes. At 1200 it let go within seconds.
    let mut u = Universe::new(16, 16, 9);
    let (dx, dy) = BLOOM_SHAPES[0][0];
    set_cell_state(&mut u, 8, 6, Material::Flower, 30, 0, FLAG_ROOTED);
    set_cell(&mut u, 8, 7, Material::Wall);
    let petal = ((8 + dx) as u32, (6 + dy) as u32);
    set_cell_state(&mut u, petal.0, petal.1, Material::Flower, 2400, 20, 0);
    for _ in 0..1100 {
        u.tick();
    }
    assert_eq!(kind_at(&u, petal.0, petal.1), Material::Flower as u8, "a two-minute-old petal let go");
}

#[test]
fn a_leaf_rides_on_the_stalk_it_clings_to() {
    // Held: the stalk beside the leaf has its own footing, so the leaf stays put.
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 5, Material::Stem, 30, 20, 0);
    set_cell_state(&mut u, 7, 5, Material::Stem, 30, 12, 0);
    set_cell(&mut u, 8, 6, Material::Wall);
    u.tick();
    u.tick();
    assert_eq!(
        kind_at(&u, 7, 5),
        Material::Stem as u8,
        "a leaf should hang on a stalk that has its own footing"
    );

    // Cut: the stalk loses its footing, so the leaf loses its hold in the same tick
    // and the whole plant still collapses.
    let mut cut = Universe::new(16, 16, 7);
    set_cell_state(&mut cut, 8, 5, Material::Stem, 30, 20, 0);
    set_cell_state(&mut cut, 7, 5, Material::Stem, 30, 12, 0);
    cut.tick();
    cut.tick();
    assert_eq!(
        kind_at(&cut, 7, 5),
        Material::Empty as u8,
        "a leaf on a severed stalk should fall with it"
    );
}

#[test]
fn a_bud_opens_into_a_petal_crown() {
    // The plant's variant picks its silhouette, so a head's size is its shape's size
    // rather than one constant. Two variants must give two different blooms — that is
    // the whole point of the table, and a fixed threshold here would hide a regression
    // that collapsed every plant back to the same head.
    //
    // Measured as a PEAK over the bloom's life rather than a reading at one tick: heads
    // are seven cells wide now and take longer to finish opening than the old five-wide
    // ones, so a fixed 400-tick sample caught some of them mid-open.
    //
    // The tolerance of one petal is the pollen wedge, and it is documented behaviour
    // rather than slack: a mote that lands on top of a bloom cannot fall, so it can hold
    // the last crest site until it ages out. Measured across all eight species, seven
    // open their whole silhouette and one lands a petal short, and which one it is
    // depends on where its own pollen happens to fall.
    let peak_of = |variant: u8| {
        let mut u = Universe::new(20, 20, 3);
        set_cell_state(&mut u, 10, 10, Material::Flower, 20, BLOOM_ENERGY, FLAG_ROOTED);
        // The crown stands on its stalk, as in play; a crown on nothing falls.
        set_cell(&mut u, 10, 11, Material::Wall);
        let idx = u.idx(10, 10);
        u.cells[idx].variant = variant;
        let mut peak = 0usize;
        for _ in 0..2000 {
            u.tick();
            let open = u
                .cells
                .iter()
                .filter(|cell| cell.kind == Material::Flower as u8)
                .count();
            if open > peak {
                peak = open;
            }
        }
        peak
    };
    for variant in 0..8u8 {
        let full = 1 + BLOOM_SHAPES[usize::from(variant)].len();
        let peak = peak_of(variant);
        assert!(
            peak + 1 >= full,
            "variant {variant} opened only {peak} of {full} cells — more than the one \
             petal the pollen wedge can hold, so its silhouette is not reachable. A head \
             can afford about (BLOOM_ENERGY - CROWN_RESERVE) / PETAL_COST petals before \
             its budget runs out; a shape bigger than that is a promise the sim cannot keep."
        );
    }
    // The cornflower against the lavender spike. This compared the sunflower once, and the
    // two differed only by the sunflower's petal at (0, 1), which the stalk always fills.
    assert_ne!(
        peak_of(0),
        peak_of(5),
        "different variants should grow visibly different blooms"
    );
}

#[test]
fn the_tulip_opens_a_cup_and_the_bluebell_nods() {
    // The two reshapes chosen on the design canvas (2026-10-22), grown from a rooted crown
    // on its stalk and read at the head's fullest. Asserted as the shapes they are, not as
    // offsets: a tulip is a CUP, wider at the body than at the base, lipped at the rim and
    // with nothing below its crown; a bluebell LEANS, its top off the stalk's line and its
    // bells hanging free. Either one drawn as a symmetric crown again fails here.
    let fullest = |variant: u8| -> Vec<(i32, i32)> {
        let mut u = Universe::new(20, 20, 3);
        set_cell_state(&mut u, 10, 10, Material::Flower, 20, BLOOM_ENERGY, FLAG_ROOTED);
        set_cell(&mut u, 10, 11, Material::Wall);
        let idx = u.idx(10, 10);
        u.cells[idx].variant = variant;
        let mut best = Vec::new();
        for _ in 0..2000 {
            u.tick();
            let head: Vec<(i32, i32)> = (0..20)
                .flat_map(|y| (0..20).map(move |x| (x, y)))
                .filter(|&(x, y)| (x, y) != (10, 10) && u.cells[u.idx(x as u32, y as u32)].kind == Material::Flower as u8)
                .map(|(x, y)| (x - 10, y - 10))
                .collect();
            if head.len() > best.len() {
                best = head;
            }
        }
        best
    };
    let row = |head: &[(i32, i32)], dy: i32| head.iter().filter(|c| c.1 == dy).count();

    let tulip = fullest(4);
    assert!(tulip.len() >= 14, "the tulip opened only {} of its 15 petals", tulip.len());
    assert!(tulip.iter().all(|c| c.1 <= 0), "a tulip opened a petal below its crown: {tulip:?}");
    assert!(row(&tulip, -1) > row(&tulip, 0), "a cup is wider at its body than at its base: {tulip:?}");
    let top = tulip.iter().map(|c| c.1).min().unwrap();
    let wide = tulip.iter().map(|c| c.0).max().unwrap() - tulip.iter().map(|c| c.0).min().unwrap() + 1;
    // The crown these replaced was seven wide and three deep, a bowl read from above.
    assert!(wide <= 1 - top + 1, "a cup is about as deep as it is wide: {wide} wide, {} deep", 1 - top);
    let lips: Vec<i32> = tulip.iter().filter(|c| c.1 == top).map(|c| c.0).collect();
    assert!(
        lips.iter().all(|x| !lips.contains(&(x + 1))),
        "a cup's rim is separate lips, not a solid bar: {lips:?}"
    );

    let bluebell = fullest(6);
    assert!(bluebell.len() >= 11, "the bluebell opened only {} of its 12 cells", bluebell.len());
    let (left, right) = (
        -bluebell.iter().map(|c| c.0).min().unwrap(),
        bluebell.iter().map(|c| c.0).max().unwrap(),
    );
    assert!(right > left, "a bluebell leans to one side of its stalk: reaches {left} left and {right} right");
    let top = bluebell.iter().map(|c| c.1).min().unwrap();
    assert!(
        bluebell.iter().filter(|c| c.1 == top).all(|c| c.0 != 0),
        "the scape bends over, so its highest point is off the stalk's line: {bluebell:?}"
    );
    let hanging = bluebell
        .iter()
        .filter(|&&(x, y)| x != 0 && y < -1 && !bluebell.contains(&(x, y + 1)))
        .count();
    assert!(hanging >= 2, "bells hang free off the scape, mouths open below: {bluebell:?}");
}

#[test]
fn a_lone_petal_never_opens_a_head_of_its_own() {
    // Only the rooted crown opens. Without this the head would grow without bound.
    let mut u = Universe::new(16, 16, 3);
    set_cell_state(&mut u, 8, 8, Material::Flower, 20, PETAL_ENERGY, 0);
    set_cell(&mut u, 8, 9, Material::Wall);
    for _ in 0..400 {
        u.tick();
    }
    let flowers = u
        .cells
        .iter()
        .filter(|cell| cell.kind == Material::Flower as u8)
        .count();
    assert_eq!(flowers, 1, "an unrooted petal should not spawn more petals");
}

#[test]
fn a_capped_bloom_still_puffs_pollen_from_its_rim() {
    // The regression this guards: pollen used to leave straight up only, so a petal
    // with anything above it — which is every inner cell of a real head — was silent.
    let mut u = Universe::new(16, 16, 5);
    set_cell_state(&mut u, 8, 8, Material::Flower, 30, 100, 0);
    set_cell_state(&mut u, 8, 7, Material::Flower, 30, 100, 0);
    set_cell(&mut u, 8, 9, Material::Wall);
    let mut puffed = false;
    for _ in 0..600 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Pollen as u8) {
            puffed = true;
            break;
        }
    }
    assert!(puffed, "a bloom capped from above should still dust pollen sideways");
}

#[test]
fn a_spent_petal_sheds_as_a_drifting_mote() {
    let mut u = Universe::new(16, 16, 9);
    set_cell_state(&mut u, 8, 4, Material::Flower, PETAL_SHED_AGE + 40, 20, 0);
    set_cell(&mut u, 8, 5, Material::Wall);
    let mut shed = false;
    for _ in 0..4000 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Pollen as u8) {
            shed = true;
            break;
        }
    }
    assert!(shed, "a spent petal should let go as a pollen mote");
    assert!(
        !u.cells.iter().any(|cell| cell.kind == Material::Flower as u8),
        "the shed petal should leave its cell, not duplicate itself"
    );
}

#[test]
fn a_shed_petal_is_marked_a_petal_of_its_species_while_it_drifts_and_after_it_lands() {
    // A shed petal used to be a pollen cell exactly like a puff, so the renderer drew every
    // fallen petal as pollen. A tulip petal high above a wall floor, so the mote has a long
    // fall and then lies there until it ages out.
    let mut u = Universe::new(16, 16, 9);
    set_cell_state(&mut u, 8, 4, Material::Flower, PETAL_SHED_AGE + 40, 20, 0);
    let idx = u.idx(8, 4);
    u.cells[idx].variant = 4;
    set_cell(&mut u, 8, 5, Material::Wall);
    for x in 0..16 {
        set_cell(&mut u, x, 15, Material::Wall);
    }
    let (mut drifting, mut landed) = (0, 0);
    for _ in 0..4000 {
        u.tick();
        for (i, cell) in u.cells.iter().enumerate() {
            if cell.kind != Material::Pollen as u8 {
                continue;
            }
            assert_eq!(cell.flags & FLAG_PETAL, FLAG_PETAL, "a shed petal should be marked a petal");
            assert_eq!(cell.variant & 7, 4, "a shed petal should keep its flower's species");
            if i / 16 == 14 {
                landed += 1;
            } else if i / 16 > 5 {
                drifting += 1;
            }
        }
        if landed > 0 && !u.cells.iter().any(|cell| cell.kind == Material::Pollen as u8) {
            break;
        }
    }
    assert!(drifting > 0, "the petal should have been seen falling");
    assert!(landed > 0, "the petal should have been seen lying on the floor");
}

#[test]
fn a_pollen_puff_is_never_marked_a_petal() {
    // Pairs with the petal test: the mark must be the shed's alone, or every mote would be
    // drawn as a petal. A fresh tulip opens and puffs for 900 ticks, short of any petal it
    // opens reaching PETAL_SHED_AGE.
    let mut u = Universe::new(20, 20, 3);
    set_cell_state(&mut u, 10, 10, Material::Flower, 20, BLOOM_ENERGY, FLAG_ROOTED);
    let idx = u.idx(10, 10);
    u.cells[idx].variant = 4;
    set_cell(&mut u, 10, 11, Material::Wall);
    let mut puffs = 0;
    for _ in 0..900 {
        u.tick();
        for cell in u.cells.iter().filter(|cell| cell.kind == Material::Pollen as u8) {
            assert_eq!(cell.flags & FLAG_PETAL, 0, "a pollen puff should stay plain pollen");
            puffs += 1;
        }
    }
    assert!(puffs > 0, "the bloom should have puffed pollen");
}

#[test]
fn a_shed_petal_that_sets_seed_never_sets_a_rooted_one() {
    // The petal mark is the rooted bit. Pollination builds the seed's flags afresh; if it
    // ever copied the mote's, a petal would set a rooted seed that sprouts where it lands.
    let mut u = pollen_beside_a_flower(2, 2, 0);
    for y in 2..8 {
        let idx = u.idx(11, y);
        u.cells[idx].flags = FLAG_PETAL;
    }
    let mut set = false;
    for _ in 0..300 {
        u.tick();
        for cell in u.cells.iter().filter(|cell| cell.kind == Material::Seed as u8) {
            assert_eq!(cell.flags & FLAG_ROOTED, 0, "a seed a petal set should not be rooted");
            set = true;
        }
    }
    assert!(set, "a petal brushing a flower of its kind should still set seed");
}

#[test]
fn a_fresh_crown_holds_its_petals() {
    // Pairs with the shed test: without this, "petals fall off" could be passing
    // because every bloom crumbles immediately rather than only when spent.
    // A spent crown on a stalk stub, so it opens nothing more, and one petal where its
    // shape puts it: the petal hangs from the crown and nothing else.
    let mut u = Universe::new(16, 16, 9);
    let (dx, dy) = BLOOM_SHAPES[0][0];
    set_cell_state(&mut u, 8, 6, Material::Flower, 30, 0, FLAG_ROOTED);
    set_cell(&mut u, 8, 7, Material::Wall);
    let petal = ((8 + dx) as u32, (6 + dy) as u32);
    set_cell_state(&mut u, petal.0, petal.1, Material::Flower, 30, PETAL_ENERGY, 0);
    for _ in 0..600 {
        u.tick();
    }
    assert_eq!(
        kind_at(&u, petal.0, petal.1),
        Material::Flower as u8,
        "a young, fed petal should stay on the bloom"
    );
}

#[test]
fn a_cut_stalk_drops_its_bloom() {
    // A stalk on a floor with its crown on top and one petal where the shape puts it. Held
    // while the stalk stands; cut the stalk and the whole head comes down, the crown no
    // longer rooted. Before, the stalk fell and the head hung in the air.
    let mut u = Universe::new(16, 16, 9);
    let (dx, dy) = BLOOM_SHAPES[0][0];
    let petal = ((8 + dx) as u32, (8 + dy) as u32);
    for x in 0..16 {
        set_cell(&mut u, x, 14, Material::Wall);
    }
    for y in 9..14 {
        set_cell_state(&mut u, 8, y, Material::Stem, 30, 20, 0);
    }
    set_cell_state(&mut u, 8, 8, Material::Flower, 30, 0, FLAG_ROOTED);
    set_cell_state(&mut u, petal.0, petal.1, Material::Flower, 30, PETAL_ENERGY, 0);
    for _ in 0..60 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Flower as u8, "a crown on its stalk stays put");
    assert_eq!(kind_at(&u, petal.0, petal.1), Material::Flower as u8, "and so does its petal");

    set_cell(&mut u, 8, 12, Material::Empty);
    for _ in 0..60 {
        u.tick();
    }
    let heads: Vec<(u32, u32)> = (0..16u32)
        .flat_map(|y| (0..16u32).map(move |x| (x, y)))
        .filter(|&(x, y)| kind_at(&u, x, y) == Material::Flower as u8)
        .collect();
    assert_eq!(heads.len(), 2, "the head falls; it does not vanish");
    assert!(!heads.contains(&(8, 8)) && !heads.contains(&petal), "the head still hangs where it grew: {heads:?}");
    for &(x, y) in &heads {
        assert_ne!(kind_at(&u, x, y + 1), Material::Empty as u8, "a bloom cell at ({x},{y}) rests on nothing");
        assert_eq!(flags_at(&u, x, y) & FLAG_ROOTED, 0, "a fallen crown is no longer rooted");
    }
}

#[test]
fn soil_under_a_rooted_seed_stays_soil() {
    let mut u = Universe::new(16, 16, 11);
    set_cell_state(&mut u, 8, 9, Material::Soil, 16, 190, FLAG_WET);
    set_cell_state(&mut u, 8, 8, Material::Seed, 40, 180, FLAG_WET | FLAG_ROOTED);
    set_cell(&mut u, 8, 10, Material::Wall);
    for _ in 0..200 {
        u.tick();
        if kind_at(&u, 8, 9) != Material::Soil as u8 {
            break;
        }
    }
    // The seed may germinate into a stalk; what must never happen is the soil
    // greening out from under it, which is what used to strand every seed.
    assert_ne!(
        kind_at(&u, 8, 9),
        Material::Moss as u8,
        "soil claimed by a rooted seed should not green into moss"
    );
}

#[test]
fn watered_soil_greens_up() {
    let mut u = Universe::new(16, 16, 11);
    set_cell_state(&mut u, 8, 8, Material::Soil, 16, 190, FLAG_WET);
    for _ in 0..36 {
        u.tick();
    }
    assert!(u.cells.iter().any(|c| c.kind == Material::Moss as u8));
}

#[test]
fn fungus_can_rot_wet_seed() {
    let mut u = Universe::new(16, 16, 3);
    set_cell_state(&mut u, 8, 8, Material::Seed, 12, 150, FLAG_WET);
    set_cell(&mut u, 8, 9, Material::Wall);
    set_cell(&mut u, 7, 8, Material::Fungus);
    for _ in 0..24 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Fungus as u8);
}

#[test]
fn frozen_seed_waits_instead_of_blooming() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Seed, 80, 180, FLAG_WET | FLAG_FROZEN);
    set_cell(&mut u, 8, 9, Material::Soil);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Seed as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_FROZEN != 0);
}

#[test]
fn ice_freezes_trapped_water() {
    let mut u = Universe::new(16, 16, 11);
    set_cell(&mut u, 7, 8, Material::Ice);
    set_cell(&mut u, 8, 8, Material::Water);
    for (x, y) in [(7, 7), (8, 7), (9, 7), (7, 9), (8, 9), (9, 9), (9, 8), (6, 8), (10, 8)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    for _ in 0..36 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Ice as u8);
}

#[test]
fn heat_dries_wet_growth_before_burning() {
    let mut u = Universe::new(16, 16, 5);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell_state(&mut u, 8, 8, Material::Moss, 20, 140, FLAG_WET);
    set_cell(&mut u, 8, 9, Material::Stone);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Moss as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_WET, 0);
}

#[test]
fn ember_dries_wet_fuel_before_lighting_it() {
    // Wood keeps its wet flag only while water touches it, so a walled cup of water sits
    // diagonally above it, out of the ember's reach (water beside an ember quenches it).
    // Watched transition by transition: smoke soots only DRY wood, so wood that was wet
    // last tick and is scorched and dry now was dried by the ember.
    let mut u = Universe::new(16, 16, 5);
    set_cell_state(&mut u, 7, 8, Material::Ember, 0, 230, 0);
    set_cell_state(&mut u, 8, 8, Material::Wood, 0, 140, FLAG_WET);
    set_cell(&mut u, 9, 7, Material::Water);
    for (x, y) in [(7, 7), (8, 7), (10, 7), (11, 7), (9, 8), (10, 8)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    for x in 6..12 {
        set_cell(&mut u, x, 9, Material::Wall);
    }
    let (mut dried, mut was_wet) = (0, true);
    for _ in 0..120 {
        u.tick();
        let (kind, flags) = (kind_at(&u, 8, 8), flags_at(&u, 8, 8));
        assert!(!was_wet || kind == Material::Wood as u8, "wet wood lit without drying first");
        if kind != Material::Wood as u8 {
            break;
        }
        if was_wet && flags & FLAG_SCORCHED != 0 && flags & FLAG_WET == 0 {
            dried += 1;
        }
        was_wet = flags & FLAG_WET != 0;
    }
    assert!(dried > 0, "the ember never dried the wet wood beside it");
}

#[test]
fn ember_still_lights_dry_fuel() {
    // The other side of drying: dry fuel has nothing to dry, so the same roll lights it.
    let mut u = Universe::new(16, 16, 5);
    set_cell_state(&mut u, 7, 8, Material::Ember, 0, 230, 0);
    set_cell_state(&mut u, 8, 8, Material::Wood, 0, 0, 0);
    for x in 6..10 {
        set_cell(&mut u, x, 9, Material::Wall);
    }
    for _ in 0..80 {
        u.tick();
        if kind_at(&u, 8, 8) == Material::Ember as u8 {
            return;
        }
    }
    panic!("an ember should light the dry wood beside it within 80 ticks");
}

#[test]
fn steam_frosts_against_ice() {
    let mut u = Universe::new(16, 16, 19);
    set_cell(&mut u, 8, 7, Material::Ice);
    set_cell(&mut u, 8, 8, Material::Steam);
    for (x, y) in [(7, 7), (9, 7), (7, 8), (9, 8), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    for _ in 0..36 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Ice as u8);
}

#[test]
fn water_wets_sand_into_clumps() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Sand);
    set_cell(&mut u, 7, 9, Material::Wall);
    set_cell(&mut u, 8, 9, Material::Wall);
    set_cell(&mut u, 9, 9, Material::Wall);
    set_cell(&mut u, 7, 8, Material::Water);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Sand as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_WET != 0);
    assert!(energy_at(&u, 8, 8) > 0);
}

#[test]
fn moss_colonizes_damp_stone() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 7, 8, Material::Moss, 12, 150, FLAG_WET);
    set_cell_state(&mut u, 8, 8, Material::Stone, 20, 90, FLAG_WET);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Moss as u8);
}

#[test]
fn oil_blocks_plain_water_hydration() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Seed, 12, 80, 0);
    set_cell(&mut u, 8, 9, Material::Stone);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell(&mut u, 9, 8, Material::Oil);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Seed as u8);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_WET, 0);
    assert!(energy_at(&u, 8, 8) < 90);
}

#[test]
fn oil_rises_above_water() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 7, Material::Water);
    set_cell(&mut u, 8, 8, Material::Oil);
    // Sealed under the diagonals and two cells out too: the water the oil lifts would
    // otherwise run or hop out of (8, 8) the tick after the swap. The test once passed only
    // by ending on the swap's tick. Four ticks are one whole cycle of oil's cadence.
    for (x, y) in [(6, 7), (7, 7), (9, 7), (10, 7), (6, 8), (7, 8), (9, 8), (10, 8), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    for _ in 0..4 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 7), Material::Oil as u8);
    assert_eq!(kind_at(&u, 8, 8), Material::Water as u8);
}

#[test]
fn wet_sand_drains_back_to_loose_sand() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Sand, 0, 4, FLAG_WET);
    set_cell(&mut u, 7, 9, Material::Wall);
    set_cell(&mut u, 8, 9, Material::Wall);
    set_cell(&mut u, 9, 9, Material::Wall);
    for _ in 0..8 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Sand as u8);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_WET, 0);
    assert_eq!(energy_at(&u, 8, 8), 0);
}

#[test]
fn heat_stresses_damp_hard_materials() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell_state(&mut u, 8, 8, Material::Stone, 12, 90, FLAG_WET);
    set_cell_state(&mut u, 8, 9, Material::Wall, 12, 90, FLAG_WET);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_WET, 0);
    assert_eq!(kind_at(&u, 8, 9), Material::Wall as u8);
    assert!(flags_at(&u, 8, 9) & FLAG_SCORCHED != 0);
    assert_eq!(flags_at(&u, 8, 9) & FLAG_WET, 0);
}

#[test]
fn water_quenches_lava_into_steam_and_stone() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell_state(&mut u, 8, 8, Material::Lava, 12, 80, 0);
    u.tick();
    assert_eq!(kind_at(&u, 7, 8), Material::Steam as u8);
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
}

#[test]
fn water_shocks_meteor_into_steam_and_stone() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell(&mut u, 8, 8, Material::Meteor);
    set_cell(&mut u, 8, 9, Material::Stone);
    u.tick();
    assert_eq!(kind_at(&u, 7, 8), Material::Steam as u8);
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
}

#[test]
fn ice_frost_stresses_damp_hard_materials() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Ice);
    set_cell_state(&mut u, 8, 8, Material::Stone, 12, 60, FLAG_WET);
    set_cell(&mut u, 8, 9, Material::Wall); // bedrock so the frost-stressed stone stays put
    set_cell_state(&mut u, 7, 9, Material::Wall, 12, 60, FLAG_WET);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_FROZEN != 0);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_SCORCHED, 0);
    assert_eq!(kind_at(&u, 7, 9), Material::Wall as u8);
    assert!(flags_at(&u, 7, 9) & FLAG_FROZEN != 0);
    assert_eq!(flags_at(&u, 7, 9) & FLAG_SCORCHED, 0);
}

#[test]
fn ice_leaves_dry_stone_and_wall_unfrosted() {
    // The other half of the test above. Frost gets into masonry through the water it
    // holds, so a dry rock or wall can sit against ice indefinitely and stay bare.
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Ice);
    set_cell(&mut u, 8, 8, Material::Stone);
    set_cell(&mut u, 8, 9, Material::Wall); // bedrock so the stone stays put
    set_cell(&mut u, 7, 9, Material::Wall);
    for tick in 0..300 {
        u.tick();
        for (x, y) in [(8, 8), (8, 9), (7, 9)] {
            assert_eq!(
                flags_at(&u, x, y) & FLAG_FROZEN,
                0,
                "dry masonry at ({x},{y}) frosted against ice on tick {tick}"
            );
        }
    }
    assert_eq!(kind_at(&u, 7, 8), Material::Ice as u8);
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
}

#[test]
fn heat_steams_wet_wood_before_burning() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell_state(&mut u, 8, 8, Material::Wood, 12, 90, FLAG_WET);
    u.tick();
    assert_eq!(kind_at(&u, 8, 7), Material::Steam as u8);
    assert_eq!(kind_at(&u, 8, 8), Material::Wood as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_WET, 0);
}

#[test]
fn mature_flower_releases_pollen() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Flower, 130, 220, FLAG_ROOTED | FLAG_WET);
    set_cell(&mut u, 7, 8, Material::Water);
    for (x, y) in [(6, 8), (5, 8), (9, 8), (6, 9), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Stone);
    }
    let mut released = false;
    for _ in 0..2000 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Pollen as u8) {
            released = true;
            break;
        }
    }
    assert!(released, "a mature healthy flower should release pollen motes");
}

#[test]
fn untended_garden_still_releases_pollen_within_its_energy_arc() {
    // Fresh blooms (energy 90, draining 1/tick) must be able to seed the next
    // generation without continuous hand-watering: the pollen loop is dead if
    // the gate outlives the blooms' own energy. Seeding is gentle per bloom,
    // so the assertion is per garden, not per flower.
    let mut u = Universe::new(24, 16, 7);
    for x in (3..21).step_by(2) {
        set_cell_state(&mut u, x, 8, Material::Flower, 0, 90, FLAG_ROOTED);
    }
    for x in 0..24 {
        set_cell(&mut u, x, 9, Material::Stone);
    }
    let mut released = false;
    for _ in 0..90 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Pollen as u8) {
            released = true;
            break;
        }
    }
    assert!(
        released,
        "an untended garden of blooms should release pollen before their energy runs out"
    );
}

/// A column of petals of species `variant` standing on a wall, with motes of species
/// `mote_variant` falling down its east side, over a wall floor. The petals are spent
/// (energy under `POLLEN_RESERVE`), or they would puff pollen of their own kind and
/// pollinate themselves.
fn pollen_beside_a_flower(variant: u8, mote_variant: u8, flower_flags: u16) -> Universe {
    let mut u = Universe::new(40, 30, 7);
    for x in 0..40 {
        set_cell(&mut u, x, 28, Material::Wall);
        set_cell(&mut u, x, 29, Material::Wall);
    }
    set_cell(&mut u, 10, 21, Material::Wall);
    for y in 2..21 {
        set_cell_state(&mut u, 10, y, Material::Flower, 30, POLLEN_RESERVE - 10, flower_flags);
        let idx = u.idx(10, y);
        u.cells[idx].variant = variant;
    }
    for y in 2..8 {
        set_cell_state(&mut u, 11, y, Material::Pollen, POLLINATE_AGE + 10, 150, 0);
        let idx = u.idx(11, y);
        u.cells[idx].variant = mote_variant;
    }
    u
}

#[test]
fn pollen_brushing_a_flower_of_its_kind_sets_a_seed_that_glides_away() {
    let mut u = pollen_beside_a_flower(2, 2, 0);
    let mut set_at: Option<u32> = None;
    for _ in 0..300 {
        u.tick();
        if set_at.is_none() {
            set_at = (0..40u32).find(|&x| {
                (0..28u32).any(|y| kind_at(&u, x, y) == Material::Seed as u8 && flags_at(&u, x, y) & FLAG_WINDBORNE != 0)
            });
        }
    }
    let set_at = set_at.expect("a mote brushing a flower of its own kind should set a seed");
    // The flower is west of the motes, so the seed glides east, and lands on the floor as
    // an ordinary seed, well clear of where it was set.
    let landed: Vec<u32> = (0..40u32)
        .filter(|&x| kind_at(&u, x, 27) == Material::Seed as u8 && flags_at(&u, x, 27) & FLAG_WINDBORNE == 0)
        .collect();
    assert!(!landed.is_empty(), "the set seed should land on the floor and stop gliding");
    assert!(
        landed.iter().any(|&x| x >= set_at + 8),
        "a seed set at x={set_at} should glide well east before landing, landed at {landed:?}"
    );
}

#[test]
fn pollen_beside_a_flower_of_another_kind_sets_nothing() {
    let mut u = pollen_beside_a_flower(2, 3, 0);
    for _ in 0..300 {
        u.tick();
        assert!(
            !u.cells.iter().any(|cell| cell.kind == Material::Seed as u8),
            "pollen is not a seed: it sets one only on a flower of its own kind"
        );
    }
}

#[test]
fn cosmic_flower_pollen_breeds_a_cosmic_seed() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Flower, 30, 150, FLAG_ROOTED | FLAG_COSMIC);
    for (x, y) in [(7, 8), (9, 8), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    let mut cosmic_mote = false;
    for _ in 0..300 {
        u.tick();
        if u
            .cells
            .iter()
            .any(|cell| cell.kind == Material::Pollen as u8 && cell.flags & FLAG_COSMIC != 0)
        {
            cosmic_mote = true;
            break;
        }
    }
    assert!(cosmic_mote, "a cosmic flower's pollen should carry the cosmic flag");

    // And a moonlit flower sets a cosmic seed, so its garden breeds true.
    let mut u = pollen_beside_a_flower(4, 4, FLAG_COSMIC);
    let mut cosmic_seed = false;
    for _ in 0..300 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Seed as u8 && cell.flags & FLAG_COSMIC != 0) {
            cosmic_seed = true;
            break;
        }
    }
    assert!(cosmic_seed, "a cosmic flower should set a cosmic seed");
}

/// A seed lying on moss, in a walled cup, watered or not. The moss stands on a wall floor.
fn seed_on_moss(watered: bool) -> Universe {
    let mut u = Universe::new(24, 24, 7);
    for x in 2..22 {
        set_cell(&mut u, x, 22, Material::Wall);
        set_cell(&mut u, x, 23, Material::Wall);
        set_cell_state(&mut u, x, 21, Material::Moss, 10, 60, 0);
    }
    set_cell_state(&mut u, 12, 20, Material::Seed, 40, SET_SEED_ENERGY, 0);
    if watered {
        set_cell(&mut u, 12, 19, Material::Water);
    }
    u
}

#[test]
fn a_set_seed_waits_for_water_then_roots_in_moss() {
    let sprouted = |mut u: Universe| {
        (0..400).any(|_| {
            u.tick();
            u.cells.iter().any(|cell| cell.kind == Material::Stem as u8)
        })
    };
    assert!(!sprouted(seed_on_moss(false)), "a dry seed on moss should wait for water");
    assert!(sprouted(seed_on_moss(true)), "a watered seed on moss should root and sprout");
}


/// The other half of the wash: a hearth doused under still water keeps its char — in a
/// shallow open pond, where no water cell has anywhere to go, so none of it is running.
#[test]
fn still_water_keeps_a_quenched_hearth() {
    let mut u = Universe::new(16, 16, 7);
    open_shallow_pond(&mut u);
    set_cell_state(&mut u, 7, 11, Material::Ember, 12, 0, FLAG_WET);
    for _ in 0..400 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 7, 11), Material::Ember as u8, "still water must not wash the char away");
}

/// A stream: a wellspring attuned to water pouring onto a long floor, running past the
/// cell at (8, 12) toward open ground. The rinse and the char wash need RUNNING water —
/// water that could actually move — and these tests used to wall a single water cell in on
/// every side it could go, which only counted as running because of the air above it:
/// the exact loophole review found in the flow test they were certifying.
fn stream_past_the_middle(u: &mut Universe) {
    for x in 0..32 {
        set_cell(u, x, 13, Material::Wall);
    }
    for (x, y) in [(3, 11), (3, 12), (4, 11), (4, 12)] {
        set_cell_state(u, x, y, Material::Wellspring, 0, Material::Water as u16, 0);
    }
}

#[test]
fn water_washes_cold_char_away() {
    let mut u = Universe::new(32, 16, 7);
    stream_past_the_middle(&mut u);
    set_cell_state(&mut u, 8, 12, Material::Ember, 200, 10, 0);
    let mut washed = false;
    for _ in 0..400 {
        u.tick();
        if kind_at(&u, 8, 12) != Material::Ember as u8 {
            washed = true;
            break;
        }
    }
    assert!(washed, "running water should crumble cold char away");
}

#[test]
fn meteor_impact_shatters_glass_to_sand() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Meteor);
    set_cell(&mut u, 8, 9, Material::Wall);
    set_cell(&mut u, 7, 8, Material::Glass);
    set_cell(&mut u, 7, 9, Material::Wall);
    u.tick();
    assert_eq!(kind_at(&u, 7, 8), Material::Sand as u8, "impact should shatter glass back to sand");
}

#[test]
fn first_water_on_dry_soil_breathes_mist() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Soil, 60, 0, 0);
    set_cell(&mut u, 7, 8, Material::Water);
    for (x, y) in [(6, 8), (5, 8), (9, 8), (6, 9), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Stone);
    }
    u.tick();
    assert!(
        u.cells.iter().any(|cell| cell.kind == Material::Steam as u8),
        "first watering of long-dry soil should breathe out a mist wisp"
    );
}

#[test]
fn saturated_moss_drips_dew() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 4, Material::Moss, 10, 220, FLAG_WET);
    let mut dripped = false;
    for _ in 0..200 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Water as u8) {
            dripped = true;
            break;
        }
    }
    assert!(dripped, "saturated overhanging moss should shed a dew droplet");
}

#[test]
fn cosmic_fed_seed_grows_a_taller_stalk() {
    fn grow_height(cosmic: bool) -> u32 {
        let mut u = Universe::new(16, 33, 7);
        let flags = FLAG_WET | if cosmic { FLAG_COSMIC } else { 0 };
        set_cell_state(&mut u, 8, 30, Material::Seed, 40, 180, flags);
        set_cell(&mut u, 8, 31, Material::Soil);
        for (x, y) in [(7, 31), (9, 31), (7, 32), (8, 32), (9, 32)] {
            set_cell(&mut u, x, y, Material::Stone);
        }
        for _ in 0..600 {
            u.tick();
        }
        // Tallest plant cell is the smallest y holding a Stem or Flower, measured up from the base.
        let mut top = 30;
        for y in 0..30 {
            for x in 0..16 {
                let k = kind_at(&u, x, y);
                if k == Material::Stem as u8 || k == Material::Flower as u8 {
                    top = top.min(y);
                }
            }
        }
        30 - top
    }
    let plain = grow_height(false);
    let cosmic = grow_height(true);
    assert!(plain >= 2, "a plain fed seed should still grow a visible stalk, got {plain}");
    assert!(
        cosmic > plain,
        "cosmic feeding should grow a taller stalk (cosmic {cosmic} vs plain {plain})"
    );
}

#[test]
fn well_watered_moss_spreads_in_a_burst() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Moss, 12, 200, FLAG_WET);
    set_cell_state(&mut u, 7, 8, Material::Soil, 12, 60, FLAG_WET);
    set_cell_state(&mut u, 9, 8, Material::Soil, 12, 60, FLAG_WET);
    u.tick();
    assert_eq!(kind_at(&u, 7, 8), Material::Moss as u8);
    assert_eq!(kind_at(&u, 9, 8), Material::Moss as u8);

    let mut modest = Universe::new(16, 16, 7);
    set_cell_state(&mut modest, 8, 8, Material::Moss, 12, 90, FLAG_WET);
    set_cell_state(&mut modest, 7, 8, Material::Soil, 12, 60, FLAG_WET);
    set_cell_state(&mut modest, 9, 8, Material::Soil, 12, 60, FLAG_WET);
    modest.tick();
    let colonized = [kind_at(&modest, 7, 8), kind_at(&modest, 9, 8)]
        .iter()
        .filter(|&&kind| kind == Material::Moss as u8)
        .count();
    assert_eq!(colonized, 1, "modestly watered moss should still spread one patch at a time");
}

/// A shaft open to the air: the water on the rock has somewhere to go, so it counts as
/// flowing and wears the rock. The water TAKES the grain — it advances into the cell the
/// stone gave up and the wet grain drops into the cell the water came from — which is the
/// only shape of this rule that can deepen. Leaving the grain where the stone was built a
/// one-cell sand skin over the rock, the water never touched stone again, the stone dried
/// back under saturation, and erosion was over permanently: measured on a spring pouring
/// across a stone lip, 21 cells by tick 8,000 and not one more in the next 12,000.
///
/// The shaft walls are TWO cells thick on purpose. Liquids side-hop up to two cells, so a
/// one-thick walls does not contain them — the water simply hops the wall and the fixture
/// tests nothing. That is `docs/HARNESS.md`'s warning, and it cost a debugging detour here.
#[test]
fn flowing_water_erodes_stone_and_carries_the_grain_off() {
    let mut u = Universe::new(16, 16, 7);
    for y in 3..=10 {
        for x in [6, 7, 9, 10] {
            set_cell(&mut u, x, y, Material::Wall);
        }
    }
    set_cell(&mut u, 8, 10, Material::Wall);
    set_cell(&mut u, 8, 9, Material::Stone);
    set_cell(&mut u, 8, 8, Material::Water);

    let mut wet_grain = false;
    for _ in 0..30000 {
        u.tick();
        for y in 4..=9 {
            if kind_at(&u, 8, y) == Material::Sand as u8 && flags_at(&u, 8, y) & FLAG_WET != 0 {
                wet_grain = true;
            }
        }
        if wet_grain {
            break;
        }
    }
    assert!(wet_grain, "flowing water on rock should wear off a wet grain");
    assert_ne!(
        kind_at(&u, 8, 9),
        Material::Stone as u8,
        "the water should have advanced into the cell the stone gave up",
    );
}

/// The rock cycle closes on its own. Sandstone is still stone, so running water wears it
/// exactly as it wears lava rock — and what comes off is PLAIN sand, not bedded sand,
/// because erosion builds a fresh grain rather than carrying the stone's flags across. A
/// lake that set into rock can be cut back to sand by a stream, and that sand could settle
/// under water and set again. The docs claim the loop closes; this is what makes it true.
#[test]
fn eroded_sandstone_comes_off_as_plain_sand() {
    let mut u = Universe::new(16, 16, 7);
    for y in 3..=10 {
        for x in [6, 7, 9, 10] {
            set_cell(&mut u, x, y, Material::Wall);
        }
    }
    set_cell(&mut u, 8, 10, Material::Wall);
    set_cell(&mut u, 8, 9, Material::Stone);
    let rock = u.idx(8, 9);
    u.cells[rock].flags |= FLAG_BEDDED;
    set_cell(&mut u, 8, 8, Material::Water);

    let mut grain = None;
    'wear: for _ in 0..30000 {
        u.tick();
        for y in 4..=9 {
            if kind_at(&u, 8, y) == Material::Sand as u8 && flags_at(&u, 8, y) & FLAG_WET != 0 {
                grain = Some(y);
                break 'wear;
            }
        }
    }
    let y = grain.expect("running water should wear a grain off sandstone, as it does off lava rock");
    assert_eq!(
        flags_at(&u, 8, y) & FLAG_BEDDED,
        0,
        "an eroded grain must come off as plain sand — bedded is a property of the rock, not the grain"
    );
}

/// The other half of the rule, and the half that protects what a player built: still water
/// carves nothing. Water with nowhere to go is a pond, not a stream. Without this the rule
/// ate the build — measured on a stone bowl holding standing water, eroding on contact
/// alone took it from 169 stone cells to 45 in 20,000 ticks, a dissolved sand pit where
/// the pond had been. Wall never erodes either way, which is what keeps it the material to
/// build something permanent out of.
#[test]
fn still_water_with_nowhere_to_go_does_not_erode_stone() {
    let mut u = Universe::new(16, 16, 7);
    for y in 5..=10 {
        for x in 6..=10 {
            set_cell(&mut u, x, y, Material::Wall);
        }
    }
    set_cell(&mut u, 8, 8, Material::Stone);
    set_cell(&mut u, 8, 7, Material::Water);
    for _ in 0..30000 {
        u.tick();
    }
    assert_eq!(
        kind_at(&u, 8, 8),
        Material::Stone as u8,
        "stone under water that cannot move should not erode",
    );
    assert_eq!(
        kind_at(&u, 8, 7),
        Material::Water as u8,
        "and the still water should still be sitting there",
    );
}

/// The claim the matrix actually makes about a pond, which the sealed-pocket test above
/// cannot reach: an OPEN stone bowl has air over its water, so its surface cells pass the
/// flow gate and its waterline does wear. What must be true is that it wears the waterline
/// and then STOPS, rather than dissolving the basin. Eroding on contact alone — the first
/// version of this rule — took the same bowl from 169 stone cells to 45.
#[test]
fn an_open_stone_pond_wears_its_waterline_and_then_holds() {
    let mut u = Universe::new(40, 26, 7);
    for x in 0..40 {
        set_cell(&mut u, x, 25, Material::Wall);
    }
    for x in 8..=30 {
        for y in 18..=24 {
            set_cell(&mut u, x, y, Material::Stone);
        }
    }
    for y in 14..=17 {
        set_cell(&mut u, 10, y, Material::Stone);
        set_cell(&mut u, 28, y, Material::Stone);
        for x in 11..=27 {
            set_cell(&mut u, x, y, Material::Water);
        }
    }
    let stone_at = |u: &Universe| {
        (0..u.cells.len())
            .filter(|&i| u.cells[i].kind == Material::Stone as u8)
            .count()
    };
    let before = stone_at(&u);
    for _ in 0..8000 {
        u.tick();
    }
    let midway = stone_at(&u);
    for _ in 0..12000 {
        u.tick();
    }
    let after = stone_at(&u);

    assert!(
        after * 4 >= before * 3,
        "an open pond should keep most of its basin, kept {after} of {before}",
    );
    assert!(
        midway - after <= (before - midway).max(1),
        "erosion should slow as the waterline wears, not run away: \
         {before} -> {midway} in the first 8,000 ticks, then -> {after} in the next 12,000",
    );
}

#[test]
fn a_fed_stream_wears_a_trough_and_then_holds() {
    // The pond test above pins STILL water. This one pins the case the matrix actually
    // promises: water being poured, continuously, onto rock. The docs used to claim that
    // cut "a channel that deepens", and it does not — the trough it wears fills with the
    // water that made it, that water stops reading as flow, and the rule switches itself
    // off. Measured on a player-scale boulder (1,169 stone cells, a wellspring pouring
    // for 20,000 ticks) only 38 cells ever wear, and every one of the 41 stone cells
    // still touching water at the end is fully saturated with ZERO passing the flow gate.
    //
    // That equilibrium is the design — a stream should mark its bed, not eat the build —
    // so it is pinned here rather than left as prose nobody checks.
    //
    // Since water stopped deleting itself (ROADMAP Phase 20) the rock is protected a second
    // way as well: the spring's own lake rises over it. So the board is 180 wide. On the
    // old 60-wide board the lake drowned the boulder after 4 cells had worn; the stream
    // only runs — and wears — while the floor it spills onto is still filling, which is
    // what the real 220-wide tray gives it (measured there: 26 cells, then the lake).
    let (w, cx) = (180, 90);
    let mut u = Universe::new(w, 40, 7);
    for x in 0..w {
        set_cell(&mut u, x, 39, Material::Wall);
    }
    for x in cx - 15..=cx + 14 {
        for y in 27..=38 {
            set_cell(&mut u, x, y, Material::Stone);
        }
    }
    // A spring on top, taught water, pouring straight down onto the rock.
    for dy in 21..=23 {
        for dx in cx - 1..=cx + 1 {
            set_cell(&mut u, dx, dy, Material::Wellspring);
        }
    }
    set_cell(&mut u, cx, 19, Material::Water);

    let stone_at = |u: &Universe| {
        (0..u.cells.len())
            .filter(|&i| u.cells[i].kind == Material::Stone as u8)
            .count()
    };
    let before = stone_at(&u);
    for _ in 0..8000 {
        u.tick();
    }
    let midway = stone_at(&u);
    for _ in 0..12000 {
        u.tick();
    }
    let after = stone_at(&u);

    let early = before - midway;
    let late = midway - after;
    assert!(
        early >= 12,
        "a poured stream should visibly wear its bed, wore only {early} cells in 8,000 ticks",
    );
    assert!(
        late * 2 <= early,
        "erosion under a steady pour should settle, not run away: \
         {before} -> {midway} in the first 8,000 ticks, then -> {after} in the next 12,000",
    );
    assert!(
        after * 10 >= before * 8,
        "a poured-on boulder should keep most of itself, kept {after} of {before}",
    );
}

/// The heat buffer -- thaw, then dry, then burn -- is what keeps fire from being a
/// binary destroyer, and the steam it vents is the only part a player can actually see.
/// That vent used to be tried in ONE cell, straight up, and dropped silently when
/// something was there -- which is the usual case, since the flame doing the drying is
/// often the thing sitting on top of it.
#[test]
fn vapour_rises_diagonally_when_the_cell_overhead_is_blocked() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Moss, 0, 120, FLAG_WET);
    set_cell(&mut u, 8, 7, Material::Wall); // straight up is sealed
    set_cell(&mut u, 7, 8, Material::Fire);
    u.tick();

    let idx = u.idx(7, 7);
    assert_eq!(
        u.cells[idx].kind,
        Material::Steam as u8,
        "with the cell overhead blocked the wisp should still find a diagonal, \
         otherwise the byproduct is dropped in exactly the scenes that produce it",
    );
}

#[test]
fn damp_stone_without_water_contact_never_erodes() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 15, Material::Stone, 12, 200, FLAG_WET);
    for _ in 0..5000 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 15), Material::Stone as u8, "damp stone alone should stay stone");
}

#[test]
fn unsupported_stone_falls_straight_to_the_floor() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 4, Material::Stone);
    u.tick();
    assert_eq!(kind_at(&u, 8, 4), Material::Empty as u8, "the vacated cell clears");
    assert_eq!(kind_at(&u, 8, 5), Material::Stone as u8, "stone drops one cell per tick");
    for _ in 0..20 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 15), Material::Stone as u8, "stone settles on the floor");
}

#[test]
fn supported_stone_holds_and_overhangs_drop_without_slipping() {
    let mut u = Universe::new(16, 16, 7);
    // A three-wide shelf whose center rests on a lone wall pillar; both ends
    // overhang open air. Only true overhangs may drop, and always straight down.
    set_cell(&mut u, 8, 15, Material::Wall);
    set_cell(&mut u, 7, 14, Material::Stone);
    set_cell(&mut u, 8, 14, Material::Stone);
    set_cell(&mut u, 9, 14, Material::Stone);
    for _ in 0..20 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 15), Material::Wall as u8, "the pillar never moves");
    assert_eq!(kind_at(&u, 8, 14), Material::Stone as u8, "stone over the pillar holds");
    assert_eq!(kind_at(&u, 7, 15), Material::Stone as u8, "left overhang drops straight, no diagonal slip");
    assert_eq!(kind_at(&u, 9, 15), Material::Stone as u8, "right overhang drops straight, no diagonal slip");
}

#[test]
fn wall_stays_anchored_in_midair() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 4, Material::Wall);
    for _ in 0..20 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 4), Material::Wall as u8, "wall never falls, unlike stone");
}

#[test]
fn isolated_lava_crusts_into_stone_over_time() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Lava);
    for (x, y) in [(7, 8), (6, 8), (9, 8), (10, 8), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    let mut crusted = false;
    for _ in 0..1200 {
        u.tick();
        if kind_at(&u, 8, 8) == Material::Stone as u8 {
            crusted = true;
            break;
        }
    }
    assert!(crusted, "exposed lava with no heat source should crust into stone");
}

#[test]
fn sustained_flame_simmers_then_boils_water() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell(&mut u, 8, 8, Material::Water);
    for (x, y) in [(6, 8), (5, 8), (9, 8), (10, 8), (6, 9), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    u.tick();
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Water as u8, "water should heat gradually, not flash to steam");
    assert!(energy_at(&u, 8, 8) > 30, "heated water should store temperature");
    let mut boiled = false;
    for _ in 0..30 {
        u.tick();
        if kind_at(&u, 8, 8) == Material::Steam as u8 {
            boiled = true;
            break;
        }
    }
    assert!(boiled, "sustained flame should boil water away into steam");
}

#[test]
fn warm_water_gives_ice_its_heat_until_it_melts() {
    let mut u = Universe::new(16, 16, 7);
    let cells: Vec<(u32, u32)> = (7..=9).flat_map(|x| (7..=9).map(move |y| (x, y))).collect();
    pocket(&mut u, &cells);
    for &(x, y) in &cells {
        set_cell_state(&mut u, x, y, Material::Water, 4, 200, 0);
    }
    set_cell(&mut u, 8, 8, Material::Ice);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Ice as u8);
    assert!(energy_at(&u, 8, 8) > 0, "ice should take the water's warmth before it melts");
    let mut melted = false;
    for _ in 0..30 {
        u.tick();
        if kind_at(&u, 8, 8) == Material::Water as u8 {
            melted = true;
            break;
        }
    }
    assert!(melted, "ice ringed by hot water should take enough heat to melt");
}

#[test]
fn one_cell_of_hot_water_cannot_melt_a_block_of_ice() {
    // Heat is conserved: one cell at 200 has 160 above ICE_TEMP to give, short of ICE_MELT.
    let mut u = Universe::new(16, 16, 7);
    pocket(&mut u, &[(7, 8), (8, 8)]);
    set_cell_state(&mut u, 7, 8, Material::Water, 4, 200, 0);
    set_cell(&mut u, 8, 8, Material::Ice);
    for _ in 0..300 {
        u.tick();
        assert_eq!(kind_at(&u, 8, 8), Material::Ice as u8, "one splash should not melt a block");
    }
}

#[test]
fn ice_freezes_water_only_once_it_is_as_cold_as_the_ice() {
    let mut u = Universe::new(16, 16, 7);
    pocket(&mut u, &[(7, 8), (8, 8)]);
    set_cell_state(&mut u, 7, 8, Material::Water, 4, 100, 0);
    set_cell(&mut u, 8, 8, Material::Ice);
    for _ in 0..10 {
        u.tick();
        assert_eq!(kind_at(&u, 7, 8), Material::Water as u8, "water warmer than ice should not freeze");
    }
    let mut frozen = false;
    for _ in 0..300 {
        u.tick();
        if kind_at(&u, 7, 8) == Material::Ice as u8 {
            frozen = true;
            break;
        }
    }
    assert!(frozen, "water that has cooled to the ice's temperature should freeze");

    let mut u = Universe::new(16, 16, 7);
    pocket(&mut u, &[(7, 8), (8, 8)]);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell(&mut u, 8, 8, Material::Ice);
    let mut frozen = false;
    for _ in 0..40 {
        u.tick();
        if kind_at(&u, 7, 8) == Material::Ice as u8 {
            frozen = true;
            break;
        }
    }
    assert!(frozen, "cold water beside ice should freeze");
}

#[test]
fn steam_frost_brings_its_heat_into_the_ice() {
    // Steam ringed by ice. Hot steam's heat, all of it above ICE_TEMP, goes to the ice that
    // frosts it, and quench-hot steam carries ICE_MELT and more, so that ice melts. Which
    // cell freezes the steam is a roll (the steam can freeze itself, giving nothing), so it
    // is asked of most seeds, not one. A cold wisp frosts the ring and warms none of it.
    let ring: Vec<(u32, u32)> = (7..=9).flat_map(|x| (7..=9).map(move |y| (x, y))).collect();
    let ringed = |seed: u32, energy: u16| {
        let mut u = Universe::new(16, 16, seed);
        pocket(&mut u, &ring);
        for &(x, y) in &ring {
            set_cell(&mut u, x, y, Material::Ice);
        }
        set_cell_state(&mut u, 8, 8, Material::Steam, 0, energy, 0);
        u
    };
    let mut melted = 0;
    for seed in 1..=8 {
        let mut u = ringed(seed, 220);
        for _ in 0..30 {
            u.tick();
            if ring.iter().any(|&(x, y)| kind_at(&u, x, y) == Material::Water as u8) {
                melted += 1;
                break;
            }
        }
    }
    assert!(melted >= 4, "ice that frosts hot steam should take its heat and melt (melted on {melted} of 8)");
    for seed in 1..=8 {
        let mut u = ringed(seed, MIST_ENERGY);
        for _ in 0..40 {
            u.tick();
        }
        assert_eq!(kind_at(&u, 8, 8), Material::Ice as u8, "a cold wisp should frost onto ice");
        for &(x, y) in ring.iter().filter(|&&c| c != (8, 8)) {
            assert_eq!(energy_at(&u, x, y), 0, "a cold wisp should give the ice no heat");
        }
    }
}

#[test]
fn heat_spreads_through_water_and_is_conserved() {
    let mut u = Universe::new(16, 16, 7);
    let row: Vec<(u32, u32)> = (4..=9).map(|x| (x, 8)).collect();
    pocket(&mut u, &row);
    for &(x, y) in &row {
        set_cell(&mut u, x, y, Material::Water);
    }
    // 150, not over it: water over 150 vents and spends heat.
    set_cell_state(&mut u, 4, 8, Material::Water, 4, 150, 0);
    // No water drains before tick WATER_CHILL, so until then every unit is accounted for.
    for _ in 0..(WATER_CHILL - 1) {
        u.tick();
    }
    let total: u32 = row.iter().map(|&(x, y)| energy_at(&u, x, y) as u32).sum();
    assert_eq!(total, 150, "heat should move through the water, none made or lost");
    assert!(energy_at(&u, 4, 8) < 150, "the hot end should have given heat away");
    assert!(energy_at(&u, 6, 8) > 0, "the heat should have reached two cells along");
}

#[test]
fn sharing_heat_never_keeps_heat_another_rule_spent() {
    // A lone hot cell among eight cold ones gives away nearly all it has. Review found that
    // inside the reaction pass it gave heat the chill or a vent had already spent, and the
    // clamp kept it; as the tick's last step it can only share what is left.
    let ring: Vec<(u32, u32)> = (7..=9).flat_map(|x| (7..=9).map(move |y| (x, y))).collect();
    let lone = |seed: u32, energy: u16| {
        let mut u = Universe::new(16, 16, seed);
        pocket(&mut u, &ring);
        for &(x, y) in &ring {
            set_cell(&mut u, x, y, Material::Water);
        }
        set_cell_state(&mut u, 8, 8, Material::Water, 4, energy, 0);
        u
    };
    let total = |u: &Universe| ring.iter().map(|&(x, y)| energy_at(u, x, y) as u32).sum::<u32>();
    // The chill tick takes 2 from the only warm cell.
    let mut u = lone(7, 144);
    u.tick_count = WATER_CHILL - 1;
    u.tick();
    assert_eq!(total(&u), 142, "the chill's 2 should be spent, not shared");
    // A vent takes 40, on a roll; either it vented or it did not, and nothing else.
    let mut vented = 0;
    for seed in 1..=40 {
        let mut u = lone(seed, 255);
        u.tick();
        let after = total(&u);
        assert!(after == 255 || after == 215, "seed {seed}: 255 should end 255 or 215, not {after}");
        if after == 215 {
            vented += 1;
        }
    }
    assert!(vented > 0, "some seed should have vented");
}

/// A wall basin two thick on every side (liquids hop a one-cell wall), open above `top`;
/// its inside runs from x 3 to `w - 4`, down to the floor at `floor`.
fn basin(u: &mut Universe, w: u32, floor: u32, top: u32) {
    for x in 0..w {
        set_cell(u, x, floor + 1, Material::Wall);
        set_cell(u, x, floor + 2, Material::Wall);
    }
    for y in top..=floor {
        for x in [1, 2, w - 3, w - 2] {
            set_cell(u, x, y, Material::Wall);
        }
    }
}

#[test]
fn poured_lava_keeps_every_cell_while_it_spreads() {
    // A column of lava dropped into a basin. Under the move clobber a spreading pour lost
    // most of itself (408 cells to 51 in a basin); lava never deletes lava now.
    let mut u = Universe::new(24, 20, 7);
    basin(&mut u, 24, 16, 4);
    for y in 4..=12 {
        for x in 10..=13 {
            set_cell(&mut u, x, y, Material::Lava);
        }
    }
    let start = count_kind(&u, Material::Lava);
    for _ in 0..200 {
        u.tick();
        assert_eq!(
            count_kind(&u, Material::Lava) + count_kind(&u, Material::Stone),
            start,
            "spreading lava should lose no cell"
        );
    }
}

/// A blob dropped mid-floor on a 120-wide board, ticked `ticks`: the centre of its lava and
/// stone against where it was dropped, how many columns it covers, and its tallest column.
fn dropped_heap(material: Material, ticks: u32) -> (f32, u32, u32) {
    let (w, floor) = (120u32, 37u32);
    let mut u = Universe::new(w, 40, 21);
    for x in 0..w {
        set_cell(&mut u, x, floor, Material::Wall);
    }
    for y in 15..=25i32 {
        for x in 55..=65i32 {
            if (x - 60) * (x - 60) + (y - 20) * (y - 20) <= 25 {
                set_cell(&mut u, x as u32, y as u32, material);
            }
        }
    }
    for _ in 0..ticks {
        u.tick();
    }
    let (mut n, mut sum, mut height) = (0u32, 0u32, vec![0u32; w as usize]);
    for i in 0..u.cells.len() {
        let kind = u.cells[i].kind;
        if kind == material as u8 || kind == Material::Stone as u8 {
            let (x, y) = u.xy(i);
            n += 1;
            sum += x as u32;
            height[x as usize] = height[x as usize].max(floor - y as u32);
        }
    }
    let width = height.iter().filter(|&&h| h > 0).count() as u32;
    (sum as f32 / n as f32 - 60.0, width, *height.iter().max().unwrap())
}

#[test]
fn poured_lava_heaps_into_a_centred_dome_that_slumps() {
    // Lava is thick (`update_lava`): it heaps where it lands and slumps outward as it crusts.
    // It used to level as water does into a sheet one grain deep, and, moving on one pass
    // direction only, set 15-25 cells left of where it was poured.
    let (centre, width, height) = dropped_heap(Material::Lava, 150);
    assert!(centre.abs() <= 3.0, "a pour should set where it was poured, centre off by {centre}");
    assert!(height >= 4 && width <= 40, "a pour should heap: {width} wide, {height} tall");
    // And it is still a liquid, not a powder: the heap slumps rather than standing as a cone.
    let (later_centre, later_width, later_height) = dropped_heap(Material::Lava, 600);
    assert!(later_centre.abs() <= 3.0, "a slumping heap should stay centred, off by {later_centre}");
    assert!(
        later_width > width && later_height < height,
        "a heap should slump: {width} wide and {height} tall, then {later_width} and {later_height}"
    );
}

#[test]
fn water_never_deletes_the_lava_it_meets() {
    // A blob of lava and a splash of water dropped apart onto a wide floor, spreading into
    // each other, as in the audit's scene. Water flowing into a cell lava had entered that
    // tick used to overwrite it. Here lava becomes nothing but stone, and only where it
    // stands, so lava gone without stone in its place was deleted. The quench itself still
    // happens.
    let mut u = Universe::new(70, 34, 11);
    basin(&mut u, 70, 30, 12);
    let blobs = [(22i32, 16i32, 4i32, Material::Lava), (47, 16, 3, Material::Water)];
    for (cx, cy, r, material) in blobs {
        for y in cy - r..=cy + r {
            for x in cx - r..=cx + r {
                if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r {
                    set_cell(&mut u, x as u32, y as u32, material);
                }
            }
        }
    }
    for _ in 0..600 {
        let was: Vec<usize> = (0..u.cells.len())
            .filter(|&i| u.cells[i].kind == Material::Lava as u8)
            .collect();
        u.tick();
        let set = was.iter().filter(|&&i| u.cells[i].kind == Material::Stone as u8).count();
        assert_eq!(
            was.len(),
            count_kind(&u, Material::Lava) + set,
            "lava should leave only by setting to stone where it stands"
        );
    }
    assert!(
        u.cells.iter().any(|c| c.kind == Material::Stone as u8 && c.flags & FLAG_SCORCHED != 0),
        "water should still quench lava into scorched stone"
    );
}

#[test]
fn a_deep_lava_pool_sets_into_stone_from_within() {
    // A pool every cell of which has three hot neighbours or more: it used to stay molten
    // for ever, and once lava stopped deleting itself a lava spring flooded the board.
    let mut u = Universe::new(24, 20, 7);
    basin(&mut u, 24, 16, 10);
    for y in 13..=16 {
        for x in 3..=20 {
            set_cell(&mut u, x, y, Material::Lava);
        }
    }
    let start = count_kind(&u, Material::Lava);
    for _ in 0..300 {
        u.tick();
    }
    assert!(count_kind(&u, Material::Lava) >= start * 9 / 10, "a deep pool should not set at once");
    let mut set = false;
    for _ in 0..3000 {
        u.tick();
        if count_kind(&u, Material::Lava) == 0 {
            set = true;
            break;
        }
    }
    assert!(set, "a deep pool should set into stone from within");
    assert_eq!(count_kind(&u, Material::Stone), start, "every cell of the pool should become stone");
}

fn oil_cells(u: &Universe) -> Vec<(u32, u32)> {
    (0..u.cells.len())
        .filter(|&i| u.cells[i].kind == Material::Oil as u8)
        .map(|i| u.xy(i))
        .map(|(x, y)| (x as u32, y as u32))
        .collect()
}

#[test]
fn poured_oil_keeps_every_cell_and_rests_as_a_sheet_spread_both_ways() {
    // A brush dab on an open floor. Under the move clobber it thinned to a few dots, and
    // oil moving on the left-to-right pass only slid them all to the board's right edge.
    let mut u = Universe::new(48, 20, 7);
    for x in 0..48 {
        set_cell(&mut u, x, 17, Material::Wall);
        set_cell(&mut u, x, 18, Material::Wall);
    }
    u.paint(24, 10, 3, Material::Oil as u8, 100);
    let start = count_kind(&u, Material::Oil);
    for _ in 0..400 {
        u.tick();
        assert_eq!(count_kind(&u, Material::Oil), start, "spreading oil should lose no cell");
    }
    let sheet = oil_cells(&u);
    assert!(sheet.iter().all(|&(_, y)| y == 16), "a pour this size should end one cell deep: {sheet:?}");
    let (left, right) = (sheet.iter().map(|c| c.0).min().unwrap(), sheet.iter().map(|c| c.0).max().unwrap());
    assert!(left < 21 && right > 27, "the sheet should run out both ways from the dab, found {left}..{right}");
    assert_eq!(right - left + 1, start as u32, "a sheet at rest has no gaps");
    for _ in 0..8 {
        u.tick();
    }
    assert_eq!(oil_cells(&u), sheet, "a sheet at rest should stay where it lies");
}

#[test]
fn a_pour_on_a_wide_floor_spreads_evenly_both_ways() {
    // Oil moves on one tick of each pass direction. On the left-to-right pass alone, even
    // flowing with momentum, a run moving against the pass shifts whole in one tick, and
    // this pour ended about 22 cells left of where it was poured; it is within 3 now.
    let mut u = Universe::new(200, 30, 7);
    for x in 0..200 {
        set_cell(&mut u, x, 27, Material::Wall);
        set_cell(&mut u, x, 28, Material::Wall);
    }
    for t in 1..=500 {
        if t <= 20 && t % 4 == 1 {
            u.paint(100, 8, 3, Material::Oil as u8, 100);
        }
        u.tick();
    }
    let sheet = oil_cells(&u);
    let centre = sheet.iter().map(|c| c.0 as f64).sum::<f64>() / sheet.len() as f64;
    assert!((centre - 100.0).abs() < 6.0, "the pour should spread evenly, its centre is {centre:.1}");
}

#[test]
fn oil_on_oil_runs_along_it_but_oil_on_a_floor_does_not_skate() {
    // The two halves of the rest rule. One cell alone on a wall floor has open air on both
    // sides and stays put; one cell on top of a sheet runs to its end and drops off.
    let mut u = Universe::new(40, 16, 7);
    for x in 0..40 {
        set_cell(&mut u, x, 13, Material::Wall);
    }
    set_cell(&mut u, 4, 12, Material::Oil);
    for x in 14..=30 {
        set_cell(&mut u, x, 12, Material::Oil);
    }
    set_cell(&mut u, 22, 11, Material::Oil);
    for _ in 0..200 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 4, 12), Material::Oil as u8, "oil on a floor should not skate");
    assert!(
        (0..40).all(|x| kind_at(&u, x, 11) != Material::Oil as u8),
        "oil on a sheet should run off its end, not stay on top"
    );
    assert!(
        kind_at(&u, 13, 12) == Material::Oil as u8 || kind_at(&u, 31, 12) == Material::Oil as u8,
        "the runner should come to rest at one end of the sheet"
    );
}

#[test]
fn spring_oil_fades_and_poured_oil_does_not() {
    // Two sheets side by side on a floor, alike but for the mark a spring puts on its oil.
    let mut u = Universe::new(48, 16, 7);
    for x in 0..48 {
        set_cell(&mut u, x, 13, Material::Wall);
    }
    for y in 8..=12 {
        set_cell(&mut u, 23, y, Material::Wall);
        set_cell(&mut u, 24, y, Material::Wall);
    }
    for x in 2..=21 {
        set_cell(&mut u, x, 12, Material::Oil);
        set_cell_state(&mut u, x + 24, 12, Material::Oil, 0, 0, FLAG_SPRING_OIL);
    }
    let marked = |u: &Universe| {
        u.cells.iter().filter(|c| c.kind == Material::Oil as u8 && c.flags & FLAG_SPRING_OIL != 0).count()
    };
    for _ in 0..40 {
        u.tick();
    }
    assert!(marked(&u) >= 15, "spring oil should fade over time, not at once: {} left", marked(&u));
    for _ in 0..4000 {
        u.tick();
    }
    assert!(marked(&u) <= 1, "spring oil should fade away: {} left", marked(&u));
    assert_eq!(count_kind(&u, Material::Oil) - marked(&u), 20, "poured oil should never fade");
}

#[test]
fn an_oil_spring_marks_its_oil_and_holds_a_lake_rather_than_flooding() {
    // One attuned cell over a floor. Kept and unfading, its oil filled the board up to the
    // spring (about 40% here) and kept the spring buried; the fade holds a lake instead.
    let (w, h) = (64u32, 40u32);
    let mut u = Universe::new(w, h, 7);
    for x in 0..w {
        set_cell(&mut u, x, h - 2, Material::Wall);
        set_cell(&mut u, x, h - 1, Material::Wall);
    }
    set_cell_state(&mut u, 32, 20, Material::Wellspring, 0, Material::Oil as u16, 0);
    for _ in 0..2000 {
        u.tick();
    }
    let early = count_kind(&u, Material::Oil);
    assert!(
        u.cells.iter().filter(|c| c.kind == Material::Oil as u8).all(|c| c.flags & FLAG_SPRING_OIL != 0),
        "every cell a spring pours should carry the mark"
    );
    for _ in 0..2000 {
        u.tick();
    }
    let late = count_kind(&u, Material::Oil);
    let board = (w * h) as usize;
    assert!(early > 50, "the spring should have poured a lake: {early}");
    assert!(late * 5 < board, "an oil spring should not flood the board: {late} of {board}");
    assert!(late * 4 < early * 5, "the lake should hold its size: {early} then {late}");
}

#[test]
fn water_holds_its_heat_between_chill_ticks() {
    let mut u = Universe::new(16, 16, 7);
    pocket(&mut u, &[(8, 8)]);
    set_cell_state(&mut u, 8, 8, Material::Water, 4, 100, 0);
    for _ in 0..(WATER_CHILL - 1) {
        u.tick();
    }
    assert_eq!(energy_at(&u, 8, 8), 100, "water should hold its heat between chill ticks");
    u.tick();
    assert_eq!(energy_at(&u, 8, 8), 98, "and lose 2 on the chill tick");
}

#[test]
fn water_rinses_soot_from_hard_surfaces() {
    let mut u = Universe::new(32, 16, 7);
    stream_past_the_middle(&mut u);
    set_cell_state(&mut u, 8, 12, Material::Stone, 12, 40, FLAG_SCORCHED);
    let mut rinsed = false;
    for _ in 0..400 {
        u.tick();
        if flags_at(&u, 8, 12) & FLAG_SCORCHED == 0 {
            rinsed = true;
            break;
        }
    }
    assert!(rinsed, "running water should rinse soot from scorched stone");
    assert_eq!(kind_at(&u, 8, 12), Material::Stone as u8);
}

/// A shallow pond, two rows deep, OPEN to the air above, in a basin walled two thick. None
/// of its water can move — below is the floor or the stone, beside is more water or wall —
/// but its surface has air above it. That is the case review found the first flow test
/// getting wrong: it counted any empty neighbour, including the sky, as "running".
fn open_shallow_pond(u: &mut Universe) {
    for y in 4..=13 {
        for x in 3..=12 {
            set_cell(u, x, y, Material::Wall);
        }
    }
    for y in 4..=9 {
        for x in 5..=10 {
            let i = u.idx(x, y);
            u.cells[i] = Cell::empty();
        }
    }
    for y in 10..=11 {
        for x in 5..=10 {
            set_cell(u, x, y, Material::Water);
        }
    }
}

/// The other half of the rinse: still water leaves soot alone. A scorched stone at the
/// bottom of a shallow open pond, where no water cell has anywhere to go, keeps its scorch. Without
/// the flow test every water cell around a sunken stone scrubbed it at once, and a meteor
/// shocked into a pond lost its scorch within a tick or two of forming it.
#[test]
fn still_water_leaves_soot_on_a_sunken_stone() {
    let mut u = Universe::new(16, 16, 7);
    open_shallow_pond(&mut u);
    set_cell_state(&mut u, 7, 11, Material::Stone, 12, 40, FLAG_SCORCHED);
    for _ in 0..400 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 7, 11), Material::Stone as u8);
    assert_ne!(flags_at(&u, 7, 11) & FLAG_SCORCHED, 0, "still water must not rinse the soot off");
}

#[test]
fn water_weathers_stone_more_than_sealed_wall() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell(&mut u, 8, 8, Material::Stone);
    set_cell(&mut u, 8, 9, Material::Wall); // bedrock so the weathered stone stays put
    set_cell(&mut u, 7, 9, Material::Wall);
    u.tick();
    assert!(flags_at(&u, 8, 8) & FLAG_WET != 0);
    assert!(flags_at(&u, 7, 9) & FLAG_WET != 0);
    assert!(energy_at(&u, 8, 8) > energy_at(&u, 7, 9));
}

#[test]
fn steam_condenses_on_hard_surfaces() {
    let mut u = Universe::new(16, 16, 19);
    set_cell(&mut u, 7, 8, Material::Steam);
    set_cell(&mut u, 8, 8, Material::Stone);
    set_cell(&mut u, 8, 9, Material::Wall); // bedrock so the dewed stone stays put
    set_cell(&mut u, 7, 9, Material::Wall);
    u.tick();
    assert!(flags_at(&u, 8, 8) & FLAG_WET != 0);
    assert!(flags_at(&u, 7, 9) & FLAG_WET != 0);
    assert!(energy_at(&u, 8, 8) > energy_at(&u, 7, 9));
}

/// Hot steam billows once: its first open air puffs it into `PUFF_SHAPE`, the puffs fade in
/// about 3 s and leave nothing behind, and neither a puff nor mist ever billows. A hot wisp
/// and a cell of mist side by side, so a rule that always fired or never fired both fail.
#[test]
fn hot_steam_billows_once_into_puffs_and_mist_does_not() {
    let mut u = Universe::new(32, 32, 19);
    set_cell_state(&mut u, 8, 24, Material::Steam, 0, 180, 0);
    set_cell_state(&mut u, 24, 24, Material::Steam, 0, MIST_ENERGY, 0);
    let puffs = |u: &Universe, left: bool| {
        u.cells
            .iter()
            .enumerate()
            .filter(|(i, c)| c.kind == Material::Steam as u8 && c.flags & FLAG_PUFF != 0 && (i % 32 < 16) == left)
            .count()
    };
    u.tick();
    assert_eq!(puffs(&u, true), PUFF_SHAPE.len(), "a hot wisp in open air should puff into every cell of its shape");
    assert_eq!(puffs(&u, false), 0, "mist never billows");
    for _ in 0..10 {
        u.tick();
    }
    assert_eq!(puffs(&u, true), PUFF_SHAPE.len(), "a wisp billows once, and a puff never does");
    for _ in 0..55 {
        u.tick();
    }
    assert_eq!(puffs(&u, true), 0, "puffs fade in about 3 s");
    assert_eq!(count_kind(&u, Material::Water), 0, "and leave no water behind");
    assert_eq!(count_kind(&u, Material::Steam), 2, "while the wisp and the mist rise on");
}

/// A puff never turns back into water or ice and wets nothing: one wisp puffs into a dozen,
/// so a stone pot would make water out of nothing, directly or through a wall it wetted and
/// a flame later vents. Paired with an ordinary wisp in the same sealed pockets, which
/// condenses, frosts and wets.
#[test]
fn a_puff_never_condenses_frosts_or_wets_and_an_ordinary_wisp_does() {
    for flags in [FLAG_PUFF, FLAG_BILLOWED] {
        let mut u = Universe::new(24, 16, 23);
        pocket(&mut u, &[(6, 8), (16, 8)]);
        set_cell(&mut u, 7, 8, Material::Stone);
        set_cell(&mut u, 17, 8, Material::Ice);
        set_cell_state(&mut u, 6, 8, Material::Steam, 0, PUFF_ENERGY, flags);
        set_cell_state(&mut u, 16, 8, Material::Steam, 0, PUFF_ENERGY, flags);
        for _ in 0..70 {
            u.tick();
        }
        let left = (count_kind(&u, Material::Water), count_kind(&u, Material::Ice), count_kind(&u, Material::Steam));
        let wetted = u.cells.iter().filter(|c| c.flags & FLAG_WET != 0).count();
        if flags == FLAG_PUFF {
            assert_eq!(left, (0, 1, 0), "a puff should fade, never condense on stone or frost onto ice");
            assert_eq!(wetted, 0, "and should wet nothing");
        } else {
            assert_eq!(left, (1, 2, 0), "an ordinary wisp condenses on stone and frosts onto ice");
            assert!(wetted > 0, "and wets the masonry it touches");
        }
    }
}

/// A puff goes only where air joins it to its wisp. A hot wisp sealed in a ring of single
/// wall, with open air two cells out, puffs nothing; checking emptiness alone put puffs
/// beyond the wall (review). Its twin in open air billows, so the test cannot pass by
/// billowing never happening.
#[test]
fn a_wisp_never_puffs_through_a_wall() {
    let mut u = Universe::new(32, 16, 29);
    for dy in -1i32..=1 {
        for dx in -1i32..=1 {
            if (dx, dy) != (0, 0) {
                set_cell(&mut u, (8 + dx) as u32, (8 + dy) as u32, Material::Wall);
            }
        }
    }
    set_cell_state(&mut u, 8, 8, Material::Steam, 0, 180, 0);
    set_cell_state(&mut u, 24, 8, Material::Steam, 0, 180, 0);
    u.tick();
    let puffs = |left: bool| {
        u.cells
            .iter()
            .enumerate()
            .filter(|(i, c)| c.kind == Material::Steam as u8 && c.flags & FLAG_PUFF != 0 && (i % 32 < 16) == left)
            .count()
    };
    assert_eq!(puffs(true), 0, "a sealed wisp should puff nothing through its wall");
    assert_eq!(puffs(false), PUFF_SHAPE.len(), "while its twin in open air billows");
}

#[test]
fn smoke_leaves_soot_instead_of_condensation() {
    let mut u = Universe::new(16, 16, 19);
    set_cell(&mut u, 7, 8, Material::Smoke);
    set_cell(&mut u, 8, 8, Material::Wall);
    u.tick();
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_WET, 0);
}

#[test]
fn only_moonwater_charged_moss_takes_a_wall() {
    let crosses = |energy: u16, flags: u16| {
        let mut u = Universe::new(16, 16, 7);
        set_cell_state(&mut u, 7, 8, Material::Moss, 12, energy, flags);
        set_cell_state(&mut u, 8, 8, Material::Wall, 12, 90, FLAG_WET);
        u.tick();
        kind_at(&u, 8, 8) == Material::Moss as u8
    };
    assert!(!crosses(130, FLAG_WET), "weak moss must not take a wall");
    // The case a pond produces every tick now that water is conserved.
    assert!(!crosses(170, FLAG_WET), "strongly fed PLAIN moss must not take a wall");
    assert!(crosses(170, FLAG_WET | FLAG_COSMIC), "moonwater-charged moss takes a soaked wall");
}

#[test]
fn stardust_charges_water_into_moonwater() {
    let mut u = Universe::new(16, 16, 13);
    set_cell(&mut u, 8, 8, Material::Water);
    set_cell(&mut u, 7, 8, Material::Stardust);
    for (x, y) in [(7, 7), (8, 7), (9, 7), (9, 8), (7, 9), (8, 9), (9, 9)] {
        set_cell(&mut u, x, y, Material::Stone);
    }
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Moonwater as u8);
}

/// The two cells are sealed in a pocket so they stay in contact. The first version left
/// the moonwater with nothing under it: it fell away from the oil within a tick, and the
/// test passed only if the 1-in-4 cleaning roll landed in that instant — 35 seeds in 50.
/// Any change to the RNG stream could flip it, and one did. Sealed, it is 50 of 50.
#[test]
fn moonwater_cleans_oil_into_stardust() {
    let mut u = Universe::new(16, 16, 17);
    set_cell(&mut u, 7, 8, Material::Moonwater);
    set_cell(&mut u, 8, 8, Material::Oil);
    // Two thick on each side: a liquid side-hops two cells and would jump a single wall.
    for x in [5, 6, 9, 10] {
        set_cell(&mut u, x, 8, Material::Wall);
    }
    for x in 5..=10 {
        set_cell(&mut u, x, 9, Material::Wall);
    }
    for _ in 0..24 {
        u.tick();
    }
    assert!(u.cells.iter().any(|cell| cell.kind == Material::Stardust as u8));
}

#[test]
fn meteor_moonwater_contact_bursts_to_stardust() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Meteor);
    set_cell(&mut u, 7, 8, Material::Moonwater);
    set_cell(&mut u, 7, 9, Material::Wall);
    set_cell(&mut u, 8, 9, Material::Wall);
    set_cell(&mut u, 9, 9, Material::Wall);
    u.tick();
    assert_eq!(kind_at(&u, 7, 8), Material::Stardust as u8);
}

#[test]
fn wood_ignites_into_ember_instead_of_bare_flame() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell(&mut u, 8, 8, Material::Wood);
    let mut embered = false;
    for _ in 0..40 {
        u.tick();
        if u.cells.iter().any(|cell| cell.kind == Material::Ember as u8) {
            embered = true;
            break;
        }
    }
    assert!(embered, "burning wood should become a glowing ember");
}

#[test]
fn ember_cools_into_inert_char() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Ember, 40, 4, 0);
    for _ in 0..6 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Ember as u8, "cold char should persist instead of vanishing");
    assert_eq!(energy_at(&u, 8, 8), 0);
}

#[test]
fn water_quenches_hot_ember() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Ember, 10, 230, 0);
    set_cell(&mut u, 7, 8, Material::Water);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Ember as u8);
    assert!(energy_at(&u, 8, 8) < 120, "water should quench ember heat");
    assert!(flags_at(&u, 8, 8) & FLAG_WET != 0, "quenched ember should read wet");
}

#[test]
fn cold_char_relights_near_fire() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Ember, 120, 20, 0);
    set_cell(&mut u, 7, 8, Material::Fire);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Ember as u8);
    assert!(energy_at(&u, 8, 8) > 150, "char should relight near open heat");
}

fn crack_and_plain_cells() -> ((u32, u32), (u32, u32)) {
    let on = (4..12).flat_map(|y| (4..12).map(move |x| (x, y)));
    let crack = on.clone().find(|&(x, y)| ember_crack(x, y)).unwrap();
    let plain = on.filter(|&(x, y)| !ember_crack(x, y) && (x as i32 - crack.0 as i32).abs() > 1).next().unwrap();
    (crack, plain)
}

#[test]
fn a_crack_ember_holds_its_glow_where_a_plain_one_goes_cold() {
    let mut u = Universe::new(16, 16, 7);
    let ((cx, cy), (px, py)) = crack_and_plain_cells();
    set_cell_state(&mut u, cx, cy, Material::Ember, 10, 90, 0);
    set_cell_state(&mut u, px, py, Material::Ember, 10, 90, 0);
    for _ in 0..200 {
        u.tick();
    }
    assert!(energy_at(&u, cx, cy) >= 75, "a crack should still glow after 10 s, has {}", energy_at(&u, cx, cy));
    assert_eq!(energy_at(&u, px, py), 0, "an ember off the cracks cools at the old pace");
}

#[test]
fn a_crack_ember_drains_at_full_pace_while_it_can_light_wood() {
    // Above 90 an ember lights its neighbours, so a crack must not linger there: a fire
    // spreads exactly as it did before cracks.
    let mut u = Universe::new(16, 16, 7);
    let ((cx, cy), _) = crack_and_plain_cells();
    set_cell_state(&mut u, cx, cy, Material::Ember, 10, 200, 0);
    for _ in 0..50 {
        u.tick();
    }
    assert_eq!(energy_at(&u, cx, cy), 100);
}

#[test]
fn a_held_crack_relights_beside_a_new_flame_and_lights_fresh_wood() {
    // A crack holds at 66-90, above the 60 that heat relights spent ember from; it must still
    // catch, or a second fire would stop at a smouldering log. Found by review, 2026-10-28.
    let mut u = Universe::new(16, 16, 7);
    let ((cx, cy), _) = crack_and_plain_cells();
    set_cell_state(&mut u, cx, cy, Material::Ember, 10, 80, 0);
    set_cell(&mut u, cx - 1, cy, Material::Fire);
    set_cell(&mut u, cx + 1, cy, Material::Wood);
    u.tick();
    assert!(energy_at(&u, cx, cy) > 150, "a crack should relight beside a flame, has {}", energy_at(&u, cx, cy));
    let mut lit = false;
    for _ in 0..40 {
        u.tick();
        lit |= kind_at(&u, cx + 1, cy) == Material::Ember as u8;
    }
    assert!(lit, "the relit crack should light the wood beside it");
}

#[test]
fn a_painted_log_burns_down_to_glowing_cracks() {
    let mut u = Universe::new(48, 32, 7);
    for x in 6..42 {
        u.paint(x, 30, 0, Material::Wall as u8, 100);
    }
    for y in 22..28 {
        for x in 12..36 {
            u.paint(x, y, 0, Material::Wood as u8, 100);
        }
    }
    u.paint(24, 20, 2, Material::Fire as u8, 100);
    let glowing = |u: &Universe| {
        u.cells.iter().enumerate().filter(|(_, c)| c.kind == Material::Ember as u8 && c.energy >= 60).map(|(i, _)| i).collect::<Vec<_>>()
    };
    for _ in 0..300 {
        u.tick();
    }
    // 15 s after it lit, today's log was long dark; now only its cracks glow.
    let lit = glowing(&u);
    assert!(lit.len() >= 20, "a burnt log should keep glowing cracks, has {}", lit.len());
    assert!(lit.iter().all(|&i| ember_crack(i as u32 % 48, i as u32 / 48)), "only crack cells glow");
    assert!(!u.cells.iter().any(|c| c.kind == Material::Wood as u8), "the log burned through");
    for _ in 0..500 {
        u.tick();
    }
    assert!(glowing(&u).is_empty(), "the cracks go dark in the end");
}

#[test]
fn accumulated_freeze_thaw_crumbles_wall_into_stone() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell_state(&mut u, 8, 8, Material::Wall, 30, 190, FLAG_FROZEN);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
}

#[test]
fn first_thaw_keeps_wall_standing() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell_state(&mut u, 8, 8, Material::Wall, 30, 88, FLAG_FROZEN);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Wall as u8);
    assert_eq!(flags_at(&u, 8, 8) & FLAG_FROZEN, 0);
    assert!(flags_at(&u, 8, 8) & FLAG_WET != 0, "thawed wall should keep melt dampness");
}

#[test]
fn stardust_snuffs_fire_into_sparkle() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Stardust);
    set_cell(&mut u, 8, 8, Material::Fire);
    for (x, y) in [(6, 9), (7, 9), (8, 9), (9, 9), (6, 8), (9, 8)] {
        set_cell(&mut u, x, y, Material::Stone);
    }
    let mut sparkled = false;
    for _ in 0..12 {
        u.tick();
        let stardust = u.cells.iter().filter(|cell| cell.kind == Material::Stardust as u8).count();
        if stardust >= 2 {
            sparkled = true;
            break;
        }
    }
    assert!(sparkled, "stardust should transmute adjacent fire into a sparkle burst");
}

#[test]
fn stardust_etches_constellations_on_stone() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Stardust);
    set_cell(&mut u, 8, 8, Material::Stone);
    for (x, y) in [(6, 9), (7, 9), (8, 9), (6, 8), (9, 8), (6, 7), (7, 7), (8, 7)] {
        set_cell(&mut u, x, y, Material::Wall);
    }
    for _ in 0..64 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_COSMIC != 0, "resting stardust should etch stone cosmic");
}

#[test]
fn lava_vitrifies_dry_sand_into_glass() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Lava);
    set_cell(&mut u, 8, 8, Material::Sand);
    for (x, y) in [(7, 9), (8, 9), (9, 9), (9, 8), (6, 8), (5, 8), (6, 9)] {
        set_cell(&mut u, x, y, Material::Stone);
    }
    for _ in 0..24 {
        u.tick();
    }
    assert!(u.cells.iter().any(|cell| cell.kind == Material::Glass as u8));
}

#[test]
fn meteor_impact_vitrifies_nearby_sand() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 8, 8, Material::Meteor);
    set_cell(&mut u, 8, 9, Material::Wall);
    set_cell(&mut u, 7, 8, Material::Sand);
    set_cell(&mut u, 7, 9, Material::Wall);
    set_cell(&mut u, 9, 8, Material::Sand);
    set_cell(&mut u, 9, 9, Material::Wall);
    for _ in 0..4 {
        u.tick();
    }
    assert!(u.cells.iter().any(|cell| cell.kind == Material::Glass as u8));
}

#[test]
fn wet_sand_takes_scorch_before_vitrifying() {
    let mut u = Universe::new(16, 16, 7);
    set_cell(&mut u, 7, 8, Material::Fire);
    set_cell_state(&mut u, 8, 8, Material::Sand, 12, 90, FLAG_WET);
    set_cell(&mut u, 8, 9, Material::Stone);
    u.tick();
    assert_eq!(kind_at(&u, 8, 8), Material::Sand as u8);
    assert!(flags_at(&u, 8, 8) & FLAG_SCORCHED != 0);
}

#[test]
fn same_seed_and_inputs_are_deterministic() {
    let mut a = Universe::new(24, 18, 42);
    let mut b = Universe::new(24, 18, 42);
    for u in [&mut a, &mut b] {
        u.paint(10, 2, 2, Material::Sand as u8, 100);
        u.paint(12, 3, 2, Material::Water as u8, 100);
        u.paint(7, 12, 2, Material::Fire as u8, 100);
        for _ in 0..40 {
            u.tick();
        }
    }
    assert_eq!(a.cells, b.cells);
}

#[test]
fn ice_lets_a_wellspring_be_reattuned() {
    let mut u = Universe::new(16, 16, 7);
    // A spring already attuned to water, stilled by ice, re-drinks a touching sand
    // source and forgets the water — the fix for an irreversible first-touch mistake.
    set_cell_state(&mut u, 8, 8, Material::Wellspring, 0, Material::Water as u16, 0);
    set_cell(&mut u, 8, 7, Material::Ice);
    set_cell(&mut u, 9, 8, Material::Sand);
    u.tick();
    assert_eq!(energy_at(&u, 8, 8), Material::Sand as u16, "a chilled spring re-drinks a touching source");
    assert_eq!(kind_at(&u, 9, 8), Material::Empty as u8, "re-attunement consumes the new source cell");
}

#[test]
fn a_chilled_spring_ignores_its_own_pool_and_keeps_the_new_lesson() {
    // The test above hand-places a bare spring. A real one sits in its own pool, and
    // the scan reaches that pool first: water on the left comes before sand on the right.
    let mut u = Universe::new(16, 16, 7);
    for x in 5..=11 {
        set_cell(&mut u, x, 9, Material::Wall);
    }
    set_cell_state(&mut u, 8, 8, Material::Wellspring, 0, Material::Water as u16, 0);
    set_cell(&mut u, 8, 7, Material::Ice);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell(&mut u, 9, 8, Material::Sand);
    u.tick();
    assert_eq!(energy_at(&u, 8, 8), Material::Sand as u16, "it learns the NEW material, not its own pool");
    let water = u.cells.iter().filter(|c| c.kind == Material::Water as u8).count();
    assert_eq!(water, 1, "its own pool water is left alone");
    // More of its old material arrives while it is still chilled: the lesson holds.
    let pool = u.idx(7, 8);
    u.cells[pool] = Cell::new(Material::Water as u8, 0, starting_energy(Material::Water as u8));
    for _ in 0..20 {
        u.tick();
        assert_eq!(energy_at(&u, 8, 8), Material::Sand as u16, "a lesson holds while the ice does");
    }
    // Lift the chill and it pours what it learned, still holding the latch for a while.
    let ice = u.idx(8, 7);
    u.cells[ice] = Cell::empty();
    for _ in 0..60 {
        u.tick();
    }
    assert_eq!(energy_at(&u, 8, 8), Material::Sand as u16, "it still remembers sand once the ice is gone");
    assert!(
        u.cells.iter().filter(|c| c.kind == Material::Sand as u8).count() > 1,
        "a freed spring pours its new material straight away"
    );
    assert_ne!(flags_at(&u, 8, 8) & FLAG_TAUGHT, 0, "it keeps the latch through the hold");
    for _ in 0..LESSON_HOLD {
        u.tick();
    }
    assert_eq!(flags_at(&u, 8, 8) & FLAG_TAUGHT, 0, "and lets go once the hold has passed");
}

#[test]
fn a_lesson_relays_through_cells_that_already_know_it() {
    // A one-cell-wide spring, water except one cell that already remembers sand, so the
    // lesson has no way round it. Ice and sand touch only the left end.
    let mut u = Universe::new(16, 16, 7);
    for x in 2..=13 {
        set_cell(&mut u, x, 7, Material::Wall);
        set_cell(&mut u, x, 9, Material::Wall);
    }
    for x in 4..=10 {
        let memory = if x == 6 { Material::Sand } else { Material::Water };
        set_cell_state(&mut u, x, 8, Material::Wellspring, 0, memory as u16, 0);
    }
    set_cell(&mut u, 11, 8, Material::Wall);
    set_cell(&mut u, 3, 8, Material::Wall);
    set_cell(&mut u, 4, 7, Material::Ice);
    set_cell(&mut u, 5, 7, Material::Sand);
    for _ in 0..20 {
        u.tick();
    }
    for x in 4..=10 {
        assert_eq!(energy_at(&u, x, 8), Material::Sand as u16, "spring cell ({x},8) never got the lesson");
    }
}

#[test]
fn a_lesson_lets_go_of_the_whole_spring_once_the_ice_is_gone() {
    // Relaying must not let ageing latches re-teach each other forever.
    let mut u = Universe::new(16, 16, 7);
    for x in 3..=12 {
        set_cell(&mut u, x, 9, Material::Wall);
    }
    for x in 5..=9 {
        set_cell_state(&mut u, x, 8, Material::Wellspring, 0, Material::Water as u16, 0);
    }
    set_cell(&mut u, 4, 8, Material::Ice);
    set_cell(&mut u, 4, 7, Material::Sand);
    for _ in 0..10 {
        u.tick();
    }
    let ice = u.idx(4, 8);
    u.cells[ice] = Cell::empty();
    for _ in 0..(LESSON_HOLD as usize + 40) {
        u.tick();
    }
    for x in 5..=9 {
        assert_eq!(energy_at(&u, x, 8), Material::Sand as u16, "spring cell ({x},8) lost its lesson");
        assert_eq!(flags_at(&u, x, 8) & FLAG_TAUGHT, 0, "spring cell ({x},8) never let go of the latch");
    }
}

#[test]
fn a_freshly_taught_spring_chilled_again_does_not_relearn_its_old_pool() {
    // The relapse the hold exists for: a spring just re-taught to sand, free and pouring,
    // is chilled again by its old pool freezing outward, with that pool's water beside it.
    let mut u = Universe::new(16, 16, 7);
    for x in 5..=11 {
        set_cell(&mut u, x, 9, Material::Wall);
    }
    set_cell_state(&mut u, 8, 8, Material::Wellspring, 0, Material::Sand as u16, FLAG_TAUGHT);
    for _ in 0..30 {
        u.tick();
    }
    set_cell(&mut u, 7, 7, Material::Ice);
    set_cell(&mut u, 7, 8, Material::Water);
    set_cell(&mut u, 9, 8, Material::Water);
    for _ in 0..20 {
        u.tick();
        assert_eq!(energy_at(&u, 8, 8), Material::Sand as u16, "it took its old water back");
    }
}

#[test]
fn a_lesson_spreads_through_the_attuned_spring_but_not_its_dormant_core() {
    // Ice and sand touch only the left end of a two-row spring. Every attuned cell
    // should learn sand; the one dormant cell never attuned and must stay dark.
    let mut u = Universe::new(16, 16, 7);
    for x in 3..=12 {
        set_cell(&mut u, x, 10, Material::Wall);
    }
    for y in 8..=9 {
        for x in 5..=10 {
            set_cell_state(&mut u, x, y, Material::Wellspring, 0, Material::Water as u16, 0);
        }
    }
    set_cell_state(&mut u, 8, 9, Material::Wellspring, 0, 0, 0);
    set_cell(&mut u, 4, 8, Material::Ice);
    set_cell(&mut u, 4, 9, Material::Sand);
    for _ in 0..12 {
        u.tick();
    }
    for y in 8..=9 {
        for x in 5..=10 {
            let expect = if (x, y) == (8, 9) { 0 } else { Material::Sand as u16 };
            assert_eq!(energy_at(&u, x, y), expect, "spring cell ({x},{y})");
        }
    }
}

/// A spring attuned to a POWDER entombs itself: the grain piles up, nothing drinks it,
/// and once no empty cell lies within WELLSPRING_REACH of any face the pour stops. That is
/// the real bound on a powder spring, and it is worth pinning both halves of. (A water
/// spring is bounded by something else entirely — the move clobber, not absorption; the
/// old claim that "every substrate drinks standing water" was never true. ROADMAP Phase 20.)
///
/// Measured on the shipped 220x140 grid at the default brush, a sand spring fills 23% of
/// the terrarium in about a minute and then halts for good. It is not dead, though, and
/// that is the half that makes the behaviour fair: give it air and it pours again with its
/// attunement intact.
#[test]
fn a_buried_spring_stops_and_then_resumes_when_given_air() {
    let mut u = Universe::new(24, 24, 7);
    // Two sealed chambers side by side, divided by a wall the test later opens.
    for x in 2..=21 {
        set_cell(&mut u, x, 2, Material::Wall);
        set_cell(&mut u, x, 21, Material::Wall);
    }
    for y in 2..=21 {
        set_cell(&mut u, 2, y, Material::Wall);
        set_cell(&mut u, 21, y, Material::Wall);
        set_cell(&mut u, 12, y, Material::Wall);
    }
    // Close to the dividing wall, so opening it puts empty cells inside WELLSPRING_REACH
    // of a face -- otherwise the grain merely slumps and the spring stays entombed.
    set_cell_state(&mut u, 10, 18, Material::Wellspring, 0, Material::Sand as u16, 0);

    let sand = |u: &Universe| {
        (0..u.cells.len())
            .filter(|&i| u.cells[i].kind == Material::Sand as u8)
            .count()
    };
    for _ in 0..4000 {
        u.tick();
    }
    let filled = sand(&u);
    for _ in 0..2000 {
        u.tick();
    }
    let stalled = sand(&u);
    assert!(filled > 20, "the spring should have filled its chamber, poured only {filled}");
    assert_eq!(
        stalled, filled,
        "a spring buried in its own grain should stop, not keep pouring into a full room",
    );

    // Open the dividing wall: one empty cell within reach of a face is all it needs.
    for y in 3..=20 {
        set_cell(&mut u, 12, y, Material::Empty);
    }
    for _ in 0..2000 {
        u.tick();
    }
    let resumed = sand(&u);
    assert!(
        resumed > stalled + 8,   // measured 33 -> 48; a few grains merely slumping is ~3
        "an entombed spring must resume once given air -- it was blocked, not dead: \
         {stalled} grains before the wall came down, {resumed} after",
    );
    assert_eq!(
        u.cells[u.idx(10, 18)].energy,
        Material::Sand as u16,
        "burial must not cost the spring its attunement",
    );
}

#[test]
fn an_unchilled_spring_keeps_its_first_identity() {
    let mut u = Universe::new(16, 16, 7);
    set_cell_state(&mut u, 8, 8, Material::Wellspring, 0, Material::Water as u16, 0);
    set_cell(&mut u, 9, 8, Material::Sand);
    u.tick();
    assert_eq!(energy_at(&u, 8, 8), Material::Water as u16, "without ice the spring ignores new sources");
    assert!(
        u.cells.iter().any(|c| c.kind == Material::Sand as u8),
        "an unchilled spring never consumes a touching source"
    );
}

#[test]
fn a_cosmic_fungus_sows_a_stardust_grain_as_it_digests() {
    let mut u = Universe::new(16, 16, 7);
    // Fill the grid with wood, then charge a lattice of fungi cosmic. No stardust is
    // present at the start, so any grain that appears was sown by the fairy-ring path.
    for y in 0..16 {
        for x in 0..16 {
            set_cell(&mut u, x, y, Material::Wood);
        }
    }
    for y in (2..14).step_by(3) {
        for x in (2..14).step_by(3) {
            set_cell_state(&mut u, x, y, Material::Fungus, 40, 255, FLAG_COSMIC);
        }
    }
    let mut sowed = false;
    for _ in 0..600 {
        u.tick();
        if u.cells.iter().any(|c| c.kind == Material::Stardust as u8) {
            sowed = true;
            break;
        }
    }
    assert!(sowed, "a charged fungus should occasionally sow a stardust grain instead of spreading");
}

#[test]
fn a_starved_old_fungus_collapses_into_soil() {
    let mut u = Universe::new(16, 16, 7);
    // A lone, ancient fungus with nothing left to eat crumbles back into fresh soil,
    // closing the soil -> moss -> fungus -> soil loop.
    set_cell_state(&mut u, 8, 8, Material::Fungus, 601, 60, 0);
    let mut collapsed = false;
    for _ in 0..10000 {
        u.tick();
        if u.cells.iter().any(|c| c.kind == Material::Soil as u8) {
            collapsed = true;
            break;
        }
    }
    assert!(collapsed, "a starved old fungus should eventually collapse into soil");
}

#[test]
fn a_young_starved_fungus_holds_instead_of_collapsing() {
    let mut u = Universe::new(16, 16, 7);
    // Starved but not yet ancient (age stays below the ~600 threshold): the
    // loop-closing collapse is gated on old age, so this fungus must hold.
    set_cell_state(&mut u, 8, 8, Material::Fungus, 100, 60, 0);
    for _ in 0..400 {
        u.tick();
    }
    assert_eq!(kind_at(&u, 8, 8), Material::Fungus as u8, "a young starved fungus should stay fungus");
}

#[test]
fn a_falling_meteor_streaks_a_spark_trail() {
    let mut u = Universe::new(16, 32, 7);
    set_cell(&mut u, 8, 2, Material::Meteor);
    let mut sparked = false;
    for _ in 0..40 {
        u.tick();
        if u.cells.iter().any(|c| c.kind == Material::Spark as u8) {
            sparked = true;
            break;
        }
    }
    assert!(sparked, "a meteor should shed sparks from the cells it falls through");
}

/// The trail fans: shed straight down only, every trail spark fell into the cell the
/// meteor was about to strike, so none could reach a fuse it merely passed.
#[test]
fn a_meteor_trail_fans_down_and_out() {
    let mut u = Universe::new(32, 140, 7);
    set_cell(&mut u, 16, 2, Material::Meteor);
    let mut seen = [false; 8];
    for _ in 0..120 {
        u.tick();
        for c in u.cells.iter().filter(|c| c.kind == Material::Spark as u8 && c.age == 0) {
            seen[(c.variant & 7) as usize] = true;
        }
    }
    assert!(seen[3] && seen[4] && seen[5], "a trail should fly straight down and to both sides: {seen:?}");
    assert!(
        seen.iter().enumerate().all(|(dir, &s)| !s || (3..=5).contains(&dir)),
        "a trail never flies up or level: {seen:?}"
    );
}

/// A slick on a wall shelf, held in by walls at either end.
fn oil_shelf(u: &mut Universe, flags: u16) {
    for y in 10..=17 {
        set_cell(u, 1, y, Material::Wall);
        set_cell(u, 30, y, Material::Wall);
    }
    for x in 2..=29 {
        set_cell(u, x, 16, Material::Wall);
        set_cell(u, x, 17, Material::Wall);
        for y in 13..=15 {
            set_cell_state(u, x, y, Material::Oil, 0, if flags != 0 { 36 } else { 0 }, flags);
        }
    }
}

#[test]
fn a_spark_resting_on_oil_sets_it_alight() {
    let mut u = Universe::new(32, 20, 3);
    oil_shelf(&mut u, 0);
    set_cell_state(&mut u, 8, 12, Material::Spark, 10, 150, 0);
    u.tick();
    assert!(count_kind(&u, Material::Fire) > 0, "a spark touching oil should light it");
}

/// Oil catches from a spark because oil asks for one; sparks stay out of `is_hot`, so the
/// same spark beside a plank lights nothing.
#[test]
fn a_spark_beside_wood_does_not_light_it() {
    let mut u = Universe::new(32, 20, 3);
    for x in 2..=29 {
        set_cell(&mut u, x, 16, Material::Wall);
        set_cell(&mut u, x, 15, Material::Wood);
    }
    set_cell_state(&mut u, 8, 14, Material::Spark, 10, 150, 0);
    for _ in 0..6 {
        u.tick();
    }
    assert_eq!(count_kind(&u, Material::Fire), 0);
    assert_eq!(count_kind(&u, Material::Ember), 0);
}

fn sheened_oil(u: &Universe) -> usize {
    u.cells.iter().filter(|c| c.kind == Material::Oil as u8 && c.flags & FLAG_COSMIC != 0).count()
}

/// Stardust touches only the top film of a slick; the sheen spreading from cell to cell is
/// what colours the pool. It also has to outlast the age pass, which drops the cosmic flag
/// from any cell at energy 0, and painted oil is at 0.
#[test]
fn stardust_leaves_a_sheen_that_spreads_through_the_slick_and_stays() {
    let mut u = Universe::new(32, 20, 5);
    oil_shelf(&mut u, 0);
    set_cell(&mut u, 15, 12, Material::Stardust);
    for _ in 0..800 {
        u.tick();
    }
    let oil = count_kind(&u, Material::Oil);
    assert!(sheened_oil(&u) * 4 >= oil * 3, "the sheen should spread through the slick: {} of {oil}", sheened_oil(&u));
}

#[test]
fn a_slick_with_no_stardust_stays_plain() {
    let mut u = Universe::new(32, 20, 5);
    oil_shelf(&mut u, 0);
    for _ in 0..800 {
        u.tick();
    }
    assert_eq!(sheened_oil(&u), 0);
}

/// Burns a slick from its left end and reports (cosmic flame seen, sparks seen).
fn burn_slick(flags: u16) -> (bool, bool) {
    let mut u = Universe::new(32, 20, 9);
    oil_shelf(&mut u, flags);
    set_cell_state(&mut u, 3, 12, Material::Fire, 0, 240, 0);
    let (mut cosmic_fire, mut sparks) = (false, false);
    for _ in 0..40 {
        u.tick();
        cosmic_fire |= u.cells.iter().any(|c| c.kind == Material::Fire as u8 && c.flags & FLAG_COSMIC != 0);
        sparks |= count_kind(&u, Material::Spark) > 0;
    }
    (cosmic_fire, sparks)
}

#[test]
fn a_sheened_slick_burns_like_a_firework() {
    let (cosmic_fire, sparks) = burn_slick(FLAG_COSMIC);
    assert!(cosmic_fire, "a sheened slick's flame should carry the cosmic flag");
    assert!(sparks, "a sheened slick should throw sparks as it catches");
}

/// Whichever side the flame is on, and whichever cell the tick reaches first, a sheened
/// cell burns cosmic: lit through `ignited_cell` by a later flame it used to burn plain.
#[test]
fn a_sheened_cell_burns_cosmic_whichever_side_lights_it() {
    for (flame_x, heat) in [(7, Material::Fire), (9, Material::Fire), (7, Material::Lava), (9, Material::Lava)] {
        for seed in 0..16 {
            let mut u = Universe::new(16, 16, seed);
            for x in 5..=11 {
                set_cell(&mut u, x, 9, Material::Wall);
            }
            set_cell_state(&mut u, 8, 8, Material::Oil, 0, 36, FLAG_COSMIC);
            set_cell_state(&mut u, flame_x, 8, heat, 0, 240, 0);
            u.tick();
            assert!(
                u.cells.iter().any(|c| c.kind == Material::Fire as u8 && c.flags & FLAG_COSMIC != 0),
                "seed {seed}: a sheened cell lit by {heat:?} at x={flame_x} burned plain"
            );
        }
    }
}

#[test]
fn a_plain_slick_burns_plain_and_throws_nothing() {
    assert_eq!(burn_slick(0), (false, false));
}

fn count_kind(u: &Universe, material: Material) -> usize {
    u.cells.iter().filter(|c| c.kind == material as u8).count()
}

/// A spring submerges itself within seconds. If it can only pour into a bare face it
/// then chokes on its own output — measured at a permanent 3-4 cells of standing
/// water, which is why the only endless source in the game watered nothing.
///
/// The shaft is what makes this decisive. Sealed sides and floor mean the water above
/// the spring CANNOT flow away, so every cardinal face stays blocked forever: under an
/// adjacent-only rule the count can never rise. A first attempt at this test used an
/// open basin and passed with the reach disabled, because the water simply drained off
/// the faces and let the old rule pour normally — it proved nothing.
#[test]
fn a_submerged_spring_pumps_up_through_its_own_water() {
    let mut u = Universe::new(40, 30, 77);
    for y in 18..=26 {
        set_cell(&mut u, 19, y, Material::Wall);
        set_cell(&mut u, 21, y, Material::Wall);
    }
    for x in 18..=22 {
        set_cell(&mut u, x, 26, Material::Wall);
    }
    set_cell_state(&mut u, 20, 25, Material::Wellspring, 0, Material::Water as u16, 0);
    set_cell(&mut u, 20, 24, Material::Water);
    set_cell(&mut u, 20, 23, Material::Water);
    let submerged = count_kind(&u, Material::Water);

    for _ in 0..600 {
        u.tick();
    }
    let pumped = count_kind(&u, Material::Water);
    assert!(
        pumped > submerged,
        "a spring walled in under its own water must push up through it; it stayed at \
         {submerged} cells (saw {pumped}), which is the choke that made it inert"
    );
}


/// A hearth burned out last night comes back as ground you can plant in.
#[test]
fn slow_steps_settle_a_cold_hearth_into_soil() {
    let mut u = Universe::new(24, 24, 7);
    for x in 4..14 {
        set_cell_state(&mut u, x, 18, Material::Ember, 400, 5, 0);
    }
    assert_eq!(count_kind(&u, Material::Soil), 0);
    for _ in 0..12 {
        u.slow_step();
    }
    let soil = count_kind(&u, Material::Soil);
    assert!(
        soil >= 7,
        "a dozen slow steps should settle most of a ten-cell hearth into soil, saw {soil}"
    );
}

/// The pairing test: a hearth still holding heat is not ash, and a quenched one
/// is a look the player chose. Neither may be quietly turned into a garden bed.
#[test]
fn slow_steps_leave_hot_and_drowned_embers_alone() {
    let mut u = Universe::new(24, 24, 7);
    for x in 4..9 {
        set_cell_state(&mut u, x, 18, Material::Ember, 400, 220, 0);
    }
    for x in 12..17 {
        set_cell_state(&mut u, x, 18, Material::Ember, 400, 5, FLAG_WET);
    }
    for _ in 0..20 {
        u.slow_step();
    }
    assert_eq!(
        count_kind(&u, Material::Ember),
        10,
        "only cold char that is not under water settles into soil"
    );
}

/// The promise the whole feature rests on: what you did not leave living does
/// not change while you are gone.
#[test]
fn slow_steps_leave_an_unliving_scene_byte_identical() {
    let mut u = Universe::new(24, 24, 7);
    for x in 2..22 {
        set_cell(&mut u, x, 20, Material::Wall);
        set_cell(&mut u, x, 19, Material::Sand);
        set_cell(&mut u, x, 6, Material::Stone);
    }
    set_cell(&mut u, 10, 12, Material::Glass);
    let before = u.cells.clone();
    for _ in 0..24 {
        u.slow_step();
    }
    assert_eq!(before, u.cells, "a scene with nothing alive in it must come back unchanged");
}

/// A flooded sand bed compacts into sandstone from the inside while you are away,
/// born bedded so the renderer can tell it from lava rock — and the layer the water
/// actually rests on stays loose, so the lake keeps a sand floor.
#[test]
fn a_flooded_sand_bed_compacts_into_bedded_sandstone() {
    let mut u = Universe::new(24, 24, 7);
    for x in 2..22 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    for y in 10..20 {
        set_cell(&mut u, 2, y, Material::Wall);
        set_cell(&mut u, 21, y, Material::Wall);
    }
    for x in 3..21 {
        for y in 15..20 {
            set_cell(&mut u, x, y, Material::Sand);
        }
        for y in 11..15 {
            set_cell(&mut u, x, y, Material::Water);
        }
    }
    for _ in 0..24 {
        u.slow_step();
    }
    let at = |u: &Universe, x: u32, y: u32| u.cells[u.idx(x, y)];

    let floor_loose = (3..21).filter(|&x| at(&u, x, 15).kind == Material::Sand as u8).count();
    assert_eq!(floor_loose, 18, "the layer the water rests on must stay loose sand");

    let (mut buried, mut bedded) = (0, 0);
    for x in 3..21 {
        for y in 16..20 {
            buried += 1;
            let c = at(&u, x, y);
            if c.kind == Material::Stone as u8 && c.flags & FLAG_BEDDED != 0 {
                bedded += 1;
            }
        }
    }
    assert!(
        bedded * 10 >= buried * 8,
        "a day's worth of slow steps should turn most of a flooded bed to sandstone \
         (at 1-in-{SLOW_SAND_COMPACTS} odds, 24 steps leave about 4% loose); got {bedded}/{buried}"
    );
}

/// Sandstone has to survive a save. `load_cells` keeps only the bits `FLAG_MASK` names,
/// and a reload is exactly when the slow world runs — so a flag left out of the mask is
/// stripped the next time the game opens, and every sandstone quietly becomes lava rock.
/// This is the PRODUCTION engine's mask; the slow-world audit checks the JS one, and the
/// two are separate constants that nothing else compares.
#[test]
fn bedded_sandstone_survives_a_save_and_reload() {
    let mut u = Universe::new(8, 8, 7);
    set_cell_state(&mut u, 3, 3, Material::Stone, 0, 0, FLAG_BEDDED | FLAG_WET);
    let bytes: Vec<u8> = u
        .cells
        .iter()
        .flat_map(|c| {
            let mut b = vec![c.kind, c.variant];
            b.extend_from_slice(&c.age.to_le_bytes());
            b.extend_from_slice(&c.energy.to_le_bytes());
            b.extend_from_slice(&c.flags.to_le_bytes());
            b
        })
        .collect();
    let mut reloaded = Universe::new(8, 8, 7);
    assert!(reloaded.load_cells(&bytes), "the saved board should load");
    let flags = reloaded.cells[reloaded.idx(3, 3)].flags;
    assert_ne!(flags & FLAG_BEDDED, 0, "a reload stripped the bedded flag — it is missing from FLAG_MASK");
    assert_ne!(flags & FLAG_WET, 0, "and it must not take the other flags with it");
    // A seed saved mid-glide keeps gliding, the same way.
    let mut u = Universe::new(8, 8, 7);
    set_cell_state(&mut u, 3, 3, Material::Seed, 0, SET_SEED_ENERGY, FLAG_WINDBORNE | FLAG_DRIFT_EAST);
    let bytes: Vec<u8> = u
        .cells
        .iter()
        .flat_map(|c| {
            let mut b = vec![c.kind, c.variant];
            b.extend_from_slice(&c.age.to_le_bytes());
            b.extend_from_slice(&c.energy.to_le_bytes());
            b.extend_from_slice(&c.flags.to_le_bytes());
            b
        })
        .collect();
    let mut reloaded = Universe::new(8, 8, 7);
    assert!(reloaded.load_cells(&bytes), "the saved board should load");
    let flags = reloaded.cells[reloaded.idx(3, 3)].flags;
    assert_eq!(flags & (FLAG_WINDBORNE | FLAG_DRIFT_EAST), FLAG_WINDBORNE | FLAG_DRIFT_EAST, "a reload stripped a gliding seed's flags");
}

#[test]
fn a_lesson_held_under_ice_survives_a_save_and_reload() {
    // The latch is a flag because a load clamps energy to 255. Saved mid-lesson, the
    // spring must come back still remembering the new material and still holding it.
    let mut u = Universe::new(8, 8, 7);
    set_cell_state(&mut u, 3, 3, Material::Wellspring, 0, Material::Sand as u16, FLAG_TAUGHT);
    let bytes: Vec<u8> = u
        .cells
        .iter()
        .flat_map(|c| {
            let mut b = vec![c.kind, c.variant];
            b.extend_from_slice(&c.age.to_le_bytes());
            b.extend_from_slice(&c.energy.to_le_bytes());
            b.extend_from_slice(&c.flags.to_le_bytes());
            b
        })
        .collect();
    let mut reloaded = Universe::new(8, 8, 7);
    assert!(reloaded.load_cells(&bytes), "the saved board should load");
    let cell = reloaded.cells[reloaded.idx(3, 3)];
    assert_eq!(cell.energy, Material::Sand as u16, "a reload changed what the spring remembers");
    assert_ne!(cell.flags & FLAG_TAUGHT, 0, "a reload dropped the lesson's latch");
}

/// The build-protection half. A deep DRY dune is buried but not flooded, so it comes
/// back exactly as it was left — a sand castle is a thing somebody made.
#[test]
fn a_dry_dune_is_never_turned_to_stone() {
    let mut u = Universe::new(24, 24, 7);
    for x in 2..22 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    for x in 3..21 {
        for y in 10..20 {
            set_cell(&mut u, x, y, Material::Sand);
        }
    }
    let before = u.cells.clone();
    for _ in 0..24 {
        u.slow_step();
    }
    assert_eq!(before, u.cells, "a dry dune must come back byte-identical");
}

/// Water that is NOT on top of the deposit does not count. A pond sitting beside a dune
/// leaves the dune alone: the test is what lies above the sand, not what lies near it.
#[test]
fn water_beside_a_dune_does_not_petrify_it() {
    let mut u = Universe::new(30, 24, 7);
    for x in 1..29 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    for y in 12..20 {
        set_cell(&mut u, 14, y, Material::Wall);
        for x in 3..14 {
            set_cell(&mut u, x, y, Material::Sand);
        }
        for x in 15..27 {
            set_cell(&mut u, x, y, Material::Water);
        }
    }
    for _ in 0..24 {
        u.slow_step();
    }
    let stone = u.cells.iter().filter(|c| c.kind == Material::Stone as u8).count();
    assert_eq!(stone, 0, "a dune next to a pond is not under it");
}

/// A painted stone LID is construction, not deposit. Water resting on top of it must
/// not petrify the dry sand sealed underneath — the case adversarial review built three
/// ways (88, 100 and 124 cells turned to rock) while the dune test passed, because that
/// test only ever buried sand under sand.
#[test]
fn water_on_a_stone_lid_does_not_petrify_the_sand_under_it() {
    let mut u = Universe::new(24, 24, 7);
    for x in 2..22 {
        set_cell(&mut u, x, 20, Material::Wall);
    }
    for y in 6..20 {
        set_cell(&mut u, 2, y, Material::Wall);
        set_cell(&mut u, 21, y, Material::Wall);
    }
    for x in 3..21 {
        for y in 14..20 {
            set_cell(&mut u, x, y, Material::Sand);
        }
        for y in 11..14 {
            set_cell(&mut u, x, y, Material::Stone);
        }
        for y in 7..11 {
            set_cell(&mut u, x, y, Material::Water);
        }
    }
    let before = u.cells.clone();
    for _ in 0..24 {
        u.slow_step();
    }
    let bedded = u.cells.iter().filter(|c| c.flags & FLAG_BEDDED != 0).count();
    assert_eq!(bedded, 0, "sand sealed under a stone lid is not a lake bed");
    assert_eq!(before, u.cells, "the whole reservoir must come back byte-identical");
}

/// A finished plant sows itself onto the next patch of ground, clear of its own
/// shadow, and the new seed carries the damp of the bed it lands in.
#[test]
fn a_spent_seed_head_scatters_onto_open_ground() {
    let mut u = Universe::new(40, 24, 7);
    for x in 2..38 {
        set_cell(&mut u, x, 21, Material::Wall);
        set_cell_state(&mut u, x, 20, Material::Soil, 0, 120, FLAG_WET);
    }
    set_cell_state(&mut u, 20, 19, Material::Flower, PETAL_SHED_AGE + 50, 0, FLAG_ROOTED);
    for _ in 0..10 {
        u.slow_step();
    }
    let seeds: Vec<(i32, i32)> = u
        .cells
        .iter()
        .enumerate()
        .filter(|(_, c)| c.kind == Material::Seed as u8)
        .map(|(i, _)| u.xy(i))
        .collect();
    assert!(!seeds.is_empty(), "a spent seed head should scatter");
    for (x, _) in &seeds {
        assert!(
            (x - 20).abs() >= PLANT_SPACING,
            "a scattered seed at x={x} lands inside the parent's shadow and could never grow"
        );
    }
    let seed_idx = u.cells.iter().position(|c| c.kind == Material::Seed as u8).unwrap();
    assert!(
        u.cells[seed_idx].flags & FLAG_WET != 0,
        "a seed sown into damp soil should arrive damp"
    );
}

/// The pairing test, and it guards both halves of "spent": a young bud is not a
/// seed head, and neither is an old bloom that still has budget to spend on its
/// own petals and pollen.
#[test]
fn a_bloom_still_in_its_prime_scatters_nothing() {
    let mut u = Universe::new(40, 24, 7);
    for x in 2..38 {
        set_cell(&mut u, x, 21, Material::Wall);
        set_cell_state(&mut u, x, 20, Material::Soil, 0, 120, FLAG_WET);
    }
    // Young and full of energy.
    set_cell_state(&mut u, 10, 19, Material::Flower, 60, 220, FLAG_ROOTED);
    // Old, but still spending: this is the one a bare-crown check would have
    // caught by accident and an age-only check would wrongly sow from.
    set_cell_state(&mut u, 28, 19, Material::Flower, PETAL_SHED_AGE + 50, 220, FLAG_ROOTED);
    for _ in 0..20 {
        u.slow_step();
    }
    assert_eq!(
        count_kind(&u, Material::Seed),
        0,
        "a bloom that has not spent its budget has nothing to sow yet"
    );
}
