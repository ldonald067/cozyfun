use std::mem::size_of;
use std::slice;

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Material {
    Empty = 0,
    Wall = 1,
    Sand = 2,
    Water = 3,
    Smoke = 4,
    Soil = 5,
    Fire = 6,
    Wood = 7,
    Lava = 8,
    Stone = 9,
    Moss = 10,
    Seed = 11,
    Fungus = 12,
    Oil = 13,
    Ice = 14,
    Steam = 15,
    Stardust = 16,
    Meteor = 17,
    Moonwater = 18,
    Flower = 19,
    Glass = 20,
    Ember = 21,
    Pollen = 22,
    Stem = 23,
    Rocket = 24,
    Wellspring = 25,
    Spark = 26,
}

/// Eight compass directions; a spark's variant indexes its birth direction.
const SPARK_DIRS: [(i32, i32); 8] = [
    (0, -1),
    (1, -1),
    (1, 0),
    (1, 1),
    (0, 1),
    (-1, 1),
    (-1, 0),
    (-1, -1),
];

/// The directions a burning sheened slick throws its sparks: up and the two upper diagonals,
/// so a burning sheen fountains like a firework instead of throwing into its own pool.
const SHEEN_SPARK_DIRS: [usize; 3] = [7, 0, 1];

/// One unsheened oil cell beside a sheened one takes the sheen in this many ticks, on average.
const SHEEN_SPREAD: u32 = 16;

/// SPARK_DIRS index for straight down, used by trail sparks shed in flight. A meteor's trail
/// also flings them one step either side of it (`leave_meteor_trail`).
const SPARK_DOWN: u8 = 4;

const FLAG_WET: u16 = 1 << 0;
const FLAG_ROOTED: u16 = 1 << 1;
const FLAG_COSMIC: u16 = 1 << 2;
const FLAG_FROZEN: u16 = 1 << 3;
const FLAG_SCORCHED: u16 = 1 << 4;
/// Stone that was laid down as sediment rather than cooled from lava. It is the only way the
/// renderer can tell the two rocks apart, so it has to survive a save: `FLAG_MASK` is what
/// `load_cells` keeps, and a flag missing from it is silently stripped on every reload —
/// which is exactly when the slow world runs.
const FLAG_BEDDED: u16 = 1 << 5;
/// A seed a flower set from pollen, still gliding away from it on the breeze
/// (`glide_seed`), and the way it is gliding. Kept by `FLAG_MASK`, so a seed saved mid-glide
/// keeps gliding instead of dropping where it hung.
const FLAG_WINDBORNE: u16 = 1 << 6;
const FLAG_DRIFT_EAST: u16 = 1 << 7;
const FLAG_MASK: u16 = FLAG_WET
    | FLAG_ROOTED
    | FLAG_COSMIC
    | FLAG_FROZEN
    | FLAG_SCORCHED
    | FLAG_BEDDED
    | FLAG_WINDBORNE
    | FLAG_DRIFT_EAST;

/// Canonical face order around a cell, walked identically by petal opening and
/// pollen release in both engines. **Cardinals first, then diagonals**: a head that
/// fills its sides before its corners is rounder at every stage of opening, and the
/// renderer can tell a crown from a bud as soon as the first petal lands. Opening
/// diagonally first left a one-petal bloom rendering as two separate buds.
const FACE_OFFSETS: [(i32, i32); 8] = [
    (0, -1),
    (-1, 0),
    (1, 0),
    (0, 1),
    (-1, -1),
    (1, -1),
    (-1, 1),
    (1, 1),
];

/// Moisture lost per cell as water soaks down through a seed bed.
const SEED_SOAK_LOSS: u16 = 20;

/// A seed will not germinate this close to an existing plant. Without it every cell of a
/// watered bed sprouts and the meadow becomes one solid wall of blooms with no silhouette.
/// Five keeps a clear gap between heads now that a head is itself five cells across.
const PLANT_SPACING: i32 = 6;

/// Per-plant bloom silhouettes, chosen by the plant's variant exactly as its hue is.
/// Offsets are relative to the crown, which always sits directly above the stalk tip, and
/// are opened in listed order. A head that is always a filled 3x3 reads as a square; these
/// give a meadow actual shapes to tell apart. Every offset stays connected to the one
/// before it, so no petal is ever stranded on its own.
/// One species per plant, chosen by `variant & 7` — the same number that picks its hue in
/// the renderer, so a bluebell is always bluebell-blue. Heads are up to five cells across,
/// which is the smallest head that can hold a shape at all: at three there are too few
/// pixels to be anything but a block or a cross. Petals are listed in opening order and
/// every offset touches one already placed, so a half-open bloom is never a scatter of
/// stranded cells. Offsets are relative to the crown, which sits directly above the tip of
/// the stalk. `app/src/rendering/shapeLanguage.ts` holds the matching hue and eye per index.
const BLOOM_SHAPES: [&[(i32, i32)]; 8] = [
    // 0 Cornflower: a ragged ROSETTE: paired petals at the crest, a full body, two outers
    // dropped below. It must not share a rim rhythm with the tulip -- the first seven-wide
    // pass gave both a regular notched top and a full row under it, which made the TULIP A
    // STRICT SUBSET OF THIS SHAPE. Silhouette overlap hit 0.85, worse than any pair before
    // the widening, and a greyscale render showed it plainly while a glance at the offsets
    // did not.
    &[(-2, -2), (-1, -2), (1, -2), (2, -2), (-3, -1), (-2, -1), (-1, -1), (0, -1), (1, -1), (2, -1), (3, -1), (-3, 0), (-2, 0), (-1, 0), (1, 0), (2, 0), (3, 0), (-2, 1), (2, 1)],
    // 1 Poppy: a broad bowl whose outer petals still DROOP below the rim, now two cells further
    // out each side. The crest stays rounded -- a filled top row reads as a bar.
    &[(-2, -1), (-1, -1), (0, -1), (1, -1), (2, -1), (-3, 0), (-2, 0), (-1, 0), (1, 0), (2, 0), (3, 0), (-3, 1), (-2, 1), (2, 1), (3, 1)],
    // 2 Daisy: the same span opened out into a star, so the gaps do the work. Widening it kept
    // the alternating rhythm rather than filling in, or it becomes a second sunflower. Its
    // bottom spoke is the stalk itself: (0, 1) is where the stalk stands, so no head opens there.
    &[(0, -2), (-2, -1), (0, -1), (2, -1), (-3, 0), (-2, 0), (-1, 0), (1, 0), (2, 0), (3, 0), (-2, 1), (2, 1)],
    // 3 Sunflower: the biggest head in the set and deliberately so: a full disc under a crown of rays,
    // seven wide and five tall. The bottom row is two petals hugging the stalk. It used to be one
    // at (0, 1), where the stalk stands, so in play the disc was only ever four tall. A leaf at
    // the stalk's tip takes one of the two on about half of plants.
    &[(0, -3), (-2, -2), (-1, -2), (0, -2), (1, -2), (2, -2), (-3, -1), (-2, -1), (-1, -1), (0, -1), (1, -1), (2, -1), (3, -1), (-3, 0), (-2, 0), (-1, 0), (1, 0), (2, 0), (3, 0), (-1, 1), (1, 1)],
    // 4 Tulip: a CUP five wide and four tall: three lips at the rim, a full shoulder and body,
    // tapering to two petals beside the crown. Seven wide with a notched rim it read as a crown
    // rather than a cup; this is the owner's pick from the design canvas (2026-10-22). The
    // taper still separates it from the cornflower's rounded body -- see the note there.
    &[(0, -1), (-1, -1), (1, -1), (-1, 0), (1, 0), (-2, -1), (2, -1), (0, -2), (-1, -2), (1, -2), (-2, -2), (2, -2), (0, -3), (-2, -3), (2, -3)],
    // 5 Lavender: UNCHANGED at three wide. A tall narrow spike is this plant's whole identity and
    // widening it would buy size at the cost of the one silhouette nothing else in the row has.
    &[(0, -1), (-1, -2), (1, -2), (0, -3), (-1, -4), (1, -4), (0, -5)],
    // 6 Bluebell: a scape that climbs from the crown and bends over to one side, with bells
    // hanging under the bend and off the scape. The first six cells are the scape, which opens
    // first and is drawn green; the rest are bells. Bells on a bare upright stalk read as
    // damage, and this is the owner's pick from the design canvas (2026-10-22). Still sparse:
    // a filled bluebell is just a small cornflower.
    &[(0, -1), (0, -2), (0, -3), (1, -4), (2, -4), (3, -3), (1, -3), (1, -2), (3, -2), (3, -1), (-1, -3), (-1, -2)],
    // 7 Cosmos: broad rounded petals around an open centre. Seven wide with the ring closed, because
    // leaving the centre gapped split it the same way the cornflower split.
    &[(-2, -1), (-1, -1), (1, -1), (2, -1), (-3, 0), (-2, 0), (-1, 0), (1, 0), (2, 0), (3, 0), (-2, 1), (-1, 1), (1, 1), (2, 1)],

];

/// A bloom runs on a slower clock than the rest of the life materials: it loses
/// energy once every this many ticks instead of every tick. The old bloom carried
/// 90 energy at 1/tick — about four and a half seconds of life — which is why an
/// untended flower emitted one or two pollen motes at most and then sat inert
/// forever. Slowing the clock buys a watchable open → dust → wilt arc while
/// keeping every material's energy under 255, which is what the scene-import
/// clamp in `load_cells` assumes.
const BLOOM_CLOCK: u16 = 8;
const BLOOM_ENERGY: u16 = 200;
const BLOOM_ENERGY_COSMIC: u16 = 250;
/// The crown only unfurls petals down to this reserve, so a head is bounded by
/// budget as well as by its silhouette. The cost must leave room for the largest shape
/// (the sunflower's 21 petals) *plus* the energy the crown drains while it is opening
/// (one every `BLOOM_CLOCK` ticks, and a petal opens about every 12) and any pollen it puffs
/// meanwhile, or the biggest blooms stall half-open. At a cost of 3 they did, in play: on a
/// stalk over 24 seeds the sunflower's outer rim opened on 15 and its bottom pair on 11 and
/// 6, and the cornflower's drooping outers on 16 and 12. At 2: 22, 22 and 19, 20 and 19.
const CROWN_RESERVE: u16 = 100;
const PETAL_ENERGY: u16 = 150;
const PETAL_COST: u16 = 2;
/// Below this a bloom is spent: no more pollen, and petals may start to let go.
const POLLEN_RESERVE: u16 = 40;
const POLLEN_COST: u16 = 15;
const PETAL_SHED_AGE: u16 = 1200;
/// Heat that shows (the owner's items 6 and 7, 2026-10-20). Water's energy is its temperature
/// and, since this batch, ice's energy is its warmth. Before it, a flame could not warm a pool
/// (water lost 2 a tick, everywhere), ice froze any water under 120 within a second, and only
/// water over 120 melted ice, on a coin flip, into a melt the slab took straight back: a flame
/// held ten seconds to the audit's slab left 78 of 86 cells of ice. Now 17 (8 seeds). Each rule
/// below, and steam's heat in the ice arm, was measured out against the others; lava radiating
/// heat across a gap was built too and left out, because poured lava thins to a film and it
/// moved nothing (85 cells of an ice wall left against 84).
///
/// What a water cell takes from each water neighbour each tick, `(theirs - its) / HEAT_SHARE`,
/// in `share_heat`, so the flows cancel and heat is conserved. 8 is the fastest that cannot
/// overshoot with eight neighbours; 16 halved the spread and the slab kept 56. Without it, 70.
const HEAT_SHARE: i32 = 8;
/// Water cools one tick in `WATER_CHILL`, so a warmed pool stays warm for a while; cooling every
/// tick, the slab keeps 42. On the global clock, not cell age (see `age_and_decay`). Boiling
/// barely moves: three pot sizes held under a flame for 40 s keep 18, 39 and 80 cells against
/// 17, 41 and 75 before, and now simmer, 9-11 cells over 120 at 10 s where there were none.
const WATER_CHILL: u32 = 16;
/// A burnt log smoulders in glowing cracks. Ember drains as fast as ever while it can light
/// its neighbours (above 90), so a fire spreads exactly as before, but cells on a crack then
/// hold between `EMBER_CRACK_FLOOR` and 90, where they still read as heat, draining one tick
/// in `EMBER_CRACK_CLOCK`. A painted log was dark 7 s after it lit; its cracks now glow to
/// 26 s (8 seeds), then ash over at the old pace. Cracks run along the grain (`ember_crack`):
/// a scattered quarter of cells was tried too and read as speckle. A power of two on the
/// global clock, because `tick_count` wraps at 2^32 here and the JS mirror's does not.
const EMBER_CRACK_CLOCK: u32 = 32;
const EMBER_CRACK_FLOOR: u16 = 66;
/// Ice's temperature. Water no warmer freezes against ice; warmer water gives the ice
/// `(energy - ICE_TEMP) / MELT_SHARE` a tick instead and spends as much; giving nothing, the
/// slab keeps 68. The line used to be 120 for freezing; set at 60, a flame-warmed puddle (50-80
/// at its edges) froze anyway.
const ICE_TEMP: u16 = 40;
const MELT_SHARE: u16 = 8;
/// Ice that has taken this much warmth melts, into water at 60. Ice above `ICE_COLD` re-chills
/// one a tick, so a block the heat has left recovers; moonwater's ice is made at 110 and keeps
/// its mark, which a fall to 0 energy would strip.
const ICE_MELT: u16 = 180;
const ICE_COLD: u16 = 110;
/// How many ticks a shell's sparks fly outward before they droop, plain and star. A star
/// shell (a rocket a meteor lit) flies longer and so blooms half as wide again.
const SHELL_FLIGHT: u16 = 6;
const STAR_SHELL_FLIGHT: u16 = 10;
/// Moss's burst. Well-watered moss (energy over 150) with nothing left to take beside it
/// throws a patch across a narrow gap, one cell of open air, gas or water, onto soil or wood
/// two cells off, which damp moss can never cross. Its old burst was a second adjacent patch
/// in the same tick, and a creeping edge has only one cell to take: moss covered a watered
/// plank in 72-78 ticks with it and 67-80 without.
const SPORE_ODDS: u32 = 6;
const SPORE_JUMPS: [(i32, i32); 8] = [(2, 0), (-2, 0), (2, 2), (-2, 2), (0, 2), (2, -2), (-2, -2), (0, -2)];
/// Pollination. Pollen is not a seed: a mote that brushes the side of a flower of its own
/// kind is taken in, and that flower sets a seed, which glides off on the breeze away from it
/// (`glide_seed`) and grows only where it lands on soil or moss and is watered. Before this,
/// pollen rooted straight into wet soil, and a garden's soil is moss by the time it blooms, so
/// no player saw it happen.
///
/// A mote must have drifted a while first (`POLLINATE_AGE`): it leaves its crown from a face
/// beside it, and without the wait every mote would be a seed before it was seen as pollen.
/// It pollinates only from the side, with open air to glide into, because a seed set on top
/// of a head lodges between its petals and the next ones pile up on it.
const POLLINATE_AGE: u16 = 20;
const POLLINATE_ODDS: u32 = 30;
/// Below the 70 that counts as wet: a set seed waits for water before it can sprout.
const SET_SEED_ENERGY: u16 = 40;

/// One open face in this many pours per tick. Tuned against a measurement, not taste:
/// at 26 an attuned spring held a permanent 3-4 cells of standing water, because the water
/// vanished about as fast as it arrived. That was read at the time as soil absorbing it; it
/// was the move clobber — nothing in the game absorbs standing water (see ROADMAP Phase 20).
const WELLSPRING_POUR: u32 = 7;
/// How far a spring will push through its own material to reach open space.
const WELLSPRING_REACH: i32 = 4;
/// On a wellspring, the rooted flag latches a lesson learned under the current chill, so the
/// spring holds it until the ice is gone. Every other reader of `FLAG_ROOTED` is guarded on a
/// seed, stem or flower, and the spring's renderer reads no flags. It is a flag rather than
/// spare bits of `energy` because a scene load clamps energy to 255: a latch kept there turned
/// a spring saved mid-lesson into one remembering material 255, which never pours.
const FLAG_TAUGHT: u16 = FLAG_ROOTED;
/// On oil, the rooted flag marks a cell a spring poured, the only oil that fades
/// (`OIL_SPRING_FADES`). The same bit for the same reason as `FLAG_TAUGHT`: every other reader
/// of `FLAG_ROOTED` is guarded on a seed, stem or flower, and oil's renderer reads only its frost
/// and sheen.
const FLAG_SPRING_OIL: u16 = FLAG_ROOTED;
/// On steam, the rooted bit marks a puff (`billow`): vapour that only fades. Every other reader
/// of `FLAG_ROOTED` is guarded on its own kind, and the vapour renderer reads no flags.
const FLAG_PUFF: u16 = FLAG_ROOTED;
/// On pollen, the rooted bit marks a petal a flower shed (`flower.wilts`) rather than a mote it
/// puffed: the two were one cell, so every fallen petal was drawn as pollen. Its variant already
/// carries the species. Every other reader of `FLAG_ROOTED` is guarded on its own kind, and a
/// mote that sets seed builds the seed's flags afresh, so a petal never lands a rooted seed.
const FLAG_PETAL: u16 = FLAG_ROOTED;
/// On steam, the drift bit marks a wisp that has already billowed, so it puffs once. The bit is
/// otherwise read only on oil and on a gliding seed.
const FLAG_BILLOWED: u16 = FLAG_DRIFT_EAST;
/// How long a re-taught spring keeps its latch once it is free of ice, in ticks (about 30 s).
/// The cell's own `age` is the clock: nothing else reads a wellspring's age, and a scene load
/// keeps it, where it clamps energy.
const LESSON_HOLD: u16 = 600;

/// Below this an ember has gone out: inert char that only relights from outside.
const COLD_CHAR_ENERGY: u16 = 30;
/// Stored moisture that still counts as damp ground under a seed.
const SOIL_DAMP_ENERGY: u16 = 60;

