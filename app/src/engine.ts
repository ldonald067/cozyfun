import { CELL_STRIDE, MATERIAL } from "./materials";

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
  private readonly ptr: number;

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
        this.writeCell(this.index(px, py), material, this.variant(px, py, material), startEnergy(material), 0);
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
        if (kind === MATERIAL.Sand || kind === MATERIAL.Soil) this.powder(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater || kind === MATERIAL.Oil) this.liquid(idx, x, y, cell, old, next, kind === MATERIAL.Oil ? 2 : 1);
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
        if (kind === MATERIAL.Fire && this.chance(12)) next[idx] = MATERIAL.Smoke;
        if (kind === MATERIAL.Seed) this.seed(idx, x, y, cell, old, next);
        if (kind === MATERIAL.Moss || kind === MATERIAL.Fungus) this.grow(idx, x, y, kind, old, next);
      }
    }

    this.cells.set(next);
  }

  getCellBytes() {
    return this.cells.slice();
  }

  loadCellBytes(bytes: Uint8Array) {
    if (bytes.byteLength !== this.cells.byteLength) return false;
    this.cells.set(bytes);
    return true;
  }

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

  private writeCell(idx: number, kind: number, variant = 0, energy = 0, age = 0) {
    this.cells[idx] = kind;
    this.cells[idx + 1] = variant;
    writeU16(this.cells, idx + 2, age);
    writeU16(this.cells, idx + 4, energy);
    writeU16(this.cells, idx + 6, 0);
  }

  private ageAndDecay(next: Uint8Array) {
    for (let idx = 0; idx < next.length; idx += CELL_STRIDE) {
      const kind = next[idx];
      if (!kind) continue;
      const age = readU16(next, idx + 2) + 1;
      const energy = Math.max(0, readU16(next, idx + 4) - (kind === MATERIAL.Fire ? 3 : kind === MATERIAL.Steam ? 2 : 1));
      writeU16(next, idx + 2, age);
      writeU16(next, idx + 4, energy);
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
      for (const nidx of this.neighbors(x, y)) {
        const other = old[nidx];
        if (kind === MATERIAL.Fire && (other === MATERIAL.Water || other === MATERIAL.Moonwater) && this.chance(other === MATERIAL.Moonwater ? 2 : 3)) {
          next[nidx] = MATERIAL.Steam;
          writeU16(next, nidx + 4, 180);
          const energy = Math.max(0, readU16(next, idx + 4) - 32);
          writeU16(next, idx + 4, energy);
          if (energy < 18) next[idx] = MATERIAL.Steam;
        }
        if ((kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor) && flammable(other) && this.chance(other === MATERIAL.Oil ? 2 : 7)) {
          next[nidx] = MATERIAL.Fire;
          writeU16(next, nidx + 4, 220);
        }
        if (kind === MATERIAL.Lava && (other === MATERIAL.Water || other === MATERIAL.Moonwater) && this.chance(other === MATERIAL.Moonwater ? 2 : 4)) {
          next[idx] = MATERIAL.Stone;
          next[nidx] = MATERIAL.Steam;
        }
        if (kind === MATERIAL.Ice && (other === MATERIAL.Fire || other === MATERIAL.Lava)) {
          next[idx] = MATERIAL.Water;
        }
      }
    }
  }

  private powder(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    for (const [dx, dy] of this.ticks % 2 === 0 ? [[0, 1], [-1, 1], [1, 1]] : [[0, 1], [1, 1], [-1, 1]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private liquid(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array, slow: number) {
    if (this.ticks % slow !== 0) return;
    const side = this.ticks % 2 === 0 ? 1 : -1;
    for (const [dx, dy] of [[0, 1], [side, 1], [-side, 1], [side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0]]) {
      if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    }
  }

  private gas(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const side = this.ticks % 2 === 0 ? 1 : -1;
    for (const [dx, dy] of [[0, -1], [side, -1], [-side, -1], [side, 0], [-side, 0]]) {
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
    if (this.move(idx, x, y + 1, cell, old, next)) return;
    next[idx] = this.chance(2) ? MATERIAL.Stardust : MATERIAL.Stone;
    for (const nidx of this.neighbors(x, y)) {
      if (old[nidx] === MATERIAL.Empty && this.chance(3)) next[nidx] = MATERIAL.Fire;
      if (flammable(old[nidx])) next[nidx] = MATERIAL.Fire;
    }
  }

  private seed(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    const below = this.inBounds(x, y + 1) ? old[this.index(x, y + 1)] : MATERIAL.Wall;
    if (below === MATERIAL.Empty) this.powder(idx, x, y, cell, old, next);
    if ((below === MATERIAL.Soil || below === MATERIAL.Moonwater || below === MATERIAL.Moss) && this.chance(70)) next[idx] = MATERIAL.Moss;
  }

  private grow(idx: number, x: number, y: number, kind: number, old: Uint8Array, next: Uint8Array) {
    if (!this.chance(kind === MATERIAL.Moss ? 110 : 95)) return;
    for (const nidx of this.neighbors(x, y)) {
      if (old[nidx] === MATERIAL.Soil || old[nidx] === MATERIAL.Wood || old[nidx] === MATERIAL.Moss) {
        next[nidx] = kind;
        return;
      }
    }
  }

  private move(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (!this.inBounds(x, y)) return false;
    const target = this.index(x, y);
    if (old[target] !== MATERIAL.Empty && next[target] !== MATERIAL.Empty && old[target] !== MATERIAL.Smoke && old[target] !== MATERIAL.Steam) return false;
    next.fill(0, idx, idx + CELL_STRIDE);
    next.set(cell, target);
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
}

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

function startEnergy(kind: number) {
  if (kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor) return 240;
  if (kind === MATERIAL.Steam || kind === MATERIAL.Stardust || kind === MATERIAL.Moonwater) return 160;
  if (kind === MATERIAL.Seed || kind === MATERIAL.Moss || kind === MATERIAL.Fungus) return 70;
  return 0;
}

function flammable(kind: number) {
  return kind === MATERIAL.Wood || kind === MATERIAL.Moss || kind === MATERIAL.Seed || kind === MATERIAL.Fungus || kind === MATERIAL.Oil;
}
