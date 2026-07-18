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
                x if x == Material::Moss as u8 => self.update_moss(idx, cell, &old, &mut next),
                x if x == Material::Fungus as u8 => self.update_fungus(idx, cell, &old, &mut next),
                _ => {}
            }
        }

        self.cells = next;
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
                    if cell.energy == 0 {
                        // An unattuned wellspring drinks the identity of the first
                        // source material that touches it, consuming that cell.
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
                    } else if !chilled {
                        // Attuned: gently emit the remembered material from open faces.
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
                        if other.kind == Material::Ember as u8 && other.energy < 30 && self.chance(12) {
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
                                // Petrichor: the first water on long-dry soil breathes out a moist wisp.
                                self.emit_vapor_from(nidx, old, next, Material::Steam as u8, other.variant, 90);
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
                x if x == Material::Flower as u8 => {
                    // Mature, healthy flowers spend stored energy to release rare pollen motes.
                    if cell.age > 120 && cell.energy > 80 && cell.flags & FLAG_FROZEN == 0 && self.chance(300) {
                        self.emit_vapor_from(idx, old, next, Material::Pollen as u8, cell.variant, 150);
                        next[idx].energy = next[idx].energy.saturating_sub(30);
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

    fn update_soil(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        self.update_powder(idx, cell, old, next, 2);
        if next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        if next[idx].kind == Material::Soil as u8
            && next[idx].energy > 140
            && cell.age > 10
            && self.chance(if next[idx].flags & FLAG_COSMIC != 0 { 7 } else { 12 })
        {
            next[idx] = Cell::new(Material::Moss as u8, cell.variant, 90);
            next[idx].flags = FLAG_WET;
        }
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
            if below.kind == Material::Soil as u8 && wet {
                next[idx].flags |= FLAG_ROOTED;
                // Germination: a fed, rooted seed becomes the base of a growing stalk.
                // Its energy is the stalk's height budget, varied per seed by variant.
                if cell.age > 30 && cell.energy > 70 && self.chance(if cosmic { 4 } else { 8 }) {
                    next[idx] = Cell::new(
                        Material::Stem as u8,
                        cell.variant,
                        130 + u16::from(cell.variant & 3) * 55,
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
        if y + 1 < self.height as i32 && old[self.idx(x as u32, (y + 1) as u32)].is_empty() {
            // A stalk segment with nothing under it falls, so cut plants collapse.
            self.update_powder(idx, cell, old, next, 1);
            return;
        }
        // Only the growing tip carries budget above the mature level.
        if cell.energy <= 20 || y == 0 {
            return;
        }
        let above = self.idx(x as u32, (y - 1) as u32);
        if !old[above].is_empty() || !next[above].is_empty() || !self.chance(4) {
            return;
        }
        let cosmic = cell.flags & FLAG_COSMIC != 0;
        if cell.energy > 75 {
            next[above] = Cell::new(Material::Stem as u8, cell.variant, cell.energy - 55);
            next[above].flags = if cosmic { FLAG_COSMIC } else { 0 };
        } else {
            next[above] = Cell::new(Material::Flower as u8, cell.variant, if cosmic { 150 } else { 90 });
            next[above].flags = FLAG_ROOTED | if cosmic { FLAG_COSMIC } else { 0 };
        }
        next[idx].energy = 20;
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
            let soft_substrate = other.kind == Material::Soil as u8 || other.kind == Material::Wood as u8;
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

    fn update_fungus(&mut self, idx: usize, _cell: Cell, old: &[Cell], next: &mut [Cell]) {
        if next[idx].flags & FLAG_FROZEN != 0 {
            return;
        }
        let (x, y) = self.xy(idx);
        if !self.chance(48) {
            return;
        }
        for nidx in self.neighbor_indices(x, y) {
            let other = old[nidx];
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
                next[nidx] = Cell::new(Material::Fungus as u8, other.variant, 80);
                return;
            }
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
            return;
        }
        if self.try_move(idx, x + if self.tick_count % 2 == 0 { 1 } else { -1 }, y + 1, cell, old, next, true) {
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
                next[nidx] = Cell::new(Material::Sand as u8, old[nidx].variant, 0);
            } else if is_flammable(old[nidx].kind) {
                next[nidx] = ignited_cell(old[nidx], 230);
            }
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
        if next[idx].energy < 30 {
            next[idx] = if self.chance(6) {
                Cell::new(Material::Stardust as u8, cell.variant, 120)
            } else {
                Cell::empty()
            };
            return;
        }
        let (x, y) = self.xy(idx);
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

    fn emit_vapor_from(
        &self,
        source_idx: usize,
        old: &[Cell],
        next: &mut [Cell],
        vapor_kind: u8,
        variant: u8,
        energy: u16,
    ) {
        let (x, y) = self.xy(source_idx);
        if y <= 0 {
            return;
        }
        let above = self.idx(x as u32, (y - 1) as u32);
        if old[above].is_empty() && next[above].is_empty() {
            next[above] = Cell::new(vapor_kind, variant, energy);
        }
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
        x if x == Material::Flower as u8 => 90,
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
        if other.kind == Material::Wall as u8 && next[idx].energy as u32 + heat as u32 > 200 {
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
    fn rocket_powder_falls_inert_without_flame() {
        let mut u = Universe::new(16, 32, 7);
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
        let mut u = Universe::new(16, 48, 7);
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
            set_cell(&mut u, x, 24, Material::Stone);
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
            u.paint(x, 10, 1, Material::Stone as u8, 100);
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
            set_cell(&mut u, x, y, Material::Stone);
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
        set_cell(&mut u, 8, 9, Material::Stone);
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
            set_cell(&mut u, x, y, Material::Stone);
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
            set_cell(&mut u, x, y, Material::Stone);
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
        set_cell(&mut u, 7, 9, Material::Stone);
        set_cell(&mut u, 8, 9, Material::Stone);
        set_cell(&mut u, 9, 9, Material::Stone);
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
            set_cell(&mut u, x, y, Material::Stone);
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
        set_cell(&mut u, 7, 9, Material::Stone);
        set_cell(&mut u, 8, 9, Material::Stone);
        set_cell(&mut u, 9, 9, Material::Stone);
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
    fn pollen_seeds_wet_soil() {
        let mut u = Universe::new(16, 16, 7);
        set_cell(&mut u, 8, 8, Material::Pollen);
        set_cell_state(&mut u, 8, 9, Material::Soil, 12, 90, FLAG_WET);
        for (x, y) in [(7, 9), (9, 9), (7, 10), (8, 10), (9, 10)] {
            set_cell(&mut u, x, y, Material::Stone);
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
            set_cell(&mut u, x, y, Material::Stone);
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
        set_cell(&mut u, 8, 9, Material::Stone);
        set_cell(&mut u, 7, 8, Material::Glass);
        set_cell(&mut u, 7, 9, Material::Stone);
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
        set_cell_state(&mut u, 8, 8, Material::Stone, 12, 200, FLAG_WET);
        for _ in 0..5000 {
            u.tick();
        }
        assert_eq!(kind_at(&u, 8, 8), Material::Stone as u8, "damp stone alone should stay stone");
    }

    #[test]
    fn isolated_lava_crusts_into_stone_over_time() {
        let mut u = Universe::new(16, 16, 7);
        set_cell(&mut u, 8, 8, Material::Lava);
        for (x, y) in [(7, 8), (6, 8), (9, 8), (10, 8), (7, 9), (8, 9), (9, 9)] {
            set_cell(&mut u, x, y, Material::Stone);
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
            set_cell(&mut u, x, y, Material::Stone);
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
            set_cell(&mut u, x, y, Material::Stone);
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
        set_cell(&mut u, 8, 9, Material::Stone);
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
        set_cell(&mut u, 7, 9, Material::Stone);
        set_cell(&mut u, 8, 9, Material::Stone);
        set_cell(&mut u, 9, 9, Material::Stone);
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
        set_cell(&mut u, 8, 9, Material::Stone);
        set_cell(&mut u, 7, 8, Material::Sand);
        set_cell(&mut u, 7, 9, Material::Stone);
        set_cell(&mut u, 9, 8, Material::Sand);
        set_cell(&mut u, 9, 9, Material::Stone);
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
}