// ── The slow world ───────────────────────────────────────────────────────────
// Odds are per slow step, and a step is roughly "a few hours away" — see
// `Universe::slow_step`. They are tuned so a night away moves a hearth
// noticeably and a day away moves it most of the way, without any single step
// being large enough to feel like the scene was edited.
const SLOW_CHAR_SETTLES: u32 = 6;
const SLOW_SEED_SCATTERS: u32 = 3;
/// Deliberately the slowest odds in the slow world: rock should feel like the one thing here
/// that takes days, not a night.
const SLOW_SAND_COMPACTS: u32 = 8;
/// Settling through a liquid happens on one tick in this many. Slower than falling through
/// air, so a grain dropped into a pond visibly drifts down rather than vanishing to the bed.
/// A tick-parity gate rather than a roll: sinking consumes no RNG in either engine.
const SINK_EVERY: u32 = 3;
/// Moving water throws spray: each time a water or moonwater cell actually moves, it turns to
/// mist at 1 in this many. Water with nowhere to go never moves, so a settled pond or a lake
/// bed keeps every cell — while a pour, a fountain and a thin film that keeps shifting lose
/// some. This is the deliberate water sink; see `try_move` for the accidental one it replaced.
const MIST_ODDS: u32 = 450;
/// Lava with three or more hot neighbours, deep in a pool, cools too: one roll in this many,
/// against one in 8 at an exposed edge. Lava never deletes lava (`try_move`), so a pour stays a
/// pool, and a pool must set or a lava spring floods the board (28% at 8,000 ticks, still
/// rising). With it a pour sets to stone in 50-75 s, and a spring builds a stone hill over
/// itself (about 13% of the board since lava is thick, 24% when it flowed as water does) and
/// is sealed by it.
const LAVA_DEEP_COOLS: u32 = 24;
/// Lava at the surface of a heap creeps sideways one roll in this many (`update_lava`); lava
/// under more lava is pushed aside every time. At 8 a pour on an open floor is a dome about
/// three times as wide as it is tall, 15 s on. At 4 it slumped into a flatter, wider puddle.
const LAVA_CREEPS: u32 = 8;
/// Oil a spring poured fades: one of oil's moving ticks in this many, moving or at rest, so a
/// cell lasts about 25 s. Oil never deletes oil (`try_move`) and comes to rest as a sheet, so
/// nothing else bounds a spring: without this it flooded 31.9% of the board, and thinning only
/// MOVING spring oil still reached 24% by 16,000 ticks, because a finished layer lies still.
/// At 250 an oil spring holds about 7.3% of the 220x140 board from tick 4,000 to 16,000, the
/// size of a water spring's lake. Oil a player pours never fades.
const OIL_SPRING_FADES: u32 = 250;
/// Mist is cool vapour — steam at the bottom of its energy range, so it reads as a faint
/// sheen rather than as a kettle.
const MIST_ENERGY: u16 = 30;
/// A puff's energy, and so its life: steam drains 2 a tick and a puff goes when it reaches 0,
/// about 3 s. The owner picked 3 s over 2 s from a filmstrip (2026-10-23).
const PUFF_ENERGY: u16 = 120;
/// Where a billowing wisp puffs, around the cell it rose into: a diamond two cells across each
/// way. A plus of four was measured first and is invisible at play size. Nearest first: a puff
/// goes only where air joins it to the wisp (`billow`), so each cell's way in comes before it.
const PUFF_SHAPE: [(i32, i32); 12] = [
    (-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1), (-2, 0), (2, 0), (0, -2), (0, 2),
];
/// Every offset clears PLANT_SPACING, so a scattered seed lands where it can grow.
const SCATTER_OFFSETS: [i32; 8] = [6, -6, 9, -9, 12, -12, 15, -15];
const SCATTER_REACH: i32 = 14;

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cell {
    pub kind: u8,
    pub variant: u8,
    pub age: u16,
    pub energy: u16,
    pub flags: u16,
}

impl Cell {
    const fn empty() -> Self {
        Self {
            kind: Material::Empty as u8,
            variant: 0,
            age: 0,
            energy: 0,
            flags: 0,
        }
    }

    fn new(kind: u8, variant: u8, energy: u16) -> Self {
        Self {
            kind,
            variant,
            age: 0,
            energy,
            flags: 0,
        }
    }

    fn is_empty(self) -> bool {
        self.kind == Material::Empty as u8
    }
}

pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<Cell>,
    tick_count: u32,
    rng: u32,
}

impl Universe {
    pub fn new(width: u32, height: u32, seed: u32) -> Self {
        let width = width.max(16);
        let height = height.max(16);
        Self {
            width,
            height,
            cells: vec![Cell::empty(); (width * height) as usize],
            tick_count: 0,
            rng: seed.max(1),
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn tick_count(&self) -> u32 {
        self.tick_count
    }

    pub fn cell_stride() -> u32 {
        size_of::<Cell>() as u32
    }

    pub fn cells_ptr(&self) -> *const Cell {
        self.cells.as_ptr()
    }

    pub fn cells_byte_len(&self) -> u32 {
        (self.cells.len() * size_of::<Cell>()) as u32
    }

    pub fn clear(&mut self) {
        for cell in &mut self.cells {
            *cell = Cell::empty();
        }
        self.tick_count = 0;
    }

    pub fn paint(&mut self, x: i32, y: i32, radius: u32, material: u8, density: u32) {
        let radius = radius.max(1) as i32;
        let radius_sq = radius * radius;
        let density = density.clamp(1, 100);
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                if dx * dx + dy * dy > radius_sq {
                    continue;
                }
                let px = x + dx;
                let py = y + dy;
                if !self.in_bounds(px, py) {
                    continue;
                }
                // Sub-full density sprinkles individual grains, like a real pour.
                if density < 100 && self.rand() % 100 >= density {
                    continue;
                }
                let idx = self.idx(px as u32, py as u32);
                let kind = material.min(Material::Spark as u8);
                self.cells[idx] = if kind == Material::Empty as u8 {
                    Cell::empty()
                } else {
                    let variant = self.variant_for(px as u32, py as u32, kind);
                    Cell::new(kind, variant, starting_energy(kind))
                };
            }
        }
    }

    pub fn load_cells(&mut self, data: &[u8]) -> bool {
        if data.len() != self.cells.len() * size_of::<Cell>() {
            return false;
        }
        for (idx, chunk) in data.chunks_exact(size_of::<Cell>()).enumerate() {
            let kind = chunk[0].min(Material::Spark as u8);
            self.cells[idx] = if kind == Material::Empty as u8 {
                Cell::empty()
            } else {
                Cell {
                    kind,
                    variant: chunk[1] & 7,
                    age: u16::from_le_bytes([chunk[2], chunk[3]]),
                    energy: u16::from_le_bytes([chunk[4], chunk[5]]).min(255),
                    flags: u16::from_le_bytes([chunk[6], chunk[7]]) & FLAG_MASK,
                }
            };
        }
        true
    }

    pub fn tick(&mut self) {
        self.tick_count = self.tick_count.wrapping_add(1);
        self.rng = self.rng.wrapping_add(0x9e37_79b9);

        let old = self.cells.clone();
        let mut next = old.clone();
        self.age_and_decay(&mut next);
        self.apply_reactions(&old, &mut next);

        let bottom_up = self.bottom_up_indices();
        for idx in bottom_up {
            let cell = old[idx];
            match cell.kind {
                x if x == Material::Sand as u8 => self.update_sand(idx, cell, &old, &mut next),
                x if x == Material::Soil as u8 => self.update_soil(idx, cell, &old, &mut next),
                x if x == Material::Stone as u8 => self.update_stone(idx, cell, &old, &mut next),
                x if x == Material::Stardust as u8 => {
                    self.update_stardust(idx, cell, &old, &mut next)
                }
                x if x == Material::Pollen as u8 => self.update_pollen(idx, cell, &old, &mut next),
                x if x == Material::Meteor as u8 => self.update_meteor(idx, cell, &old, &mut next),
                x if x == Material::Rocket as u8 && cell.energy == 0 => {
                    self.update_powder(idx, cell, &old, &mut next, 1)
                }
                x if x == Material::Water as u8 => self.update_liquid(idx, cell, &old, &mut next),
                x if x == Material::Moonwater as u8 => self.update_liquid(idx, cell, &old, &mut next),
                x if x == Material::Oil as u8 => self.update_oil(idx, cell, &old, &mut next),
                x if x == Material::Lava as u8 => self.update_lava(idx, cell, &old, &mut next),
                _ => {}
            }
        }

        let top_down = self.top_down_indices();
        for idx in top_down {
            let cell = old[idx];
            match cell.kind {
                x if x == Material::Smoke as u8 => self.update_gas(idx, cell, &old, &mut next, 1),
                x if x == Material::Steam as u8 => self.update_gas(idx, cell, &old, &mut next, 1),
                x if x == Material::Fire as u8 => self.update_fire(idx, cell, &old, &mut next),
                x if x == Material::Rocket as u8 && cell.energy > 0 => {
                    self.update_rocket(idx, cell, &old, &mut next)
                }
                x if x == Material::Spark as u8 => self.update_spark(idx, cell, &old, &mut next),
                x if x == Material::Seed as u8 => self.update_seed(idx, cell, &old, &mut next),
                x if x == Material::Stem as u8 => self.update_stem(idx, cell, &old, &mut next),
                x if x == Material::Flower as u8 => self.update_flower(idx, cell, &old, &mut next),
                x if x == Material::Moss as u8 => self.update_moss(idx, cell, &old, &mut next),
                x if x == Material::Fungus as u8 => self.update_fungus(idx, cell, &old, &mut next),
                _ => {}
            }
        }

        self.share_heat(&mut next);
        self.cells = next;
    }

    /// Heat spreads through water (`HEAT_SHARE`), as the tick's last step: each water cell
    /// takes `(theirs - its) / HEAT_SHARE` from every water neighbour, all read from the tick's
    /// final energies, so what one cell takes another gives, exactly, and nothing else spends
    /// that heat at the same time. It first ran inside the reaction pass, reading `old` while a
    /// vent or the chill debited `next`, so a lone hot cell gave away heat it had already spent
    /// and the clamp at zero kept it: 255 vented to 215, and its neighbours ended with 248.
    fn share_heat(&self, cells: &mut [Cell]) {
        let water = Material::Water as u8;
        let energy: Vec<u16> = cells.iter().map(|cell| cell.energy).collect();
        for idx in 0..cells.len() {
            if cells[idx].kind != water {
                continue;
            }
            let (x, y) = self.xy(idx);
            let own = energy[idx] as i32;
            let mut flow = 0;
            for dy in -1..=1 {
                for dx in -1..=1 {
                    if (dx != 0 || dy != 0) && self.in_bounds(x + dx, y + dy) {
                        let nidx = self.idx((x + dx) as u32, (y + dy) as u32);
                        if cells[nidx].kind == water {
                            flow += (energy[nidx] as i32 - own) / HEAT_SHARE;
                        }
                    }
                }
            }
            if flow != 0 {
                cells[idx].energy = (own + flow).clamp(0, 255) as u16;
            }
        }
    }

    /// One step of the slow world: the changes a terrarium makes while nobody is
    /// watching it.
    ///
    /// Runs only when the player returns, on a clock derived from how long they were
    /// away, and **never during play**. A slow step is deliberately not a slow tick:
    /// it is a small set of transformations each too consequential to fire while
    /// watched, and none of them edits something the player BUILT — a scene of bare
    /// walls, dry sand and glass comes back byte-identical. (This used to say "only what
    /// the player left living"; a flooded lake bed is not alive, and nobody built it.)
    ///
    /// Why absence needs a unit of its own, and the curve that converts hours into
    /// steps, both live in `app/src/slowWorld.ts`, which owns the absence policy for
    /// the app and the harness alike. `wakeTerrarium` there is also what guarantees
    /// these steps land BEFORE the tick catch-up, so the conditions they create get
    /// played forward and arrive as a garden rather than as a diff.
    pub fn slow_step(&mut self) {
        let old = self.cells.clone();
        let mut next = old.clone();

        for idx in 0..old.len() {
            let cell = old[idx];

            // The hearth goes back to the ground. Cold char left standing in the
            // open crumbles into fresh soil, so a fire you burned out last night is
            // a bed you can plant in tomorrow. Char under water is spared: a
            // quenched hearth is a deliberate look, and running water already has
            // its own rule for washing char away.
            if cell.kind == Material::Ember as u8 {
                if cell.energy < COLD_CHAR_ENERGY
                    && cell.flags & FLAG_WET == 0
                    && self.chance(SLOW_CHAR_SETTLES)
                {
                    next[idx] = Cell::new(Material::Soil as u8, cell.variant, 0);
                }
                continue;
            }

            // Sediment turns to rock, which closes the one loop the roster was missing.
            // Lava cools to stone, running water wears stone to sand, heat fuses sand to
            // glass and a meteor shatters glass back to sand — but nothing ever turned sand
            // into stone, so the cycle had a hole in it. Sand lying under its own deposit
            // at the bottom of standing water compacts into sandstone while you are away.
            //
            // "At the bottom of standing water", not "wet", and that is a measured choice:
            // water does not soak down through a sand bed in this sim. On a real pond only
            // the top two to five rows ever carry the wet flag and the deep bed stays dry,
            // so a wetness test either fired on about nine cells (wet AND covered) or capped
            // loose sand with a stone lid (wet at all). The deposit's position under the
            // water is what matters, which is also the true geology: a lake bed, not a beach.
            //
            // The cover requirement leaves the topmost layer loose, so a compacted bed keeps
            // a sand floor on top of it. And a dry dune can never qualify — the sand castle
            // you left on the shelf comes back as sand. Only a flooded deposit changes.
            if cell.kind == Material::Sand as u8 {
                if self.under_standing_water(idx, &old) && self.chance(SLOW_SAND_COMPACTS) {
                    next[idx] = Cell::new(Material::Stone as u8, cell.variant, cell.energy);
                    next[idx].flags = (cell.flags & FLAG_WET) | FLAG_BEDDED;
                }
                continue;
            }

            // A spent seed head sows. The crown drops a seed clear of its own shadow,
            // so a garden walks across the tray over successive visits instead of
            // standing exactly where it was planted forever. The seed inherits the
            // damp of the ground it lands in, which is what decides whether it comes
            // up: a garden you keep watered spreads, a dry one holds still.
            //
            // "Spent" is age plus an empty budget, NOT the absence of petals. A
            // measured garden showed why: crowns reliably run to energy 0 by ~1200
            // ticks, but a head almost always keeps one stubborn petal that never
            // meets the shed rule's own energy test, so a bare-crown check fired
            // essentially never and the whole rule was dead on arrival.
            if cell.kind == Material::Flower as u8
                && cell.flags & FLAG_ROOTED != 0
                && cell.age > PETAL_SHED_AGE
                && cell.energy < POLLEN_RESERVE
                && self.chance(SLOW_SEED_SCATTERS)
            {
                let site = self.scatter_site(idx, cell.variant, &old, &next);
                if let Some(site) = site {
                    let below = site + self.width as usize;
                    let ground = old[below];
                    let damp = ground.flags & FLAG_WET != 0 || ground.energy > SOIL_DAMP_ENERGY;
                    // The seed works its way down to ground. A watered bed is a solid
                    // moss carpet within about twenty seconds of play, and moss does
                    // not root a seed — measured on a real garden, every seed a head
                    // sowed landed on moss and sat there as an inert grain forever.
                    // So the landing displaces that one patch of carpet back to the
                    // soil under it, carrying the moss's moisture down with it. One
                    // cell per seed: this opens a planting hole, it does not strip a
                    // carpet the player grew.
                    if ground.kind == Material::Moss as u8 {
                        next[below] = Cell::new(Material::Soil as u8, ground.variant, ground.energy);
                        next[below].flags = ground.flags & (FLAG_WET | FLAG_COSMIC);
                    }
                    next[site] = Cell::new(Material::Seed as u8, cell.variant, 0);
                    next[site].flags =
                        (cell.flags & FLAG_COSMIC) | if damp { FLAG_WET } else { 0 };
                }
            }
        }

        self.cells = next;
    }

    /// Sand covered by at least one layer of its own deposit, in a deposit whose top is
    /// under standing water. Scans straight up through sand and BEDDED stone — sandstone
    /// already formed above still counts as overburden — and asks what it meets first.
    /// Reads `old` only, so a cell compacting this step cannot change what its neighbours
    /// see.
    ///
    /// Plain stone ends the scan, and that is the construction guard rather than a detail.
    /// Counting every stone as deposit let water resting on a painted stone lid petrify the
    /// dry sand sealed under it — reproduced three separate ways by review, 88-124 cells of
    /// sand that never touched water turned to rock in a day. A lid is something somebody
    /// built; only rock the lake itself laid down is part of the lake bed.
    fn under_standing_water(&self, idx: usize, old: &[Cell]) -> bool {
        let (x, y) = self.xy(idx);
        let mut cover = 0;
        let mut ny = y - 1;
        while ny >= 0 {
            let above = old[self.idx(x as u32, ny as u32)];
            let kind = above.kind;
            if kind == Material::Sand as u8
                || (kind == Material::Stone as u8 && above.flags & FLAG_BEDDED != 0)
            {
                cover += 1;
                ny -= 1;
                continue;
            }
            return cover > 0 && is_water_like(kind);
        }
        false
    }

    /// Somewhere a scattered seed could actually come up: open air resting on soil
    /// or moss, searched outward from the parent. Every offset clears
    /// `PLANT_SPACING`, because a seed dropped inside the parent's shadow can never
    /// germinate and would only litter the bed with grains that do nothing.
    fn scatter_site(&self, idx: usize, variant: u8, old: &[Cell], next: &[Cell]) -> Option<usize> {
        let (x, y) = self.xy(idx);
        let start = variant as usize % SCATTER_OFFSETS.len();
        for step in 0..SCATTER_OFFSETS.len() {
            let dx = SCATTER_OFFSETS[(start + step) % SCATTER_OFFSETS.len()];
            let nx = x + dx;
            if !self.in_bounds(nx, y) {
                continue;
            }
            for ny in y..(y + SCATTER_REACH).min(self.height as i32 - 1) {
                if ny < 0 {
                    continue;
                }
                let site = self.idx(nx as u32, ny as u32);
                let below = self.idx(nx as u32, (ny + 1) as u32);
                let ground = old[below].kind;
                if old[site].kind == Material::Empty as u8
                    && next[site].kind == Material::Empty as u8
                    && (ground == Material::Soil as u8 || ground == Material::Moss as u8)
                {
                    return Some(site);
                }
            }
        }
        None
    }
}

#[no_mangle]
pub extern "C" fn universe_new(width: u32, height: u32, seed: u32) -> *mut Universe {
    Box::into_raw(Box::new(Universe::new(width, height, seed)))
}

#[no_mangle]
pub unsafe extern "C" fn universe_free(ptr: *mut Universe) {
    if !ptr.is_null() {
        drop(Box::from_raw(ptr));
    }
}

#[no_mangle]
pub unsafe extern "C" fn universe_width(ptr: *const Universe) -> u32 {
    ptr.as_ref().map_or(0, Universe::width)
}

