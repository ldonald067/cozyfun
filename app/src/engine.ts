import { CELL_FLAG, CELL_FLAG_MASK, CELL_STRIDE, MATERIAL } from "./materials";

export type SandboxEngine = {
  source: "wasm" | "js";
  width(): number;
  height(): number;
  tickCount(): number;
  tick(): void;
  /** One step of the between-sessions slow world. Never called during play. */
  slowStep(): void;
  clear(): void;
  paint(x: number, y: number, radius: number, material: number, density?: number): void;
  getCellBytes(): Uint8Array;
  loadCellBytes(bytes: Uint8Array): boolean;
  dispose(): void;
};

type WasmModule = {
  memory: WebAssembly.Memory;
  universe_new(width: number, height: number, seed: number): number;
  universe_free(ptr: number): void;
  universe_width(ptr: number): number;
  universe_height(ptr: number): number;
  universe_tick_count(ptr: number): number;
  universe_tick(ptr: number): void;
  universe_slow_step(ptr: number): void;
  universe_clear(ptr: number): void;
  universe_paint(ptr: number, x: number, y: number, radius: number, material: number, density: number): void;
  universe_cells_ptr(ptr: number): number;
  universe_cells_byte_len(ptr: number): number;
  universe_load_cells(ptr: number, dataPtr: number, dataLen: number): number;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
};

// wasmUrl is passed in rather than derived here: this module is compiled to CommonJS by the
// parity harness, where `import.meta.env.BASE_URL` is a compile error, so the app layer
// resolves the deploy base and hands the URL down. It is required on purpose — defaulting it
// to the domain root would fail OPEN under a subpath deploy, and this particular failure is
// invisible: a 404 here does not throw, it quietly drops the sandbox to the JS engine.
export async function createEngine(
  width: number,
  height: number,
  seed: number,
  wasmUrl: string
): Promise<SandboxEngine> {
  const wasm = await loadRawWasm(wasmUrl);
  if (wasm) {
    return new WasmSandboxEngine(wasm, width, height, seed);
  }
  return new JsSandboxEngine(width, height, seed);
}

export function createFallbackEngine(width: number, height: number, seed: number): SandboxEngine {
  return new JsSandboxEngine(width, height, seed);
}

async function loadRawWasm(wasmUrl: string): Promise<WasmModule | null> {
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) return null;
    const { instance } = await WebAssembly.instantiateStreaming(response, {});
    return instance.exports as unknown as WasmModule;
  } catch {
    return null;
  }
}

class WasmSandboxEngine implements SandboxEngine {
  readonly source = "wasm" as const;
  private ptr: number;

  constructor(private readonly wasm: WasmModule, width: number, height: number, seed: number) {
    this.ptr = wasm.universe_new(width, height, seed);
  }

  width() {
    return this.wasm.universe_width(this.ptr);
  }

  height() {
    return this.wasm.universe_height(this.ptr);
  }

  tickCount() {
    return this.wasm.universe_tick_count(this.ptr);
  }

  tick() {
    this.wasm.universe_tick(this.ptr);
  }

  slowStep() {
    this.wasm.universe_slow_step(this.ptr);
  }

  clear() {
    this.wasm.universe_clear(this.ptr);
  }

  paint(x: number, y: number, radius: number, material: number, density = 100) {
    this.wasm.universe_paint(this.ptr, x, y, radius, material, density);
  }

  getCellBytes() {
    const ptr = this.wasm.universe_cells_ptr(this.ptr);
    const len = this.wasm.universe_cells_byte_len(this.ptr);
    return new Uint8Array(this.wasm.memory.buffer, ptr, len).slice();
  }

  loadCellBytes(bytes: Uint8Array) {
    const ptr = this.wasm.alloc(bytes.byteLength);
    new Uint8Array(this.wasm.memory.buffer, ptr, bytes.byteLength).set(bytes);
    const loaded = this.wasm.universe_load_cells(this.ptr, ptr, bytes.byteLength) === 1;
    this.wasm.dealloc(ptr, bytes.byteLength);
    return loaded;
  }

  dispose() {
    if (this.ptr === 0) return;
    this.wasm.universe_free(this.ptr);
    this.ptr = 0;
  }
}

class JsSandboxEngine implements SandboxEngine {
  readonly source = "js" as const;
  private readonly cells: Uint8Array;
  private ticks = 0;
  private rng: number;

  constructor(
    private readonly w: number,
    private readonly h: number,
    seed: number
  ) {
    this.cells = new Uint8Array(w * h * CELL_STRIDE);
    this.rng = seed || 1;
  }

  width() {
    return this.w;
  }

  height() {
    return this.h;
  }

  tickCount() {
    return this.ticks;
  }

  clear() {
    this.cells.fill(0);
    this.ticks = 0;
  }

