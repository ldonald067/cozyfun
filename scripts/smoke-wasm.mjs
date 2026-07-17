import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const wasmPath = resolve(root, "app/public/sim/cozy_sandbox_sim.wasm");
const bytes = await readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {});
const wasm = instance.exports;

const MATERIAL = {
  Empty: 0,
  Wall: 1,
  Sand: 2,
  Water: 3,
  Smoke: 4,
  Soil: 5,
  Fire: 6,
  Wood: 7,
  Lava: 8,
  Stone: 9,
  Moss: 10,
  Seed: 11,
  Fungus: 12,
  Oil: 13,
  Ice: 14,
  Steam: 15,
  Stardust: 16,
  Meteor: 17,
  Moonwater: 18,
  Flower: 19,
  Glass: 20,
  Ember: 21,
  Stem: 23,
  Rocket: 24,
  Wellspring: 25
};

const CELL_FLAG = {
  Wet: 1 << 0,
  Frozen: 1 << 3,
  Scorched: 1 << 4,
  Unknown: 1 << 12
};

function readCells(universe) {
  const ptr = wasm.universe_cells_ptr(universe);
  const len = wasm.universe_cells_byte_len(universe);
  return new Uint8Array(wasm.memory.buffer, ptr, len).slice();
}

function countKind(cells, kind) {
  let count = 0;
  for (let offset = 0; offset < cells.byteLength; offset += 8) {
    if (cells[offset] === kind) count++;
  }
  return count;
}

function kindAt(cells, width, x, y) {
  return cells[(y * width + x) * 8];
}

function writeU16(cells, offset, value) {
  cells[offset] = value & 255;
  cells[offset + 1] = (value >> 8) & 255;
}

function readU16(cells, offset) {
  return cells[offset] | (cells[offset + 1] << 8);
}

function setCell(cells, width, x, y, kind, { age = 0, energy = 0, flags = 0 } = {}) {
  const offset = (y * width + x) * 8;
  cells[offset] = kind;
  cells[offset + 1] = 0;
  writeU16(cells, offset + 2, age);
  writeU16(cells, offset + 4, energy);
  writeU16(cells, offset + 6, flags);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function withUniverse(width, height, seed, callback) {
  const universe = wasm.universe_new(width, height, seed);
  try {
    callback(universe);
  } finally {
    wasm.universe_free(universe);
  }
}

withUniverse(16, 16, 7, (universe) => {
  wasm.universe_paint(universe, 8, 2, 1, MATERIAL.Sand, 100);
  wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(kindAt(cells, 16, 8, 3) === MATERIAL.Sand, "sand should fall one cell");
});

withUniverse(16, 16, 7, (universe) => {
  wasm.universe_paint(universe, 8, 8, 1, MATERIAL.Fire, 100);
  wasm.universe_paint(universe, 8, 7, 1, MATERIAL.Water, 100);
  for (let tick = 0; tick < 8; tick++) wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(countKind(cells, MATERIAL.Steam) > 0, "water and fire should create steam");
});

withUniverse(16, 16, 7, (universe) => {
  wasm.universe_paint(universe, 8, 8, 1, MATERIAL.Lava, 100);
  wasm.universe_paint(universe, 9, 8, 1, MATERIAL.Moonwater, 100);
  for (let tick = 0; tick < 24; tick++) wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(countKind(cells, MATERIAL.Stone) > 0, "moonwater should help cool lava into stone");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  for (let x = 0; x < 16; x++) setCell(cells, 16, x, 15, MATERIAL.Stone);
  setCell(cells, 16, 8, 14, MATERIAL.Rocket);
  setCell(cells, 16, 7, 14, MATERIAL.Fire, { energy: 240 });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "rocket test cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  let burst = false;
  for (let tick = 0; tick < 80 && !burst; tick++) {
    wasm.universe_tick(universe);
    if (countKind(readCells(universe), MATERIAL.Stardust) > 0) burst = true;
  }
  assert(burst, "flame-lit rocket powder should fly and burst into stardust");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Wellspring);
  setCell(cells, 16, 8, 7, MATERIAL.Water);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "wellspring test cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  let pouring = false;
  for (let tick = 0; tick < 120 && !pouring; tick++) {
    wasm.universe_tick(universe);
    if (countKind(readCells(universe), MATERIAL.Water) > 2) pouring = true;
  }
  assert(pouring, "a water-attuned wellspring should keep pouring water");
  const updated = readCells(universe);
  assert(readU16(updated, (8 * 16 + 8) * 8 + 4) === MATERIAL.Water, "the wellspring should stay attuned to water");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 40, energy: 180, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 9, MATERIAL.Soil);
  for (const [x, y] of [[7, 9], [9, 9], [7, 10], [8, 10], [9, 10]]) setCell(cells, 16, x, y, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "seed test cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  let stalked = false;
  let bloomed = false;
  for (let tick = 0; tick < 400 && !bloomed; tick++) {
    wasm.universe_tick(universe);
    const updated = readCells(universe);
    if (countKind(updated, MATERIAL.Stem) > 0) stalked = true;
    if (countKind(updated, MATERIAL.Flower) > 0) bloomed = true;
  }
  assert(stalked, "wet rooted seed should grow a stalk");
  assert(bloomed, "the stalk should bloom a flower at its tip");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 80, energy: 180, flags: CELL_FLAG.Wet | CELL_FLAG.Frozen });
  setCell(cells, 16, 8, 9, MATERIAL.Soil);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "frozen seed cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Seed, "frozen wet seed should stay dormant");
});