#[no_mangle]
pub unsafe extern "C" fn universe_height(ptr: *const Universe) -> u32 {
    ptr.as_ref().map_or(0, Universe::height)
}

#[no_mangle]
pub unsafe extern "C" fn universe_tick_count(ptr: *const Universe) -> u32 {
    ptr.as_ref().map_or(0, Universe::tick_count)
}

#[no_mangle]
pub extern "C" fn universe_cell_stride() -> u32 {
    Universe::cell_stride()
}

#[no_mangle]
pub unsafe extern "C" fn universe_cells_ptr(ptr: *const Universe) -> *const Cell {
    ptr.as_ref()
        .map(Universe::cells_ptr)
        .unwrap_or(std::ptr::null())
}

#[no_mangle]
pub unsafe extern "C" fn universe_cells_byte_len(ptr: *const Universe) -> u32 {
    ptr.as_ref().map_or(0, Universe::cells_byte_len)
}

#[no_mangle]
pub unsafe extern "C" fn universe_clear(ptr: *mut Universe) {
    if let Some(universe) = ptr.as_mut() {
        universe.clear();
    }
}

#[no_mangle]
pub unsafe extern "C" fn universe_paint(
    ptr: *mut Universe,
    x: i32,
    y: i32,
    radius: u32,
    material: u8,
    density: u32,
) {
    if let Some(universe) = ptr.as_mut() {
        universe.paint(x, y, radius, material, density);
    }
}

#[no_mangle]
pub unsafe extern "C" fn universe_tick(ptr: *mut Universe) {
    if let Some(universe) = ptr.as_mut() {
        universe.tick();
    }
}

#[no_mangle]
pub unsafe extern "C" fn universe_slow_step(ptr: *mut Universe) {
    if let Some(universe) = ptr.as_mut() {
        universe.slow_step();
    }
}

#[no_mangle]
pub unsafe extern "C" fn universe_load_cells(
    ptr: *mut Universe,
    data_ptr: *const u8,
    data_len: u32,
) -> u32 {
    if ptr.is_null() || data_ptr.is_null() {
        return 0;
    }
    let data = slice::from_raw_parts(data_ptr, data_len as usize);
    ptr.as_mut()
        .map(|universe| universe.load_cells(data) as u32)
        .unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn alloc(len: u32) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len as usize);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: u32) {
    if !ptr.is_null() {
        drop(Vec::from_raw_parts(ptr, 0, len as usize));
    }
}

impl Universe {
    fn idx(&self, x: u32, y: u32) -> usize {
        (y * self.width + x) as usize
    }

    fn xy(&self, idx: usize) -> (i32, i32) {
        ((idx as u32 % self.width) as i32, (idx as u32 / self.width) as i32)
    }

    fn in_bounds(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && x < self.width as i32 && y < self.height as i32
    }

    fn rand(&mut self) -> u32 {
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x.max(1);
        self.rng
    }

    fn chance(&mut self, n: u32) -> bool {
        n > 0 && self.rand() % n == 0
    }

    fn variant_for(&mut self, x: u32, y: u32, material: u8) -> u8 {
        let mix = x
            .wrapping_mul(73856093)
            .wrapping_add(y.wrapping_mul(19349663))
            .wrapping_add((material as u32).wrapping_mul(83492791))
            .wrapping_add(self.rng);
        (mix % 8) as u8
    }

    fn bottom_up_indices(&self) -> Vec<usize> {
        let mut indices = Vec::with_capacity(self.cells.len());
        let flip = self.tick_count % 2 == 1;
        for y in (0..self.height).rev() {
            if flip {
                for x in (0..self.width).rev() {
                    indices.push(self.idx(x, y));
                }
            } else {
                for x in 0..self.width {
                    indices.push(self.idx(x, y));
                }
            }
        }
        indices
    }

    fn top_down_indices(&self) -> Vec<usize> {
        let mut indices = Vec::with_capacity(self.cells.len());
        let flip = self.tick_count % 2 == 0;
        for y in 0..self.height {
            if flip {
                for x in (0..self.width).rev() {
                    indices.push(self.idx(x, y));
                }
            } else {
                for x in 0..self.width {
                    indices.push(self.idx(x, y));
                }
            }
        }
        indices
    }

    fn age_and_decay(&self, cells: &mut [Cell]) {
        for (idx, cell) in cells.iter_mut().enumerate() {
            if cell.kind == Material::Empty as u8 {
                continue;
            }
            cell.age = cell.age.saturating_add(1);
            let drain = match cell.kind {
                x if x == Material::Fire as u8 => 3,
                x if x == Material::Ember as u8 => 2,
                x if x == Material::Pollen as u8 => 2,
                x if x == Material::Water as u8 => 2,
                x if x == Material::Steam as u8 => 2,
                x if x == Material::Smoke as u8 => 1,
                x if x == Material::Stardust as u8 => 1,
                x if x == Material::Soil as u8 => 1,
                x if x == Material::Seed as u8 => 1,
                x if x == Material::Moss as u8 => 1,
                x if x == Material::Fungus as u8 => 1,
                x if x == Material::Flower as u8 => 1,
                _ => 0,
            } + if cell.flags & FLAG_FROZEN != 0 { 1 } else { 0 }
                + if cell.flags & FLAG_WET != 0 && is_absorbent(cell.kind) { 1 } else { 0 };
            // A bloom's whole arc ticks down on BLOOM_CLOCK, so its budget can stay a
            // small number the save format already accepts while still lasting long
            // enough to watch it open, dust the air with pollen, and finally wilt.
            //
            // The phase comes from the cell's OWN age, not the global tick count. Cell
            // age is saved with the scene; the tick count is not restored on load, so a
            // global phase would silently shift a loaded bloom's arc.
            //
            // The environmental drains ride the same slow clock deliberately. A bloom in
            // a watered garden is usually wet, and Flower is absorbent, so letting the
            // wet drain run at full rate would collapse the whole arc back to the few
            // seconds this change exists to fix.
            let drain = if cell.kind == Material::Flower as u8 && cell.age % BLOOM_CLOCK != 0 {
                0
            } else {
                drain
            };
            // Water holds its heat (`WATER_CHILL`). On the global clock, not the cell's age:
            // age saturates at 65535 here and wraps in the JS mirror, so an hour-old pond
            // keyed on age would stop cooling in one engine and not the other.
            let drain = if cell.kind == Material::Water as u8 && self.tick_count % WATER_CHILL != 0 {
                0
            } else {
                drain
            };
            let drain = if cell.kind == Material::Ember as u8
                && (EMBER_CRACK_FLOOR..=90).contains(&cell.energy)
                && self.tick_count % EMBER_CRACK_CLOCK != 0
                && ember_crack(idx as u32 % self.width, idx as u32 / self.width)
            {
                0
            } else {
                drain
            };
            cell.energy = cell.energy.saturating_sub(drain);
            if cell.energy == 0 {
                if cell.flags & FLAG_FROZEN != 0 {
                    cell.flags = thawed_flags(cell.kind, cell.flags);
                } else {
                    cell.flags &= !(FLAG_WET | FLAG_COSMIC);
                }
            }

            if cell.kind == Material::Steam as u8 && cell.flags & FLAG_PUFF != 0 && cell.energy == 0 {
                // A puff fades without a trace: it is vapour a wisp spread into, never water.
                *cell = Cell::empty();
            } else if cell.kind == Material::Steam as u8 && cell.age > 150 {
                // A quarter of expiring steam condenses back into a falling droplet.
                *cell = if cell.variant & 3 == 0 {
                    Cell::new(Material::Water as u8, cell.variant, 26)
                } else {
                    Cell::empty()
                };
            } else if (cell.kind == Material::Smoke as u8 && cell.age > 180)
                || (cell.kind == Material::Pollen as u8 && cell.age > 140)
                || (cell.kind == Material::Spark as u8 && cell.age > 60)
                || (cell.kind == Material::Fire as u8 && cell.age > 90 && cell.energy < 24)
            {
                *cell = Cell::empty();
            }
        }
    }