  paint(x: number, y: number, radius: number, material: number, density = 100) {
    const r = Math.max(1, radius | 0);
    const clamped = Math.min(100, Math.max(1, density | 0));
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const px = x + dx;
        const py = y + dy;
        if (!this.inBounds(px, py)) continue;
        if (clamped < 100 && this.rand() % 100 >= clamped) continue;
        const kind = Math.min(material, MATERIAL.Spark);
        this.writeCell(this.index(px, py), kind, this.variant(px, py, kind), startEnergy(kind), 0);
      }
    }
  }

  tick() {
    this.ticks++;
    // Match the Rust sim's per-tick RNG perturbation so identical seeds stay in lockstep.
    this.rng = (this.rng + 0x9e3779b9) | 0;
    const old = this.cells.slice();
    const next = this.cells.slice();
    this.ageAndDecay(next);
    this.react(old, next);

    for (let y = this.h - 1; y >= 0; y--) {
      const xs = this.ticks % 2 === 0 ? range(0, this.w) : range(this.w - 1, -1);
      for (const x of xs) {
        const idx = this.index(x, y);
        const kind = old[idx];
        const cell = old.slice(idx, idx + CELL_STRIDE);
        if (kind === MATERIAL.Sand) this.sand(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Soil) this.soil(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Stone) this.stone(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) this.liquid(idx, x, y, cell, old, next, 1);
        if (kind === MATERIAL.Oil) this.oil(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Lava) this.liquid(idx, x, y, cell, old, next, 2);
        if (kind === MATERIAL.Stardust) this.stardust(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Pollen) this.pollen(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Meteor) this.meteor(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Rocket && readU16(cell, 4) === 0) this.powder(idx, x, y, cell, old, next);
      }
    }

    for (let y = 0; y < this.h; y++) {
      const xs = this.ticks % 2 === 0 ? range(this.w - 1, -1) : range(0, this.w);
      for (const x of xs) {
        const idx = this.index(x, y);
        const kind = old[idx];
        const cell = old.slice(idx, idx + CELL_STRIDE);
        if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) this.gas(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Fire) this.fire(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Rocket && readU16(cell, 4) > 0) this.rocket(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Spark) this.spark(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Seed) this.seed(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Stem) this.stem(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Flower) this.flower(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Moss) this.moss(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Fungus) this.fungus(x, y, old, next);
      }
    }

    this.cells.set(next);
  }

  /**
   * One step of the slow world — the changes a terrarium makes while nobody is
   * watching. Mirrors `Universe::slow_step` in `sim/src/lib.rs`, which carries the
   * design rationale; the ORDER of the `chance()` rolls here has to match it cell
   * for cell or the two engines desynchronise permanently.
   */
  slowStep() {
    const old = this.cells.slice();
    const next = this.cells.slice();

    for (let cellIndex = 0; cellIndex < this.w * this.h; cellIndex++) {
      const idx = cellIndex * CELL_STRIDE;
      const kind = old[idx];
      const flags = readU16(old, idx + 6);

      // The hearth goes back to the ground: cold char that is not under water
      // crumbles into soil.
      if (kind === MATERIAL.Ember) {
        if (
          readU16(old, idx + 4) < COLD_CHAR_ENERGY &&
          !(flags & CELL_FLAG.Wet) &&
          this.chance(SLOW_CHAR_SETTLES)
        ) {
          writeCellBytes(next, idx, MATERIAL.Soil, old[idx + 1], 0, 0, 0);
        }
        continue;
      }

      // A spent seed head sows itself clear of its own shadow. "Spent" is age plus an
      // empty budget, not the absence of petals — see the sim for the measurement
      // that ruled out a bare-crown check.
      if (
        kind === MATERIAL.Flower &&
        flags & CELL_FLAG.Rooted &&
        readU16(old, idx + 2) > PETAL_SHED_AGE &&
        readU16(old, idx + 4) < POLLEN_RESERVE &&
        this.chance(SLOW_SEED_SCATTERS)
      ) {
        const site = this.scatterSite(
          cellIndex % this.w,
          Math.floor(cellIndex / this.w),
          old[idx + 1],
          old,
          next
        );
        if (site >= 0) {
          const below = site + this.w * CELL_STRIDE;
          const groundFlags = readU16(old, below + 6);
          const groundEnergy = readU16(old, below + 4);
          const damp = Boolean(groundFlags & CELL_FLAG.Wet) || groundEnergy > SOIL_DAMP_ENERGY;
          // The seed works its way down to ground: a watered bed is solid moss within
          // seconds and moss does not root a seed, so the landing displaces that one
          // patch of carpet back to the soil under it, moisture and all.
          if (old[below] === MATERIAL.Moss) {
            writeCellBytes(
              next,
              below,
              MATERIAL.Soil,
              old[below + 1],
              groundEnergy,
              0,
              groundFlags & (CELL_FLAG.Wet | CELL_FLAG.Cosmic)
            );
          }
          writeCellBytes(
            next,
            site,
            MATERIAL.Seed,
            old[idx + 1],
            0,
            0,
            (flags & CELL_FLAG.Cosmic) | (damp ? CELL_FLAG.Wet : 0)
          );
        }
      }
    }

    this.cells.set(next);
  }

  /** Open air resting on soil or moss, searched outward past PLANT_SPACING. */
  private scatterSite(x: number, y: number, variant: number, old: Uint8Array, next: Uint8Array) {
    const start = variant % SCATTER_OFFSETS.length;
    for (let step = 0; step < SCATTER_OFFSETS.length; step++) {
      const nx = x + SCATTER_OFFSETS[(start + step) % SCATTER_OFFSETS.length];
      if (!this.inBounds(nx, y)) continue;
      const limit = Math.min(y + SCATTER_REACH, this.h - 1);
      for (let ny = y; ny < limit; ny++) {
        if (ny < 0) continue;
        const site = this.index(nx, ny);
        const ground = old[this.index(nx, ny + 1)];
        if (
          old[site] === MATERIAL.Empty &&
          next[site] === MATERIAL.Empty &&
          (ground === MATERIAL.Soil || ground === MATERIAL.Moss)
        ) {
          return site;
        }
      }
    }
    return -1;
  }

  getCellBytes() {
    return this.cells.slice();
  }

  loadCellBytes(bytes: Uint8Array) {
    if (bytes.byteLength !== this.cells.byteLength) return false;
    const sanitized = bytes.slice();
    for (let idx = 0; idx < sanitized.byteLength; idx += CELL_STRIDE) {
      const kind = Math.min(sanitized[idx], MATERIAL.Spark);
      if (kind === MATERIAL.Empty) {
        sanitized.fill(0, idx, idx + CELL_STRIDE);
        continue;
      }
      sanitized[idx] = kind;
      sanitized[idx + 1] &= 7;
      writeU16(sanitized, idx + 4, Math.min(readU16(sanitized, idx + 4), 255));
      writeU16(sanitized, idx + 6, readU16(sanitized, idx + 6) & CELL_FLAG_MASK);
    }
    this.cells.set(sanitized);
    return true;
  }

  dispose() {}

  private index(x: number, y: number) {
    return (y * this.w + x) * CELL_STRIDE;
  }

  private inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  private variant(x: number, y: number, material: number) {
    // Mirror the Rust variant_for hash exactly (wrapping u32 math) so both engines
    // assign the same visual variant, which also feeds behavior via `variant & 3`.
    const mix = (Math.imul(x, 73856093) + Math.imul(y, 19349663) + Math.imul(material, 83492791) + this.rng) >>> 0;
    return mix % 8;
  }

  private rand() {
    let x = this.rng | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x || 1;
    return this.rng >>> 0;
  }

  private chance(n: number) {
    return this.rand() % n === 0;
  }

  private writeCell(idx: number, kind: number, variant = 0, energy = 0, age = 0, flags = 0) {
    this.cells[idx] = kind;
    this.cells[idx + 1] = variant;
    writeU16(this.cells, idx + 2, age);
    writeU16(this.cells, idx + 4, energy);
    writeU16(this.cells, idx + 6, flags);
  }

  private ageAndDecay(next: Uint8Array) {
    for (let idx = 0; idx < next.length; idx += CELL_STRIDE) {
      const kind = next[idx];
      if (!kind) continue;
      const age = readU16(next, idx + 2) + 1;
      const drain =
        kind === MATERIAL.Fire
          ? 3
          : kind === MATERIAL.Ember || kind === MATERIAL.Steam || kind === MATERIAL.Pollen || kind === MATERIAL.Water
            ? 2
            : kind === MATERIAL.Smoke ||
                kind === MATERIAL.Stardust ||
                kind === MATERIAL.Soil ||
                kind === MATERIAL.Seed ||
                kind === MATERIAL.Moss ||
                kind === MATERIAL.Fungus ||
                kind === MATERIAL.Flower
              ? 1
              : 0;
      const flags = readU16(next, idx + 6);
      // A bloom's whole arc ticks down on BLOOM_CLOCK, so its budget can stay a small
      // number the save format already accepts while still lasting long enough to
      // watch it open, dust the air with pollen, and finally wilt.
      // The phase comes from the cell's OWN age, not the global tick count. Cell age is
      // saved with the scene; the tick count is not restored on load, so a global phase
      // would silently shift a loaded bloom's arc. The environmental drains ride the same
      // slow clock deliberately — see the note in sim/src/lib.rs.
      const slowed = kind === MATERIAL.Flower && age % BLOOM_CLOCK !== 0;
      const energy = slowed
        ? readU16(next, idx + 4)
        : Math.max(0, readU16(next, idx + 4) - drain - (flags & CELL_FLAG.Frozen ? 1 : 0) - (flags & CELL_FLAG.Wet && absorbent(kind) ? 1 : 0));
      writeU16(next, idx + 2, age);
      writeU16(next, idx + 4, energy);
      if (energy === 0) {
        writeU16(next, idx + 6, flags & CELL_FLAG.Frozen ? thawedFlags(kind, flags) : flags & ~(CELL_FLAG.Wet | CELL_FLAG.Cosmic));
      }
      if (kind === MATERIAL.Steam && age > 150) {
        if ((next[idx + 1] & 3) === 0) {
          writeCellBytes(next, idx, MATERIAL.Water, next[idx + 1], 26);
        } else {
          next.fill(0, idx, idx + CELL_STRIDE);
        }
      } else if (
        (kind === MATERIAL.Smoke && age > 180) ||
        (kind === MATERIAL.Pollen && age > 140) ||
        (kind === MATERIAL.Spark && age > 60) ||
        (kind === MATERIAL.Fire && age > 90 && energy < 24)
      ) {
        next.fill(0, idx, idx + CELL_STRIDE);
      }
    }
  }

  private react(old: Uint8Array, next: Uint8Array) {
    for (let idx = 0; idx < old.length; idx += CELL_STRIDE) {
      const kind = old[idx];
      if (!kind) continue;
      const x = (idx / CELL_STRIDE) % this.w;
      const y = Math.floor(idx / CELL_STRIDE / this.w);
      if (kind === MATERIAL.Wellspring) {
        this.wellspring(idx, x, y, old, next);
        continue;
      }
      if (kind === MATERIAL.Ice) {
        this.ice(idx, x, y, old, next);
        continue;
      }
      if (kind === MATERIAL.Oil) {
        this.oilReact(idx, x, y, old, next);
        continue;
      }
      if (kind === MATERIAL.Steam) {
        this.steamReact(idx, x, y, old, next);
        continue;
      }
      if (kind === MATERIAL.Wall) {
        this.wallReact(idx, x, y, old, next);
        continue;
      }
      // Simmering water vents a wisp before reacting with neighbors, matching the Rust arm order.
      if (kind === MATERIAL.Water && readU16(old, idx + 4) > 150 && this.chance(20)) {
        this.emitVaporFrom(idx, old, next, MATERIAL.Steam, old[idx + 1], 120);
        writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - 40));
      }
      let fireDampened = false;
      let lavaCooling = 0;
      // Mirrors `water_can_move` in sim/src/lib.rs: erosion needs flow, and water with an
      // open neighbour is the cheapest honest proxy for it the reaction pass has. Computed
      // once per cell, before the loop, exactly as the Rust arm does.
      const waterCanMove =
        (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) &&
        this.neighbors(x, y).some((nidx) => old[nidx] === MATERIAL.Empty);
      for (const nidx of this.neighbors(x, y)) {
        const other = old[nidx];
        if (kind === MATERIAL.Fire) {
          if (other === MATERIAL.Water) {
            fireDampened = true;
            if (next[nidx] === MATERIAL.Water) {
              const heated = Math.min(255, readU16(next, nidx + 4) + 30);
              writeU16(next, nidx + 4, heated);
              if (heated > 200) {
                writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 180);
              }
            }
          }
          if (other === MATERIAL.Moonwater) {
            fireDampened = true;
            if (this.chance(2)) {
              writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 180);
            }
          }
          if (heatSoftens(next, nidx, old, 42)) {
            if (readU16(old, nidx + 6) & CELL_FLAG.Wet) {
              this.emitVaporFrom(nidx, old, next, MATERIAL.Steam, old[nidx + 1], 150);
            }
            continue;
          }
          if (other === MATERIAL.Sand && readU16(old, idx + 4) > 190 && this.chance(7)) {
            writeCellBytes(next, nidx, MATERIAL.Glass, old[nidx + 1]);
            continue;
          }
          if (flammable(other) && this.chance(burnChance(other))) {
            writeIgnitedCell(next, nidx, other, old[nidx + 1], 220);
          }
        }
        if (kind === MATERIAL.Lava) {
          if (other === MATERIAL.Water || other === MATERIAL.Moonwater) {
            lavaCooling += other === MATERIAL.Moonwater ? 50 : 72;
            if (other === MATERIAL.Water || this.chance(3)) {
              writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 220);
            }
          }
          if (heatSoftens(next, nidx, old, 72)) {
            if (readU16(old, nidx + 6) & CELL_FLAG.Wet) {
              this.emitVaporFrom(nidx, old, next, MATERIAL.Steam, old[nidx + 1], 180);
            }
            continue;
          }
          if (other === MATERIAL.Sand && this.chance(4)) {
            writeCellBytes(next, nidx, MATERIAL.Glass, old[nidx + 1]);
            continue;
          }
          if (flammable(other) && this.chance(3)) {
            writeIgnitedCell(next, nidx, other, old[nidx + 1], 240);
          }
        }
        if (kind === MATERIAL.Stardust && (other === MATERIAL.Seed || other === MATERIAL.Moss || other === MATERIAL.Flower) && this.chance(12)) {
          writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + 24));
          writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Cosmic);
        }
        if (kind === MATERIAL.Stardust && other === MATERIAL.Water) {
          writeCellBytes(next, nidx, MATERIAL.Moonwater, old[nidx + 1], 130, 0, CELL_FLAG.Cosmic);
        }
        if (kind === MATERIAL.Stardust && (other === MATERIAL.Soil || other === MATERIAL.Fungus) && this.chance(14)) {
          writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + 18));
          writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Cosmic);
        }
        if (kind === MATERIAL.Stardust && other === MATERIAL.Fire && this.chance(2)) {
          writeCellBytes(next, nidx, MATERIAL.Stardust, old[nidx + 1], 140, 0, CELL_FLAG.Cosmic);
        }
        if (kind === MATERIAL.Stardust && (other === MATERIAL.Stone || other === MATERIAL.Wall) && this.chance(12)) {
          writeU16(next, nidx + 4, Math.max(36, readU16(next, nidx + 4)));
          writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Cosmic);
        }
        if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) {
          const vigor = kind === MATERIAL.Moonwater ? 96 : 56;
          if (kind === MATERIAL.Water && other === MATERIAL.Ice && readU16(old, idx + 4) > 120 && this.chance(2)) {
            writeCellBytes(next, nidx, MATERIAL.Water, old[nidx + 1], 40);
            continue;
          }
          if (kind === MATERIAL.Moonwater && other === MATERIAL.Oil && this.chance(4)) {
            writeCellBytes(next, nidx, MATERIAL.Stardust, old[nidx + 1], 150);
            continue;
          }
          if (kind !== MATERIAL.Moonwater && other === MATERIAL.Lava) {
            writeCellBytes(next, idx, MATERIAL.Steam, old[idx + 1], 220);
            const lavaEnergy = Math.max(0, readU16(next, nidx + 4) - 72);
            writeU16(next, nidx + 4, lavaEnergy);
            writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Scorched);
            if (lavaEnergy < 120) {
              writeCellBytes(next, nidx, MATERIAL.Stone, old[nidx + 1], 0, 0, CELL_FLAG.Scorched);
            }
            continue;
          }
          if (kind !== MATERIAL.Moonwater && other === MATERIAL.Meteor) {
            writeCellBytes(next, idx, MATERIAL.Steam, old[idx + 1], 230);
            writeCellBytes(next, nidx, MATERIAL.Stone, old[nidx + 1], 0, 0, CELL_FLAG.Scorched);
            continue;
          }
          if (other === MATERIAL.Ember && readU16(old, nidx + 4) < 30 && this.chance(12)) {
            next.fill(0, nidx, nidx + CELL_STRIDE);
            continue;
          }
          if (kind !== MATERIAL.Moonwater && hydratable(other) && this.neighborHasKind(old, nidx, MATERIAL.Oil)) {
            writeU16(next, nidx + 4, Math.max(0, readU16(next, nidx + 4) - 16));
            writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Wet);
            continue;
          }
          if (other === MATERIAL.Seed) {
            const seedVigor = kind === MATERIAL.Moonwater ? 130 : 90;
            const energy = Math.min(255, readU16(next, nidx + 4) + seedVigor);
            writeU16(next, nidx + 4, energy);
            writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0)) & ~CELL_FLAG.Scorched);
          }
          if (other === MATERIAL.Moss || other === MATERIAL.Fungus || other === MATERIAL.Flower) {
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + Math.floor(vigor / 2)));
            writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0)) & ~CELL_FLAG.Scorched);
          }
          if (other === MATERIAL.Soil) {
            if (readU16(old, nidx + 4) === 0 && readU16(old, nidx + 2) > 40) {
              // Vents from any open face, not straight up: venting upward only meant the mist
        // could never appear when a player waters from above, which is the only gesture
        // anybody makes. Mirrors sim/src/lib.rs.
        const ncell = Math.floor(nidx / CELL_STRIDE);
        const vent = this.openFace(ncell % this.w, Math.floor(ncell / this.w), 0, old, next);
        if (vent >= 0) writeCellBytes(next, vent, MATERIAL.Steam, old[nidx + 1], 90);
            }
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + vigor * 2));
            writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0)) & ~CELL_FLAG.Scorched);
          }
          if (other === MATERIAL.Sand) {
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + vigor));
            writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Wet);
          }
          if (other === MATERIAL.Wood) {
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + vigor));
            const nextFlags = readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0);
            writeU16(next, nidx + 6, kind === MATERIAL.Moonwater ? nextFlags & ~CELL_FLAG.Scorched : nextFlags);
          }
          if (other === MATERIAL.Stone) {
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + Math.floor(vigor / 2)));
            writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0));
            if (readU16(next, nidx + 6) & CELL_FLAG.Scorched && this.chance(5)) {
              writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Scorched);
            }
            // `next[idx] === kind` is the ownership check mirrored from sim/src/lib.rs: an
            // earlier neighbour may already have consumed this water cell (quenching lava
            // writes steam into it and continues), and erosion must not overwrite that.
            if (next[nidx] === MATERIAL.Stone && next[idx] === kind && readU16(next, nidx + 4) >= 250 && waterCanMove && this.chance(2000)) {
              // Mirrors the erosion arm in sim/src/lib.rs: the water TAKES the grain, so the
              // grain lands where the water was and the water advances into the rock. Leaving
              // it in place built a sand skin that shielded the stone and stopped erosion for
              // good. The `break` is load-bearing for parity as much as for correctness — this
              // cell is sand now and must not go on hydrating its remaining neighbours, and the
              // rolls that would make are rolls the Rust side does not make either.
              writeCellBytes(next, nidx, kind, old[idx + 1], readU16(old, idx + 4), 0, readU16(old, idx + 6));
              writeCellBytes(next, idx, MATERIAL.Sand, old[nidx + 1], 60, 0,
                CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0));
              break;
            }
          }
          if (other === MATERIAL.Wall) {
            const wallVigor = Math.max(8, Math.floor(vigor / (kind === MATERIAL.Moonwater ? 3 : 5)));
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + wallVigor));
            writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0));
            if (readU16(next, nidx + 6) & CELL_FLAG.Scorched && this.chance(5)) {
              writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Scorched);
            }
          }
        }
        if (kind === MATERIAL.Ember) {
          if (other === MATERIAL.Water || other === MATERIAL.Moonwater) {
            writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - 120));
            writeU16(next, idx + 6, readU16(next, idx + 6) | CELL_FLAG.Wet);
            if (readU16(old, idx + 4) > 40 && this.chance(6)) {
              writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 170);
            }
            continue;
          }
          const emberEnergy = readU16(old, idx + 4);
          if (emberEnergy < 60 && (other === MATERIAL.Fire || other === MATERIAL.Lava || other === MATERIAL.Meteor) && next[idx] === MATERIAL.Ember) {
            writeU16(next, idx + 4, 210);
            writeU16(next, idx + 6, readU16(next, idx + 6) & ~CELL_FLAG.Wet);
            continue;
          }
          if (emberEnergy > 90 && flammable(other) && this.chance(Math.floor((burnChance(other) * 3) / 2))) {
            writeIgnitedCell(next, nidx, other, old[nidx + 1], 210);
          }
        }
        if (kind === MATERIAL.Smoke && sootable(other)) {
          const otherFlags = readU16(old, nidx + 6);
          const smokeEnergy = readU16(old, idx + 4);
          const smokeAge = readU16(old, idx + 2);
          if (!(otherFlags & (CELL_FLAG.Wet | CELL_FLAG.Frozen)) && (smokeEnergy > 70 || smokeAge > 16)) {
            writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Scorched);
          }
        }
      }
      if (kind === MATERIAL.Ember && readU16(old, idx + 4) > 90 && this.chance(9)) {
        this.emitVaporFrom(idx, old, next, MATERIAL.Smoke, old[idx + 1], 80);
      }
      if (kind === MATERIAL.Fire && fireDampened) {
        const energy = Math.max(0, readU16(next, idx + 4) - 32);
        writeU16(next, idx + 4, energy);
        if (energy < 18 && readU16(old, idx + 2) > 8) {
          writeCellBytes(next, idx, MATERIAL.Steam, old[idx + 1], 130);
        }
      }
      if (kind === MATERIAL.Lava && lavaCooling > 0 && next[idx] === MATERIAL.Lava) {
        const energy = Math.max(0, readU16(next, idx + 4) - lavaCooling);
        writeU16(next, idx + 4, energy);
        if (energy < 90 && this.chance(3)) {
          writeCellBytes(next, idx, MATERIAL.Stone, old[idx + 1]);
        }
      } else if (kind === MATERIAL.Lava && next[idx] === MATERIAL.Lava) {
        const hotNeighbors = this.neighbors(x, y).filter((nidx) =>
          old[nidx] === MATERIAL.Fire || old[nidx] === MATERIAL.Lava || old[nidx] === MATERIAL.Meteor
        ).length;
        if (hotNeighbors < 3 && this.chance(8)) {
          const energy = Math.max(0, readU16(next, idx + 4) - 4);
          writeU16(next, idx + 4, energy);
          if (energy < 60 && this.chance(4)) {
            writeCellBytes(next, idx, MATERIAL.Stone, old[idx + 1]);
          }
        }
      }
    }
  }

  private sand(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const wet = Boolean(readU16(old, idx + 6) & CELL_FLAG.Wet) || readU16(old, idx + 4) > 35;
    // Gate only wet-sand movement on odd ticks (sluggishness 2); the WET-flag
    // reapplication below still runs every tick, matching Rust's update_sand.
    if (wet) {
      if (this.ticks % 2 === 0) this.powder(idx, x, y, cell, old, next);
    } else if (this.move(idx, x, y + 1, cell, old, next)) {
      this.move(this.index(x, y + 1), x, y + 2, cell, old, next);
    } else {
      for (const [dx, dy] of this.ticks % 2 === 0 ? [[-1, 1], [1, 1]] : [[1, 1], [-1, 1]]) {
        if (this.move(idx, x + dx, y + dy, cell, old, next)) break;
      }
    }
    const energy = readU16(next, idx + 4);
    if (wet && next[idx] === MATERIAL.Sand && energy > 0) writeU16(next, idx + 6, readU16(next, idx + 6) | CELL_FLAG.Wet);
    else if (next[idx] === MATERIAL.Sand && energy === 0) writeU16(next, idx + 6, readU16(next, idx + 6) & ~CELL_FLAG.Wet);
  }

  private powder(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    for (const [dx, dy] of this.ticks % 2 === 0 ? [[0, 1], [-1, 1], [1, 1]] : [[0, 1], [1, 1], [-1, 1]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  // Unsupported stone drops straight down one cell per tick — no diagonal slip, so
  // pillars, floors, and shelves hold and only true overhangs fall. Wall never moves.
  private stone(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    this.move(idx, x, y + 1, cell, old, next);
  }

  private soil(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (this.ticks % 2 === 0) this.powder(idx, x, y, cell, old, next);
    const flags = readU16(next, idx + 6);
    if (flags & CELL_FLAG.Frozen) return;
    // Soil that a rooted seed is standing on is spoken for. Without this a watered bed
    // greens over long before anything can germinate — the seed needs Soil directly
    // beneath it, and moss was reliably winning that race, which is why a watered garden
    // used to end as a moss carpet and never as a flower.
    const claimed = this.soilIsClaimed(x, y, old);
    if (!claimed && next[idx] === MATERIAL.Soil && readU16(next, idx + 4) > 140 && readU16(cell, 2) > 10 && this.chance(flags & CELL_FLAG.Cosmic ? 7 : 12)) {
      writeCellBytes(next, idx, MATERIAL.Moss, cell[1], 90, 0, CELL_FLAG.Wet);
    }
  }

  // Ground a living seed is standing on, which moss may not take — neither by the soil
  // greening on its own nor by moss spreading in from a neighbour. The claim is held only
  // while the seed is still viable: a seed that dries out releases the ground, so the
  // soil -> moss -> fungus -> soil loop still closes on an abandoned bed.
  private soilIsClaimed(x: number, y: number, old: Uint8Array) {
    if (y <= 0) return false;
    const above = this.index(x, y - 1);
    if (old[above] !== MATERIAL.Seed) return false;
    const aboveFlags = readU16(old, above + 6);
    return Boolean(aboveFlags & CELL_FLAG.Rooted) && (Boolean(aboveFlags & CELL_FLAG.Wet) || readU16(old, above + 4) > 40);
  }

  private liquid(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array, slow: number) {
    if (this.ticks % slow !== 0) return;
    const side = this.ticks % 2 === 0 ? 1 : -1;
    for (const [dx, dy] of [[0, 1], [side, 1], [-side, 1], [side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private oil(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (this.ticks % 2 !== 0) return;
    if (y > 0) {
      const above = this.index(x, y - 1);
      if (waterLike(old[above]) && next[above] === old[above] && next[idx] === MATERIAL.Oil) {
        const oilCell = next.slice(idx, idx + CELL_STRIDE);
        const waterCell = next.slice(above, above + CELL_STRIDE);
        next.set(oilCell, above);
        next.set(waterCell, idx);
        return;
      }
    }

    const below = this.inBounds(x, y + 1) ? old[this.index(x, y + 1)] : MATERIAL.Wall;
    const supported = below !== MATERIAL.Empty && below !== MATERIAL.Smoke && below !== MATERIAL.Steam;
    const side = this.ticks % 2 === 0 ? 1 : -1;
    const dirs = supported
      ? [[side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0], [0, 1], [side, 1], [-side, 1]]
      : [[0, 1], [side, 1], [-side, 1], [side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0]];
    for (const [dx, dy] of dirs) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private gas(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const side = this.ticks % 2 === 0 ? 1 : -1;
    for (const [dx, dy] of [[0, -1], [side, -1], [-side, -1], [side, 0], [-side, 0]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next, false)) return;
    }
  }

  private fire(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Fire) return;
    if (this.chance(7) && y > 0) {
      const target = this.index(x, y - 1);
      if (old[target] === MATERIAL.Empty && next[target] === MATERIAL.Empty) {
        writeCellBytes(next, target, MATERIAL.Smoke, cell[1], 80);
      }
    }
    if (this.chance(18)) {
      writeCellBytes(next, idx, MATERIAL.Smoke, cell[1], 70);
    }
  }

  private pollen(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Pollen) return;
    if (this.inBounds(x, y + 1)) {
      const below = this.index(x, y + 1);
      const belowWet = Boolean(readU16(old, below + 6) & CELL_FLAG.Wet) || readU16(old, below + 4) > 60;
      if (old[below] === MATERIAL.Soil && belowWet && this.chance(8)) {
        // Cosmic pollen roots into a cosmic seed, so moonlit gardens breed true.
        writeCellBytes(next, idx, MATERIAL.Seed, cell[1], 40, 0, readU16(cell, 6) & CELL_FLAG.Cosmic);
        return;
      }
    }
    if (this.ticks % 3 !== 0) return;
    const supported = !this.inBounds(x, y + 1) || old[this.index(x, y + 1)] !== MATERIAL.Empty;
    if (supported && !this.chance(3)) return;
    const side = this.chance(2) ? 1 : -1;
    for (const [dx, dy] of [[0, 1], [side, 0], [side, 1], [-side, 0]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private stardust(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (this.ticks % 2 === 0) return;
    const side = this.chance(2) ? 1 : -1;
    for (const [dx, dy] of [[0, 1], [side, 1], [-side, 0], [side, -1]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private meteor(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Meteor) return;
    if (this.move(idx, x, y + 1, cell, old, next)) return this.leaveMeteorTrail(idx, next);
    if (this.move(idx, x + (this.ticks % 2 === 0 ? 1 : -1), y + 1, cell, old, next)) return this.leaveMeteorTrail(idx, next);
    if (this.chance(2)) writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 180);
    else writeCellBytes(next, idx, MATERIAL.Stone, cell[1]);
    for (const nidx of this.neighbors(x, y)) {
      if (old[nidx] === MATERIAL.Moonwater) {
        writeCellBytes(next, nidx, MATERIAL.Stardust, old[nidx + 1], 190);
      } else if (old[nidx] === MATERIAL.Empty && this.chance(3)) {
        writeCellBytes(next, nidx, MATERIAL.Fire, cell[1], 190);
      } else if (heatSoftens(next, nidx, old, 72)) continue;
      else if (old[nidx] === MATERIAL.Sand && this.chance(2)) {
        writeCellBytes(next, nidx, MATERIAL.Glass, old[nidx + 1]);
      } else if (old[nidx] === MATERIAL.Glass) {
        // The crack runs one pane-width further than the strike. Converting only the cells
        // the meteor physically touched turned a smashed pane into a two-cell chip.
        writeCellBytes(next, nidx, MATERIAL.Sand, old[nidx + 1]);
        const ncell = Math.floor(nidx / CELL_STRIDE);
        for (const cracked of this.neighbors(ncell % this.w, Math.floor(ncell / this.w))) {
          if (old[cracked] === MATERIAL.Glass) writeCellBytes(next, cracked, MATERIAL.Sand, old[cracked + 1]);
        }
      } else if (flammable(old[nidx])) {
        writeIgnitedCell(next, nidx, old[nidx], old[nidx + 1], 230);
      }
    }
  }

  // A meteor occasionally sheds a downward spark from the cell it just left, so a
  // shower streaks a glittering tail. Trail sparks age out fast and hiss over water.
  private leaveMeteorTrail(vacated: number, next: Uint8Array) {
    if (next[vacated] === MATERIAL.Empty && this.chance(3)) {
      writeCellBytes(next, vacated, MATERIAL.Spark, SPARK_DOWN, 90);
    }
  }

  private wellspring(idx: number, x: number, y: number, old: Uint8Array, next: Uint8Array) {
    const neighbors = this.neighbors(x, y);
    const chilled = neighbors.some((nidx) => old[nidx] === MATERIAL.Ice);
    const energy = readU16(old, idx + 4);
    if (energy === 0 || chilled) {
      // An unattuned wellspring drinks the identity of the first source material
      // that touches it, consuming that cell. A spring stilled by ice can be
      // re-taught the same way, so a first-touch misattunement is fixable — remove
      // the ice and it pours the newly drunk material.
      for (const nidx of neighbors) {
        const other = old[nidx];
        if (wellspringSource(other) && next[idx] === MATERIAL.Wellspring) {
          writeU16(next, idx + 4, other);
          if (next[nidx] === other) next.fill(0, nidx, nidx + CELL_STRIDE);
          break;
        }
      }
    } else if (wellspringSource(energy & 255)) {
      // Attuned: pour the remembered material, feeding THROUGH its own body rather than
      // only into a bare face. See `apply_reactions` in sim/src/lib.rs for the
      // measurement behind this and for why there is no output cap.
      const source = energy & 255;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        let target = -1;
        for (let step = 1; step <= WELLSPRING_REACH; step++) {
          const nx = x + dx * step;
          const ny = y + dy * step;
          if (!this.inBounds(nx, ny)) break;
          const nidx = this.index(nx, ny);
          if (old[nidx] === MATERIAL.Empty && next[nidx] === MATERIAL.Empty) { target = nidx; break; }
          if (old[nidx] !== source) break;
        }
        // The roll happens only once a target exists, matching the sim, or the two RNG
        // streams part company.
        if (target >= 0 && this.chance(WELLSPRING_POUR)) {
          writeCellBytes(next, target, source, this.rand() & 3, startEnergy(source));
        }
      }
    }
  }

  // Hearth masonry: a wall beside a live flame radiates gentle warmth, thawing
  // and drying its nook. It only clears flags — a hearth never ignites anything
  // or creates cells.
  private wallReact(idx: number, x: number, y: number, old: Uint8Array, next: Uint8Array) {
    if (readU16(old, idx + 6) & CELL_FLAG.Frozen) return;
    const neighbors = this.neighbors(x, y);
    // Warmth CONDUCTS along the masonry: a brick is warm if it touches the flame, or if it
    // touches a brick that does. Mirrors sim/src/lib.rs exactly, including that thawing
    // still needs strict contact, and including the manual loops — this runs for every wall
    // cell every tick and a scene can be mostly wall. It was a 5x5 proximity scan until an
    // adversarial review pointed out that a lone brick across an air gap warmed its
    // neighbour exactly like a chimney breast.
    const isFlame = (nidx: number) => {
      const other = old[nidx];
      return (
        HOT_MATERIALS.includes(other as (typeof HOT_MATERIALS)[number]) ||
        (other === MATERIAL.Ember && readU16(old, nidx + 4) > 90)
      );
    };
    const touchingFlame = neighbors.some(isFlame);
    let hearth = touchingFlame;
    if (!hearth) {
      conduct: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const bx = x + dx;
          const by = y + dy;
          if (!this.inBounds(bx, by)) continue;
          if (old[this.index(bx, by)] !== MATERIAL.Wall) continue;
          for (let fy = -1; fy <= 1; fy++) {
            for (let fx = -1; fx <= 1; fx++) {
              const nx = bx + fx;
              const ny = by + fy;
              if (!this.inBounds(nx, ny)) continue;
              if (isFlame(this.index(nx, ny))) {
                hearth = true;
                break conduct;
              }
            }
          }
        }
      }
    }
    if (!hearth) return;
    for (const nidx of neighbors) {
      const otherFlags = readU16(old, nidx + 6);
      if (otherFlags & CELL_FLAG.Frozen && touchingFlame && this.chance(6)) {
        writeU16(next, nidx + 6, thawedFlags(old[nidx], readU16(next, nidx + 6)));
      } else if (otherFlags & CELL_FLAG.Wet && this.chance(10)) {
        writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Wet);
      }
    }
  }

  private steamReact(idx: number, x: number, y: number, old: Uint8Array, next: Uint8Array) {
    const neighbors = this.neighbors(x, y);
    const iceNearby = neighbors.some((nidx) => old[nidx] === MATERIAL.Ice);
    // One freeze roll for the whole cell, matching Rust (not one per ice neighbor).
    if (iceNearby && this.chance(5)) {
      writeCellBytes(next, idx, MATERIAL.Ice, old[idx + 1], 70);
    }
    const hotNearby = neighbors.some((nidx) => HOT_MATERIALS.includes(old[nidx] as (typeof HOT_MATERIALS)[number]));
    if (!iceNearby && !hotNearby) {
      for (const nidx of neighbors) {
        const other = old[nidx];
        if (other === MATERIAL.Stone || other === MATERIAL.Wall) {
          const condensation = other === MATERIAL.Stone ? 58 : 26;
          writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + condensation));
          writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet) & ~CELL_FLAG.Scorched);
          if (other === MATERIAL.Stone && this.chance(4)) {
            writeCellBytes(next, idx, MATERIAL.Water, old[idx + 1], 50);
          }
        } else if (other === MATERIAL.Glass) {
          // Glass dew: steam fogs the pane and beads back into water, so a
          // sealed glass terrarium keeps its moisture cycling.
          writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + 46));
          writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Wet);
          if (this.chance(4)) {
            writeCellBytes(next, idx, MATERIAL.Water, old[idx + 1], 50);
          }
        }
      }
    }
  }

  private oilReact(idx: number, x: number, y: number, old: Uint8Array, next: Uint8Array) {
    const neighbors = this.neighbors(x, y);
    // Whole-arm ignition: any hot neighbor sets the whole slick alight before it dehydrates anything.
    if (neighbors.some((nidx) => HOT_MATERIALS.includes(old[nidx] as (typeof HOT_MATERIALS)[number]))) {
      writeCellBytes(next, idx, MATERIAL.Fire, old[idx + 1], 240);
      return;
    }
    for (const nidx of neighbors) {
      if (hydratable(old[nidx])) {
        writeU16(next, nidx + 4, Math.max(0, readU16(next, nidx + 4) - 28));
        writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Wet);
      }
    }
  }

  private ice(idx: number, x: number, y: number, old: Uint8Array, next: Uint8Array) {
    const neighbors = this.neighbors(x, y);
    // Whole-arm melt: any hot neighbor thaws the ice before it can freeze anything.
    if (neighbors.some((nidx) => HOT_MATERIALS.includes(old[nidx] as (typeof HOT_MATERIALS)[number]))) {
      writeCellBytes(next, idx, MATERIAL.Water, old[idx + 1], 70);
      return;
    }
    for (const nidx of neighbors) {
      const other = old[nidx];
      if (other === MATERIAL.Water && readU16(old, nidx + 4) < 120 && this.chance(5)) {
        writeCellBytes(next, nidx, MATERIAL.Ice, old[nidx + 1], 90);
      } else if (other === MATERIAL.Moonwater && this.chance(10)) {
        writeCellBytes(next, nidx, MATERIAL.Ice, old[nidx + 1], 110, 0, CELL_FLAG.Cosmic);
      } else if (other === MATERIAL.Steam && this.chance(4)) {
        writeCellBytes(next, nidx, MATERIAL.Ice, old[nidx + 1], 70);
      } else if (
        (other === MATERIAL.Stone || other === MATERIAL.Wall) &&
        ((readU16(old, nidx + 6) & CELL_FLAG.Wet) || readU16(old, nidx + 4) > 40)
      ) {
        writeU16(next, nidx + 4, Math.max(88, readU16(next, nidx + 4)));
        writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Frozen) & ~CELL_FLAG.Scorched);
      } else if (freezable(other) && this.chance(4)) {
        writeU16(next, nidx + 4, Math.max(72, readU16(next, nidx + 4)));
        writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Frozen);
      }
    }
  }

  private rocket(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Rocket || readU16(next, idx + 4) === 0) return;
    writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - 10));
    if (readU16(next, idx + 4) <= 96 || y === 0) {
      this.burstRocket(idx, x, y, cell, old, next);
      return;
    }
    const sway = this.chance(3) ? (this.ticks % 2 === 0 ? 1 : -1) : 0;
    let moved = false;
    let nx = x;
    for (const [dx, dy] of [[sway, -1], [0, -1], [-sway, -1]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) {
        moved = true;
        nx = x + dx;
        break;
      }
    }
    if (!moved) {
      this.burstRocket(idx, x, y, cell, old, next);
      return;
    }
    // A second straight-up step per tick gives the ascent a real whoosh.
    const climbed = this.index(nx, y - 1);
    this.move(climbed, nx, y - 2, cell, old, next);
    if ((next[idx] as number) === MATERIAL.Empty) {
      if (this.chance(3)) writeCellBytes(next, idx, MATERIAL.Spark, SPARK_DOWN, 110);
      else if (this.chance(2)) writeCellBytes(next, idx, MATERIAL.Smoke, cell[1], 70);
    }
  }

  private burstRocket(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 200);
    for (let dir = 0; dir < SPARK_DIRS.length; dir++) {
      const [dx, dy] = SPARK_DIRS[dir];
      for (let dist = 1; dist <= 2; dist++) {
        const nx = x + dx * dist;
        const ny = y + dy * dist;
        if (!this.inBounds(nx, ny)) continue;
        const nidx = this.index(nx, ny);
        const other = old[nidx];
        if (other === MATERIAL.Empty && next[nidx] === MATERIAL.Empty) {
          writeCellBytes(next, nidx, MATERIAL.Spark, dir, dist === 1 ? 235 : 215);
        } else if (dist === 1 && flammable(other) && this.chance(3)) {
          writeIgnitedCell(next, nidx, other, old[nidx + 1], 200);
        }
      }
    }
  }

  private spark(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Spark) return;
    writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - 10));
    if (readU16(next, idx + 4) < 30) {
      if (this.chance(6)) writeCellBytes(next, idx, MATERIAL.Stardust, cell[1], 120);
      else next.fill(0, idx, idx + CELL_STRIDE);
      return;
    }
    // A spark meeting water hisses out into a wisp of steam — fireworks sizzle
    // over a pond instead of raining fire on it.
    if (this.neighbors(x, y).some((nidx) => waterLike(old[nidx]))) {
      writeCellBytes(next, idx, MATERIAL.Steam, cell[1], 60);
      return;
    }
    const age = readU16(cell, 2);
    if (age < 6) {
      // Shell expansion: the spark keeps flying along its birth direction.
      const [dx, dy] = SPARK_DIRS[cell[1] & 7];
      if (!this.move(idx, x + dx, y + dy, cell, old, next)) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.inBounds(nx, ny)) {
          const nidx = this.index(nx, ny);
          // Sparks landing on rocket powder light its fuse.
          if (old[nidx] === MATERIAL.Rocket && readU16(old, nidx + 4) === 0 && next[nidx] === MATERIAL.Rocket) {
            writeU16(next, nidx + 4, 220);
          }
        }
        writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - 30));
      }
    } else if (this.ticks % 2 === 0) {
      // Droop: spent sparks drift down, wobbling as they fade.
      const side = this.chance(2) ? 1 : -1;
      for (const [dx, dy] of [[0, 1], [side, 1]]) {
        if (this.move(idx, x + dx, y + dy, cell, old, next)) break;
      }
    }
  }

  // Emits a vapor cell above the source when that cell is open, returning the
  // emitted index (or -1) so callers can stamp extra state (e.g. cosmic pollen).
  private emitVaporFrom(sourceIdx: number, old: Uint8Array, next: Uint8Array, vaporKind: number, variant: number, energy: number) {
    const cellNumber = sourceIdx / CELL_STRIDE;
    const x = cellNumber % this.w;
    const y = Math.floor(cellNumber / this.w);
    if (y <= 0) return -1;
    const above = this.index(x, y - 1);
    if (old[above] === MATERIAL.Empty && next[above] === MATERIAL.Empty) {
      writeCellBytes(next, above, vaporKind, variant, energy);
      return above;
    }
    return -1;
  }

  private seed(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (!this.inBounds(x, y + 1)) return;
    const below = old[this.index(x, y + 1)];
    if (below === MATERIAL.Empty) {
      this.powder(idx, x, y, cell, old, next);
      return;
    }
    // Frozen is read from next (this tick's freezing counts); everything else reads
    // the old cell state so same-tick hydration does not root or germinate early.
    if (readU16(next, idx + 6) & CELL_FLAG.Frozen) return;
    const neighborKinds = this.neighbors(x, y).map((nidx) => old[nidx]);
    const flags = readU16(cell, 6);
    const age = readU16(cell, 2);
    const energy = readU16(cell, 4);
    const wet = Boolean(flags & CELL_FLAG.Wet) || energy > 70;
    const cosmic = Boolean(flags & CELL_FLAG.Cosmic) || neighborKinds.includes(MATERIAL.Moonwater) || neighborKinds.includes(MATERIAL.Stardust);

    if (wet && energy > 80 && neighborKinds.includes(MATERIAL.Fungus) && this.chance(10)) {
      writeCellBytes(next, idx, MATERIAL.Fungus, cell[1], 90, 0, CELL_FLAG.Wet);
      return;
    }

    // Water soaks down through a seed bed. Without this a painted bed never germinates
    // at all: the seeds touching soil are buried at the bottom and never meet the water,
    // while the seeds the water does reach are sitting on other seeds. Measured on a
    // hand-painted planter, that combination produced zero rooted seeds in 3600 ticks.
    const aboveIdx = y > 0 ? this.index(x, y - 1) : -1;
    if (aboveIdx >= 0 && old[aboveIdx] === MATERIAL.Seed) {
      const aboveEnergy = readU16(old, aboveIdx + 4);
      if (aboveEnergy > SEED_SOAK_LOSS) {
        const soaked = aboveEnergy - SEED_SOAK_LOSS;
        if (soaked > readU16(next, idx + 4)) writeU16(next, idx + 4, soaked);
      }
    }

    // A wet seed is grounded either by soil directly under it or by another grounded
    // seed, so a bed is rooted as a whole and sprouts from its surface.
    const grounded =
      below === MATERIAL.Soil ||
      (below === MATERIAL.Seed && Boolean(readU16(old, this.index(x, y + 1) + 6) & CELL_FLAG.Rooted));
    if (grounded && wet) {
      writeU16(next, idx + 6, readU16(next, idx + 6) | CELL_FLAG.Rooted);
      // Only a seed with open sky above sprouts — a buried one would germinate into a
      // stalk that can never climb, wasting the bed's whole surface.
      const openAbove = aboveIdx >= 0 && isGrowable(old[aboveIdx]);
      if (openAbove && age > 30 && energy > 70 && !this.plantNearby(x, y, old, next) && this.chance(cosmic ? 4 : 8)) {
        // Each segment costs 55, so this is a 4-to-7 cell stalk. The old 130 base could
        // bloom after a single segment, leaving a head almost on the ground with no room
        // for leaves.
        writeCellBytes(next, idx, MATERIAL.Stem, cell[1], 200 + (cell[1] & 3) * 55 + (cosmic ? 55 : 0), 0, CELL_FLAG.Rooted | (cosmic ? CELL_FLAG.Cosmic : 0));
        return;
      }
    }

    if (below === MATERIAL.Moss && wet && energy > 110 && this.chance(12)) {
      writeCellBytes(next, idx, MATERIAL.Moss, cell[1], 100, 0, CELL_FLAG.Wet);
    }
  }

  private stem(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Stem || readU16(next, idx + 6) & CELL_FLAG.Frozen) return;
    if (!this.stemHasFooting(x, y, old)) {
      this.powder(idx, x, y, cell, old, next);
      return;
    }
    const energy = readU16(old, idx + 4);
    if (energy <= 20 || y === 0) return;
    const above = this.index(x, y - 1);
    if (!isGrowable(old[above]) || !isGrowable(next[above]) || !this.chance(4)) return;
    const cosmic = Boolean(readU16(old, idx + 6) & CELL_FLAG.Cosmic);
    if (energy > 75) {
      writeCellBytes(next, above, MATERIAL.Stem, cell[1], energy - 55, 0, cosmic ? CELL_FLAG.Cosmic : 0);
      this.unfurlLeaf(x, y, cell, old, next);
    } else {
      writeCellBytes(
        next,
        above,
        MATERIAL.Flower,
        cell[1],
        cosmic ? BLOOM_ENERGY_COSMIC : BLOOM_ENERGY,
        0,
        CELL_FLAG.Rooted | (cosmic ? CELL_FLAG.Cosmic : 0)
      );
    }
    writeU16(next, idx + 4, 20);
  }

  // A stalk stands on its own base, or clings to a neighbouring stalk cell that has its
  // own footing. Leaves ride entirely on the second rule; cutting the stalk takes both
  // away at once, so a severed plant still collapses whole.
  private stemHasFooting(x: number, y: number, old: Uint8Array) {
    if (y + 1 >= this.h) return true;
    if (old[this.index(x, y + 1)] !== MATERIAL.Empty) return true;
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (!this.inBounds(nx, y)) continue;
      const side = old[this.index(nx, y)];
      if (side !== MATERIAL.Stem && side !== MATERIAL.Flower) continue;
      if (old[this.index(nx, y + 1)] !== MATERIAL.Empty) return true;
    }
    return false;
  }

  // Leaves unfurl in alternating pairs as the stalk climbs, so a grown plant reads as a
  // plant instead of a bare pole. Placement is a pure function of height — no RNG — so it
  // cannot desynchronise the two engines. Leaf energy stays under the growth threshold,
  // so a leaf never climbs a stalk of its own.
  private unfurlLeaf(x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    // Every other segment, alternating sides. Spacing them any further apart left the
    // shortest stalks — the common case — with no leaves at all.
    if (y % 2 !== 0) return;
    const lx = Math.floor(y / 2) % 2 === 0 ? x - 1 : x + 1;
    if (!this.inBounds(lx, y)) return;
    const leaf = this.index(lx, y);
    if (!isGrowable(old[leaf]) || !isGrowable(next[leaf])) return;
    writeCellBytes(next, leaf, MATERIAL.Stem, cell[1], 12, 0, readU16(cell, 6) & CELL_FLAG.Cosmic);
  }

  // First empty cell around idx, scanning the canonical faces from `start`. Rotating the
  // start spreads pollen off a bloom's whole rim rather than always puffing from the same
  // corner. Returns -1 when the cell is walled in.
  private openFace(x: number, y: number, start: number, old: Uint8Array, next: Uint8Array) {
    for (let step = 0; step < FACE_OFFSETS.length; step++) {
      const [dx, dy] = FACE_OFFSETS[(start + step) % FACE_OFFSETS.length];
      const nx = x + dx;
      const ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;
      const nidx = this.index(nx, ny);
      if (old[nidx] === MATERIAL.Empty && next[nidx] === MATERIAL.Empty) return nidx;
    }
    return -1;
  }

  // Next unfilled cell of this plant's bloom silhouette, in the shape's own order.
  private nextPetalSite(x: number, y: number, variant: number, old: Uint8Array, next: Uint8Array) {
    for (const [dx, dy] of BLOOM_SHAPES[variant & 7]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;
      const site = this.index(nx, ny);
      // A petal may open through the head's own drifting pollen: a mote that lands on top
      // of a bloom is wedged (the bloom is under it) and would otherwise hold the last
      // petal site until it aged out, leaving big heads one petal short at the crest.
      if (petalSiteFree(old[site]) && petalSiteFree(next[site])) return site;
    }
    return -1;
  }

  // Whether another plant already stands within PLANT_SPACING. Checks next as well as old
  // so seeds germinating in the same tick still space themselves out.
  private plantNearby(x: number, y: number, old: Uint8Array, next: Uint8Array) {
    for (let dy = -PLANT_SPACING; dy <= PLANT_SPACING; dy++) {
      for (let dx = -PLANT_SPACING; dx <= PLANT_SPACING; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const site = this.index(nx, ny);
        for (const kind of [old[site], next[site]]) {
          if (kind === MATERIAL.Stem || kind === MATERIAL.Flower) return true;
        }
      }
    }
    return false;
  }

  private flower(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Flower || readU16(next, idx + 6) & CELL_FLAG.Frozen) return;
    const age = readU16(cell, 2);
    const energy = readU16(cell, 4);
    const flags = readU16(cell, 6);
    const cosmic = Boolean(flags & CELL_FLAG.Cosmic);

    // The crown is the one cell the stalk produced. It spends the top of its budget
    // unfurling petals into the open air around it, one per beat, so a bloom is watched
    // opening rather than appearing whole. Petals are never rooted, so only the crown
    // ever opens and a head cannot run away.
    if (flags & CELL_FLAG.Rooted && energy > CROWN_RESERVE && age > 12 && this.chance(cosmic ? 8 : 12)) {
      const petal = this.nextPetalSite(x, y, cell[1], old, next);
      if (petal >= 0) {
        writeCellBytes(next, petal, MATERIAL.Flower, cell[1], PETAL_ENERGY, 0, cosmic ? CELL_FLAG.Cosmic : 0);
        writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - PETAL_COST));
      }
    }

    // Pollen leaves from any open face. Straight up alone would silence a finished bloom
    // outright, because the crown is walled in by its own petals.
    if (energy > POLLEN_RESERVE && age > 24 && this.chance(cosmic ? 90 : 200)) {
      const face = this.openFace(x, y, (cell[1] + age) % FACE_OFFSETS.length, old, next);
      if (face >= 0) {
        writeCellBytes(next, face, MATERIAL.Pollen, cell[1], 150, 0, cosmic ? CELL_FLAG.Cosmic : 0);
        writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - POLLEN_COST));
      }
    }

    // Wilt: a spent petal finally lets go and drifts off as a mote, so an old bloom
    // visibly thins instead of standing perfect forever, and what it sheds can still seed
    // the soil under it. The crown stays behind as a seed head — which is why a finished
    // garden is not a field of bare poles.
    if (!(flags & CELL_FLAG.Rooted) && age > PETAL_SHED_AGE && energy < POLLEN_RESERVE && this.chance(400)) {
      writeCellBytes(next, idx, MATERIAL.Pollen, cell[1], 150, 0, flags & CELL_FLAG.Cosmic);
    }
  }

  private moss(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (readU16(next, idx + 6) & CELL_FLAG.Frozen) return;
    // Growth reads the old cell state; only the frozen guard above reflects this tick.
    const oldEnergy = readU16(cell, 4);
    const oldFlags = readU16(cell, 6);
    if (oldFlags & CELL_FLAG.Wet && oldEnergy > 90 && this.inBounds(x, y + 1)) {
      const below = this.index(x, y + 1);
      if (old[below] === MATERIAL.Empty && next[below] === MATERIAL.Empty && this.chance(60)) {
        writeCellBytes(next, below, MATERIAL.Water, cell[1], 26);
        writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - 24));
      }
    }
    const wet = Boolean(oldFlags & CELL_FLAG.Wet) || oldEnergy > 70;
    if (!(wet || this.chance(120))) return;
    let spreadsLeft = oldEnergy > 150 ? 2 : 1;
    for (const nidx of this.neighbors(x, y)) {
      const other = old[nidx];
      const dampSubstrate = Boolean(readU16(old, nidx + 6) & CELL_FLAG.Wet) || readU16(old, nidx + 4) > 40;
      // Ground under a living seed is off limits to moss spreading in as well as to soil
      // greening on its own. Guarding only the latter left the claim porous: a bed still
      // carpeted over, just from the side instead.
      const ncell = Math.floor(nidx / CELL_STRIDE);
      const softSubstrate =
        (other === MATERIAL.Soil && !this.soilIsClaimed(ncell % this.w, Math.floor(ncell / this.w), old)) ||
        other === MATERIAL.Wood;
      // Spreading moss inherits the substrate's variant, not the parent moss's.
      let spread = false;
      if (softSubstrate && (oldEnergy > 110 || dampSubstrate || this.chance(8))) {
        writeCellBytes(next, nidx, MATERIAL.Moss, old[nidx + 1], 70, 0, wet ? CELL_FLAG.Wet : 0);
        spread = true;
      } else if (other === MATERIAL.Stone && dampSubstrate && (oldEnergy > 120 || this.chance(10))) {
        writeCellBytes(next, nidx, MATERIAL.Moss, old[nidx + 1], 58, 0, CELL_FLAG.Wet);
        spread = true;
      } else if (other === MATERIAL.Wall && dampSubstrate && oldEnergy > 150) {
        writeCellBytes(next, nidx, MATERIAL.Moss, old[nidx + 1], 48, 0, CELL_FLAG.Wet);
        spread = true;
      }
      if (spread) {
        spreadsLeft -= 1;
        if (spreadsLeft === 0) return;
      }
    }
  }

  private fungus(x: number, y: number, old: Uint8Array, next: Uint8Array) {
    const idx = this.index(x, y);
    if (readU16(next, idx + 6) & CELL_FLAG.Frozen) return;
    if (!this.chance(48)) return;
    let hasFood = false;
    for (const nidx of this.neighbors(x, y)) {
      const other = old[nidx];
      const edible = other === MATERIAL.Seed || other === MATERIAL.Moss || other === MATERIAL.Wood || other === MATERIAL.Soil;
      if (edible && !(readU16(old, nidx + 6) & CELL_FLAG.Frozen)) hasFood = true;
      const otherWet = Boolean(readU16(old, nidx + 6) & CELL_FLAG.Wet) || readU16(old, nidx + 4) > 70;
      if (other === MATERIAL.Seed && !(readU16(old, nidx + 6) & CELL_FLAG.Frozen) && otherWet && this.chance(4)) {
        writeCellBytes(next, nidx, MATERIAL.Fungus, old[nidx + 1], 90, 0, CELL_FLAG.Wet);
        return;
      }
      if (other === MATERIAL.Moss && !(readU16(old, nidx + 6) & CELL_FLAG.Frozen) && (otherWet || readU16(old, nidx + 2) > 120) && this.chance(7)) {
        writeCellBytes(next, nidx, MATERIAL.Fungus, old[nidx + 1], 80, 0, readU16(old, nidx + 6) & CELL_FLAG.Wet);
        return;
      }
      if ((other === MATERIAL.Wood || other === MATERIAL.Moss || other === MATERIAL.Soil) && !(readU16(old, nidx + 6) & CELL_FLAG.Frozen) && this.chance(5)) {
        // Fairy ring: a cosmic-charged fungus occasionally sows a stardust grain
        // where it would digest, spending its charge on the gift instead of spreading.
        if (readU16(old, idx + 6) & CELL_FLAG.Cosmic && this.chance(10)) {
          writeCellBytes(next, nidx, MATERIAL.Stardust, old[nidx + 1], 180);
          writeU16(next, idx + 6, readU16(next, idx + 6) & ~CELL_FLAG.Cosmic);
        } else {
          writeCellBytes(next, nidx, MATERIAL.Fungus, old[nidx + 1], 80);
        }
        return;
      }
    }
    // Starvation collapse: an old fungus with nothing left to digest crumbles back
    // into fresh soil, closing the soil -> moss -> fungus -> soil loop.
    if (readU16(old, idx + 2) > 600 && !hasFood && this.chance(20)) {
      writeCellBytes(next, idx, MATERIAL.Soil, old[idx + 1], 0);
    }
  }

  private move(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array, canSinkThroughGas = true) {
    if (!this.inBounds(x, y)) return false;
    const movingCell = next.slice(idx, idx + CELL_STRIDE);
    if (movingCell[0] !== cell[0]) return false;
    const target = this.index(x, y);
    const canMove =
      old[target] === MATERIAL.Empty ||
      next[target] === MATERIAL.Empty ||
      (canSinkThroughGas && (old[target] === MATERIAL.Smoke || old[target] === MATERIAL.Steam));
    if (!canMove) return false;
    next.fill(0, idx, idx + CELL_STRIDE);
    next.set(movingCell, target);
    return true;
  }

  private neighbors(x: number, y: number) {
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (this.inBounds(x + dx, y + dy)) out.push(this.index(x + dx, y + dy));
      }
    }
    return out;
  }

  private neighborHasKind(cells: Uint8Array, idx: number, kind: number) {
    const cellNumber = idx / CELL_STRIDE;
    const x = cellNumber % this.w;
    const y = Math.floor(cellNumber / this.w);
    return this.neighbors(x, y).some((nidx) => cells[nidx] === kind);
  }

}