withUniverse(16, 16, 23, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 12, energy: 999, flags: CELL_FLAG.Wet | CELL_FLAG.Unknown });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "flag-mask cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  const updated = readCells(universe);
  const flags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  const energy = readU16(updated, (8 * 16 + 8) * 8 + 4);
  assert((flags & CELL_FLAG.Wet) !== 0, "known imported wet flag should stay");
  assert((flags & CELL_FLAG.Unknown) === 0, "unknown imported flag should be masked");
  assert(energy === 255, `imported energy should be clamped to 255, got ${energy}`);
});

withUniverse(16, 16, 5, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Fire, { energy: 240 });
  setCell(cells, 16, 8, 8, MATERIAL.Moss, { age: 20, energy: 140, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "wet moss cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const flags = updated[(8 * 16 + 8) * 8 + 6] | (updated[(8 * 16 + 8) * 8 + 7] << 8);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Moss, "heat should dry wet moss before burning it");
  assert((flags & CELL_FLAG.Scorched) !== 0, "dried moss should be marked scorched");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 12, energy: 80 });
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 9, 8, MATERIAL.Oil);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "oil hydration block cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const flags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  assert((flags & CELL_FLAG.Wet) === 0, "oil should block plain water hydration");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 7, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Oil);
  for (const [x, y] of [[6, 7], [7, 7], [9, 7], [10, 7], [7, 8], [9, 8], [8, 9]]) setCell(cells, 16, x, y, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "oil float cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  assert(kindAt(updated, 16, 8, 7) === MATERIAL.Oil, "oil should rise above water");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Water, "water should settle below oil");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Sand, { energy: 4, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 7, 9, MATERIAL.Stone);
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  setCell(cells, 16, 9, 9, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "wet sand drying cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  for (let tick = 0; tick < 8; tick++) wasm.universe_tick(universe);
  const updated = readCells(universe);
  const flags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  const energy = readU16(updated, (8 * 16 + 8) * 8 + 4);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Sand, "sand should stay blocked in place");
  assert((flags & CELL_FLAG.Wet) === 0, "wet sand should dry back to loose sand");
  assert(energy === 0, "dried sand should have no stored moisture");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Fire);
  setCell(cells, 16, 8, 8, MATERIAL.Stone, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 9, MATERIAL.Wall, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "hard material heat cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const stoneFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  const wallFlags = readU16(updated, (9 * 16 + 8) * 8 + 6);
  assert((stoneFlags & CELL_FLAG.Scorched) !== 0, "damp stone should take thermal stress");
  assert((stoneFlags & CELL_FLAG.Wet) === 0, "heated stone should dry");
  assert((wallFlags & CELL_FLAG.Scorched) !== 0, "damp wall should take thermal stress");
  assert((wallFlags & CELL_FLAG.Wet) === 0, "heated wall should dry");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Lava, { age: 12, energy: 80 });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "water lava shock cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const lavaFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  assert(kindAt(updated, 16, 7, 8) === MATERIAL.Steam, "plain water should flash into steam against lava");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "quenched low-energy lava should cool into stone");
  assert((lavaFlags & CELL_FLAG.Scorched) !== 0, "quenched lava stone should keep thermal stress");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Meteor, { energy: 255 });
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "water meteor shock cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const meteorFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  assert(kindAt(updated, 16, 7, 8) === MATERIAL.Steam, "plain water should flash into steam against meteor");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "water-shocked meteor should become stone");
  assert((meteorFlags & CELL_FLAG.Scorched) !== 0, "water-shocked meteor stone should keep impact stress");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Ice);
  setCell(cells, 16, 8, 8, MATERIAL.Stone, { age: 12, energy: 60, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 7, 9, MATERIAL.Wall, { age: 12, energy: 60, flags: CELL_FLAG.Wet });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "ice hard-surface stress cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const stoneFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  const wallFlags = readU16(updated, (9 * 16 + 7) * 8 + 6);
  assert((stoneFlags & CELL_FLAG.Frozen) !== 0, "ice should frost-stress damp stone");
  assert((stoneFlags & CELL_FLAG.Scorched) === 0, "frost-stressed stone should not look heat-scorched");
  assert((wallFlags & CELL_FLAG.Frozen) !== 0, "ice should frost-stress damp wall");
  assert((wallFlags & CELL_FLAG.Scorched) === 0, "frost-stressed wall should not look heat-scorched");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Fire);
  setCell(cells, 16, 8, 8, MATERIAL.Wood, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "wet wood heat cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const woodFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  assert(kindAt(updated, 16, 8, 7) === MATERIAL.Steam, "heated wet wood should vent steam");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Wood, "wet wood should dry before burning");
  assert((woodFlags & CELL_FLAG.Scorched) !== 0, "dried wood should be marked scorched");
  assert((woodFlags & CELL_FLAG.Wet) === 0, "dried wood should lose wet state");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Stone);
  setCell(cells, 16, 7, 9, MATERIAL.Wall);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "hard material hydration cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const stoneFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  const wallFlags = readU16(updated, (9 * 16 + 7) * 8 + 6);
  const stoneEnergy = readU16(updated, (8 * 16 + 8) * 8 + 4);
  const wallEnergy = readU16(updated, (9 * 16 + 7) * 8 + 4);
  assert((stoneFlags & CELL_FLAG.Wet) !== 0, "water should wet natural stone");
  assert((wallFlags & CELL_FLAG.Wet) !== 0, "water should leave wall dampness");
  assert(stoneEnergy > wallEnergy, "stone should weather more strongly than wall");
});