    fn apply_reactions(&mut self, old: &[Cell], next: &mut [Cell]) {
        for idx in 0..old.len() {
            let cell = old[idx];
            if cell.is_empty() {
                continue;
            }
            let (x, y) = self.xy(idx);
            let neighbors = self.neighbor_indices(x, y);
            match cell.kind {
                x if x == Material::Wellspring as u8 => {
                    let chilled = neighbors
                        .iter()
                        .any(|&nidx| old[nidx].kind == Material::Ice as u8);
                    let remembered = cell.energy;
                    let taught = cell.flags & FLAG_TAUGHT != 0;
                    if remembered == 0 {
                        // An unattuned wellspring drinks the identity of the first source
                        // material that touches it, consuming that cell.
                        for nidx in neighbors {
                            let other = old[nidx];
                            if is_wellspring_source(other.kind)
                                && next[idx].kind == Material::Wellspring as u8
                            {
                                next[idx].energy = other.kind as u16;
                                if next[nidx].kind == other.kind {
                                    next[nidx] = Cell::empty();
                                }
                                break;
                            }
                        }
                    } else if !taught && self.learn_or_adopt(idx, remembered, chilled, &neighbors, old, next) {
                        // Learned or took up a lesson this tick; it holds still while it does.
                    } else if chilled {
                        // Stilled by the ice. A taught cell holds its lesson and restarts its
                        // hold; an untaught one is still listening.
                        if taught && next[idx].kind == Material::Wellspring as u8 {
                            next[idx].age = 0;
                        }
                    } else if is_wellspring_source(remembered as u8) {
                        // A taught cell pours its lesson as soon as it is free, but keeps the
                        // latch for LESSON_HOLD ticks more. Letting go the moment the ice left
                        // was a relapse: a pool still freezing outward chilled the cell again,
                        // its old water now counted as new, and it learned that back. Measured
                        // with sand dropped a quarter-second after the ice, 2-4 seeds of 6 on
                        // the real board ended mixed or back on water; one cell flipped 21 times.
                        if taught && cell.age >= LESSON_HOLD && next[idx].kind == Material::Wellspring as u8 {
                            next[idx].flags &= !FLAG_TAUGHT;
                        }
                        // Attuned: pour the remembered material, feeding THROUGH its own
                        // body rather than only into a bare face. The source guard rejects
                        // out-of-range ids from imported scenes.
                        //
                        // A spring submerges itself within seconds, and an adjacent-empty
                        // rule then blocks every face and stops the source dead. Measured
                        // before this: a permanent 3-4 cells of standing water, so the only
                        // endless source in the game watered its own footprint and nothing
                        // else. Raising the rate alone changed nothing, because the faces
                        // were the limit, not the odds — walking past its own material to
                        // the edge of the pool is what lets it actually pump.
                        //
                        // No output cap here. One was tried — resting once a 5x5 held enough
                        // of its own material — and no scene could be built in which it
                        // changed the outcome. The reason recorded for that was wrong, though:
                        // nothing in the game drinks standing water (water resting on soil,
                        // sand, wall or stone keeps every cell for 3,000 ticks, measured).
                        // What bounds a water spring is the move clobber — flowing water
                        // deleting water — at about 280 cells on the 220x140 board, against
                        // 8,837 once moving water stops deleting itself. ROADMAP Phase 20
                        // replaces that accident with a deliberate sink; until it does, the
                        // clobber cannot be closed on its own. `npm run water:budget` measures it.
                        let (cx, cy) = self.xy(idx);
                        let source = cell.energy as u8;
                        for (dx, dy) in [(0, -1), (-1, 0), (1, 0), (0, 1)] {
                            let mut target = None;
                            for step in 1..=WELLSPRING_REACH {
                                let (nx, ny) = (cx + dx * step, cy + dy * step);
                                if !self.in_bounds(nx, ny) {
                                    break;
                                }
                                let nidx = self.idx(nx as u32, ny as u32);
                                if old[nidx].is_empty() && next[nidx].is_empty() {
                                    target = Some(nidx);
                                    break;
                                }
                                if old[nidx].kind != source {
                                    break;
                                }
                            }
                            // The roll happens only once a target exists, in both engines,
                            // or the two RNG streams part company.
                            if let Some(nidx) = target {
                                if self.chance(WELLSPRING_POUR) {
                                    let variant = (self.rand() & 3) as u8;
                                    next[nidx] = Cell::new(source, variant, starting_energy(source));
                                    if source == Material::Oil as u8 {
                                        next[nidx].flags = FLAG_SPRING_OIL;
                                    }
                                }
                            }
                        }
                    }
                }
                x if x == Material::Wall as u8 => {
                    // Hearth masonry: a wall beside a live flame radiates gentle warmth,
                    // thawing and drying its nook. It only clears flags — a hearth never
                    // ignites anything or creates cells.
                    if cell.flags & FLAG_FROZEN != 0 {
                        continue;
                    }
                    //
                    // Warmth CONDUCTS along the masonry: a brick is warm if it touches the
                    // flame, or if it touches a brick that does. That is one cell of reach
                    // past contact, which is what the clause needs — measured across eight
                    // geometries, exactly ONE wall cell was ever both touching the flame and
                    // touching the damp, so the nook dried one cell however eagerly the rule
                    // rolled. Adjacency was a reach problem and no amount of rolling fixes
                    // reach.
                    //
                    // This was first written as a 5x5 proximity scan, which an adversarial
                    // review correctly called out: an isolated brick two cells diagonally
                    // from a flame, across open air, dried its neighbour exactly like a
                    // chimney breast. The comment said conduction and the code said
                    // proximity. Requiring the intervening brick is both truthful and
                    // simpler than searching a square.
                    //
                    // THAWING deliberately keeps strict contact. Giving it the same reach
                    // melted the ice around every wall near any flame, and four unrelated
                    // frost interactions went too faint to see. Radiant warmth drying a damp
                    // wall is not the same as heat enough to melt ice.
                    let is_flame = |other: Cell| {
                        is_hot(other.kind)
                            || (other.kind == Material::Ember as u8 && other.energy > 90)
                    };
                    let touching_flame = neighbors.iter().any(|&nidx| is_flame(old[nidx]));
                    // Written with manual loops rather than `neighbor_indices`, which
                    // allocates: this runs for every wall cell every tick, and a scene can
                    // be mostly wall.
                    let mut hearth = touching_flame;
                    if !hearth {
                        let (wx, wy) = self.xy(idx);
                        'conduct: for dy in -1..=1i32 {
                            for dx in -1..=1i32 {
                                if dx == 0 && dy == 0 {
                                    continue;
                                }
                                let (bx, by) = (wx + dx, wy + dy);
                                if !self.in_bounds(bx, by) {
                                    continue;
                                }
                                if old[self.idx(bx as u32, by as u32)].kind != Material::Wall as u8
                                {
                                    continue;
                                }
                                for fy in -1..=1i32 {
                                    for fx in -1..=1i32 {
                                        let (nx, ny) = (bx + fx, by + fy);
                                        if !self.in_bounds(nx, ny) {
                                            continue;
                                        }
                                        if is_flame(old[self.idx(nx as u32, ny as u32)]) {
                                            hearth = true;
                                            break 'conduct;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if !hearth {
                        continue;
                    }
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.flags & FLAG_FROZEN != 0 && touching_flame && self.chance(6) {
                            next[nidx].flags = thawed_flags(other.kind, next[nidx].flags);
                        } else if other.flags & FLAG_WET != 0 && self.chance(10) {
                            next[nidx].flags &= !FLAG_WET;
                        }
                    }
                }
                x if x == Material::Fire as u8 => {
                    let mut dampened = false;
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 {
                            // Water heats gradually: its energy field is temperature, and a
                            // sustained flame walks it from simmer to a boil-off into steam.
                            dampened = true;
                            if next[nidx].kind == Material::Water as u8 {
                                next[nidx].energy = next[nidx].energy.saturating_add(30).min(255);
                                if next[nidx].energy > 200 {
                                    next[nidx] = Cell::new(Material::Steam as u8, other.variant, 180);
                                }
                            }
                        }
                        if other.kind == Material::Moonwater as u8 {
                            dampened = true;
                            if self.chance(2) {
                                next[nidx] = Cell::new(Material::Steam as u8, other.variant, 180);
                            }
                        }
                        if heat_softens_cell(next, nidx, other, 42) {
                            if other.flags & FLAG_WET != 0 {
                                self.emit_vapor_from(nidx, old, next, Material::Steam as u8, other.variant, 150);
                            }
                            continue;
                        }
                        if other.kind == Material::Sand as u8 && cell.energy > 190 && self.chance(7) {
                            next[nidx] = Cell::new(Material::Glass as u8, other.variant, 0);
                            continue;
                        }
                        if is_flammable(other.kind) && self.chance(burn_chance(other.kind)) {
                            next[nidx] = ignited_cell(other, 220);
                        }
                    }
                    if dampened {
                        next[idx].energy = next[idx].energy.saturating_sub(32);
                        if next[idx].energy < 18 && cell.age > 8 {
                            next[idx] = Cell::new(Material::Steam as u8, cell.variant, 130);
                        }
                    }
                }
                x if x == Material::Lava as u8 => {
                    let mut cooling = 0;
                    let hot_neighbors = neighbors.iter().filter(|&&nidx| is_hot(old[nidx].kind)).count();
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 || other.kind == Material::Moonwater as u8 {
                            cooling += if other.kind == Material::Moonwater as u8 { 50 } else { 72 };
                            if other.kind == Material::Water as u8 || self.chance(3) {
                                next[nidx] = Cell::new(Material::Steam as u8, other.variant, 220);
                            }
                        }
                        if heat_softens_cell(next, nidx, other, 72) {
                            if other.flags & FLAG_WET != 0 {
                                self.emit_vapor_from(nidx, old, next, Material::Steam as u8, other.variant, 180);
                            }
                            continue;
                        }
                        if other.kind == Material::Sand as u8 && self.chance(4) {
                            next[nidx] = Cell::new(Material::Glass as u8, other.variant, 0);
                            continue;
                        }
                        if is_flammable(other.kind) && self.chance(3) {
                            next[nidx] = ignited_cell(other, 240);
                        }
                    }
                    if cooling > 0 && next[idx].kind == Material::Lava as u8 {
                        next[idx].energy = next[idx].energy.saturating_sub(cooling);
                        if next[idx].energy < 90 && self.chance(3) {
                            next[idx] = Cell::new(Material::Stone as u8, cell.variant, 0);
                        }
                    } else if next[idx].kind == Material::Lava as u8
                        && self.chance(if hot_neighbors < 3 { 8 } else { LAVA_DEEP_COOLS })
                    {
                        // Lava cools on its own, exposed edges fastest, so pools crust
                        // edge-inward and nothing stays molten forever without a heat source.
                        // Deep lava cooling too is what keeps a kept pool from lasting forever.
                        next[idx].energy = next[idx].energy.saturating_sub(4);
                        if next[idx].energy < 60 && self.chance(4) {
                            next[idx] = Cell::new(Material::Stone as u8, cell.variant, 0);
                        }
                    }
                }
                x if x == Material::Stardust as u8 => {
                    for nidx in neighbors {
                        let other = old[nidx];
                        if (other.kind == Material::Seed as u8
                            || other.kind == Material::Moss as u8
                            || other.kind == Material::Flower as u8)
                            && self.chance(12)
                        {
                            next[nidx].energy = next[nidx].energy.saturating_add(24).min(255);
                            next[nidx].flags |= FLAG_COSMIC;
                        }
                        if other.kind == Material::Water as u8 {
                            next[nidx] = Cell::new(Material::Moonwater as u8, other.variant, 130);
                            next[nidx].flags = FLAG_COSMIC;
                        }
                        if (other.kind == Material::Soil as u8 || other.kind == Material::Fungus as u8)
                            && self.chance(14)
                        {
                            next[nidx].energy = next[nidx].energy.saturating_add(18).min(255);
                            next[nidx].flags |= FLAG_COSMIC;
                        }
                        if other.kind == Material::Fire as u8 && self.chance(2) {
                            next[nidx] = Cell::new(Material::Stardust as u8, other.variant, 140);
                            next[nidx].flags = FLAG_COSMIC;
                        }
                        if (other.kind == Material::Stone as u8 || other.kind == Material::Wall as u8)
                            && self.chance(12)
                        {
                            next[nidx].flags |= FLAG_COSMIC;
                            next[nidx].energy = next[nidx].energy.max(36);
                        }
                        // Stardust settling on a slick leaves a rainbow sheen that burns like a
                        // firework (see the oil arm). Oil is painted at energy 0, and a cell at 0
                        // loses its cosmic flag in `age_and_decay`, so the sheen lifts it as the
                        // etch above does; oil drains nothing, so the sheen stays.
                        if other.kind == Material::Oil as u8 && self.chance(12) {
                            next[nidx].flags |= FLAG_COSMIC;
                            next[nidx].energy = next[nidx].energy.max(36);
                        }
                    }
                }
                x if x == Material::Water as u8 || x == Material::Moonwater as u8 => {
                    let is_moonwater = cell.kind == Material::Moonwater as u8;
                    let vigor = if is_moonwater { 96 } else { 56 };
                    // Erosion needs FLOW, and this is the cheapest honest proxy the reaction
                    // pass has for it: water with somewhere to go. A stream falling over a lip
                    // always has open air around it; the still middle of a pond has none.
                    //
                    // Without this the rule ate the player's build. Measured on a stone bowl
                    // holding standing water, letting every touching cell erode took the basin
                    // from 169 stone cells to 45-60 in 20,000 ticks — the pond dissolved into a
                    // sand pit. With it, only the waterline wears, which is what a shoreline
                    // does. A wall basin is untouched either way; wall never erodes, and that is
                    // what makes Wall the material to build something permanent from.
                    let water_can_move = neighbors.iter().any(|&nidx| old[nidx].is_empty());
                    // Stricter than `water_can_move`: somewhere this water could actually MOVE.
                    // Rinsing soot and washing char claim RUNNING water, and open air above a
                    // still pond's surface is not running — review measured a shallow open
                    // pond rinsing a sunken stone on tick 1 with zero water moves.
                    let (cx, cy) = self.xy(idx);
                    let water_can_flow = self.liquid_can_flow(cx, cy, old);
                    if !is_moonwater && cell.energy > 150 && self.chance(20) {
                        // Simmering water vents a wisp and loses heat to evaporation.
                        self.emit_vapor_from(idx, old, next, Material::Steam as u8, cell.variant, 120);
                        next[idx].energy = next[idx].energy.saturating_sub(40);
                    }
                    for nidx in neighbors {
                        let other = old[nidx];
                        // Water warmer than ice gives the ice its heat (`ICE_TEMP`); the ice
                        // melts once it has taken enough, in its own arm.
                        if !is_moonwater && other.kind == Material::Ice as u8 && cell.energy > ICE_TEMP {
                            let given = (cell.energy - ICE_TEMP) / MELT_SHARE;
                            if next[nidx].kind == Material::Ice as u8 {
                                next[nidx].energy = next[nidx].energy.saturating_add(given).min(255);
                            }
                            next[idx].energy = next[idx].energy.saturating_sub(given);
                            continue;
                        }
                        if is_moonwater && other.kind == Material::Oil as u8 && self.chance(4) {
                            next[nidx] = Cell::new(Material::Stardust as u8, other.variant, 150);
                            continue;
                        }
                        if !is_moonwater && other.kind == Material::Lava as u8 {
                            next[idx] = Cell::new(Material::Steam as u8, cell.variant, 220);
                            next[nidx].energy = next[nidx].energy.saturating_sub(72);
                            next[nidx].flags |= FLAG_SCORCHED;
                            if next[nidx].energy < 120 {
                                next[nidx] = Cell::new(Material::Stone as u8, other.variant, 0);
                                next[nidx].flags = FLAG_SCORCHED;
                            }
                            continue;
                        }
                        if !is_moonwater && other.kind == Material::Meteor as u8 {
                            next[idx] = Cell::new(Material::Steam as u8, cell.variant, 230);
                            next[nidx] = Cell::new(Material::Stone as u8, other.variant, 0);
                            next[nidx].flags = FLAG_SCORCHED;
                            continue;
                        }
                        if other.kind == Material::Ember as u8
                            && other.energy < COLD_CHAR_ENERGY
                            && water_can_flow
                            && self.chance(12)
                        {
                            // Charcoal wash: RUNNING water crumbles cold char away. The comment
                            // always said running; the code took any touching water, so a hearth
                            // doused under a still pond dissolved within ticks — contradicting the
                            // slow world, which spares char under water because a quenched hearth
                            // is a look somebody chose. Once ponds stopped draining (ROADMAP
                            // Phase 20) that was every doused hearth. Same flow test as the rinse;
                            // the roll comes after it.
                            next[nidx] = Cell::empty();
                            continue;
                        }
                        if !is_moonwater
                            && is_hydratable(other.kind)
                            && self.neighbor_has_kind(old, nidx, Material::Oil as u8)
                        {
                            // The oil arm itself strips the wet flag from everything it touches,
                            // every tick; a second strip here changed no byte of a board but for
                            // four cells for one tick each, over 32 runs (2026-10-14).
                            next[nidx].energy = next[nidx].energy.saturating_sub(16);
                            continue;
                        }
                        if other.kind == Material::Seed as u8 {
                            let seed_vigor = if is_moonwater { 130 } else { 90 };
                            let energy = next[nidx].energy.saturating_add(seed_vigor).min(255);
                            next[nidx].energy = energy;
                            next[nidx].flags = (next[nidx].flags | FLAG_WET) & !FLAG_SCORCHED;
                            if is_moonwater {
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                        }
                        if other.kind == Material::Moss as u8
                            || other.kind == Material::Fungus as u8
                            || other.kind == Material::Flower as u8
                        {
                            next[nidx].energy = next[nidx].energy.saturating_add(vigor / 2).min(255);
                            next[nidx].flags = (next[nidx].flags | FLAG_WET) & !FLAG_SCORCHED;
                            if is_moonwater {
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                        }
                        if other.kind == Material::Soil as u8 {
                            if other.energy == 0 && other.age > 40 {
                                // Petrichor: the first water on long-dry soil breathes out a moist
                                // wisp. It vents from any open face, not straight up. Venting
                                // upward only meant the mist could never appear when a player
                                // waters from above — the water is sitting on the vent — which is
                                // to say, in the one gesture anybody actually makes.
                                if let Some(vent) = self.open_face(nidx, 0, old, next) {
                                    next[vent] = Cell::new(Material::Steam as u8, other.variant, 90);
                                }
                            }
                            next[nidx].energy = next[nidx].energy.saturating_add(vigor * 2).min(255);
                            next[nidx].flags = (next[nidx].flags | FLAG_WET) & !FLAG_SCORCHED;
                            if is_moonwater {
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                        }
                        if other.kind == Material::Sand as u8 {
                            next[nidx].energy = next[nidx].energy.saturating_add(vigor).min(255);
                            next[nidx].flags |= FLAG_WET;
                        }
                        if other.kind == Material::Wood as u8 {
                            next[nidx].energy = next[nidx].energy.saturating_add(vigor).min(255);
                            next[nidx].flags |= FLAG_WET;
                            if is_moonwater {
                                next[nidx].flags &= !FLAG_SCORCHED;
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                        }
                        if other.kind == Material::Stone as u8 {
                            next[nidx].energy = next[nidx].energy.saturating_add(vigor / 2).min(255);
                            next[nidx].flags |= FLAG_WET;
                            if is_moonwater {
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                            // Soot is rinsed off by RUNNING water — water that could actually move
                            // (`liquid_can_flow`), not merely water with air above it. Unconditional, a stone at the bottom of a still pond was
                            // scrubbed by every water cell around it at once — and once water
                            // stopped vanishing (ROADMAP Phase 20) a meteor shocked into scorched
                            // stone sank into the pond and lost its scorch within a tick or two,
                            // so the shock was never seen. The roll comes after the flow test,
                            // so still water takes no roll at all.
                            if next[nidx].flags & FLAG_SCORCHED != 0 && water_can_flow && self.chance(5) {
                                next[nidx].flags &= !FLAG_SCORCHED;
                            }
                            // `next[idx].kind == cell.kind` is an OWNERSHIP check, not a
                            // formality. Erosion consumes this water cell, and an earlier
                            // neighbour in the same loop may already have consumed it —
                            // quenching lava writes steam into it and then `continue`s, and
                            // meteor shock does the same. Without this guard erosion
                            // overwrites that steam with sand, so one water cell quenches
                            // the lava and then throws the result away.
                            if next[nidx].kind == Material::Stone as u8
                                && next[idx].kind == cell.kind
                                && next[nidx].energy >= 250
                                && water_can_move
                                && self.chance(2000)
                            {
                                // Erosion: fully saturated stone wears into a wet grain, and the
                                // water TAKES it — the grain drops into the cell the water was in
                                // and the water advances into the rock. Rolls happen per touching
                                // water cell, so heavier flow wears faster; sealed wall never
                                // erodes, which is what keeps Wall the material to build a
                                // permanent basin from.
                                //
                                // Leaving the grain where the stone was is what this used to do,
                                // and it made the rule self-terminating: the new sand formed a
                                // one-cell skin over the rock, the water never touched stone
                                // again, the stone dried back below saturation and erosion was
                                // over PERMANENTLY. Measured on a spring pouring across a stone
                                // lip — 21 cells by tick 8,000 and then not one more in the next
                                // 12,000, with zero stone cells left either saturated or in
                                // contact with water. A stream that cannot deepen its own channel
                                // is a stain, not erosion.
                                next[nidx] = Cell::new(cell.kind, cell.variant, cell.energy);
                                next[nidx].flags = cell.flags;
                                next[idx] = Cell::new(Material::Sand as u8, other.variant, 60);
                                // Moonwater marks what it touches, and a grain it wore off a
                                // rock is something it touched: dropping the mark here made
                                // `moonwater.marks` quietly untrue for this one outcome. Keyed
                                // on `is_moonwater` like every other branch in this arm, NOT on
                                // the liquid's own flags — moonwater is cosmic by KIND and
                                // carries no cosmic flag of its own, so copying its flags across
                                // set nothing at all and the grain came out plain wet.
                                next[idx].flags = FLAG_WET | if is_moonwater { FLAG_COSMIC } else { 0 };
                                break;
                            }
                        }
                        if other.kind == Material::Wall as u8 {
                            let wall_vigor = (vigor / if is_moonwater { 3 } else { 5 }).max(8);
                            next[nidx].energy = next[nidx].energy.saturating_add(wall_vigor).min(255);
                            next[nidx].flags |= FLAG_WET;
                            if is_moonwater {
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                            if next[nidx].flags & FLAG_SCORCHED != 0 && water_can_flow && self.chance(5) {
                                next[nidx].flags &= !FLAG_SCORCHED;
                            }
                        }
                    }
                }
                x if x == Material::Ice as u8 => {
                    if neighbors.iter().any(|&nidx| is_hot(old[nidx].kind)) {
                        next[idx] = Cell::new(Material::Water as u8, cell.variant, 70);
                        continue;
                    }
                    // Ice's energy is its warmth, given it by warmer water. Enough, and it
                    // melts (`ICE_MELT`); a little, and it re-chills a point a tick.
                    if cell.energy >= ICE_MELT {
                        next[idx] = Cell::new(Material::Water as u8, cell.variant, 60);
                        continue;
                    }
                    if cell.energy > ICE_COLD {
                        next[idx].energy = next[idx].energy.saturating_sub(1);
                    }
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 && other.energy <= ICE_TEMP && self.chance(5) {
                            next[nidx] = Cell::new(Material::Ice as u8, other.variant, 90);
                        } else if other.kind == Material::Moonwater as u8 && self.chance(10) {
                            next[nidx] = Cell::new(Material::Ice as u8, other.variant, 110);
                            next[nidx].flags = FLAG_COSMIC;
                        } else if other.kind == Material::Steam as u8 {
                            // A puff never frosts: it would make ice, and bring heat, out of
                            // vapour that was never water.
                            if other.flags & FLAG_PUFF != 0 || !self.chance(4) {
                                continue;
                            }
                            // Frost from steam brings the steam's heat into the ice, all of it
                            // above ICE_TEMP: a wisp frosts it, a flood of quench steam beside
                            // lava melts it. Steam used to freeze for nothing, so lava poured by
                            // an ice block grew it from 52 cells to 68 by 20 s; now it holds at
                            // 53 (8 seeds). A gate keeping hot steam from freezing at all took
                            // the frost out of `ice.condenses` and `steam.frosts` (8 seeds of 8
                            // to 0 and 1). Only the first ice to catch a cell takes its heat,
                            // so none is doubled.
                            if next[nidx].kind == Material::Steam as u8 {
                                next[idx].energy = next[idx].energy.saturating_add(other.energy.saturating_sub(ICE_TEMP)).min(255);
                            }
                            next[nidx] = Cell::new(Material::Ice as u8, other.variant, 70);
                        } else if other.kind == Material::Stone as u8 || other.kind == Material::Wall as u8 {
                            // Frost gets into masonry only through the water it holds, so a
                            // dry rock beside ice stays bare and a wet one frosts. Dry masonry
                            // used to fall through to the generic 1-in-4 freeze below, and the
                            // 72 energy that wrote was read as dampness the next tick: dry and
                            // damp ended identically frosted, and "damp" meant nothing.
                            if other.flags & FLAG_WET != 0 || other.energy > 40 {
                                next[nidx].flags = (next[nidx].flags | FLAG_FROZEN) & !FLAG_SCORCHED;
                                next[nidx].energy = next[nidx].energy.max(88);
                            }
                        } else if is_freezable(other.kind) && self.chance(4) {
                            next[nidx].flags |= FLAG_FROZEN;
                            next[nidx].energy = next[nidx].energy.max(72);
                        }
                    }
                }
                x if x == Material::Steam as u8 => {
                    let ice_nearby = neighbors.iter().any(|&nidx| old[nidx].kind == Material::Ice as u8);
                    // A puff is vapour a wisp spread into, never water: one water cell's wisp
                    // puffs into a dozen, so it neither turns back into water or ice nor wets what
                    // it touches (heat vents a wet wall as ordinary steam, which condenses; review
                    // made water from a puff that way). It skips those rolls. And a puff that
                    // meets ice is gone, so it never crowds the ice's face: puffs lingering there
                    // kept wisps from reaching it, and steam frosting a small ice dab passed the
                    // audit on 29 of 32 seeds (32 before billowing); 31 now.
                    let puff = cell.flags & FLAG_PUFF != 0;
                    if puff {
                        if ice_nearby && next[idx].kind == Material::Steam as u8 {
                            next[idx] = Cell::empty();
                        }
                        continue;
                    }
                    if ice_nearby && self.chance(5) {
                        next[idx] = Cell::new(Material::Ice as u8, cell.variant, 70);
                    }
                    let hot_nearby = neighbors.iter().any(|&nidx| is_hot(old[nidx].kind));
                    if !ice_nearby && !hot_nearby {
                        for nidx in neighbors {
                            let other = old[nidx];
                            if other.kind == Material::Stone as u8 || other.kind == Material::Wall as u8 {
                                let condensation = if other.kind == Material::Stone as u8 { 58 } else { 26 };
                                next[nidx].energy = next[nidx].energy.saturating_add(condensation).min(255);
                                // Condensation wets a surface; it does not wash soot off it —
                                // that is running water's job (the rinse, gated on flow). It used
                                // to clear the scorch too, and once moving water began throwing
                                // mist (ROADMAP Phase 20) that mist condensed on every stone near a
                                // pond: a meteor shocked into scorched stone lost its scorch within
                                // 5-11 ticks on 7 seeds of 8, so the shock was never seen.
                                next[nidx].flags |= FLAG_WET;
                                if other.kind == Material::Stone as u8 && self.chance(4) {
                                    next[idx] = Cell::new(Material::Water as u8, cell.variant, 50);
                                }
                            } else if other.kind == Material::Glass as u8 {
                                // Glass dew: steam fogs the pane and beads back into water,
                                // so a sealed glass terrarium keeps its moisture cycling.
                                next[nidx].energy = next[nidx].energy.saturating_add(46).min(255);
                                next[nidx].flags |= FLAG_WET;
                                if self.chance(4) {
                                    next[idx] = Cell::new(Material::Water as u8, cell.variant, 50);
                                }
                            }
                        }
                    }
                }
                x if x == Material::Smoke as u8 => {
                    for nidx in neighbors {
                        let other = old[nidx];
                        if is_sootable(other.kind)
                            && other.flags & (FLAG_WET | FLAG_FROZEN) == 0
                            && (cell.energy > 70 || cell.age > 16)
                        {
                            next[nidx].flags |= FLAG_SCORCHED;
                        }
                    }
                }
                x if x == Material::Ember as u8 => {
                    // Heat relights spent ember below 60, and a crack anywhere in the band it
                    // holds: a crack kept at 66-90 must catch again beside a new flame, or a
                    // smouldering log would stop carrying a second fire through it (review,
                    // 2026-10-28). `x` is the kind in this arm, so the crack is read from `idx`.
                    let relights = cell.energy < 60
                        || (cell.energy <= 90 && ember_crack(idx as u32 % self.width, idx as u32 / self.width));
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 || other.kind == Material::Moonwater as u8 {
                            next[idx].energy = next[idx].energy.saturating_sub(120);
                            next[idx].flags |= FLAG_WET;
                            // A hot ember hisses on 1 roll in 2 (1 in 6 before steam billowed).
                            // The bed gets this roll only on the tick water first reaches it, so
                            // at 1 in 6 a doused burning log billowed into a cloud half the size:
                            // about 60 cells at its biggest against 120, over 16 seeds.
                            if cell.energy > 40 && self.chance(2) {
                                next[nidx] = Cell::new(Material::Steam as u8, other.variant, 170);
                            }
                            continue;
                        }
                        if relights && is_hot(other.kind) && next[idx].kind == Material::Ember as u8 {
                            next[idx].energy = 210;
                            next[idx].flags &= !FLAG_WET;
                            continue;
                        }
                        if cell.energy > 90
                            && is_flammable(other.kind)
                            && self.chance(burn_chance(other.kind) * 3 / 2)
                        {
                            // Dries before ignition, as a flame does: the roll that would light
                            // a wet neighbour dries and scorches it instead, with the flame's
                            // drying heat. A burning log is mostly ember, and it used to light
                            // wet wood straight through, so a soaked log never showed it: over
                            // 32 seeds of the fire.dries scene, 434 wet cells went straight to
                            // ember and 180 were dried first; now none skip the step. It spends
                            // the same roll, so a scene with no wet fuel beside an ember plays
                            // out exactly as before. A frozen cell is left to the existing rules.
                            if is_scorchable(other.kind)
                                && other.flags & FLAG_WET != 0
                                && other.flags & FLAG_FROZEN == 0
                            {
                                next[nidx].flags = (next[nidx].flags & !FLAG_WET) | FLAG_SCORCHED;
                                next[nidx].energy = next[nidx].energy.saturating_sub(42);
                                continue;
                            }
                            next[nidx] = ignited_cell(other, 210);
                        }
                    }
                    if cell.energy > 90 && self.chance(9) {
                        self.emit_vapor_from(idx, old, next, Material::Smoke as u8, cell.variant, 80);
                    }
                }
                x if x == Material::Oil as u8 => {
                    // Heat, or a spark: a firework raining onto a slick, or a meteor's tail
                    // brushing it, sets it alight. Sparks are kept out of `is_hot` itself, which
                    // would let every spark light wood and melt ice.
                    if neighbors
                        .iter()
                        .any(|&nidx| is_hot(old[nidx].kind) || old[nidx].kind == Material::Spark as u8)
                    {
                        next[idx] = Cell::new(Material::Fire as u8, cell.variant, 240);
                        if cell.flags & FLAG_COSMIC != 0 {
                            // A slick stardust has given a sheen burns like a firework: its flame
                            // keeps the cosmic flag (the renderer's coloured fire) and each cell
                            // throws one spark upward, which can light powder and oil in its path.
                            next[idx].flags = FLAG_COSMIC;
                            let dir = SHEEN_SPARK_DIRS[(self.rand() % 3) as usize];
                            let (dx, dy) = SPARK_DIRS[dir];
                            // `x` in this arm is the matched kind, not the column.
                            let (cx, cy) = self.xy(idx);
                            let (sx, sy) = (cx + dx, cy + dy);
                            if self.in_bounds(sx, sy) {
                                let sidx = self.idx(sx as u32, sy as u32);
                                if old[sidx].is_empty() && next[sidx].is_empty() {
                                    next[sidx] = Cell::new(Material::Spark as u8, dir as u8, 235);
                                }
                            }
                        }
                        continue;
                    }
                    // A sheen spreads through its slick, so stardust settling on the top film
                    // colours the pool: an unsheened cell beside a sheened one takes it now and then.
                    if cell.flags & FLAG_COSMIC == 0
                        && neighbors.iter().any(|&nidx| {
                            old[nidx].kind == Material::Oil as u8 && old[nidx].flags & FLAG_COSMIC != 0
                        })
                        && self.chance(SHEEN_SPREAD)
                    {
                        next[idx].flags |= FLAG_COSMIC;
                        next[idx].energy = next[idx].energy.max(36);
                    }
                    for nidx in neighbors {
                        let other = old[nidx];
                        if is_hydratable(other.kind) {
                            next[nidx].energy = next[nidx].energy.saturating_sub(28);
                            next[nidx].flags &= !FLAG_WET;
                        }
                    }
                }
                _ => {}
            }
        }
    }

    fn neighbor_indices(&self, x: i32, y: i32) -> Vec<usize> {
        let mut indices = Vec::with_capacity(8);
        for dy in -1..=1 {
            for dx in -1..=1 {
                if dx == 0 && dy == 0 {
                    continue;
                }
                let nx = x + dx;
                let ny = y + dy;
                if self.in_bounds(nx, ny) {
                    indices.push(self.idx(nx as u32, ny as u32));
                }
            }
        }
        indices
    }

    /// Re-teaching a wellspring, for an attuned cell that is not already holding a lesson.
    /// Returns true when it learned or took one up this tick.
    ///
    /// Chilled, it drinks the first touching source that is NOT what it already pours. A
    /// spring sits in its own pool or pile, and drinking that back is why a lesson used to
    /// fade a tick after it was offered: measured on the real board, a water spring with sand
    /// dropped on it poured only water again on 2 seeds of 3 once the ice was cleared.
    ///
    /// Chilled or not, it also takes up a different lesson that a taught neighbour holds, so
    /// the whole spring learns, not just the few cells the new material landed on. The
    /// dormant core never attuned and never reaches here, so it stays dark.
    fn learn_or_adopt(
        &self,
        idx: usize,
        remembered: u16,
        chilled: bool,
        neighbors: &[usize],
        old: &[Cell],
        next: &mut [Cell],
    ) -> bool {
        if next[idx].kind != Material::Wellspring as u8 {
            return false;
        }
        // Drinking is only for a cell with no lesson beside it. Without this, a cell the lesson
        // had reached and let go of could be chilled again by its own pool freezing outward, and
        // the old pool water was now a "new" material to it: dropping sand a quarter-second after
        // the ice flipped one cell 21 times between water and sand, and the spring ended water.
        // Next to a held lesson a cell can only take that lesson up.
        let lesson_beside = neighbors.iter().any(|&nidx| {
            old[nidx].kind == Material::Wellspring as u8 && old[nidx].flags & FLAG_TAUGHT != 0
        });
        if chilled && !lesson_beside {
            for &nidx in neighbors {
                let other = old[nidx];
                if is_wellspring_source(other.kind) && other.kind as u16 != remembered {
                    next[idx].energy = other.kind as u16;
                    next[idx].flags |= FLAG_TAUGHT;
                    next[idx].age = 0;
                    if next[nidx].kind == other.kind {
                        next[nidx] = Cell::empty();
                    }
                    return true;
                }
            }
        }
        // Taking up a lesson relays it, even for a cell that already remembers that material:
        // otherwise a spring partly attuned to it already (sand from an earlier offering, say)
        // stopped the lesson at its first matching cell. Only a FRESH lesson is taken up — one
        // learned or taken up last tick, or held under ice right now (a chilled holder restarts
        // its age every tick). Ageing latches beside each other would otherwise re-teach one
        // another forever, and the latch would never clear once the ice was gone. A lesson that
        // starts the natural way spreads both ways and its fronts cancel where they meet:
        // measured on a closed 676-cell ring, every latch cleared within ~700 ticks of the ice
        // going. Only a lesson staged by hand (in a loaded scene) to run ONE way round a ring
        // longer than LESSON_HOLD keeps circling, and that spring still pours its lesson; it
        // just cannot be taught again. Review found it; it is recorded rather than guarded.
        for &nidx in neighbors {
            let other = old[nidx];
            if other.kind == Material::Wellspring as u8
                && other.flags & FLAG_TAUGHT != 0
                && other.age <= 1
            {
                next[idx].energy = other.energy;
                next[idx].flags |= FLAG_TAUGHT;
                next[idx].age = 0;
                return true;
            }
        }
        false
    }

    fn neighbor_has_kind(&self, cells: &[Cell], idx: usize, kind: u8) -> bool {
        let (x, y) = self.xy(idx);
        self.neighbor_indices(x, y)
            .iter()
            .any(|&nidx| cells[nidx].kind == kind)
    }

    fn update_sand(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        let wet = cell.flags & FLAG_WET != 0 || cell.energy > 35;
        if wet {
            self.update_powder(idx, cell, old, next, 2);
        } else {
            let (x, y) = self.xy(idx);
            // A dry grain drops two cells a tick through air, but settles through a liquid
            // like anything else — so the second cell is only taken after a real fall.
            let sinking = y + 1 < self.height as i32
                && is_free_liquid(next[self.idx(x as u32, (y + 1) as u32)].kind);
            if self.try_fall(idx, x, y + 1, cell, old, next) {
                if !sinking {
                    let dropped = self.idx(x as u32, (y + 1) as u32);
                    self.try_fall(dropped, x, y + 2, cell, old, next);
                }
            } else {
                for (dx, dy) in self.fall_dirs() {
                    if dx != 0 && self.try_fall(idx, x + dx, y + dy, cell, old, next) {
                        break;
                    }
                }
            }
        }
        if wet && next[idx].kind == Material::Sand as u8 && next[idx].energy > 0 {
            next[idx].flags |= FLAG_WET;
        } else if next[idx].kind == Material::Sand as u8 && next[idx].energy == 0 {
            next[idx].flags &= !FLAG_WET;
        }
    }

    fn update_powder(
        &mut self,
        idx: usize,
        cell: Cell,
        old: &[Cell],
        next: &mut [Cell],
        sluggishness: u32,
    ) {
        if sluggishness > 1 && self.tick_count % sluggishness != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        let dirs = self.fall_dirs();
        for (dx, dy) in dirs {
            if self.try_fall(idx, x + dx, y + dy, cell, old, next) {
                return;
            }
        }
    }

    /// Unsupported stone drops straight down one cell per tick — no diagonal slip, so
    /// pillars, floors, and shelves hold and only true overhangs fall. Liquid is not
    /// support: stone settles through it like any other grain. Motion halts the instant
    /// anything solid (stone, wall, growth) sits directly below. Wall never moves.
    fn update_stone(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        let (x, y) = self.xy(idx);
        self.try_fall(idx, x, y + 1, cell, old, next);
    }

    fn update_soil(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        self.update_powder(idx, cell, old, next, 2);
        if next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        // Soil that a rooted seed is standing on is spoken for. Without this a watered
        // bed greens over long before anything can germinate — the seed needs Soil
        // directly beneath it, and moss was reliably winning that race, which is why
        // a watered garden used to end as a moss carpet and never as a flower.
        let (x, y) = self.xy(idx);
        let claimed = self.soil_is_claimed(x, y, old);
        // Moss is a carpet on GROUND, so only soil that has come to rest greens. Once soil
        // could sink, soaked grains greened on the way down and hung in the water as moss.
        let at_rest = y + 1 >= self.height as i32 || {
            let below = old[self.idx(x as u32, (y + 1) as u32)].kind;
            below != Material::Empty as u8 && !is_free_liquid(below)
        };
        if !claimed
            && at_rest
            && next[idx].kind == Material::Soil as u8
            && next[idx].energy > 140
            && cell.age > 10
            && self.chance(if next[idx].flags & FLAG_COSMIC != 0 { 7 } else { 12 })
        {
            next[idx] = Cell::new(Material::Moss as u8, cell.variant, 90);
            next[idx].flags = FLAG_WET;
        }
    }

    /// Ground a living seed is standing on, which moss may not take — neither by the
    /// soil greening on its own nor by moss spreading in from a neighbour. The claim is
    /// held only while the seed is still viable: a seed that dries out releases the
    /// ground, so the soil → moss → fungus → soil loop still closes on an abandoned bed.
    fn soil_is_claimed(&self, x: i32, y: i32, old: &[Cell]) -> bool {
        if y <= 0 {
            return false;
        }
        let above = old[self.idx(x as u32, (y - 1) as u32)];
        above.kind == Material::Seed as u8
            && above.flags & FLAG_ROOTED != 0
            && (above.flags & FLAG_WET != 0 || above.energy > 40)
    }

    fn update_liquid(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        let (x, y) = self.xy(idx);
        let side = if self.tick_count % 2 == 0 { 1 } else { -1 };
        let dirs = [
            (0, 1),
            (side, 1),
            (-side, 1),
            (side, 0),
            (-side, 0),
            (side * 2, 0),
            (-side * 2, 0),
        ];
        for (dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                // Moving water throws spray (MIST_ODDS). The roll comes after the move, so
                // water that cannot move — a settled pond — never draws on the RNG at all.
                if is_water_like(cell.kind) && self.chance(MIST_ODDS) {
                    let landed = self.idx((x + dx) as u32, (y + dy) as u32);
                    // An odd variant: expiring steam condenses back into a droplet when
                    // `variant & 3 == 0`, and mist that kept the water's variant rained back
                    // forever — review watched one droplet make 62 round trips, so a puddle
                    // never quite dried. Mist disperses; steam from heat still condenses.
                    next[landed] = Cell::new(Material::Steam as u8, cell.variant | 1, MIST_ENERGY);
                }
                return;
            }
        }
    }

    /// Lava is thick. It falls like any liquid, but on the level only lava with more lava on top
    /// of it is pushed aside, one cell, by the weight above; lava at the surface creeps one roll
    /// in `LAVA_CREEPS`. So a pour heaps into a dome that slumps as it crusts, and runs down a
    /// slope as a tongue. It used to move as water does, hopping two cells, and a pour levelled
    /// into a sheet one grain deep that ran the width of the floor.
    ///
    /// Two ticks in four, one of each pass direction, as oil. On even ticks only it always saw
    /// the left-to-right pass, so its side never flipped and a pour mid-floor set 15-25 cells
    /// left of where it was poured.
    fn update_lava(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if self.tick_count % 4 >= 2 {
            return;
        }
        let (x, y) = self.xy(idx);
        let side = if self.tick_count % 2 == 0 { 1 } else { -1 };
        for (dx, dy) in [(0, 1), (side, 1), (-side, 1)] {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                return;
            }
        }
        let pressed = y > 0 && old[self.idx(x as u32, (y - 1) as u32)].kind == Material::Lava as u8;
        // The roll is made only for surface lava that could not fall.
        if !pressed && !self.chance(LAVA_CREEPS) {
            return;
        }
        for dx in [side, -side] {
            if self.try_move(idx, x + dx, y, cell, old, next, true) {
                return;
            }
        }
    }

    fn update_oil(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        // Two ticks in four, one of each pass direction. Oil used to move on even ticks only,
        // which are always the left-to-right pass, so its side never flipped and every slick
        // slid right: a dab poured mid-floor ended against the board's right edge. Moving
        // against the pass also lets a whole run shift in one tick, so one direction alone
        // drifts either way; one tick of each is what makes a pour spread evenly.
        if self.tick_count % 4 >= 2 {
            return;
        }
        // Spring oil fades (`OIL_SPRING_FADES`). The roll is only made for a spring's oil, so
        // oil a player pours never draws on the RNG here.
        if next[idx].kind == Material::Oil as u8
            && next[idx].flags & FLAG_SPRING_OIL != 0
            && self.chance(OIL_SPRING_FADES)
        {
            next[idx] = Cell::empty();
            return;
        }
        let (x, y) = self.xy(idx);
        if y > 0 {
            let above = self.idx(x as u32, (y - 1) as u32);
            if is_water_like(old[above].kind)
                && next[above].kind == old[above].kind
                && next[idx].kind == Material::Oil as u8
            {
                let water = next[above];
                next[above] = next[idx];
                next[idx] = water;
                return;
            }
        }

        let below = if y + 1 < self.height as i32 {
            old[self.idx(x as u32, (y + 1) as u32)].kind
        } else {
            Material::Wall as u8
        };
        let supported = below != Material::Empty as u8 && below != Material::Smoke as u8 && below != Material::Steam as u8;
        // Oil keeps flowing the way it is going until it is blocked, then turns round. With the
        // side alternating instead, a poured heap shuffled left and right in place and never
        // spread. The way is `FLAG_DRIFT_EAST` (a gliding seed's) flipped by the variant's low
        // bit, so a painted dab, whose flags are all clear, starts out both ways.
        let east = (cell.flags & FLAG_DRIFT_EAST != 0) != (cell.variant & 1 != 0);
        let side = if east { 1 } else { -1 };
        let falling = [(0, 1), (side, 1), (-side, 1), (side, 0), (-side, 0), (side * 2, 0), (-side * 2, 0)];
        let sheeting = [(side, 0), (side * 2, 0), (0, 1), (side, 1), (-side, 1)];
        // Oil on oil sheets sideways; oil resting on anything else does not skate, though it
        // still runs down a slope. So a pour spreads into a sheet one cell deep and comes to
        // rest, where a film that kept shifting into every gap never settled.
        let on_oil = below == Material::Oil as u8;
        let dirs: &[(i32, i32)] = if !supported {
            &falling
        } else if on_oil {
            &sheeting
        } else {
            &sheeting[2..]
        };
        for &(dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                return;
            }
        }
        if on_oil && next[idx].kind == Material::Oil as u8 {
            next[idx].flags ^= FLAG_DRIFT_EAST;
        }
    }

    fn update_gas(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell], speed: u32) {
        if speed > 1 && self.tick_count % speed != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        let side = if self.tick_count % 2 == 0 { 1 } else { -1 };
        let dirs = [(0, -1), (side, -1), (-side, -1), (side, 0), (-side, 0)];
        let mut at = idx;
        for (dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, false) {
                at = self.idx((x + dx) as u32, (y + dy) as u32);
                break;
            }
        }
        if cell.kind == Material::Steam as u8 {
            self.billow(idx, at, cell, old, next);
        }
    }