const HOT_MATERIALS = [MATERIAL.Fire, MATERIAL.Lava, MATERIAL.Meteor] as const;

// Eight compass directions; a spark's variant indexes its birth direction.
const SPARK_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1]
];

// SPARK_DIRS index for straight down, used by trail sparks shed in flight.
const SPARK_DOWN = 4;

// Canonical face order around a cell, walked identically by petal opening and pollen
// release in both engines. Cardinals first, then diagonals: a head that fills its sides
// before its corners is rounder at every stage of opening, and the renderer can tell a
// crown from a bud as soon as the first petal lands. Opening diagonally first left a
// one-petal bloom rendering as two separate buds.
const FACE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1]
];

// Moisture lost per cell as water soaks down through a seed bed.
const SEED_SOAK_LOSS = 20;

// One open face in this many pours per tick, and how far a spring pushes through its
// own material to reach open space. Mirrors sim/src/lib.rs, which carries the
// measurement these come from.
const WELLSPRING_POUR = 7;
const WELLSPRING_REACH = 4;

// Below this an ember has gone out: inert char that only relights from outside.
const COLD_CHAR_ENERGY = 30;
// Stored moisture that still counts as damp ground under a seed.
const SOIL_DAMP_ENERGY = 60;

// The slow world. Odds are per slow step — roughly "a few hours away" — and every
// scatter offset clears PLANT_SPACING so a sown seed lands where it can grow.
// See `Universe::slow_step` in sim/src/lib.rs for the reasoning behind the tuning.
const SLOW_CHAR_SETTLES = 6;
const SLOW_SEED_SCATTERS = 3;
const SCATTER_OFFSETS: readonly number[] = [6, -6, 9, -9, 12, -12, 15, -15];
const SCATTER_REACH = 14;

