import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const wasmPath = resolve(root, "app/public/sim/cozy_sandbox_sim.wasm");
const bytes = await readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {});
const wasm = instance.exports;

const MATERIAL = {
  Empty: 0,
  Sand: 2,
  Water: 3,
  Fire: 6,
  Lava: 8,
  Stone: 9,
  Steam: 15,
  Moonwater: 18
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
  wasm.universe_paint(universe, 8, 2, 1, MATERIAL.Sand);
  wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(kindAt(cells, 16, 8, 3) === MATERIAL.Sand, "sand should fall one cell");
});

withUniverse(16, 16, 7, (universe) => {
  wasm.universe_paint(universe, 8, 8, 1, MATERIAL.Fire);
  wasm.universe_paint(universe, 8, 7, 1, MATERIAL.Water);
  for (let tick = 0; tick < 8; tick++) wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(countKind(cells, MATERIAL.Steam) > 0, "water and fire should create steam");
});

withUniverse(16, 16, 7, (universe) => {
  wasm.universe_paint(universe, 8, 8, 1, MATERIAL.Lava);
  wasm.universe_paint(universe, 9, 8, 1, MATERIAL.Moonwater);
  for (let tick = 0; tick < 24; tick++) wasm.universe_tick(universe);
  const cells = readCells(universe);
  assert(countKind(cells, MATERIAL.Stone) > 0, "moonwater should help cool lava into stone");
});

console.log("WASM smoke checks passed");