    /// Hot steam billows: the first time a wisp has open air around it, it puffs into the open
    /// cells of `PUFF_SHAPE` around where it rose, and the puffs fade in about 3 s. Steam used
    /// to leave every source one cell at a time and rise at once, so a kettle, a hot pond or a
    /// doused fire drew a dotted thread: 82% of a held kettle's steam had no steam beside it.
    /// The renderer already draws a body of steam as a soft cloud, and no shading can make
    /// one out of cells that are not there (`VISUAL_PIPELINE.md`, Smoke/Steam).
    ///
    /// It is a wisp's FIRST open air, not its first tick, because quench steam is born inside
    /// the water it boiled and reaches the air only after bubbling up. Mist never billows, and
    /// a puff never does, so one wisp puffs once. Puffs only fill empty cells that touch the
    /// wisp or a puff placed before them, so none appears through a wall: checking emptiness
    /// alone let a wisp sealed inside a one-cell wall puff out beyond it (review). They never
    /// turn back into water or ice and wet nothing (the steam and ice arms), and vanish when
    /// spent (`age_and_decay`), so they cost no water and carry no heat anywhere. No RNG.
    fn billow(&self, idx: usize, at: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if cell.energy <= MIST_ENERGY || cell.flags & (FLAG_PUFF | FLAG_BILLOWED) != 0 {
            return;
        }
        // Only the wisp itself puffs. Water sinking through it this tick trades places with it
        // (a bubble), and then it puffs from where it is next tick; puffing from the cell it
        // left, unmarked, sprayed lines of puffs along a hot pond's surface every tick.
        if next[at].kind != Material::Steam as u8 || next[at].flags & FLAG_PUFF != 0 {
            return;
        }
        let (px, py) = self.xy(at);
        let mut placed = [at; PUFF_SHAPE.len() + 1];
        let mut count = 1;
        for (ox, oy) in PUFF_SHAPE {
            let (tx, ty) = (px + ox, py + oy);
            if !self.in_bounds(tx, ty) {
                continue;
            }
            let target = self.idx(tx as u32, ty as u32);
            let joined = [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|&(dx, dy)| {
                self.in_bounds(tx + dx, ty + dy) && placed[..count].contains(&self.idx((tx + dx) as u32, (ty + dy) as u32))
            });
            if joined && next[target].is_empty() && (old[target].is_empty() || target == idx) {
                let mut puff = Cell::new(Material::Steam as u8, cell.variant | 1, PUFF_ENERGY);
                puff.age = next[at].age;
                puff.flags = FLAG_PUFF;
                next[target] = puff;
                placed[count] = target;
                count += 1;
            }
        }
        if count > 1 {
            next[at].flags |= FLAG_BILLOWED;
        }
    }