// A seed will not germinate this close to an existing plant. Without it every cell of a
// watered bed sprouts and the meadow becomes one solid wall of blooms with no silhouette.
// Five keeps a clear gap between heads now that a head is itself five cells across.
const PLANT_SPACING = 5;

// Per-plant bloom silhouettes, chosen by the plant's variant exactly as its hue is.
// Offsets are relative to the crown, which always sits directly above the stalk tip, and
// are opened in listed order. Mirrors BLOOM_SHAPES in sim/src/lib.rs.
// One species per plant, chosen by `variant & 7` — the same number that picks its hue in
// the renderer. Petals are listed in opening order and every offset touches one already
// placed. Mirrors BLOOM_SHAPES in sim/src/lib.rs.
const BLOOM_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // 0 Cornflower: a frilled rosette with a notched crest — see sim/src/lib.rs.
  [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-2, 0], [2, 0], [-2, -1], [2, -1], [-1, -2], [1, -2], [-1, 1], [1, 1]],
  // 1 Poppy: a broad bowl whose outer petals droop below the rim.
  [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-2, 0], [2, 0], [-2, 1], [2, 1]],
  // 2 Daisy: the same span opened out into a star, so the gaps do the work.
  [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, -2], [-1, 1], [1, 1]],
  // 3 Sunflower: the biggest head, a full disc under a crown of rays.
  [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-2, 0], [2, 0], [-2, -1], [2, -1], [0, -2], [-1, -2], [1, -2], [-1, 1], [1, 1], [-2, -2], [2, -2], [0, -3]],
  // 4 Tulip: a solid cup under a notched top edge — the notches are the signature.
  [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-2, -1], [2, -1], [-2, -2], [0, -2], [2, -2]],
  // 5 Lavender: a tall checkered spike, three wide and six high.
  [[0, -1], [-1, -2], [1, -2], [0, -3], [-1, -4], [1, -4], [0, -5]],
  // 6 Bluebell: paired bells nodding off a bare central stalk.
  [[0, -1], [0, -2], [-1, -1], [1, -2], [-2, 0], [2, -1]],
  // 7 Forget-me-not: the smallest head, a tight five-petal cluster.
  [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1]]
];