withUniverse(16, 16, 19, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Steam);
  setCell(cells, 16, 8, 8, MATERIAL.Stone);
  setCell(cells, 16, 7, 9, MATERIAL.Wall);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "steam condensation cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const stoneFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  const wallFlags = readU16(updated, (9 * 16 + 7) * 8 + 6);
  const stoneEnergy = readU16(updated, (8 * 16 + 8) * 8 + 4);
  const wallEnergy = readU16(updated, (9 * 16 + 7) * 8 + 4);
  assert((stoneFlags & CELL_FLAG.Wet) !== 0, "steam should condense onto stone");
  assert((wallFlags & CELL_FLAG.Wet) !== 0, "steam should condense onto wall");
  assert(stoneEnergy > wallEnergy, "stone should take more condensation than sealed wall");
});

withUniverse(16, 16, 19, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Smoke, { energy: 90 });
  setCell(cells, 16, 8, 8, MATERIAL.Wall);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "smoke soot cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  const wallFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  assert((wallFlags & CELL_FLAG.Scorched) !== 0, "smoke should leave soot on wall");
  assert((wallFlags & CELL_FLAG.Wet) === 0, "smoke should not behave like condensation");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Moss, { age: 12, energy: 130, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 8, MATERIAL.Wall, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "weak wall moss cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const weak = readCells(universe);
  assert(kindAt(weak, 16, 8, 8) === MATERIAL.Wall, "wall should resist ordinary moss spread");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Moss, { age: 12, energy: 170, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 8, MATERIAL.Wall, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "strong wall moss cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const strong = readCells(universe);
  assert(kindAt(strong, 16, 8, 8) === MATERIAL.Moss, "fed moss should still cross a soaked wall");
});

