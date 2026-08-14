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

/// SPARK_DIRS index for straight down, used by trail sparks shed in flight.
const SPARK_DOWN: u8 = 4;

const FLAG_WET: u16 = 1 << 0;
const FLAG_ROOTED: u16 = 1 << 1;
const FLAG_COSMIC: u16 = 1 << 2;
const FLAG_FROZEN: u16 = 1 << 3;
const FLAG_SCORCHED: u16 = 1 << 4;
const FLAG_MASK: u16 = FLAG_WET | FLAG_ROOTED | FLAG_COSMIC | FLAG_FROZEN | FLAG_SCORCHED;

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
const PLANT_SPACING: i32 = 5;

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
    // 0 Cornflower: a frilled rosette. The crest is NOTCHED — filling it made this the
    // solidest head in the set, a plain ball that read as a lump beside the poppy in a
    // desaturated crop. The notch sits above a full row, so unlike the poppy's crest it
    // cannot split the head; the poppy's dark eye already cuts its lower row, this one's
    // gold disc does not.
    &[
        (0, -1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-2, 0), (2, 0),
        (-2, -1), (2, -1), (-1, -2), (1, -2), (-1, 1), (1, 1),
    ],
    // 1 Poppy: a broad bowl whose outer petals DROOP below the rim, which is what a
    // poppy does and what separates it from the cornflower at a glance — compact rosette
    // versus wide flopping cap. Leaving a notch at the crest split the head into two
    // separate red blocks, because the dark eye cuts the middle of the lower row too.
    // Filling the notch instead made a solid 5x2 bar, so the top corners come off: the
    // bowl has to be rounded at the crest or it is just a rectangle.
    &[(0, -1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-2, 0), (2, 0), (-2, 1), (2, 1)],
    // 2 Daisy: the same span opened out into a star, so the gaps do the work.
    &[(0, -1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-2, 0), (2, 0), (0, -2), (-1, 1), (1, 1)],
    // 3 Sunflower: the biggest head, a full disc under a crown of rays.
    &[
        (0, -1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-2, 0), (2, 0),
        (-2, -1), (2, -1), (0, -2), (-1, -2), (1, -2), (-1, 1), (1, 1),
        (-2, -2), (2, -2), (0, -3),
    ],
    // 4 Tulip: a solid cup under a notched top edge — the notches are the signature.
    &[(0, -1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-2, -1), (2, -1), (-2, -2), (0, -2), (2, -2)],
    // 5 Lavender: a tall checkered spike, three wide and six high.
    &[(0, -1), (-1, -2), (1, -2), (0, -3), (-1, -4), (1, -4), (0, -5)],
    // 6 Bluebell: paired bells nodding off a bare central stalk.
    &[(0, -1), (0, -2), (-1, -1), (1, -2), (-2, 0), (2, -1)],
    // 7 Forget-me-not: the smallest head, a tight five-petal cluster.
    &[(0, -1), (-1, 0), (1, 0), (-1, -1), (1, -1)],
];