// Growth may push up through standing water as well as through open air. A watered garden
// pools, and requiring bare air meant a bed only ever sprouted around the pond's dry
// margins while its whole middle stayed bare — which is what a player who waters
// generously actually sees.
function petalSiteFree(kind: number) {
  return kind === MATERIAL.Empty || kind === MATERIAL.Pollen;
}

function isGrowable(kind: number) {
  return kind === MATERIAL.Empty || kind === MATERIAL.Water || kind === MATERIAL.Moonwater;
}

// The bloom arc, mirroring sim/src/lib.rs. A flower loses energy once every
// BLOOM_CLOCK ticks rather than every tick, so the open → dust → wilt sequence lasts
// tens of seconds while its budget stays under the 255 the scene-import clamp assumes.
const BLOOM_CLOCK = 8;
const BLOOM_ENERGY = 200;
const BLOOM_ENERGY_COSMIC = 250;
const CROWN_RESERVE = 100;
const PETAL_ENERGY = 150;
const PETAL_COST = 3;
const POLLEN_RESERVE = 40;
const POLLEN_COST = 15;
const PETAL_SHED_AGE = 1200;

function range(start: number, endExclusive: number) {
  const out: number[] = [];
  const step = start < endExclusive ? 1 : -1;
  for (let x = start; step > 0 ? x < endExclusive : x > endExclusive; x += step) out.push(x);
  return out;
}

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function writeU16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 255;
  bytes[offset + 1] = (value >> 8) & 255;
}

