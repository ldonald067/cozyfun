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
}

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

    pub fn paint(&mut self, x: i32, y: i32, radius: u32, material: u8) {
        let radius = radius.max(1) as i32;
        let radius_sq = radius * radius;
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
                let idx = self.idx(px as u32, py as u32);
                let kind = material.min(Material::Moonwater as u8);
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
            self.cells[idx] = Cell {
                kind: chunk[0].min(Material::Moonwater as u8),
                variant: chunk[1],
                age: u16::from_le_bytes([chunk[2], chunk[3]]),
                energy: u16::from_le_bytes([chunk[4], chunk[5]]),
                flags: u16::from_le_bytes([chunk[6], chunk[7]]),
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
                x if x == Material::Sand as u8 => self.update_powder(idx, cell, &old, &mut next, 1),
                x if x == Material::Soil as u8 => self.update_powder(idx, cell, &old, &mut next, 2),
                x if x == Material::Stardust as u8 => {
                    self.update_stardust(idx, cell, &old, &mut next)
                }
                x if x == Material::Meteor as u8 => self.update_meteor(idx, cell, &old, &mut next),
                x if x == Material::Water as u8 => self.update_liquid(idx, cell, &old, &mut next, 1),
                x if x == Material::Moonwater as u8 => {
                    self.update_liquid(idx, cell, &old, &mut next, 1)
                }
                x if x == Material::Oil as u8 => self.update_liquid(idx, cell, &old, &mut next, 2),
                x if x == Material::Lava as u8 => self.update_liquid(idx, cell, &old, &mut next, 4),
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
                x if x == Material::Seed as u8 => self.update_seed(idx, cell, &old, &mut next),
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
) {
    if let Some(universe) = ptr.as_mut() {
        universe.paint(x, y, radius, material);
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
            cell.energy = cell.energy.saturating_sub(match cell.kind {
                x if x == Material::Fire as u8 => 3,
                x if x == Material::Steam as u8 => 2,
                x if x == Material::Smoke as u8 => 1,
                x if x == Material::Stardust as u8 => 1,
                _ => 0,
            });

            if (cell.kind == Material::Smoke as u8 && cell.age > 180)
                || (cell.kind == Material::Steam as u8 && cell.age > 150)
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
                x if x == Material::Fire as u8 => {
                    let mut dampened = false;
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 || other.kind == Material::Moonwater as u8 {
                            dampened = true;
                            if self.chance(if other.kind == Material::Moonwater as u8 { 2 } else { 3 }) {
                                next[nidx] = Cell::new(Material::Steam as u8, other.variant, 180);
                            }
                        }
                        if is_flammable(other.kind) && self.chance(burn_chance(other.kind)) {
                            next[nidx] = Cell::new(Material::Fire as u8, other.variant, 220);
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
                    for nidx in neighbors {
                        let other = old[nidx];
                        if other.kind == Material::Water as u8 || other.kind == Material::Moonwater as u8 {
                            cooling += if other.kind == Material::Moonwater as u8 { 50 } else { 24 };
                            if self.chance(3) {
                                next[nidx] = Cell::new(Material::Steam as u8, other.variant, 220);
                            }
                        }
                        if is_flammable(other.kind) && self.chance(3) {
                            next[nidx] = Cell::new(Material::Fire as u8, other.variant, 240);
                        }
                        if other.kind == Material::Ice as u8 {
                            next[nidx] = Cell::new(Material::Water as u8, other.variant, 40);
                        }
                    }
                    if cooling > 0 {
                        next[idx].energy = next[idx].energy.saturating_sub(cooling);
                        if next[idx].energy < 90 && self.chance(3) {
                            next[idx] = Cell::new(Material::Stone as u8, cell.variant, 0);
                        }
                    }
                }
                x if x == Material::Stardust as u8 => {
                    for nidx in neighbors {
                        let other = old[nidx];
                        if (other.kind == Material::Seed as u8 || other.kind == Material::Moss as u8)
                            && self.chance(16)
                        {
                            next[nidx].energy = next[nidx].energy.saturating_add(24).min(255);
                        }
                    }
                }
                x if x == Material::Ice as u8 => {
                    if neighbors.iter().any(|&nidx| is_hot(old[nidx].kind)) {
                        next[idx] = Cell::new(Material::Water as u8, cell.variant, 70);
                    }
                }
                x if x == Material::Oil as u8 => {
                    if neighbors.iter().any(|&nidx| is_hot(old[nidx].kind)) {
                        next[idx] = Cell::new(Material::Fire as u8, cell.variant, 240);
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
            if (below.kind == Material::Soil as u8
                || below.kind == Material::Moss as u8
                || below.kind == Material::Moonwater as u8)
                && (cell.energy > 40 || self.chance(80))
            {
                next[idx] = Cell::new(Material::Moss as u8, cell.variant, 90);
            }
        }
    }

    fn update_moss(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
        let (x, y) = self.xy(idx);
        if !(cell.energy > 70 || self.chance(110)) {
            return;
        }
        for nidx in self.neighbor_indices(x, y) {
            let other = old[nidx];
            if (other.kind == Material::Soil as u8 || other.kind == Material::Wood as u8)
                && self.chance(6)
            {
                next[nidx] = Cell::new(Material::Moss as u8, other.variant, 70);
                return;
            }
        }
    }

    fn update_fungus(&mut self, idx: usize, _cell: Cell, old: &[Cell], next: &mut [Cell]) {
        let (x, y) = self.xy(idx);
        if !self.chance(95) {
            return;
        }
        for nidx in self.neighbor_indices(x, y) {
            let other = old[nidx];
            if (other.kind == Material::Wood as u8
                || other.kind == Material::Moss as u8
                || other.kind == Material::Soil as u8)
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

    fn update_meteor(&mut self, idx: usize, cell: Cell, old: &[Cell], next: &mut [Cell]) {
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
            if old[nidx].is_empty() && self.chance(3) {
                next[nidx] = Cell::new(Material::Fire as u8, cell.variant, 190);
            } else if is_flammable(old[nidx].kind) {
                next[nidx] = Cell::new(Material::Fire as u8, old[nidx].variant, 230);
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
        next[target] = cell;
        true
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
        x if x == Material::Seed as u8 => 50,
        x if x == Material::Moss as u8 => 70,
        x if x == Material::Fungus as u8 => 70,
        _ => 0,
    }
}

fn is_hot(kind: u8) -> bool {
    kind == Material::Fire as u8 || kind == Material::Lava as u8 || kind == Material::Meteor as u8
}

fn is_flammable(kind: u8) -> bool {
    kind == Material::Wood as u8
        || kind == Material::Moss as u8
        || kind == Material::Seed as u8
        || kind == Material::Fungus as u8
        || kind == Material::Oil as u8
}

fn burn_chance(kind: u8) -> u32 {
    match kind {
        x if x == Material::Oil as u8 => 2,
        x if x == Material::Fungus as u8 => 5,
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

    #[test]
    fn sand_falls() {
        let mut u = Universe::new(16, 16, 7);
        u.paint(8, 2, 1, Material::Sand as u8);
        u.tick();
        assert_eq!(kind_at(&u, 8, 3), Material::Sand as u8);
    }

    #[test]
    fn water_spreads_when_blocked() {
        let mut u = Universe::new(16, 16, 7);
        for x in 0..16 {
            u.paint(x, 10, 1, Material::Stone as u8);
        }
        u.paint(8, 9, 1, Material::Water as u8);
        u.tick();
        assert!(
            kind_at(&u, 7, 9) == Material::Water as u8
                || kind_at(&u, 9, 9) == Material::Water as u8
        );
    }

    #[test]
    fn water_fire_creates_steam_glow_instead_of_instant_delete() {
        let mut u = Universe::new(16, 16, 7);
        u.paint(8, 8, 1, Material::Fire as u8);
        u.paint(8, 7, 1, Material::Water as u8);
        for _ in 0..8 {
            u.tick();
        }
        assert!(u.cells.iter().any(|c| c.kind == Material::Steam as u8));
    }

    #[test]
    fn lava_cools_near_moonwater() {
        let mut u = Universe::new(16, 16, 7);
        u.paint(8, 8, 1, Material::Lava as u8);
        u.paint(9, 8, 1, Material::Moonwater as u8);
        for _ in 0..24 {
            u.tick();
        }
        assert!(u.cells.iter().any(|c| c.kind == Material::Stone as u8));
    }

    #[test]
    fn same_seed_and_inputs_are_deterministic() {
        let mut a = Universe::new(24, 18, 42);
        let mut b = Universe::new(24, 18, 42);
        for u in [&mut a, &mut b] {
            u.paint(10, 2, 2, Material::Sand as u8);
            u.paint(12, 3, 2, Material::Water as u8);
            u.paint(7, 12, 2, Material::Fire as u8);
            for _ in 0..40 {
                u.tick();
            }
        }
        assert_eq!(a.cells, b.cells);
    }
}