    fn update_fire(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Fire as u8 {
            return;
        }
        let (x, y) = self.xy(idx);
        if self.chance(7) && y > 0 {
            let target = self.idx(x as u32, (y - 1) as u32);
            if old[target].is_empty() && next[target].is_empty() {
                next[target] = Cell::new(Material::Smoke as u8, cell.variant, 80);
            }
        }
        if self.chance(18) {
            next[idx] = Cell::new(Material::Smoke as u8, cell.variant, 70);
        }
    }

    fn update_seed(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        // A frozen seed stops gliding and falls like any other until it thaws.
        if cell.flags & FLAG_WINDBORNE != 0 && next[idx].flags & FLAG_FROZEN == 0 {
            self.glide_seed(idx, cell, old, next);
            return;
        }
        let (x, y) = self.xy(idx);
        if y + 1 < self.height as i32 {
            let below = old[self.idx(x as u32, (y + 1) as u32)];
            // A seed over open air or a liquid is still falling, and does nothing else until
            // it lands — which is how a seed dropped into a pond reaches the bed to root.
            if below.is_empty() || is_free_liquid(below.kind) {
                self.update_powder(idx, cell, old, next, 1);
                return;
            }
            if next[idx].flags & FLAG_FROZEN != 0 {
                return;
            }
            let neighbors = self.neighbor_indices(x, y);
            let wet = cell.flags & FLAG_WET != 0 || cell.energy > 70;
            let cosmic = cell.flags & FLAG_COSMIC != 0
                || neighbors.iter().any(|&nidx| {
                    old[nidx].kind == Material::Moonwater as u8
                        || old[nidx].kind == Material::Stardust as u8
                });
            if wet
                && cell.energy > 80
                && neighbors
                    .iter()
                    .any(|&nidx| old[nidx].kind == Material::Fungus as u8)
                && self.chance(10)
            {
                next[idx] = Cell::new(Material::Fungus as u8, cell.variant, 90);
                next[idx].flags = FLAG_WET;
                return;
            }
            // Water soaks down through a seed bed. Without this a painted bed never
            // germinates at all: the seeds touching soil are buried at the bottom and
            // never meet the water, while the seeds the water does reach are sitting on
            // other seeds. Measured on a hand-painted planter, that combination produced
            // zero rooted seeds in 3600 ticks.
            if y > 0 {
                let above = old[self.idx(x as u32, (y - 1) as u32)];
                if above.kind == Material::Seed as u8 && above.energy > SEED_SOAK_LOSS {
                    let soaked = above.energy - SEED_SOAK_LOSS;
                    if soaked > next[idx].energy {
                        next[idx].energy = soaked;
                    }
                }
            }
            // A wet seed is grounded by soil directly under it, by the moss carpet that soil
            // greens into, or by another grounded seed, so a bed is rooted as a whole and
            // sprouts from its surface. Moss counts because a garden's soil is moss by the
            // time it blooms, and the seeds its flowers set land there.
            let grounded = below.kind == Material::Soil as u8
                || below.kind == Material::Moss as u8
                || (below.kind == Material::Seed as u8 && below.flags & FLAG_ROOTED != 0);
            if grounded && wet {
                next[idx].flags |= FLAG_ROOTED;
                // Germination: a fed, rooted seed becomes the base of a growing stalk.
                // Its energy is the stalk's height budget, varied per seed by variant.
                // Only a seed with open sky above sprouts — a buried one would germinate
                // into a stalk that can never climb, wasting the bed's whole surface.
                let open_above = y > 0 && is_growable(old[self.idx(x as u32, (y - 1) as u32)].kind);
                if open_above
                    && cell.age > 30
                    && cell.energy > 70
                    && !self.plant_nearby(x, y, old, next)
                    && self.chance(if cosmic { 4 } else { 8 })
                {
                    next[idx] = Cell::new(
                        Material::Stem as u8,
                        cell.variant,
                        // Each segment costs 55, so this is a 4-to-7 cell stalk. The old
                        // 130 base could bloom after a single segment, which left a head
                        // sitting almost on the ground with no room for leaves.
                        200 + u16::from(cell.variant & 3) * 55 + if cosmic { 55 } else { 0 },
                    );
                    next[idx].flags = FLAG_ROOTED | if cosmic { FLAG_COSMIC } else { 0 };
                    return;
                }
            }
            if below.kind == Material::Moss as u8 && wet && cell.energy > 110 && self.chance(12) {
                next[idx] = Cell::new(Material::Moss as u8, cell.variant, 100);
                next[idx].flags = FLAG_WET;
            }
        }
    }

    /// A seed a flower set glides down and away from it, every other tick, and lands on the
    /// first ground it meets. On the plant it was set on, it drops off the edge of the head or
    /// rolls along it, turning where it is boxed in. In the air it sails two across for one
    /// down, turning away from a plant it is heading into. Landed, it is an ordinary seed: it
    /// falls through water, and roots where it lies if it is watered.
    ///
    /// Only the flight bits are written, onto the cell as it stands in `next`: a stale copy of
    /// the flags would undo whatever a reaction did to the seed earlier this tick.
    fn glide_seed(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if self.tick_count % 2 != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        let mut dir = if cell.flags & FLAG_DRIFT_EAST != 0 { 1 } else { -1 };
        let on_plant = self.in_bounds(x, y + 1) && is_plant(old[self.idx(x as u32, (y + 1) as u32)].kind);
        if on_plant {
            if self.glide_into(idx, x + dir, y + 1, cell, old, next)
                || self.glide_into(idx, x + dir, y, cell, old, next)
            {
                return;
            }
            next[idx].flags ^= FLAG_DRIFT_EAST;
            return;
        }
        // Every other step sails level, so a seed travels twice as far as it drops. At one
        // across for one down it landed inside its parent's shadow (`PLANT_SPACING` counts
        // the petals, three cells out from the stalk) and sowed a plant on 3 of 16 gardens;
        // at two across, on 14 of 16.
        let dy = if (self.tick_count >> 1) % 2 == 0 { 0 } else { 1 };
        if self.in_bounds(x + dir, y + dy) && is_plant(old[self.idx((x + dir) as u32, (y + dy) as u32)].kind) {
            dir = -dir;
            next[idx].flags ^= FLAG_DRIFT_EAST;
        }
        if self.glide_into(idx, x + dir, y + dy, cell, old, next)
            || self.glide_into(idx, x, y + 1, cell, old, next)
        {
            return;
        }
        next[idx].flags &= !(FLAG_WINDBORNE | FLAG_DRIFT_EAST);
    }

    /// A gliding seed moves only into open air: a cell that is empty or gas at both ends of
    /// the tick. `try_move` counts a cell free if it was empty in `old`, and water that flowed
    /// in first would be deleted under it, the way `try_fall` already guards against for a
    /// falling grain (`a_gliding_seed_never_deletes_water_that_just_flowed_under_it`). Gas
    /// stays passable, as it is for a drifting mote: refusing it grounded seeds in the mist a
    /// watering throws, and sowing fell from 14 of 16 gardens to 9.
    fn glide_into(&self, idx: usize, nx: i32, ny: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) -> bool {
        if !self.in_bounds(nx, ny) {
            return false;
        }
        let target = self.idx(nx as u32, ny as u32);
        let open = |c: Cell| c.is_empty() || is_gas(c.kind);
        open(old[target]) && open(next[target]) && self.try_move(idx, nx, ny, cell, old, next, true)
    }

    fn update_stem(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Stem as u8 || next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        if !self.stem_has_footing(x, y, old) {
            // A stalk segment with nothing holding it up falls, so cut plants collapse.
            self.update_powder(idx, cell, old, next, 1);
            return;
        }
        // Only the growing tip carries budget above the mature level.
        if cell.energy <= 20 || y == 0 {
            return;
        }
        let above = self.idx(x as u32, (y - 1) as u32);
        if !is_growable(old[above].kind) || !is_growable(next[above].kind) || !self.chance(4) {
            return;
        }
        let cosmic = cell.flags & FLAG_COSMIC != 0;
        if cell.energy > 75 {
            next[above] = Cell::new(Material::Stem as u8, cell.variant, cell.energy - 55);
            next[above].flags = if cosmic { FLAG_COSMIC } else { 0 };
            self.unfurl_leaf(x, y, cell, old, next);
        } else {
            next[above] = Cell::new(
                Material::Flower as u8,
                cell.variant,
                if cosmic { BLOOM_ENERGY_COSMIC } else { BLOOM_ENERGY },
            );
            next[above].flags = FLAG_ROOTED | if cosmic { FLAG_COSMIC } else { 0 };
        }
        next[idx].energy = 20;
    }

    /// A stalk stands on its own base, or clings to a neighbouring stalk cell that
    /// has its own footing. Leaves ride entirely on the second rule; cutting the
    /// stalk takes both away at once, so a severed plant still collapses whole.
    fn stem_has_footing(&self, x: i32, y: i32, old: &[Cell]) -> bool {
        if y + 1 >= self.height as i32 {
            return true;
        }
        if !old[self.idx(x as u32, (y + 1) as u32)].is_empty() {
            return true;
        }
        for dx in [-1i32, 1] {
            let nx = x + dx;
            if !self.in_bounds(nx, y) {
                continue;
            }
            let side = old[self.idx(nx as u32, y as u32)];
            if side.kind != Material::Stem as u8 && side.kind != Material::Flower as u8 {
                continue;
            }
            if !old[self.idx(nx as u32, (y + 1) as u32)].is_empty() {
                return true;
            }
        }
        false
    }

    /// A flower cell stands on whatever is under it, as a stalk segment does. A petal also
    /// hangs from its crown, found at the offset its bloom shape opened it at, so a whole head
    /// is held by the one cell sitting on the stalk's tip. The crown gets no sideways hold: a
    /// cosmos has petals beside and under its crown, and the head would hold itself up.
    fn flower_has_footing(&self, x: i32, y: i32, cell: Cell, old: &[Cell]) -> bool {
        if y + 1 >= self.height as i32 || !old[self.idx(x as u32, (y + 1) as u32)].is_empty() {
            return true;
        }
        if cell.flags & FLAG_ROOTED != 0 {
            return false;
        }
        BLOOM_SHAPES[usize::from(cell.variant) & 7].iter().any(|&(dx, dy)| {
            let (cx, cy) = (x - dx, y - dy);
            if !self.in_bounds(cx, cy) {
                return false;
            }
            let crown = old[self.idx(cx as u32, cy as u32)];
            crown.kind == Material::Flower as u8
                && crown.flags & FLAG_ROOTED != 0
                && crown.variant == cell.variant
        })
    }

    /// Leaves unfurl in alternating pairs as the stalk climbs, so a grown plant
    /// reads as a plant instead of a bare pole. Placement is a pure function of
    /// height — no RNG — so it cannot desynchronise the two engines. Leaf energy
    /// stays under the growth threshold, so a leaf never climbs a stalk of its own.
    fn unfurl_leaf(&self, x: i32, y: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        // Every other segment, alternating sides. Spacing them any further apart left
        // the shortest stalks — the common case — with no leaves at all.
        if y % 2 != 0 {
            return;
        }
        let lx = if (y / 2) % 2 == 0 { x - 1 } else { x + 1 };
        if !self.in_bounds(lx, y) {
            return;
        }
        let leaf = self.idx(lx as u32, y as u32);
        if !is_growable(old[leaf].kind) || !is_growable(next[leaf].kind) {
            return;
        }
        next[leaf] = Cell::new(Material::Stem as u8, cell.variant, 12);
        next[leaf].flags = cell.flags & FLAG_COSMIC;
    }

    /// First empty cell around `idx`, scanning the canonical faces from `start`.
    /// Rotating the start spreads pollen off a bloom's whole rim rather than
    /// always puffing from the same corner.
    fn open_face(&self, idx: usize, start: usize, old: &[Cell], next: &[Cell]) -> Option<usize> {
        let (x, y) = self.xy(idx);
        for step in 0..FACE_OFFSETS.len() {
            let (dx, dy) = FACE_OFFSETS[(start + step) % FACE_OFFSETS.len()];
            let nx = x + dx;
            let ny = y + dy;
            if !self.in_bounds(nx, ny) {
                continue;
            }
            let nidx = self.idx(nx as u32, ny as u32);
            if old[nidx].is_empty() && next[nidx].is_empty() {
                return Some(nidx);
            }
        }
        None
    }

    /// Next unfilled cell of this plant's bloom silhouette, in the shape's own order.
    fn next_petal_site(
        &self,
        idx: usize,
        variant: u8,
        old: &[Cell],
        next: &[Cell],
    ) -> Option<usize> {
        let (x, y) = self.xy(idx);
        for &(dx, dy) in BLOOM_SHAPES[usize::from(variant) & 7] {
            let nx = x + dx;
            let ny = y + dy;
            if !self.in_bounds(nx, ny) {
                continue;
            }
            let site = self.idx(nx as u32, ny as u32);
            // A petal may open through the head's own drifting pollen. A mote that lands
            // on top of a bloom is wedged — the bloom is under it, so it cannot fall — and
            // it would otherwise hold the last petal site until it aged out, leaving big
            // heads permanently one petal short at the crest.
            if petal_site_free(old[site]) && petal_site_free(next[site]) {
                return Some(site);
            }
        }
        None
    }