function writeIgnitedCell(next: Uint8Array, idx: number, fuelKind: number, variant: number, energy: number) {
  if (fuelKind === MATERIAL.Wood) {
    writeCellBytes(next, idx, MATERIAL.Ember, variant, 230);
  } else if (fuelKind === MATERIAL.Rocket) {
    // Lighting rocket powder starts its fuse (energy > 0) rather than burning it in place.
    writeCellBytes(next, idx, MATERIAL.Rocket, variant, 220);
  } else {
    writeCellBytes(next, idx, MATERIAL.Fire, variant, energy);
  }
}

function writeCellBytes(bytes: Uint8Array, idx: number, kind: number, variant = 0, energy = 0, age = 0, flags = 0) {
  bytes[idx] = kind;
  bytes[idx + 1] = variant;
  writeU16(bytes, idx + 2, age);
  writeU16(bytes, idx + 4, energy);
  writeU16(bytes, idx + 6, flags);
}

function startEnergy(kind: number) {
  if (kind === MATERIAL.Fire) return 240;
  if (kind === MATERIAL.Lava || kind === MATERIAL.Meteor) return 255;
  if (kind === MATERIAL.Smoke) return 90;
  if (kind === MATERIAL.Steam) return 160;
  if (kind === MATERIAL.Stardust) return 190;
  if (kind === MATERIAL.Pollen) return 150;
  if (kind === MATERIAL.Moonwater) return 120;
  if (kind === MATERIAL.Seed) return 50;
  if (kind === MATERIAL.Moss || kind === MATERIAL.Fungus) return 70;
  if (kind === MATERIAL.Flower) return BLOOM_ENERGY;
  return 0;
}