/// A bloom runs on a slower clock than the rest of the life materials: it loses
/// energy once every this many ticks instead of every tick. The old bloom carried
/// 90 energy at 1/tick — about a second and a half of life — which is why an
/// untended flower emitted one or two pollen motes at most and then sat inert
/// forever. Slowing the clock buys a watchable open → dust → wilt arc while
/// keeping every material's energy under 255, which is what the scene-import
/// clamp in `load_cells` assumes.
const BLOOM_CLOCK: u16 = 8;
const BLOOM_ENERGY: u16 = 200;
const BLOOM_ENERGY_COSMIC: u16 = 250;
/// The crown only unfurls petals down to this reserve, so a head is bounded by
/// budget as well as by its silhouette. The cost must leave room for the largest shape
/// (17 petals) *plus* the energy the crown drains while it is opening, or the biggest
/// blooms stall half-open.
const CROWN_RESERVE: u16 = 100;
const PETAL_ENERGY: u16 = 150;
const PETAL_COST: u16 = 3;
/// Below this a bloom is spent: no more pollen, and petals may start to let go.
const POLLEN_RESERVE: u16 = 40;
const POLLEN_COST: u16 = 15;
const PETAL_SHED_AGE: u16 = 1200;

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
                x if x == Material::Water as u8 => self.update_liquid(idx, cell, &old, &mut next, 1),
                x if x == Material::Moonwater as u8 => {
                    self.update_liquid(idx, cell, &old, &mut next, 1)
                }
                x if x == Material::Oil as u8 => self.update_oil(idx, cell, &old, &mut next),
                x if x == Material::Lava as u8 => self.update_liquid(idx, cell, &old, &mut next, 2),
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

        self.cells = next;
    }

    /// One step of the slow world: the changes a terrarium makes while nobody is
    /// watching it.
    ///
    /// Runs only when the player returns, on a clock derived from how long they were
    /// away, and **never during play**. A slow step is deliberately not a slow tick:
    /// it is a small set of transformations each too consequential to fire while
    /// watched, and each touches only something the player left living — a scene of
    /// bare walls and sand comes back byte-identical.
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
        for cell in cells {
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
            cell.energy = cell.energy.saturating_sub(drain);
            if cell.energy == 0 {
                if cell.flags & FLAG_FROZEN != 0 {
                    cell.flags = thawed_flags(cell.kind, cell.flags);
                } else {
                    cell.flags &= !(FLAG_WET | FLAG_COSMIC);
                }
            }

            if cell.kind == Material::Steam as u8 && cell.age > 150 {
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
                    if cell.energy == 0 || chilled {
                        // An unattuned wellspring drinks the identity of the first source
                        // material that touches it, consuming that cell. A spring stilled
                        // by ice can be re-taught the same way, so a first-touch misattunement
                        // is fixable — remove the ice and it pours the newly drunk material.
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
                    } else if is_wellspring_source(cell.energy as u8) {
                        // Attuned: gently emit the remembered material from open faces.
                        // The source guard rejects out-of-range ids from imported scenes.
                        let (cx, cy) = self.xy(idx);
                        let source = cell.energy as u8;
                        for (dx, dy) in [(0, -1), (-1, 0), (1, 0), (0, 1)] {
                            let (nx, ny) = (cx + dx, cy + dy);
                            if !self.in_bounds(nx, ny) {
                                continue;
                            }
                            let nidx = self.idx(nx as u32, ny as u32);
                            if old[nidx].is_empty() && next[nidx].is_empty() && self.chance(26) {
                                let variant = (self.rand() & 3) as u8;
                                next[nidx] = Cell::new(source, variant, starting_energy(source));
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
                    let hearth = neighbors.iter().any(|&nidx| {
                        let other = old[nidx];
                        is_hot(other.kind)
                            || (other.kind == Material::Ember as u8 && other.energy > 90)
                    });
                    if !hearth {
                        continue;
                    }
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.flags & FLAG_FROZEN != 0 && self.chance(6) {
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
                    } else if next[idx].kind == Material::Lava as u8 && hot_neighbors < 3 && self.chance(8) {
                        // Exposed lava slowly crusts over on its own, so pools cool edge-inward
                        // and nothing stays molten forever without a heat source.
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
                    }
                }
                x if x == Material::Water as u8 || x == Material::Moonwater as u8 => {
                    let is_moonwater = cell.kind == Material::Moonwater as u8;
                    let vigor = if is_moonwater { 96 } else { 56 };
                    if !is_moonwater && cell.energy > 150 && self.chance(20) {
                        // Simmering water vents a wisp and loses heat to evaporation.
                        self.emit_vapor_from(idx, old, next, Material::Steam as u8, cell.variant, 120);
                        next[idx].energy = next[idx].energy.saturating_sub(40);
                    }
                    for nidx in neighbors {
                        let other = old[nidx];
                        if !is_moonwater && other.kind == Material::Ice as u8 && cell.energy > 120 && self.chance(2) {
                            next[nidx] = Cell::new(Material::Water as u8, other.variant, 40);
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
                        if other.kind == Material::Ember as u8 && other.energy < COLD_CHAR_ENERGY && self.chance(12) {
                            // Charcoal wash: running water crumbles cold char away.
                            next[nidx] = Cell::empty();
                            continue;
                        }
                        if !is_moonwater
                            && is_hydratable(other.kind)
                            && self.neighbor_has_kind(old, nidx, Material::Oil as u8)
                        {
                            next[nidx].energy = next[nidx].energy.saturating_sub(16);
                            next[nidx].flags &= !FLAG_WET;
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
                            if next[nidx].flags & FLAG_SCORCHED != 0 && self.chance(5) {
                                next[nidx].flags &= !FLAG_SCORCHED;
                            }
                            if next[nidx].kind == Material::Stone as u8
                                && next[nidx].energy >= 250
                                && self.chance(2000)
                            {
                                // Erosion: fully saturated stone slowly wears into wet grains that
                                // keep the stone's variant. Rolls happen per touching water cell,
                                // so heavier flow wears faster; sealed wall never erodes.
                                next[nidx] = Cell::new(Material::Sand as u8, other.variant, 60);
                                next[nidx].flags = FLAG_WET;
                            }
                        }
                        if other.kind == Material::Wall as u8 {
                            let wall_vigor = (vigor / if is_moonwater { 3 } else { 5 }).max(8);
                            next[nidx].energy = next[nidx].energy.saturating_add(wall_vigor).min(255);
                            next[nidx].flags |= FLAG_WET;
                            if is_moonwater {
                                next[nidx].flags |= FLAG_COSMIC;
                            }
                            if next[nidx].flags & FLAG_SCORCHED != 0 && self.chance(5) {
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
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 && other.energy < 120 && self.chance(5) {
                            next[nidx] = Cell::new(Material::Ice as u8, other.variant, 90);
                        } else if other.kind == Material::Moonwater as u8 && self.chance(10) {
                            next[nidx] = Cell::new(Material::Ice as u8, other.variant, 110);
                            next[nidx].flags = FLAG_COSMIC;
                        } else if other.kind == Material::Steam as u8 && self.chance(4) {
                            next[nidx] = Cell::new(Material::Ice as u8, other.variant, 70);
                        } else if (other.kind == Material::Stone as u8 || other.kind == Material::Wall as u8)
                            && (other.flags & FLAG_WET != 0 || other.energy > 40)
                        {
                            next[nidx].flags = (next[nidx].flags | FLAG_FROZEN) & !FLAG_SCORCHED;
                            next[nidx].energy = next[nidx].energy.max(88);
                        } else if is_freezable(other.kind) && self.chance(4) {
                            next[nidx].flags |= FLAG_FROZEN;
                            next[nidx].energy = next[nidx].energy.max(72);
                        }
                    }
                }
                x if x == Material::Steam as u8 => {
                    let ice_nearby = neighbors.iter().any(|&nidx| old[nidx].kind == Material::Ice as u8);
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
                                next[nidx].flags = (next[nidx].flags | FLAG_WET) & !FLAG_SCORCHED;
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
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 || other.kind == Material::Moonwater as u8 {
                            next[idx].energy = next[idx].energy.saturating_sub(120);
                            next[idx].flags |= FLAG_WET;
                            if cell.energy > 40 && self.chance(6) {
                                next[nidx] = Cell::new(Material::Steam as u8, other.variant, 170);
                            }
                            continue;
                        }
                        if cell.energy < 60 && is_hot(other.kind) && next[idx].kind == Material::Ember as u8 {
                            next[idx].energy = 210;
                            next[idx].flags &= !FLAG_WET;
                            continue;
                        }
                        if cell.energy > 90
                            && is_flammable(other.kind)
                            && self.chance(burn_chance(other.kind) * 3 / 2)
                        {
                            next[nidx] = ignited_cell(other, 210);
                        }
                    }
                    if cell.energy > 90 && self.chance(9) {
                        self.emit_vapor_from(idx, old, next, Material::Smoke as u8, cell.variant, 80);
                    }
                }
                x if x == Material::Oil as u8 => {
                    if neighbors.iter().any(|&nidx| is_hot(old[nidx].kind)) {
                        next[idx] = Cell::new(Material::Fire as u8, cell.variant, 240);
                        continue;
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
            if self.try_move(idx, x, y + 1, cell, old, next, true) {
                let dropped = self.idx(x as u32, (y + 1) as u32);
                self.try_move(dropped, x, y + 2, cell, old, next, true);
            } else {
                for (dx, dy) in self.fall_dirs() {
                    if dx != 0 && self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
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
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                return;
            }
        }
    }

    /// Unsupported stone drops straight down one cell per tick — no diagonal slip, so
    /// pillars, floors, and shelves hold and only true overhangs fall. Motion halts the
    /// instant anything (stone, wall, liquid, growth) sits directly below. Wall never moves.
    fn update_stone(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        let (x, y) = self.xy(idx);
        self.try_move(idx, x, y + 1, cell, old, next, true);
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
        if !claimed
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

    fn update_liquid(
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
                return;
            }
        }
    }

    fn update_oil(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if self.tick_count % 2 != 0 {
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
        let side = if self.tick_count % 2 == 0 { 1 } else { -1 };
        let dirs = if supported {
            [(side, 0), (-side, 0), (side * 2, 0), (-side * 2, 0), (0, 1), (side, 1), (-side, 1)]
        } else {
            [(0, 1), (side, 1), (-side, 1), (side, 0), (-side, 0), (side * 2, 0), (-side * 2, 0)]
        };
        for (dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, true) {
                return;
            }
        }
    }

    fn update_gas(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell], speed: u32) {
        if speed > 1 && self.tick_count % speed != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        let side = if self.tick_count % 2 == 0 { 1 } else { -1 };
        let dirs = [(0, -1), (side, -1), (-side, -1), (side, 0), (-side, 0)];
        for (dx, dy) in dirs {
            if self.try_move(idx, x + dx, y + dy, cell, old, next, false) {
                return;
            }
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
        let (x, y) = self.xy(idx);
        if y + 1 < self.height as i32 {
            let below = old[self.idx(x as u32, (y + 1) as u32)];
            if below.is_empty() {
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
            // A wet seed is grounded either by soil directly under it or by another
            // grounded seed, so a bed is rooted as a whole and sprouts from its surface.
            let grounded = below.kind == Material::Soil as u8
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
        // which is why a finished garden is not a field of bare poles.
        if cell.flags & FLAG_ROOTED == 0
            && cell.age > PETAL_SHED_AGE
            && cell.energy < POLLEN_RESERVE
            && self.chance(400)
        {
            next[idx] = Cell::new(Material::Pollen as u8, cell.variant, 150);
            next[idx].flags = cell.flags & FLAG_COSMIC;
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
            } else if wall_substrate && damp_substrate && cell.energy > 150 {
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
        if y + 1 < self.height as i32 {
            let below = old[self.idx(x as u32, (y + 1) as u32)];
            if below.kind == Material::Soil as u8
                && (below.flags & FLAG_WET != 0 || below.energy > 60)
                && self.chance(8)
            {
                next[idx] = Cell::new(Material::Seed as u8, cell.variant, 40);
                // Cosmic pollen roots into a cosmic seed, so moonlit gardens breed true.
                next[idx].flags = cell.flags & FLAG_COSMIC;
                return;
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
            } else if is_flammable(old[nidx].kind) {
                next[nidx] = ignited_cell(old[nidx], 230);
            }
        }
    }

    /// A meteor occasionally sheds a downward spark from the cell it just left, so a
    /// shower streaks a glittering tail. Trail sparks age out fast and light nothing but
    /// rocket fuses (Spark is excluded from `is_hot`), and hiss to steam over water.
    fn leave_meteor_trail(&mut self, vacated: usize, next: &mut [Cell]) {
        if next[vacated].is_empty() && self.chance(3) {
            next[vacated] = Cell::new(Material::Spark as u8, SPARK_DOWN, 90);
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

    fn burst_rocket(&mut self, idx: usize, x: i32, y: i32, cell: Cell, old: &[Cell], next: &mut [Cell]) {
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
            next[idx] = if self.chance(6) {
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
        if cell.age < 6 {
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
        let can_move = target_old.is_empty()
            || target_next.is_empty()
            || (can_sink_through_gas
                && (target_old.kind == Material::Smoke as u8 || target_old.kind == Material::Steam as u8));
        if !can_move {
            return false;
        }
        next[idx] = Cell::empty();
        next[target] = moving_cell;
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
        let above = self.idx(x as u32, (y - 1) as u32);
        if old[above].is_empty() && next[above].is_empty() {
            next[above] = Cell::new(vapor_kind, variant, energy);
            return Some(above);
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

fn ignited_cell(fuel: Cell, energy: u16) -> Cell {
    if fuel.kind == Material::Wood as u8 {
        Cell::new(Material::Ember as u8, fuel.variant, 230)
    } else if fuel.kind == Material::Rocket as u8 {
        // Rocket powder does not burn in place: lighting it starts the fuse
        // (energy > 0 marks a lit grain) and it launches skyward instead.
        Cell::new(Material::Rocket as u8, fuel.variant, 220)
    } else {
        Cell::new(Material::Fire as u8, fuel.variant, energy)
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
mod tests {
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

    #[test]
    fn moss_cannot_spread_into_claimed_ground() {
        let mut u = Universe::new(16, 16, 13);
        for x in 0..16 {
            set_cell(&mut u, x, 10, Material::Wall);
        }
        set_cell_state(&mut u, 7, 9, Material::Moss, 40, 200, FLAG_WET);
        set_cell_state(&mut u, 8, 9, Material::Soil, 16, 250, FLAG_WET);
        set_cell_state(&mut u, 8, 8, Material::Seed, 40, 200, FLAG_WET | FLAG_ROOTED);
        // Capped so the seed stays a seed and keeps holding the claim for the whole run.
        set_cell(&mut u, 8, 7, Material::Wall);
        for _ in 0..300 {
            u.tick();
        }
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
        let head_of = |variant: u8| {
            let mut u = Universe::new(16, 16, 3);
            set_cell_state(&mut u, 8, 8, Material::Flower, 20, BLOOM_ENERGY, FLAG_ROOTED);
            let idx = u.idx(8, 8);
            u.cells[idx].variant = variant;
            for _ in 0..400 {
                u.tick();
            }
            u.cells
                .iter()
                .filter(|cell| cell.kind == Material::Flower as u8)
                .count()
        };
        assert_eq!(
            head_of(0),
            1 + BLOOM_SHAPES[0].len(),
            "a poppy crown should open its whole silhouette"
        );
        assert_eq!(
            head_of(3),
            1 + BLOOM_SHAPES[3].len(),
            "a lavender crown should open its whole silhouette"
        );
        assert_ne!(
            head_of(0),
            head_of(3),
            "different variants should grow visibly different blooms"
        );
    }

    #[test]
    fn a_lone_petal_never_opens_a_head_of_its_own() {
        // Only the rooted crown opens. Without this the head would grow without bound.
        let mut u = Universe::new(16, 16, 3);
        set_cell_state(&mut u, 8, 8, Material::Flower, 20, PETAL_ENERGY, 0);
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
    fn a_fresh_crown_holds_its_petals() {
        // Pairs with the shed test: without this, "petals fall off" could be passing
        // because every bloom crumbles immediately rather than only when spent.
        let mut u = Universe::new(16, 16, 9);
        set_cell_state(&mut u, 8, 4, Material::Flower, 30, PETAL_ENERGY, 0);
        for _ in 0..600 {
            u.tick();
        }
        assert_eq!(
            kind_at(&u, 8, 4),
            Material::Flower as u8,
            "a young, fed petal should stay on the bloom"
        );
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
        for (x, y) in [(6, 7), (7, 7), (9, 7), (10, 7), (7, 8), (9, 8), (8, 9)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        for _ in 0..2 {
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

        // And a cosmic mote rooting on damp soil produces a cosmic seed.
        let mut u = Universe::new(16, 16, 7);
        set_cell_state(&mut u, 8, 8, Material::Pollen, 10, 150, FLAG_COSMIC);
        set_cell_state(&mut u, 8, 9, Material::Soil, 10, 120, FLAG_WET);
        for (x, y) in [(7, 9), (9, 9), (7, 10), (8, 10), (9, 10)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        let mut rooted_cosmic = false;
        for _ in 0..200 {
            u.tick();
            if u
                .cells
                .iter()
                .any(|cell| cell.kind == Material::Seed as u8 && cell.flags & FLAG_COSMIC != 0)
            {
                rooted_cosmic = true;
                break;
            }
        }
        assert!(rooted_cosmic, "cosmic pollen should root into a cosmic seed");
    }

    #[test]
    fn pollen_seeds_wet_soil() {
        let mut u = Universe::new(16, 16, 7);
        set_cell(&mut u, 8, 8, Material::Pollen);
        set_cell_state(&mut u, 8, 9, Material::Soil, 12, 90, FLAG_WET);
        for (x, y) in [(7, 9), (9, 9), (7, 10), (8, 10), (9, 10)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        let mut seeded = false;
        for _ in 0..120 {
            u.tick();
            if u.cells.iter().any(|cell| cell.kind == Material::Seed as u8 || cell.kind == Material::Flower as u8) {
                seeded = true;
                break;
            }
        }
        assert!(seeded, "pollen resting on wet soil should take root as a seed");
    }

    #[test]
    fn water_washes_cold_char_away() {
        let mut u = Universe::new(16, 16, 7);
        set_cell_state(&mut u, 8, 8, Material::Ember, 200, 10, 0);
        set_cell(&mut u, 7, 8, Material::Water);
        for (x, y) in [(6, 8), (5, 8), (9, 8), (6, 9), (7, 9), (8, 9), (9, 9)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        let mut washed = false;
        for _ in 0..80 {
            u.tick();
            if kind_at(&u, 8, 8) != Material::Ember as u8 {
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

    #[test]
    fn sustained_water_erodes_saturated_stone_into_sand() {
        let mut u = Universe::new(16, 16, 7);
        set_cell(&mut u, 8, 8, Material::Stone);
        set_cell(&mut u, 7, 8, Material::Water);
        set_cell(&mut u, 8, 7, Material::Water);
        for (x, y) in [(6, 8), (5, 8), (6, 9), (7, 9), (8, 9), (9, 9), (9, 8), (10, 8), (7, 7), (6, 7), (9, 7), (8, 6), (7, 6), (9, 6)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        let mut eroded = false;
        for _ in 0..30000 {
            u.tick();
            if kind_at(&u, 8, 8) == Material::Sand as u8 {
                eroded = true;
                break;
            }
        }
        assert!(eroded, "stone soaked by persistent water should erode into sand");
        assert!(flags_at(&u, 8, 8) & FLAG_WET != 0, "eroded grains should be wet");
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
    fn hot_water_melts_ice_and_resists_freezing() {
        let mut u = Universe::new(16, 16, 7);
        set_cell_state(&mut u, 7, 8, Material::Water, 4, 220, 0);
        set_cell(&mut u, 8, 8, Material::Ice);
        for (x, y) in [(6, 8), (5, 8), (6, 9), (7, 9), (8, 9)] {
            set_cell(&mut u, x, y, Material::Stone);
        }
        let mut melted = false;
        for _ in 0..40 {
            u.tick();
            if kind_at(&u, 8, 8) == Material::Water as u8 {
                melted = true;
                break;
            }
        }
        assert!(melted, "hot water should melt adjacent ice instead of freezing");
    }

    #[test]
    fn water_rinses_soot_from_hard_surfaces() {
        let mut u = Universe::new(16, 16, 7);
        set_cell(&mut u, 7, 8, Material::Water);
        set_cell_state(&mut u, 8, 8, Material::Stone, 12, 40, FLAG_SCORCHED);
        for (x, y) in [(6, 8), (5, 8), (9, 8), (6, 9), (7, 9), (8, 9)] {
            set_cell(&mut u, x, y, Material::Wall);
        }
        let mut rinsed = false;
        for _ in 0..40 {
            u.tick();
            if flags_at(&u, 8, 8) & FLAG_SCORCHED == 0 {
                rinsed = true;
                break;
            }
        }
        assert!(rinsed, "running water should rinse soot from scorched stone");
        assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8);
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
    fn moss_needs_extra_energy_to_cross_wall() {
        let mut weak = Universe::new(16, 16, 7);
        set_cell_state(&mut weak, 7, 8, Material::Moss, 12, 130, FLAG_WET);
        set_cell_state(&mut weak, 8, 8, Material::Wall, 12, 90, FLAG_WET);
        weak.tick();
        assert_eq!(kind_at(&weak, 8, 8), Material::Wall as u8);

        let mut strong = Universe::new(16, 16, 7);
        set_cell_state(&mut strong, 7, 8, Material::Moss, 12, 170, FLAG_WET);
        set_cell_state(&mut strong, 8, 8, Material::Wall, 12, 90, FLAG_WET);
        strong.tick();
        assert_eq!(kind_at(&strong, 8, 8), Material::Moss as u8);
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

    #[test]
    fn moonwater_cleans_oil_into_stardust() {
        let mut u = Universe::new(16, 16, 17);
        set_cell(&mut u, 7, 8, Material::Moonwater);
        set_cell(&mut u, 8, 8, Material::Oil);
        set_cell(&mut u, 8, 9, Material::Wall);
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

    fn count_kind(u: &Universe, material: Material) -> usize {
        u.cells.iter().filter(|c| c.kind == material as u8).count()
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
}