    /// Whether another plant already stands within `PLANT_SPACING`. Checks `next` as well
    /// as `old` so seeds germinating in the same tick still space themselves out.
    fn plant_nearby(&self, x: i32, y: i32, old: &[Cell], next: &[Cell]) -> bool {
        for dy in -PLANT_SPACING..=PLANT_SPACING {
            for dx in -PLANT_SPACING..=PLANT_SPACING {
                if dx == 0 && dy == 0 {
                    continue;
                }
                let nx = x + dx;
                let ny = y + dy;
                if !self.in_bounds(nx, ny) {
                    continue;
                }
                let site = self.idx(nx as u32, ny as u32);
                for candidate in [old[site], next[site]] {
                    if candidate.kind == Material::Stem as u8
                        || candidate.kind == Material::Flower as u8
                    {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn update_flower(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Flower as u8 || next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        // Nothing used to ask whether a bloom was held up, so cutting a stalk dropped the
        // stalk and left its head hanging in the air for about two minutes. A crown that has
        // lost its stalk is no longer rooted: it falls as a loose petal, and cannot re-open on
        // the ground or sow seed from there.
        let (x, y) = self.xy(idx);
        if !self.flower_has_footing(x, y, cell, old) {
            next[idx].flags &= !FLAG_ROOTED;
            self.update_powder(idx, cell, old, next, 1);
            return;
        }
        let cosmic = cell.flags & FLAG_COSMIC != 0;

        // The crown is the one cell the stalk produced. It spends the top of its
        // budget unfurling petals into the open air around it, one per beat, so a
        // bloom is watched opening rather than appearing whole. Petals are never
        // rooted, so only the crown ever opens and a head cannot run away.
        if cell.flags & FLAG_ROOTED != 0
            && cell.energy > CROWN_RESERVE
            && cell.age > 12
            && self.chance(if cosmic { 8 } else { 12 })
        {
            if let Some(petal) = self.next_petal_site(idx, cell.variant, old, next) {
                next[petal] = Cell::new(Material::Flower as u8, cell.variant, PETAL_ENERGY);
                next[petal].flags = if cosmic { FLAG_COSMIC } else { 0 };
                next[idx].energy = next[idx].energy.saturating_sub(PETAL_COST);
            }
        }

        // Pollen leaves from any open face. Straight up alone would silence a
        // finished bloom outright, because the crown is walled in by its own petals.
        if cell.energy > POLLEN_RESERVE && cell.age > 24 && self.chance(if cosmic { 90 } else { 200 })
        {
            let start =
                (cell.variant as usize).wrapping_add(cell.age as usize) % FACE_OFFSETS.len();
            if let Some(face) = self.open_face(idx, start, old, next) {
                next[face] = Cell::new(Material::Pollen as u8, cell.variant, 150);
                if cosmic {
                    next[face].flags |= FLAG_COSMIC;
                }
                next[idx].energy = next[idx].energy.saturating_sub(POLLEN_COST);
            }
        }

        // Wilt: a spent petal finally lets go and drifts off as a mote, so an old
        // bloom visibly thins instead of standing perfect forever, and what it sheds
        // can still seed the soil under it. The crown stays behind as a seed head —
        // which is why a finished garden is not a field of bare poles. The mote is
        // marked a petal, so it is drawn in its flower's colour rather than as pollen.
        if cell.flags & FLAG_ROOTED == 0
            && cell.age > PETAL_SHED_AGE
            && cell.energy < POLLEN_RESERVE
            && self.chance(400)
        {
            next[idx] = Cell::new(Material::Pollen as u8, cell.variant, 150);
            next[idx].flags = (cell.flags & FLAG_COSMIC) | FLAG_PETAL;
        }
    }

    fn update_moss(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        // Dew drip: saturated moss hanging over open air sheds a droplet, spending stored water.
        if cell.flags & FLAG_WET != 0 && cell.energy > 90 && y + 1 < self.height as i32 {
            let below = self.idx(x as u32, (y + 1) as u32);
            if old[below].is_empty() && next[below].is_empty() && self.chance(60) {
                next[below] = Cell::new(Material::Water as u8, cell.variant, 26);
                next[idx].energy = next[idx].energy.saturating_sub(24);
            }
        }
        let wet = cell.flags & FLAG_WET != 0 || cell.energy > 70;
        if !(wet || self.chance(120)) {
            return;
        }
        // Well-watered moss colonizes in a visible burst instead of one patch at a time.
        let mut spreads_left = if cell.energy > 150 { 2 } else { 1 };
        for nidx in self.neighbor_indices(x, y) {
            let other = old[nidx];
            let damp_substrate = other.flags & FLAG_WET != 0 || other.energy > 40;
            // Ground under a living seed is off limits to moss spreading in as well as
            // to soil greening on its own. Guarding only the latter left the claim
            // porous: a bed still carpeted over, just from the side instead.
            let (nx, ny) = self.xy(nidx);
            let soft_substrate = (other.kind == Material::Soil as u8
                && !self.soil_is_claimed(nx, ny, old))
                || other.kind == Material::Wood as u8;
            let stone_substrate = other.kind == Material::Stone as u8;
            let wall_substrate = other.kind == Material::Wall as u8;
            let mut spread = false;
            if soft_substrate && (cell.energy > 110 || damp_substrate || self.chance(8)) {
                next[nidx] = Cell::new(Material::Moss as u8, other.variant, 70);
                next[nidx].flags = if wet { FLAG_WET } else { 0 };
                spread = true;
            } else if stone_substrate && damp_substrate && (cell.energy > 120 || self.chance(10)) {
                next[nidx] = Cell::new(Material::Moss as u8, other.variant, 58);
                next[nidx].flags = FLAG_WET;
                spread = true;
            } else if wall_substrate
                && damp_substrate
                && cell.energy > 150
                && cell.flags & FLAG_COSMIC != 0
            {
                // A wall is construction, and only moonwater's supercharged growth takes one.
                // "Strongly fed" used to be enough, and it was rare while moving water deleted
                // itself; once water was conserved (ROADMAP Phase 20) any moss beside a pond
                // is fed past 150 every tick, and plain moss ate every wall a pond touched —
                // wall to moss to fungus to soil, dissolving the one material the game
                // promises is permanent. Ordinary growth stays grounded; the cosmic liquid
                // keeps the special case.
                next[nidx] = Cell::new(Material::Moss as u8, other.variant, 48);
                next[nidx].flags = FLAG_WET;
                spread = true;
            }
            if spread {
                spreads_left -= 1;
                if spreads_left == 0 {
                    return;
                }
            }
        }
        if cell.energy > 150 && self.chance(SPORE_ODDS) {
            for (dx, dy) in SPORE_JUMPS {
                let (tx, ty) = (x + dx, y + dy);
                if !self.in_bounds(tx, ty) {
                    continue;
                }
                if !is_spore_gap(old[self.idx((x + dx / 2) as u32, (y + dy / 2) as u32)].kind) {
                    continue;
                }
                let target = self.idx(tx as u32, ty as u32);
                let other = old[target];
                let soft = (other.kind == Material::Soil as u8 && !self.soil_is_claimed(tx, ty, old))
                    || other.kind == Material::Wood as u8;
                if !soft || next[target].kind != other.kind {
                    continue;
                }
                next[target] = Cell::new(Material::Moss as u8, other.variant, 70);
                next[target].flags = if wet { FLAG_WET } else { 0 };
                return;
            }
        }
    }

    fn update_fungus(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        if !self.chance(48) {
            return;
        }
        let mut has_food = false;
        for nidx in self.neighbor_indices(x, y) {
            let other = old[nidx];
            let edible = matches!(
                other.kind,
                k if k == Material::Seed as u8
                    || k == Material::Moss as u8
                    || k == Material::Wood as u8
                    || k == Material::Soil as u8
            );
            if edible && other.flags & FLAG_FROZEN == 0 {
                has_food = true;
            }
            if other.kind == Material::Seed as u8
                && other.flags & FLAG_FROZEN == 0
                && (other.flags & FLAG_WET != 0 || other.energy > 70)
                && self.chance(4)
            {
                next[nidx] = Cell::new(Material::Fungus as u8, other.variant, 90);
                next[nidx].flags = FLAG_WET;
                return;
            }
            if other.kind == Material::Moss as u8
                && other.flags & FLAG_FROZEN == 0
                && (other.flags & FLAG_WET != 0 || other.energy > 90 || other.age > 120)
                && self.chance(7)
            {
                next[nidx] = Cell::new(Material::Fungus as u8, other.variant, 80);
                next[nidx].flags = other.flags & FLAG_WET;
                return;
            }
            if (other.kind == Material::Wood as u8
                || other.kind == Material::Moss as u8
                || other.kind == Material::Soil as u8)
                && other.flags & FLAG_FROZEN == 0
                && self.chance(5)
            {
                // Fairy ring: a cosmic-charged fungus occasionally sows a stardust grain
                // where it would digest, spending its charge on the gift instead of spreading.
                if cell.flags & FLAG_COSMIC != 0 && self.chance(10) {
                    next[nidx] = Cell::new(Material::Stardust as u8, other.variant, 180);
                    next[idx].flags &= !FLAG_COSMIC;
                } else {
                    next[nidx] = Cell::new(Material::Fungus as u8, other.variant, 80);
                }
                return;
            }
        }
        // Starvation collapse: an old fungus with nothing left to digest crumbles back
        // into fresh soil, closing the soil -> moss -> fungus -> soil loop.
        if cell.age > 600 && !has_food && self.chance(20) {
            next[idx] = Cell::new(Material::Soil as u8, cell.variant, 0);
        }
    }

    fn update_stardust(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if self.tick_count % 2 == 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        let side = if self.chance(2) { 1 } else { -1 };
        let dirs = [(0, 1), (side, 1), (-side, 0), (side, -1)];
        for (dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                return;
            }
        }
    }

    fn update_pollen(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Pollen as u8 {
            return;
        }
        let (x, y) = self.xy(idx);
        if cell.age > POLLINATE_AGE {
            for dx in [-1, 1] {
                if !self.in_bounds(x + dx, y) || !self.in_bounds(x - dx, y + 1) {
                    continue;
                }
                let flower = old[self.idx((x + dx) as u32, y as u32)];
                if flower.kind != Material::Flower as u8 || flower.variant & 7 != cell.variant & 7 {
                    continue;
                }
                if !old[self.idx((x - dx) as u32, (y + 1) as u32)].is_empty() {
                    continue;
                }
                if self.chance(POLLINATE_ODDS) {
                    next[idx] = Cell::new(Material::Seed as u8, flower.variant, SET_SEED_ENERGY);
                    // A moonlit flower, or its pollen, sets a cosmic seed, so its garden breeds true.
                    next[idx].flags = ((cell.flags | flower.flags) & FLAG_COSMIC)
                        | FLAG_WINDBORNE
                        | if dx < 0 { FLAG_DRIFT_EAST } else { 0 };
                    return;
                }
                break;
            }
        }
        if self.tick_count % 3 != 0 {
            return;
        }
        // Settled motes mostly rest where they landed instead of jittering sideways.
        let supported =
            y + 1 >= self.height as i32 || !old[self.idx(x as u32, (y + 1) as u32)].is_empty();
        if supported && !self.chance(3) {
            return;
        }
        let side = if self.chance(2) { 1 } else { -1 };
        let dirs = [(0, 1), (side, 0), (side, 1), (-side, 0)];
        for (dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                return;
            }
        }
    }

    fn update_meteor(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Meteor as u8 {
            return;
        }
        let (x, y) = self.xy(idx);
        if self.try_move(idx, x, y + 1, cell, old, next, true) {
            self.leave_meteor_trail(idx, next);
            return;
        }
        if self.try_move(idx, x + if self.tick_count % 2 == 0 { 1 } else { -1 }, y + 1, cell, old, next, true) {
            self.leave_meteor_trail(idx, next);
            return;
        }

        next[idx] = if self.chance(2) {
            Cell::new(Material::Stardust as u8, cell.variant, 180)
        } else {
            Cell::new(Material::Stone as u8, cell.variant, 0)
        };
        for nidx in self.neighbor_indices(x, y) {
            if old[nidx].kind == Material::Moonwater as u8 {
                next[nidx] = Cell::new(Material::Stardust as u8, old[nidx].variant, 190);
            } else if old[nidx].is_empty() && self.chance(3) {
                next[nidx] = Cell::new(Material::Fire as u8, cell.variant, 190);
            } else if heat_softens_cell(next, nidx, old[nidx], 72) {
                continue;
            } else if old[nidx].kind == Material::Sand as u8 && self.chance(2) {
                next[nidx] = Cell::new(Material::Glass as u8, old[nidx].variant, 0);
            } else if old[nidx].kind == Material::Glass as u8 {
                // The crack runs one pane-width further than the strike. Converting only the
                // cells the meteor physically touched turned a smashed pane into a two-cell
                // chip — measured at 2 cells and a colour delta of 17 through the real
                // renderer, which is nothing a player would ever notice happening.
                next[nidx] = Cell::new(Material::Sand as u8, old[nidx].variant, 0);
                let (nx, ny) = self.xy(nidx);
                for cracked in self.neighbor_indices(nx, ny) {
                    if old[cracked].kind == Material::Glass as u8 {
                        next[cracked] = Cell::new(Material::Sand as u8, old[cracked].variant, 0);
                    }
                }
            } else if old[nidx].kind == Material::Rocket as u8 {
                // A meteor lights the powder it lands on as a star rocket (FLAG_COSMIC): it
                // passes the star through its volley (`light_touching_powder`), and its shell
                // blooms wider and burns out into stardust (`update_spark`). Lit as any flame
                // lights it, the meteor's own lighting never showed: its fire ring lit the
                // powder too, and a meteor-lit charge looked exactly like a fire-lit one.
                next[nidx] = Cell::new(Material::Rocket as u8, old[nidx].variant, 220);
                next[nidx].flags = FLAG_COSMIC;
            } else if is_flammable(old[nidx].kind) {
                next[nidx] = ignited_cell(old[nidx], 230);
            }
        }
    }

    /// A meteor occasionally sheds a spark from the cell it just left, flung straight down or
    /// down and out to either side, so a shower's tail fans into a glittering cone. Trail
    /// sparks age out fast, light only rocket fuses and oil (Spark is excluded from `is_hot`),
    /// and hiss to steam over water.
    ///
    /// They used to fly straight down only, into the cell the meteor was about to strike, so
    /// they met nothing its impact did not light the same tick: no powder lit before a meteor
    /// stopped, on 32 of 32 seeds. Fanned, they reach a fuse or a slick the meteor only passes.
    fn leave_meteor_trail(&mut self, vacated: usize, next: &mut [Cell]) {
        if next[vacated].is_empty() && self.chance(3) {
            let dir = SPARK_DOWN - 1 + (self.rand() % 3) as u8;
            next[vacated] = Cell::new(Material::Spark as u8, dir, 90);
        }
    }

    fn update_rocket(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Rocket as u8 || next[idx].energy == 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        next[idx].energy = next[idx].energy.saturating_sub(10);
        if next[idx].energy <= 96 || y == 0 {
            self.burst_rocket(idx, x, y, cell, old, next);
            return;
        }
        self.light_touching_powder(x, y, old, next, cell.flags & FLAG_COSMIC != 0);
        let sway = if self.chance(3) {
            if self.tick_count % 2 == 0 { 1 } else { -1 }
        } else {
            0
        };
        let flying = next[idx];
        let mut moved = false;
        let mut nx = x;
        for (dx, dy) in [(sway, -1), (0, -1), (-sway, -1)] {
            if self.try_move(idx, x + dx, y + dy, flying, old, next, true) {
                moved = true;
                nx = x + dx;
                break;
            }
        }
        if !moved && self.try_thrust(idx, x, y - 1, flying, old, next) {
            moved = true;
        }
        if !moved {
            self.burst_rocket(idx, x, y, cell, old, next);
            return;
        }
        // A second straight-up step per tick gives the ascent a real whoosh.
        let climbed = self.idx(nx as u32, (y - 1) as u32);
        self.try_move(climbed, nx, y - 2, flying, old, next, true);
        if next[idx].is_empty() {
            if self.chance(3) {
                next[idx] = Cell::new(Material::Spark as u8, SPARK_DOWN, 110);
            } else if self.chance(2) {
                next[idx] = Cell::new(Material::Smoke as u8, cell.variant, 70);
            }
        }
    }

    /// A lit grain lights the unlit powder it touches, the way a flame does. `try_thrust`
    /// took away the ground bursts that used to relay the light through a charge, and with
    /// them the fuse: a line of powder dragged at the default brush and lit at one end burned
    /// its full length on 7 of 16 seeds before, and on none once grains flew — the ones at
    /// the lit end left and the rest of the line sat there. This relays the light directly
    /// instead, so a whole charge goes up and a line burns its length as a wave of launches:
    /// 16 of 16. Four neighbours, no roll; the same 220 fuse a flame or a spark lights.
    /// A star rocket passes its star to every grain it touches, lit or not, so the star runs
    /// through the whole volley. Lighting only the unlit ones left it racing the meteor's own
    /// fire ring for the charge, and about one spark in five was a star.
    fn light_touching_powder(&self, x: i32, y: i32, old: &[Cell], next: &mut [Cell], star: bool) {
        for (dx, dy) in [(0, -1), (0, 1), (-1, 0), (1, 0)] {
            let (nx, ny) = (x + dx, y + dy);
            if !self.in_bounds(nx, ny) {
                continue;
            }
            let n = self.idx(nx as u32, ny as u32);
            let unlit = |c: Cell| c.kind == Material::Rocket as u8 && c.energy == 0;
            if unlit(old[n]) && unlit(next[n]) {
                next[n].energy = 220;
            }
            if star && next[n].kind == Material::Rocket as u8 && next[n].energy > 0 {
                next[n].flags |= FLAG_COSMIC;
            }
        }
    }

    /// A lit grain shoves straight up through its own charge instead of taking it for a
    /// ceiling. A grain that burst whenever anything sat above it made a lit pile go off where
    /// it lay: at the default brush, 2 grains of ~24 flew and 12 burst on the ground, most of
    /// them under the very flame that lit them. It trades places, so nothing is deleted.
    ///
    /// The cell has to be part of the charge at BOTH ends of the tick. `old` is the guard every
    /// rule reads: it keeps the shove to what was already there when the tick began, so it
    /// never shoves something that has only just caught fire or wandered in. `next` is needed
    /// too, because the grain ahead leaves its trail in the cell it vacates THIS tick — once
    /// powder and flame were shoved, that trail was the commonest thing a following grain
    /// burst under. Anything else — sand, wall, a lid — is still a ceiling, and the grain
    /// bursts under it.
    fn try_thrust(&self, idx: usize, nx: i32, ny: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) -> bool {
        if !self.in_bounds(nx, ny) || next[idx].kind != cell.kind {
            return false;
        }
        let target = self.idx(nx as u32, ny as u32);
        if !is_rocket_charge(old[target].kind) || !is_rocket_charge(next[target].kind) {
            return false;
        }
        let moving = next[idx];
        next[idx] = next[target];
        next[target] = moving;
        true
    }

    fn burst_rocket(&mut self, idx: usize, x: i32, y: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        // The star as the rocket stands now: a grain handed the star this tick by the volley
        // beside it bursts as a star shell (review: reading `cell` threw a plain one).
        let star = next[idx].flags & FLAG_COSMIC;
        next[idx] = Cell::new(Material::Stardust as u8, cell.variant, 200);
        for (dir, (dx, dy)) in SPARK_DIRS.iter().enumerate() {
            for dist in 1..=2 {
                let (nx, ny) = (x + dx * dist, y + dy * dist);
                if !self.in_bounds(nx, ny) {
                    continue;
                }
                let nidx = self.idx(nx as u32, ny as u32);
                let other = old[nidx];
                if other.is_empty() && next[nidx].is_empty() {
                    next[nidx] =
                        Cell::new(Material::Spark as u8, dir as u8, if dist == 1 { 235 } else { 215 });
                    next[nidx].flags = star;
                } else if dist == 1 && is_flammable(other.kind) && self.chance(3) {
                    next[nidx] = ignited_cell(other, 200);
                }
            }
        }
    }

    fn update_spark(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].kind != Material::Spark as u8 {
            return;
        }
        next[idx].energy = next[idx].energy.saturating_sub(10);
        if next[idx].energy < COLD_CHAR_ENERGY {
            // A star shell's sparks all burn out into stardust, so it rains glitter.
            next[idx] = if cell.flags & FLAG_COSMIC != 0 || self.chance(6) {
                Cell::new(Material::Stardust as u8, cell.variant, 120)
            } else {
                Cell::empty()
            };
            return;
        }
        let (x, y) = self.xy(idx);
        // A spark meeting water hisses out into a wisp of steam — fireworks sizzle
        // over a pond instead of raining fire on it.
        if self
            .neighbor_indices(x, y)
            .iter()
            .any(|&nidx| is_water_like(old[nidx].kind))
        {
            next[idx] = Cell::new(Material::Steam as u8, cell.variant, 60);
            return;
        }
        let flying = next[idx];
        // A star shell's sparks fly out longer, so it blooms half as wide again.
        if cell.age < if cell.flags & FLAG_COSMIC != 0 { STAR_SHELL_FLIGHT } else { SHELL_FLIGHT } {
            // Shell expansion: the spark keeps flying along its birth direction.
            let (dx, dy) = SPARK_DIRS[(cell.variant & 7) as usize];
            if !self.try_move(idx, x + dx, y + dy, flying, old, next, true) {
                let (nx, ny) = (x + dx, y + dy);
                if self.in_bounds(nx, ny) {
                    let nidx = self.idx(nx as u32, ny as u32);
                    // Sparks landing on rocket powder light its fuse.
                    if old[nidx].kind == Material::Rocket as u8
                        && old[nidx].energy == 0
                        && next[nidx].kind == Material::Rocket as u8
                    {
                        next[nidx].energy = 220;
                    }
                }
                next[idx].energy = next[idx].energy.saturating_sub(30);
            }
        } else if self.tick_count % 2 == 0 {
            // Droop: spent sparks drift down, wobbling as they fade.
            let side = if self.chance(2) { 1 } else { -1 };
            for (dx, dy) in [(0, 1), (side, 1)] {
                if self.try_move(idx, x + dx, y + dy, flying, old, next, true) {
                    break;
                }
            }
        }
    }

    fn fall_dirs(&self) -> [(i32, i32); 3] {
        if self.tick_count % 2 == 0 {
            [(0, 1), (-1, 1), (1, 1)]
        } else {
            [(0, 1), (1, 1), (-1, 1)]
        }
    }

    fn try_move(
        &self,
        idx: usize,
        nx: i32,
        ny: i32,
        cell: Cell,
        old: &[Cell],
        next: &mut [Cell],
        can_sink_through_gas: bool,
    ) -> bool {
        if !self.in_bounds(nx, ny) {
            return false;
        }
        let moving_cell = next[idx];
        if moving_cell.kind != cell.kind {
            return false;
        }
        let target = self.idx(nx as u32, ny as u32);
        let target_old = old[target];
        let target_next = next[target];
        // Water never deletes water. Two cells flowing into the same just-emptied cell used to
        // overwrite each other, and that loss was the game's only water sink — the one thing
        // bounding a spring. Mist (MIST_ODDS) is the deliberate sink that replaced it.
        //
        // Water and moonwater only, because conserving a liquid needs a sink and only those
        // two mist. Oil was in this guard at first and review measured the result: an oil
        // spring flooded 31.9% of the board (main: 1.2%), because the clobber had been its
        // only sink too. Oil and lava have guards of their own below, each with its own sink.
        if is_water_like(moving_cell.kind) && is_water_like(target_next.kind) {
            return false;
        }
        // Nothing that moves deletes lava. First lava lava (2026-10-21): a spreading pour lost
        // most of itself to the clobber, 408 cells to 51 within 10 s, so lava never pooled. Its
        // sink is its own: deep lava cools too (`LAVA_DEEP_COOLS`). Then everything else
        // (2026-10-22): water flowing into a cell lava had just entered deleted it, so a pour
        // beside a splash of water kept a median 76% of itself as rock and 14% at the worst. A
        // falling grain did the same, far more rarely. A meteor's impact can still write fire
        // over lava that moved this tick (`update_meteor`), as it always could; no mover can.
        if target_next.kind == Material::Lava as u8 {
            return false;
        }
        // Nor oil oil (2026-10-21): a 583-cell pour was 19 cells ten seconds later, and a dab
        // on an open floor ten dots. Its sink spares a slick: only oil a spring poured fades
        // (`OIL_SPRING_FADES`), and oil a player pours is kept.
        if moving_cell.kind == Material::Oil as u8 && target_next.kind == Material::Oil as u8 {
            return false;
        }
        // A gas never deletes a gas (ROADMAP Phase 20D). Unlike water, smoke and steam already
        // have a sink of their own — they expire by age — so no new rule is needed to keep
        // this from filling the tray.
        if is_gas(moving_cell.kind) && is_gas(target_next.kind) {
            return false;
        }
        // Nor does a gas delete water (ROADMAP Phase 20E): mist rising through its own stream
        // used to overwrite the water that had just flowed into its path — the last leak of the
        // old accidental sink. Water only, as above: oil still has no sink of its own.
        if is_gas(moving_cell.kind) && is_water_like(target_next.kind) {
            return false;
        }
        // And water never deletes a gas that ARRIVED this tick — steam a quench or a boil has
        // just vented into an empty cell, or mist just thrown (ROADMAP Phase 20E). Water may
        // still sink through gas that sat there all tick; only the clobber is closed.
        if is_water_like(moving_cell.kind) && is_gas(target_next.kind) && target_old.is_empty() {
            return false;
        }
        // Nor does a mote delete water (ROADMAP Phase 20E). Pollen and stardust are kept out of
        // `try_fall` so they float on a pond rather than sinking, which left them the old move:
        // one landing on water that had just flowed into its path overwrote it. Oil and lava
        // over water are not included — the owner closed these two leaks and no others.
        if is_mote(moving_cell.kind) && is_water_like(target_next.kind) {
            return false;
        }
        let can_move = target_old.is_empty()
            || target_next.is_empty()
            || (can_sink_through_gas
                && (target_old.kind == Material::Smoke as u8 || target_old.kind == Material::Steam as u8));
        if !can_move {
            return false;
        }
        // Bubbles: a mover sinking into gas that is still in the cell trades places with it, so
        // the gas rises into the space the mover left instead of being deleted. Without this,
        // steam made at the bottom of a pool was eaten by the water sinking into it — about
        // seven cells in ten on a boil — and `water.boils` surfaced on 20 seeds of 32.
        //
        // Only gas hotter than mist bubbles. Mist is thrown INSIDE a moving pool, and letting it
        // bubble filled a spring's lake with pockets of gas, so less water moved, less mist was
        // thrown, and the sink starved: the lake grew from 7.2% of the board to 29.5%, which is
        // the no-sink flood. Mist keeps its old fate and the water budget is unchanged.
        //
        // The displaced gas usually lands in a cell whose `old` kind is the mover, so the gas pass
        // does not move it again this tick. The exception is dry sand's two-cell fall through
        // two stacked gas cells: the second gas lands where the first one started, and the gas
        // pass moves it one extra cell. Both survive, which is the point
        // (`dry_sand_falling_through_two_steam_cells_keeps_both`).
        let bubble = can_sink_through_gas
            && is_gas(target_old.kind)
            && is_gas(target_next.kind)
            && target_next.energy > MIST_ENERGY;
        next[idx] = if bubble { target_next } else { Cell::empty() };
        next[target] = moving_cell;
        true
    }

    /// Whether a liquid at (x, y) has somewhere it could actually MOVE: the cells
    /// `update_liquid` tries — below, the two lower diagonals, one and two cells to either
    /// side. It reads `old` only, as the reaction pass must. Erosion keeps the looser
    /// `water_can_move` (any empty neighbour), which deliberately lets a pond's waterline
    /// wear; anything claiming to need RUNNING water uses this.
    fn liquid_can_flow(&self, x: i32, y: i32, old: &[Cell]) -> bool {
        [(0, 1), (-1, 1), (1, 1), (-1, 0), (1, 0), (-2, 0), (2, 0)]
            .iter()
            .any(|&(dx, dy)| {
                let (nx, ny) = (x + dx, y + dy);
                self.in_bounds(nx, ny) && old[self.idx(nx as u32, ny as u32)].is_empty()
            })
    }

    /// How every GRAIN moves one cell: sand, soil, seed, stone, unlit rocket powder and a
    /// cut stalk. Into air it falls; into a liquid it sinks, trading places with it. And it
    /// never destroys a liquid — the one promise this adds over `try_move`.
    ///
    /// That promise is needed because `try_move` counts a cell as free if it was empty at the
    /// START of the tick, even when water has since moved into it, and overwrites it. That
    /// clobber is load-bearing for reaction output and is deliberately left alone there (see
    /// the note in docs/HARNESS.md). But sinking pushes water up into the path of whatever is
    /// still falling, and measured on a sand pour into a pond, the clobber then deleted 213 of
    /// 392 water cells. So for grains, a liquid in the target means sink or wait — never
    /// overwrite. Pollen and stardust are not grains here: pollen floating on a pond is the
    /// right picture, and stardust charges the water it touches rather than sinking in it.
    fn try_fall(&self, idx: usize, nx: i32, ny: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) -> bool {
        if !self.in_bounds(nx, ny) {
            return false;
        }
        if is_free_liquid(next[self.idx(nx as u32, ny as u32)].kind) {
            return self.try_sink(idx, nx, ny, cell, old, next);
        }
        self.try_move(idx, nx, ny, cell, old, next, true)
    }

    /// Settle a grain through a liquid by trading places with it: the grain goes down and the
    /// liquid comes up into the space it left, carrying its own temperature and flags. This is
    /// oil rising through water run the other way. The liquid must be one that sat there all
    /// tick, or one that flowed into an empty cell this tick — never a cell something else has
    /// already turned into a different liquid, or two movers would claim it.
    fn try_sink(&self, idx: usize, nx: i32, ny: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) -> bool {
        if self.tick_count % SINK_EVERY != 0 || !self.in_bounds(nx, ny) {
            return false;
        }
        if next[idx].kind != cell.kind {
            return false;
        }
        let target = self.idx(nx as u32, ny as u32);
        let liquid = next[target].kind;
        if !is_free_liquid(liquid) || (old[target].kind != liquid && !old[target].is_empty()) {
            return false;
        }
        let liquid = next[target];
        next[target] = next[idx];
        next[idx] = liquid;
        true
    }

    /// Emits a vapor cell above the source when that cell is open, returning the
    /// emitted index so callers can stamp extra state (e.g. cosmic pollen).
    fn emit_vapor_from(
        &self,
        source_idx: usize,
        old: &[Cell],
        next: &mut [Cell],
        vapor_kind: u8,
        variant: u8,
        energy: u16,
    ) -> Option<usize> {
        let (x, y) = self.xy(source_idx);
        if y <= 0 {
            return None;
        }
        // Vapour rises, but it needs somewhere to rise INTO. Trying only the cell directly
        // overhead dropped the emission in precisely the scenes that produce it: a flame
        // sitting on top of what it is drying occupies that cell itself. So the byproduct
        // that makes the heat buffer legible was mostly never placed, and drying scored
        // contrast 95 while wet wood venting into open air scored 404 -- the same mechanic,
        // told apart only by whether the steam had room. The two diagonals keep it rising
        // rather than letting vapour appear beside its source. No RNG here, in either
        // engine, so widening the search cannot shift the shared stream.
        for dx in [0, -1, 1] {
            let nx = x + dx;
            if !self.in_bounds(nx, y - 1) {
                continue;
            }
            let above = self.idx(nx as u32, (y - 1) as u32);
            if old[above].is_empty() && next[above].is_empty() {
                next[above] = Cell::new(vapor_kind, variant, energy);
                return Some(above);
            }
        }
        None
    }
}

fn starting_energy(kind: u8) -> u16 {
    match kind {
        x if x == Material::Fire as u8 => 240,
        x if x == Material::Lava as u8 => 255,
        x if x == Material::Smoke as u8 => 90,
        x if x == Material::Steam as u8 => 160,
        x if x == Material::Stardust as u8 => 190,
        x if x == Material::Meteor as u8 => 255,
        x if x == Material::Moonwater as u8 => 120,
        x if x == Material::Pollen as u8 => 150,
        x if x == Material::Seed as u8 => 50,
        x if x == Material::Moss as u8 => 70,
        x if x == Material::Fungus as u8 => 70,
        x if x == Material::Flower as u8 => BLOOM_ENERGY,
        _ => 0,
    }
}

fn is_hot(kind: u8) -> bool {
    kind == Material::Fire as u8 || kind == Material::Lava as u8 || kind == Material::Meteor as u8
}

/// Whether a cell lies on one of a burnt log's cracks: every third row, offset per band of
/// four columns, so a crack runs a few cells along the grain and jogs. By position, not a roll.
fn ember_crack(x: u32, y: u32) -> bool {
    (y + (x >> 2).wrapping_mul(374_761_393) % 3) % 3 == 0
}

fn ignited_cell(fuel: Cell, energy: u16) -> Cell {
    if fuel.kind == Material::Wood as u8 {
        Cell::new(Material::Ember as u8, fuel.variant, 230)
    } else if fuel.kind == Material::Rocket as u8 {
        // Rocket powder does not burn in place: lighting it starts the fuse
        // (energy > 0 marks a lit grain) and it launches skyward instead.
        Cell::new(Material::Rocket as u8, fuel.variant, 220)
    } else {
        // A sheened slick's flame keeps its sheen whichever neighbour lights it. The oil arm
        // writes cosmic fire itself, but a flame or lava cell processed after it in the same
        // tick re-lit the cell here as plain fire, so the colour hung on traversal order
        // (review, 2026-10-15: 16 of 32 seeds with the flame on the oil's right).
        let mut fire = Cell::new(Material::Fire as u8, fuel.variant, energy);
        if fuel.kind == Material::Oil as u8 {
            fire.flags = fuel.flags & FLAG_COSMIC;
        }
        fire
    }
}

fn is_wellspring_source(kind: u8) -> bool {
    kind == Material::Sand as u8
        || kind == Material::Water as u8
        || kind == Material::Soil as u8
        || kind == Material::Fire as u8
        || kind == Material::Lava as u8
        || kind == Material::Oil as u8
        || kind == Material::Seed as u8
        || kind == Material::Stardust as u8
        || kind == Material::Meteor as u8
        || kind == Material::Moonwater as u8
        || kind == Material::Rocket as u8
}

fn is_water_like(kind: u8) -> bool {
    kind == Material::Water as u8 || kind == Material::Moonwater as u8
}

/// Pollen and stardust: light enough to float on a pond, so they move with `try_move`
/// rather than sinking through liquid with `try_fall`.
fn is_mote(kind: u8) -> bool {
    kind == Material::Pollen as u8 || kind == Material::Stardust as u8
}

/// What a climbing rocket grain shoves aside rather than bursting under (`try_thrust`): its
/// own powder, lit or not, the flame that lit it, and the exhaust of the grain ahead.
fn is_rocket_charge(kind: u8) -> bool {
    kind == Material::Rocket as u8
        || kind == Material::Fire as u8
        || kind == Material::Stardust as u8
        || kind == Material::Spark as u8
        || kind == Material::Smoke as u8
}

fn is_gas(kind: u8) -> bool {
    kind == Material::Smoke as u8 || kind == Material::Steam as u8
}

/// Water, moonwater and oil: the liquids a grain sinks through, and never overwrites. Lava
/// is left out on purpose — everything that touches lava reacts with it, and nothing should
/// quietly sink into a pool that is meant to burn it.
fn is_free_liquid(kind: u8) -> bool {
    is_water_like(kind) || kind == Material::Oil as u8
}

fn is_absorbent(kind: u8) -> bool {
    kind == Material::Wall as u8
        || kind == Material::Sand as u8
        || kind == Material::Wood as u8
        || kind == Material::Stone as u8
        || kind == Material::Glass as u8
}

fn is_hydratable(kind: u8) -> bool {
    kind == Material::Wall as u8
        || kind == Material::Sand as u8
        || kind == Material::Soil as u8
        || kind == Material::Wood as u8
        || kind == Material::Stone as u8
        || kind == Material::Moss as u8
        || kind == Material::Seed as u8
        || kind == Material::Fungus as u8
        || kind == Material::Flower as u8
}

fn is_sootable(kind: u8) -> bool {
    kind == Material::Wall as u8 || kind == Material::Stone as u8 || kind == Material::Wood as u8
}

fn is_freezable(kind: u8) -> bool {
    kind == Material::Wall as u8
        || kind == Material::Sand as u8
        || kind == Material::Soil as u8
        || kind == Material::Stone as u8
        || kind == Material::Wood as u8
        || kind == Material::Seed as u8
        || kind == Material::Stem as u8
        || kind == Material::Moss as u8
        || kind == Material::Fungus as u8
        || kind == Material::Flower as u8
        || kind == Material::Oil as u8
}

fn is_scorchable(kind: u8) -> bool {
    kind == Material::Wall as u8
        || kind == Material::Sand as u8
        || kind == Material::Soil as u8
        || kind == Material::Stone as u8
        || kind == Material::Wood as u8
        || kind == Material::Seed as u8
        || kind == Material::Stem as u8
        || kind == Material::Moss as u8
        || kind == Material::Fungus as u8
        || kind == Material::Flower as u8
}

fn thawed_flags(kind: u8, flags: u16) -> u16 {
    let residue = if is_hydratable(kind) { FLAG_WET } else { 0 };
    (flags & !FLAG_FROZEN) | residue
}

fn heat_softens_cell(next: &mut [Cell], idx: usize, other: Cell, heat: u16) -> bool {
    if other.kind == Material::Ice as u8 {
        next[idx] = Cell::new(Material::Water as u8, other.variant, heat.max(40));
        return true;
    }
    if !is_freezable(other.kind) && !is_scorchable(other.kind) {
        return false;
    }
    if other.flags & FLAG_FROZEN != 0 {
        // Two hot rounds should crack a frost-stressed wall: lava's heat 72 crumbles
        // it in two, and fire (heat 42) in three, once the melt heat has accumulated.
        if other.kind == Material::Wall as u8 && next[idx].energy as u32 + heat as u32 > 150 {
            next[idx] = Cell::new(Material::Stone as u8, other.variant, 40);
            return true;
        }
        next[idx].flags = thawed_flags(other.kind, next[idx].flags);
        next[idx].energy = next[idx].energy.saturating_add(heat).min(255);
        return true;
    }
    if is_scorchable(other.kind) && other.flags & FLAG_WET != 0 {
        next[idx].flags = (next[idx].flags & !FLAG_WET) | FLAG_SCORCHED;
        next[idx].energy = next[idx].energy.saturating_sub(heat);
        return true;
    }
    false
}

fn is_flammable(kind: u8) -> bool {
    kind == Material::Wood as u8
        || kind == Material::Moss as u8
        || kind == Material::Seed as u8
        || kind == Material::Stem as u8
        || kind == Material::Fungus as u8
        || kind == Material::Flower as u8
        || kind == Material::Oil as u8
        || kind == Material::Rocket as u8
}

/// Growth may push up through standing water as well as through open air. A watered
/// garden pools, and requiring bare air meant a bed only ever sprouted around the pond's
/// dry margins while its whole middle stayed bare — which is what a player who waters
/// generously actually sees.
fn petal_site_free(cell: Cell) -> bool {
    cell.is_empty() || cell.kind == Material::Pollen as u8
}

/// What a moss spore crosses (`SPORE_JUMPS`): open air, gas or water, never a wall or rock.
fn is_spore_gap(kind: u8) -> bool {
    kind == Material::Empty as u8 || is_gas(kind) || is_water_like(kind)
}

/// What a gliding seed rolls along rather than landing on: the plant that set it.
fn is_plant(kind: u8) -> bool {
    kind == Material::Flower as u8 || kind == Material::Stem as u8
}

fn is_growable(kind: u8) -> bool {
    kind == Material::Empty as u8
        || kind == Material::Water as u8
        || kind == Material::Moonwater as u8
}

fn burn_chance(kind: u8) -> u32 {
    match kind {
        x if x == Material::Oil as u8 => 2,
        x if x == Material::Rocket as u8 => 3,
        x if x == Material::Fungus as u8 => 5,
        x if x == Material::Flower as u8 => 5,
        x if x == Material::Moss as u8 => 7,
        x if x == Material::Seed as u8 => 8,
        _ => 10,
    }
}

#[cfg(test)]
mod tests;