function flammable(kind: number) {
  return kind === MATERIAL.Wood || kind === MATERIAL.Moss || kind === MATERIAL.Seed || kind === MATERIAL.Stem || kind === MATERIAL.Fungus || kind === MATERIAL.Flower || kind === MATERIAL.Oil || kind === MATERIAL.Rocket;
}

function wellspringSource(kind: number) {
  return (
    kind === MATERIAL.Sand ||
    kind === MATERIAL.Water ||
    kind === MATERIAL.Soil ||
    kind === MATERIAL.Fire ||
    kind === MATERIAL.Lava ||
    kind === MATERIAL.Oil ||
    kind === MATERIAL.Seed ||
    kind === MATERIAL.Stardust ||
    kind === MATERIAL.Meteor ||
    kind === MATERIAL.Moonwater ||
    kind === MATERIAL.Rocket
  );
}

function waterLike(kind: number) {
  return kind === MATERIAL.Water || kind === MATERIAL.Moonwater;
}

function absorbent(kind: number) {
  return kind === MATERIAL.Wall || kind === MATERIAL.Sand || kind === MATERIAL.Wood || kind === MATERIAL.Stone || kind === MATERIAL.Glass;
}

function hydratable(kind: number) {
  return (
    kind === MATERIAL.Wall ||
    kind === MATERIAL.Sand ||
    kind === MATERIAL.Soil ||
    kind === MATERIAL.Wood ||
    kind === MATERIAL.Stone ||
    kind === MATERIAL.Moss ||
    kind === MATERIAL.Seed ||
    kind === MATERIAL.Fungus ||
    kind === MATERIAL.Flower
  );
}