withUniverse(16, 16, 13, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 8, 8, MATERIAL.Water);
  setCell(cells, 16, 7, 8, MATERIAL.Stardust, { energy: 190 });
  for (const [x, y] of [[7, 7], [8, 7], [9, 7], [9, 8], [7, 9], [8, 9], [9, 9]]) setCell(cells, 16, x, y, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "stardust water cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Moonwater, "stardust should charge water into moonwater");
});

withUniverse(16, 16, 17, (universe) => {
  wasm.universe_paint(universe, 7, 8, 1, MATERIAL.Moonwater, 100);
  wasm.universe_paint(universe, 8, 8, 1, MATERIAL.Oil, 100);
  for (let tick = 0; tick < 24; tick++) wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(countKind(cells, MATERIAL.Stardust) > 0, "moonwater should clean oil into stardust");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Lava, { energy: 255 });
  setCell(cells, 16, 8, 8, MATERIAL.Sand);
  for (const [x, y] of [[7, 9], [8, 9], [9, 9], [9, 8], [6, 8], [5, 8], [6, 9]]) setCell(cells, 16, x, y, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "vitrification cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  for (let tick = 0; tick < 24; tick++) wasm.universe_tick(universe);
  const updated = readCells(universe);
  assert(countKind(updated, MATERIAL.Glass) > 0, "lava should vitrify dry sand into glass");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Stardust, { energy: 190 });
  setCell(cells, 16, 8, 8, MATERIAL.Stone);
  for (const [x, y] of [[6, 9], [7, 9], [8, 9], [6, 8], [9, 8], [6, 7], [7, 7], [8, 7]]) setCell(cells, 16, x, y, MATERIAL.Wall);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "constellation etch cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  for (let tick = 0; tick < 64; tick++) wasm.universe_tick(universe);
  const updated = readCells(universe);
  const stoneFlags = readU16(updated, (8 * 16 + 8) * 8 + 6);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "etched stone should stay stone");
  assert((stoneFlags & 4) !== 0, "resting stardust should etch stone with a cosmic mark");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Fire, { energy: 240 });
  setCell(cells, 16, 8, 8, MATERIAL.Wall, { age: 30, energy: 190, flags: CELL_FLAG.Frozen });
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "freeze-thaw wall cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  const updated = readCells(universe);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "accumulated freeze-thaw stress should crumble wall into stone");
});

withUniverse(16, 16, 7, (universe) => {
  wasm.universe_paint(universe, 7, 8, 1, MATERIAL.Fire, 100);
  wasm.universe_paint(universe, 9, 8, 1, MATERIAL.Wood, 100);
  let embered = false;
  for (let tick = 0; tick < 40 && !embered; tick++) {
    wasm.universe_tick(universe);
    embered = countKind(readCells(universe), MATERIAL.Ember) > 0;
  }
  assert(embered, "burning wood should leave glowing embers");
});

withUniverse(16, 16, 7, (universe) => {
  const cells = new Uint8Array(16 * 16 * 8);
  setCell(cells, 16, 7, 8, MATERIAL.Fire, { energy: 240 });
  setCell(cells, 16, 8, 8, MATERIAL.Water);
  for (const [x, y] of [[6, 8], [5, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9]]) setCell(cells, 16, x, y, MATERIAL.Stone);
  const ptr = wasm.alloc(cells.byteLength);
  new Uint8Array(wasm.memory.buffer, ptr, cells.byteLength).set(cells);
  assert(wasm.universe_load_cells(universe, ptr, cells.byteLength) === 1, "boiling cells should load");
  wasm.dealloc(ptr, cells.byteLength);
  wasm.universe_tick(universe);
  wasm.universe_tick(universe);
  assert(kindAt(readCells(universe), 16, 8, 8) === MATERIAL.Water, "water should heat gradually instead of flashing to steam");
  let boiled = false;
  for (let tick = 0; tick < 30 && !boiled; tick++) {
    wasm.universe_tick(universe);
    boiled = kindAt(readCells(universe), 16, 8, 8) === MATERIAL.Steam;
  }
  assert(boiled, "sustained flame should boil water into steam");
});

console.log("WASM smoke checks passed");
