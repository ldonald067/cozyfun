import { CELL_FLAG, CELL_FLAG_MASK, CELL_STRIDE, MATERIAL } from "./materials";

export type SandboxEngine = {
  source: "wasm" | "js";
  width(): number;
  height(): number;
  tickCount(): number;
  tick(): void;
  clear(): void;
  paint(x: number, y: number, radius: number, material: number): void;
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
  universe_clear(ptr: number): void;
  universe_paint(ptr: number, x: number, y: number, radius: number, material: number): void;
  universe_cells_ptr(ptr: number): number;
  universe_cells_byte_len(ptr: number): number;
  universe_load_cells(ptr: number, dataPtr: number, dataLen: number): number;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
};

export async function createEngine(width: number, height: number, seed: number): Promise<SandboxEngine> {
  const wasm = await loadRawWasm();
  if (wasm) {
    return new WasmSandboxEngine(wasm, width, height, seed);
  }
  return new JsSandboxEngine(width, height, seed);
}

export function createFallbackEngine(width: number, height: number, seed: number): SandboxEngine {
  return new JsSandboxEngine(width, height, seed);
}

async function loadRawWasm(): Promise<WasmModule | null> {
  try {
    const response = await fetch("/sim/cozy_sandbox_sim.wasm");
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

  clear() {
    this.wasm.universe_clear(this.ptr);
  }

  paint(x: number, y: number, radius: number, material: number) {
    this.wasm.universe_paint(this.ptr, x, y, radius, material);
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

  paint(x: number, y: number, radius: number, material: number) {
    const r = Math.max(1, radius | 0);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const px = x + dx;
        const py = y + dy;
        if (!this.inBounds(px, py)) continue;
        const kind = Math.min(material, MATERIAL.Glass);
        this.writeCell(this.index(px, py), kind, this.variant(px, py, kind), startEnergy(kind), 0);
      }
    }
  }

  tick() {
    this.ticks++;
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
        if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) this.liquid(idx, x, y, cell, old, next, 1);
        if (kind === MATERIAL.Oil) this.oil(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Lava) this.liquid(idx, x, y, cell, old, next, 4);
        if (kind === MATERIAL.Stardust) this.stardust(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Meteor) this.meteor(idx, x, y, cell, old, next);
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
        if (kind === MATERIAL.Seed) this.seed(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Moss) this.moss(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Fungus) this.fungus(x, y, old, next);
      }
    }

    this.cells.set(next);
  }

  getCellBytes() {
    return this.cells.slice();
  }

  loadCellBytes(bytes: Uint8Array) {
    if (bytes.byteLength !== this.cells.byteLength) return false;
    const sanitized = bytes.slice();
    for (let idx = 0; idx < sanitized.byteLength; idx += CELL_STRIDE) {
      const kind = Math.min(sanitized[idx], MATERIAL.Glass);
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
    return (x * 17 + y * 31 + material * 13 + this.rng) & 7;
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
          : kind === MATERIAL.Steam
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
      const energy = Math.max(0, readU16(next, idx + 4) - drain - (flags & CELL_FLAG.Frozen ? 1 : 0) - (flags & CELL_FLAG.Wet && absorbent(kind) ? 1 : 0));
      writeU16(next, idx + 2, age);
      writeU16(next, idx + 4, energy);
      if (energy === 0) {
        writeU16(next, idx + 6, flags & CELL_FLAG.Frozen ? thawedFlags(kind, flags) : flags & ~(CELL_FLAG.Wet | CELL_FLAG.Cosmic));
      }
      if ((kind === MATERIAL.Smoke && age > 180) || (kind === MATERIAL.Steam && age > 150) || (kind === MATERIAL.Fire && age > 90 && energy < 24)) {
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
      let fireDampened = false;
      let lavaCooling = 0;
      for (const nidx of this.neighbors(x, y)) {
        const other = old[nidx];
        if (kind === MATERIAL.Fire) {
          if (other === MATERIAL.Water || other === MATERIAL.Moonwater) {
            fireDampened = true;
            if (this.chance(other === MATERIAL.Moonwater ? 2 : 3)) {
              writeCellBytes(next, nidx, MATERIAL.Steam, old[nidx + 1], 180);
            }
          }
          if (heatSoftens(next, nidx, old, 42)) {
            if (readU16(old, nidx + 6) & CELL_FLAG.Wet) {
              this.emitVaporFrom(nidx, old, next, MATERIAL.Steam, old[nidx + 1], 150);
            }
            continue;
          }
          if (other === MATERIAL.Sand && readU16(old, idx + 4) > 190 && this.chance(9)) {
            writeCellBytes(next, nidx, MATERIAL.Glass, old[nidx + 1]);
            continue;
          }
          if (flammable(other) && this.chance(burnChance(other))) {
            writeCellBytes(next, nidx, MATERIAL.Fire, old[nidx + 1], 220);
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
          if (other === MATERIAL.Sand && this.chance(6)) {
            writeCellBytes(next, nidx, MATERIAL.Glass, old[nidx + 1]);
            continue;
          }
          if (flammable(other) && this.chance(3)) {
            writeCellBytes(next, nidx, MATERIAL.Fire, old[nidx + 1], 240);
          }
        }
        if (kind === MATERIAL.Ice && (other === MATERIAL.Fire || other === MATERIAL.Lava || other === MATERIAL.Meteor)) {
          writeCellBytes(next, idx, MATERIAL.Water, old[idx + 1], 70);
          continue;
        }
        if (kind === MATERIAL.Ice && other === MATERIAL.Water && this.chance(5)) {
          writeCellBytes(next, nidx, MATERIAL.Ice, old[nidx + 1], 90);
        }
        if (kind === MATERIAL.Ice && other === MATERIAL.Moonwater && this.chance(10)) {
          writeCellBytes(next, nidx, MATERIAL.Ice, old[nidx + 1], 110, 0, CELL_FLAG.Cosmic);
        }
        if (kind === MATERIAL.Ice && other === MATERIAL.Steam && this.chance(4)) {
          writeCellBytes(next, nidx, MATERIAL.Ice, old[nidx + 1], 70);
        }
        if (
          kind === MATERIAL.Ice &&
          (other === MATERIAL.Stone || other === MATERIAL.Wall) &&
          ((readU16(old, nidx + 6) & CELL_FLAG.Wet) || readU16(old, nidx + 4) > 40)
        ) {
          writeU16(next, nidx + 4, Math.max(88, readU16(next, nidx + 4)));
          writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Frozen) & ~CELL_FLAG.Scorched);
        } else if (kind === MATERIAL.Ice && freezable(other) && this.chance(4)) {
          writeU16(next, nidx + 4, Math.max(72, readU16(next, nidx + 4)));
          writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Frozen);
        }
        if (kind === MATERIAL.Steam && other === MATERIAL.Ice && this.chance(5)) {
          writeCellBytes(next, idx, MATERIAL.Ice, old[idx + 1], 70);
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
        if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) {
          const vigor = kind === MATERIAL.Moonwater ? 96 : 56;
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
          }
          if (other === MATERIAL.Wall) {
            const wallVigor = Math.max(8, Math.floor(vigor / (kind === MATERIAL.Moonwater ? 3 : 5)));
            writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + wallVigor));
            writeU16(next, nidx + 6, readU16(next, nidx + 6) | CELL_FLAG.Wet | (kind === MATERIAL.Moonwater ? CELL_FLAG.Cosmic : 0));
          }
        }
        if (kind === MATERIAL.Oil) {
          if (other === MATERIAL.Fire || other === MATERIAL.Lava || other === MATERIAL.Meteor) {
            writeCellBytes(next, idx, MATERIAL.Fire, old[idx + 1], 240);
            continue;
          }
          if (hydratable(other)) {
            writeU16(next, nidx + 4, Math.max(0, readU16(next, nidx + 4) - 28));
            writeU16(next, nidx + 6, readU16(next, nidx + 6) & ~CELL_FLAG.Wet);
          }
        }
        if (
          kind === MATERIAL.Steam &&
          (other === MATERIAL.Stone || other === MATERIAL.Wall) &&
          !this.neighborHasKind(old, idx, MATERIAL.Ice) &&
          !this.neighborHasAnyKind(old, idx, HOT_MATERIALS)
        ) {
          const condensation = other === MATERIAL.Stone ? 58 : 26;
          writeU16(next, nidx + 4, Math.min(255, readU16(next, nidx + 4) + condensation));
          writeU16(next, nidx + 6, (readU16(next, nidx + 6) | CELL_FLAG.Wet) & ~CELL_FLAG.Scorched);
          if (other === MATERIAL.Stone && this.chance(4)) {
            writeCellBytes(next, idx, MATERIAL.Water, old[idx + 1], 50);
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
      }
    }
  }

  private sand(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const wet = Boolean(readU16(old, idx + 6) & CELL_FLAG.Wet) || readU16(old, idx + 4) > 35;
    if (wet && this.ticks % 2 !== 0) return;
    this.powder(idx, x, y, cell, old, next);
    const energy = readU16(next, idx + 4);
    if (wet && next[idx] === MATERIAL.Sand && energy > 0) writeU16(next, idx + 6, readU16(next, idx + 6) | CELL_FLAG.Wet);
    else if (next[idx] === MATERIAL.Sand && energy === 0) writeU16(next, idx + 6, readU16(next, idx + 6) & ~CELL_FLAG.Wet);
  }

  private powder(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    for (const [dx, dy] of this.ticks % 2 === 0 ? [[0, 1], [-1, 1], [1, 1]] : [[0, 1], [1, 1], [-1, 1]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private soil(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (this.ticks % 2 === 0) this.powder(idx, x, y, cell, old, next);
    const flags = readU16(next, idx + 6);
    if (flags & CELL_FLAG.Frozen) return;
    if (next[idx] === MATERIAL.Soil && readU16(next, idx + 4) > 140 && readU16(next, idx + 2) > 10 && this.chance(flags & CELL_FLAG.Cosmic ? 7 : 12)) {
      writeCellBytes(next, idx, MATERIAL.Moss, cell[1], 90, 0, CELL_FLAG.Wet);
    }
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
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
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

  private stardust(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (this.ticks % 2 === 0) return;
    const side = this.chance(2) ? 1 : -1;
    for (const [dx, dy] of [[0, 1], [side, 1], [-side, 0], [side, -1]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private meteor(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (next[idx] !== MATERIAL.Meteor) return;
    if (this.move(idx, x, y + 1, cell, old, next)) return;
    if (this.move(idx, x + (this.ticks % 2 === 0 ? 1 : -1), y + 1, cell, old, next)) return;
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
      } else if (flammable(old[nidx])) {
        writeCellBytes(next, nidx, MATERIAL.Fire, old[nidx + 1], 230);
      }
    }
  }

  private emitVaporFrom(sourceIdx: number, old: Uint8Array, next: Uint8Array, vaporKind: number, variant: number, energy: number) {
    const cellNumber = sourceIdx / CELL_STRIDE;
    const x = cellNumber % this.w;
    const y = Math.floor(cellNumber / this.w);
    if (y <= 0) return;
    const above = this.index(x, y - 1);
    if (old[above] === MATERIAL.Empty && next[above] === MATERIAL.Empty) {
      writeCellBytes(next, above, vaporKind, variant, energy);
    }
  }

  private seed(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const below = this.inBounds(x, y + 1) ? old[this.index(x, y + 1)] : MATERIAL.Wall;
    if (below === MATERIAL.Empty) this.powder(idx, x, y, cell, old, next);
    if (next[idx] !== MATERIAL.Seed) return;

    const flags = readU16(next, idx + 6);
    if (flags & CELL_FLAG.Frozen) return;
    const age = readU16(next, idx + 2);
    const energy = readU16(next, idx + 4);
    const wet = Boolean(flags & CELL_FLAG.Wet) || energy > 70;
    const neighborKinds = this.neighbors(x, y).map((nidx) => old[nidx]);
    const cosmic = Boolean(flags & CELL_FLAG.Cosmic) || neighborKinds.includes(MATERIAL.Moonwater) || neighborKinds.includes(MATERIAL.Stardust);

    if (wet && energy > 80 && neighborKinds.includes(MATERIAL.Fungus) && this.chance(10)) {
      writeCellBytes(next, idx, MATERIAL.Fungus, cell[1], 90, 0, CELL_FLAG.Wet);
      return;
    }

    if (below === MATERIAL.Soil && wet) {
      writeU16(next, idx + 6, flags | CELL_FLAG.Rooted);
      if ((age > 16 && energy > 90) || (age > 6 && energy > 55 && this.chance(cosmic ? 3 : 5))) {
        writeCellBytes(next, idx, MATERIAL.Flower, cell[1], cosmic ? 150 : 90, 0, CELL_FLAG.Rooted | (cosmic ? CELL_FLAG.Cosmic : 0));
        return;
      }
    }

    if (below === MATERIAL.Moss && wet && energy > 110 && this.chance(12)) {
      writeCellBytes(next, idx, MATERIAL.Moss, cell[1], 100, 0, CELL_FLAG.Wet);
    }
  }

  private moss(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const energy = readU16(next, idx + 4);
    const wet = Boolean(readU16(next, idx + 6) & CELL_FLAG.Wet) || energy > 70;
    if (readU16(next, idx + 6) & CELL_FLAG.Frozen) return;
    if (!(wet || this.chance(120))) return;
    for (const nidx of this.neighbors(x, y)) {
      const other = old[nidx];
      const dampSubstrate = Boolean(readU16(old, nidx + 6) & CELL_FLAG.Wet) || readU16(old, nidx + 4) > 40;
      if ((other === MATERIAL.Soil || other === MATERIAL.Wood) && (energy > 110 || dampSubstrate || this.chance(8))) {
        writeCellBytes(next, nidx, MATERIAL.Moss, cell[1], 70, 0, wet ? CELL_FLAG.Wet : 0);
        return;
      }
      if (other === MATERIAL.Stone && dampSubstrate && (energy > 120 || this.chance(10))) {
        writeCellBytes(next, nidx, MATERIAL.Moss, cell[1], 58, 0, CELL_FLAG.Wet);
        return;
      }
      if (other === MATERIAL.Wall && dampSubstrate && energy > 150) {
        writeCellBytes(next, nidx, MATERIAL.Moss, cell[1], 48, 0, CELL_FLAG.Wet);
        return;
      }
    }
  }

  private fungus(x: number, y: number, old: Uint8Array, next: Uint8Array) {
    if (readU16(next, this.index(x, y) + 6) & CELL_FLAG.Frozen) return;
    if (!this.chance(95)) return;
    for (const nidx of this.neighbors(x, y)) {
      const other = old[nidx];
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
        writeCellBytes(next, nidx, MATERIAL.Fungus, old[nidx + 1], 80);
        return;
      }
    }
  }

  private move(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (!this.inBounds(x, y)) return false;
    const movingCell = next.slice(idx, idx + CELL_STRIDE);
    if (movingCell[0] !== cell[0]) return false;
    const target = this.index(x, y);
    if (old[target] !== MATERIAL.Empty && next[target] !== MATERIAL.Empty && old[target] !== MATERIAL.Smoke && old[target] !== MATERIAL.Steam) return false;
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

  private neighborHasAnyKind(cells: Uint8Array, idx: number, kinds: readonly number[]) {
    const cellNumber = idx / CELL_STRIDE;
    const x = cellNumber % this.w;
    const y = Math.floor(cellNumber / this.w);
    return this.neighbors(x, y).some((nidx) => kinds.includes(cells[nidx]));
  }
}

const HOT_MATERIALS = [MATERIAL.Fire, MATERIAL.Lava, MATERIAL.Meteor] as const;

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
  if (kind === MATERIAL.Moonwater) return 120;
  if (kind === MATERIAL.Seed) return 50;
  if (kind === MATERIAL.Moss || kind === MATERIAL.Fungus) return 70;
  if (kind === MATERIAL.Flower) return 90;
  return 0;
}

function flammable(kind: number) {
  return kind === MATERIAL.Wood || kind === MATERIAL.Moss || kind === MATERIAL.Seed || kind === MATERIAL.Fungus || kind === MATERIAL.Flower || kind === MATERIAL.Oil;
}

function waterLike(kind: number) {
  return kind === MATERIAL.Water || kind === MATERIAL.Moonwater;
}

function absorbent(kind: number) {
  return kind === MATERIAL.Wall || kind === MATERIAL.Sand || kind === MATERIAL.Wood || kind === MATERIAL.Stone;
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
    kind === MATERIAL.Moss ||
    kind === MATERIAL.Fungus ||
    kind === MATERIAL.Flower
  );
}

function burnChance(kind: number) {
  if (kind === MATERIAL.Oil) return 2;
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
    writeU16(next, idx + 4, Math.min(255, readU16(next, idx + 4) + heat));
    writeU16(next, idx + 6, thawedFlags(kind, readU16(next, idx + 6)));
    return true;
  }
  if (scorchable(kind) && flags & CELL_FLAG.Wet) {
    writeU16(next, idx + 4, Math.max(0, readU16(next, idx + 4) - heat));
    writeU16(next, idx + 6, (flags & ~CELL_FLAG.Wet) | CELL_FLAG.Scorched);
    return true;
  }
  return false;
}

function thawedFlags(kind: number, flags: number) {
  return (flags & ~CELL_FLAG.Frozen) | (hydratable(kind) ? CELL_FLAG.Wet : 0);
}