function sootable(kind: number) {
  return kind === MATERIAL.Wall || kind === MATERIAL.Stone || kind === MATERIAL.Wood;
}

function freezable(kind: number) {
  return (
    kind === MATERIAL.Wall ||
    kind === MATERIAL.Sand ||
    kind === MATERIAL.Soil ||
    kind === MATERIAL.Stone ||
    kind === MATERIAL.Wood ||
    kind === MATERIAL.Seed ||
    kind === MATERIAL.Stem ||
    kind === MATERIAL.Moss ||
    kind === MATERIAL.Fungus ||
    kind === MATERIAL.Flower ||
    kind === MATERIAL.Oil
  );
}

function scorchable(kind: number) {
  return (
    kind === MATERIAL.Wall ||
    kind === MATERIAL.Sand ||
    kind === MATERIAL.Soil ||
    kind === MATERIAL.Stone ||
    kind === MATERIAL.Wood ||
    kind === MATERIAL.Seed ||
    kind === MATERIAL.Stem ||
    kind === MATERIAL.Moss ||
    kind === MATERIAL.Fungus ||
    kind === MATERIAL.Flower
  );
}

function burnChance(kind: number) {
  if (kind === MATERIAL.Oil) return 2;
  if (kind === MATERIAL.Rocket) return 3;
  if (kind === MATERIAL.Fungus || kind === MATERIAL.Flower) return 5;
  if (kind === MATERIAL.Moss) return 7;
  if (kind === MATERIAL.Seed) return 8;
  return 10;
}

function heatSoftens(next: Uint8Array, idx: number, old: Uint8Array, heat: number) {
  const kind = old[idx];
  if (kind === MATERIAL.Ice) {
    writeCellBytes(next, idx, MATERIAL.Water, old[idx + 1], Math.max(40, heat));
    return true;
  }
  const flags = readU16(old, idx + 6);
  if (!freezable(kind) && !scorchable(kind)) return false;
  if (flags & CELL_FLAG.Frozen) {
    // Two hot rounds should crack a frost-stressed wall: lava's heat 72 crumbles
    // it in two, and fire (heat 42) in three, once the melt heat has accumulated.
    if (kind === MATERIAL.Wall && readU16(next, idx + 4) + heat > 150) {
      writeCellBytes(next, idx, MATERIAL.Stone, old[idx + 1], 40);
      return true;
    }
    writeU16(next, idx + 4, Math.min(255, readU16(next, idx + 4) + heat));
    writeU16(next, idx + 6, thawedFlags(kind, readU16(next, idx + 6)));
    return true;
  }
  if (scorchable(kind) && flags & CELL_FLAG.Wet) {
    writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - heat));
    // Scorch off the accumulated next-state flags, not old, so flags set earlier this tick survive.
    writeU16(next, idx + 6, (readU16(next, idx + 6) & ~CELL_FLAG.Wet) | CELL_FLAG.Scorched);
    return true;
  }
  return false;
}

function thawedFlags(kind: number, flags: number) {
  return (flags & ~CELL_FLAG.Frozen) | (hydratable(kind) ? CELL_FLAG.Wet : 0);
}
