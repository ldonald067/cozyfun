import { rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, ".tmp/js-fallback-cjs");
const tsc = resolve(root, "app/node_modules/typescript/bin/tsc");

await rm(outDir, { recursive: true, force: true });

const compile = spawnSync(process.execPath, [
  tsc,
  "--target",
  "ES2022",
  "--module",
  "CommonJS",
  "--moduleResolution",
  "Node",
  "--lib",
  "ES2022,DOM",
  "--strict",
  "true",
  "--skipLibCheck",
  "true",
  "--esModuleInterop",
  "true",
  "--outDir",
  outDir,
  "app/src/engine.ts",
  "app/src/materials.ts"
], { cwd: root, stdio: "inherit" });

if (compile.status !== 0) {
  throw new Error("JS fallback TypeScript compile failed");
}

await writeFile(resolve(outDir, "package.json"), JSON.stringify({ type: "commonjs" }));

const require = createRequire(import.meta.url);
const { createFallbackEngine } = require(resolve(outDir, "engine.js"));

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

const CELL_STRIDE = 8;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function withEngine(seed, callback) {
  const engine = createFallbackEngine(16, 16, seed);
  try {
    callback(engine);
  } finally {
    engine.dispose();
  }
}

function writeU16(cells, offset, value) {
  cells[offset] = value & 255;
  cells[offset + 1] = (value >> 8) & 255;
}

function readU16(cells, offset) {
  return cells[offset] | (cells[offset + 1] << 8);
}

function setCell(cells, width, x, y, kind, { age = 0, energy = 0, flags = 0 } = {}) {
  const offset = (y * width + x) * CELL_STRIDE;
  cells[offset] = kind;
  cells[offset + 1] = 0;
  writeU16(cells, offset + 2, age);
  writeU16(cells, offset + 4, energy);
  writeU16(cells, offset + 6, flags);
}

function kindAt(cells, width, x, y) {
  return cells[(y * width + x) * CELL_STRIDE];
}

function loadCells(engine, cells, label) {
  assert(engine.loadCellBytes(cells), label);
}

withEngine(7, (engine) => {
  assert(engine.source === "js", "fallback engine should identify itself as JS");
  engine.paint(8, 2, 1, MATERIAL.Sand);
  engine.tick();
  const cells = engine.getCellBytes();
  assert(kindAt(cells, 16, 8, 3) === MATERIAL.Sand, "sand should fall one cell");
});

withEngine(23, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 12, energy: 999, flags: CELL_FLAG.Wet | CELL_FLAG.Unknown });
  loadCells(engine, cells, "flag-mask cells should load");
  const loaded = engine.getCellBytes();
  const flags = readU16(loaded, (8 * 16 + 8) * CELL_STRIDE + 6);
  const energy = readU16(loaded, (8 * 16 + 8) * CELL_STRIDE + 4);
  assert((flags & CELL_FLAG.Wet) !== 0, "known imported wet flag should stay");
  assert((flags & CELL_FLAG.Unknown) === 0, "unknown imported flag should be masked");
  assert(energy === 255, `imported energy should be clamped to 255, got ${energy}`);
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  for (let x = 0; x < 16; x++) setCell(cells, 16, x, 15, MATERIAL.Stone);
  setCell(cells, 16, 8, 14, MATERIAL.Rocket);
  setCell(cells, 16, 7, 14, MATERIAL.Fire, { energy: 240 });
  loadCells(engine, cells, "rocket test cells should load");
  let burst = false;
  for (let tick = 0; tick < 80 && !burst; tick++) {
    engine.tick();
    const updated = engine.getCellBytes();
    for (let offset = 0; offset < updated.byteLength; offset += CELL_STRIDE) {
      if (updated[offset] === MATERIAL.Stardust) burst = true;
    }
  }
  assert(burst, "flame-lit rocket powder should fly and burst into stardust");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Wellspring);
  setCell(cells, 16, 8, 7, MATERIAL.Water);
  loadCells(engine, cells, "wellspring test cells should load");
  let pouring = false;
  for (let tick = 0; tick < 120 && !pouring; tick++) {
    engine.tick();
    const updated = engine.getCellBytes();
    let water = 0;
    for (let offset = 0; offset < updated.byteLength; offset += CELL_STRIDE) {
      if (updated[offset] === MATERIAL.Water) water++;
    }
    if (water > 2) pouring = true;
  }
  assert(pouring, "a water-attuned wellspring should keep pouring water");
  const updated = engine.getCellBytes();
  assert(readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 4) === MATERIAL.Water, "the wellspring should stay attuned to water");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 40, energy: 180, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 9, MATERIAL.Soil);
  for (const [x, y] of [[7, 9], [9, 9], [7, 10], [8, 10], [9, 10]]) {
    setCell(cells, 16, x, y, MATERIAL.Stone);
  }
  loadCells(engine, cells, "seed test cells should load");
  let stalked = false;
  let bloomed = false;
  for (let tick = 0; tick < 400 && !bloomed; tick++) {
    engine.tick();
    const updated = engine.getCellBytes();
    let stems = 0;
    let flowers = 0;
    for (let offset = 0; offset < updated.byteLength; offset += CELL_STRIDE) {
      if (updated[offset] === MATERIAL.Stem) stems++;
      if (updated[offset] === MATERIAL.Flower) flowers++;
    }
    if (stems > 0) stalked = true;
    if (flowers > 0) bloomed = true;
  }
  assert(stalked, "wet rooted seed should grow a stalk");
  assert(bloomed, "the stalk should bloom a flower at its tip");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 80, energy: 180, flags: CELL_FLAG.Wet | CELL_FLAG.Frozen });
  setCell(cells, 16, 8, 9, MATERIAL.Soil);
  loadCells(engine, cells, "frozen seed cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Seed, "frozen wet seed should stay dormant");
});

withEngine(5, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Fire, { energy: 240 });
  setCell(cells, 16, 8, 8, MATERIAL.Moss, { age: 20, energy: 140, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  loadCells(engine, cells, "wet moss cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const flags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Moss, "heat should dry wet moss before burning it");
  assert((flags & CELL_FLAG.Scorched) !== 0, "dried moss should be marked scorched");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Seed, { age: 12, energy: 80 });
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 9, 8, MATERIAL.Oil);
  loadCells(engine, cells, "oil hydration block cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const flags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  assert((flags & CELL_FLAG.Wet) === 0, "oil should block plain water hydration");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 7, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Oil);
  for (const [x, y] of [[6, 7], [7, 7], [9, 7], [10, 7], [7, 8], [9, 8], [8, 9]]) {
    setCell(cells, 16, x, y, MATERIAL.Stone);
  }
  loadCells(engine, cells, "oil float cells should load");
  engine.tick();
  engine.tick();
  const updated = engine.getCellBytes();
  assert(kindAt(updated, 16, 8, 7) === MATERIAL.Oil, "oil should rise above water");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Water, "water should settle below oil");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Sand, { energy: 4, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 7, 9, MATERIAL.Stone);
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  setCell(cells, 16, 9, 9, MATERIAL.Stone);
  loadCells(engine, cells, "wet sand drying cells should load");
  for (let tick = 0; tick < 8; tick++) engine.tick();
  const updated = engine.getCellBytes();
  const flags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  const energy = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 4);
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Sand, "sand should stay blocked in place");
  assert((flags & CELL_FLAG.Wet) === 0, "wet sand should dry back to loose sand");
  assert(energy === 0, "dried sand should have no stored moisture");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Fire);
  setCell(cells, 16, 8, 8, MATERIAL.Stone, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 9, MATERIAL.Wall, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  loadCells(engine, cells, "hard material heat cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const stoneFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  const wallFlags = readU16(updated, (9 * 16 + 8) * CELL_STRIDE + 6);
  assert((stoneFlags & CELL_FLAG.Scorched) !== 0, "damp stone should take thermal stress");
  assert((stoneFlags & CELL_FLAG.Wet) === 0, "heated stone should dry");
  assert((wallFlags & CELL_FLAG.Scorched) !== 0, "damp wall should take thermal stress");
  assert((wallFlags & CELL_FLAG.Wet) === 0, "heated wall should dry");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Lava, { age: 12, energy: 80 });
  loadCells(engine, cells, "water lava shock cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const lavaFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  assert(kindAt(updated, 16, 7, 8) === MATERIAL.Steam, "plain water should flash into steam against lava");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "quenched low-energy lava should cool into stone");
  assert((lavaFlags & CELL_FLAG.Scorched) !== 0, "quenched lava stone should keep thermal stress");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Meteor, { energy: 255 });
  setCell(cells, 16, 8, 9, MATERIAL.Stone);
  loadCells(engine, cells, "water meteor shock cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const meteorFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  assert(kindAt(updated, 16, 7, 8) === MATERIAL.Steam, "plain water should flash into steam against meteor");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "water-shocked meteor should become stone");
  assert((meteorFlags & CELL_FLAG.Scorched) !== 0, "water-shocked meteor stone should keep impact stress");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Ice);
  setCell(cells, 16, 8, 8, MATERIAL.Stone, { age: 12, energy: 60, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 7, 9, MATERIAL.Wall, { age: 12, energy: 60, flags: CELL_FLAG.Wet });
  loadCells(engine, cells, "ice hard-surface stress cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const stoneFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  const wallFlags = readU16(updated, (9 * 16 + 7) * CELL_STRIDE + 6);
  assert((stoneFlags & CELL_FLAG.Frozen) !== 0, "ice should frost-stress damp stone");
  assert((stoneFlags & CELL_FLAG.Scorched) === 0, "frost-stressed stone should not look heat-scorched");
  assert((wallFlags & CELL_FLAG.Frozen) !== 0, "ice should frost-stress damp wall");
  assert((wallFlags & CELL_FLAG.Scorched) === 0, "frost-stressed wall should not look heat-scorched");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Fire);
  setCell(cells, 16, 8, 8, MATERIAL.Wood, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  loadCells(engine, cells, "wet wood heat cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const woodFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  assert(kindAt(updated, 16, 8, 7) === MATERIAL.Steam, "heated wet wood should vent steam");
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Wood, "wet wood should dry before burning");
  assert((woodFlags & CELL_FLAG.Scorched) !== 0, "dried wood should be marked scorched");
  assert((woodFlags & CELL_FLAG.Wet) === 0, "dried wood should lose wet state");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  setCell(cells, 16, 8, 8, MATERIAL.Stone);
  setCell(cells, 16, 7, 9, MATERIAL.Wall);
  loadCells(engine, cells, "hard material hydration cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const stoneFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  const wallFlags = readU16(updated, (9 * 16 + 7) * CELL_STRIDE + 6);
  const stoneEnergy = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 4);
  const wallEnergy = readU16(updated, (9 * 16 + 7) * CELL_STRIDE + 4);
  assert((stoneFlags & CELL_FLAG.Wet) !== 0, "water should wet natural stone");
  assert((wallFlags & CELL_FLAG.Wet) !== 0, "water should leave wall dampness");
  assert(stoneEnergy > wallEnergy, "stone should weather more strongly than wall");
});

withEngine(19, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Steam);
  setCell(cells, 16, 8, 8, MATERIAL.Stone);
  setCell(cells, 16, 7, 9, MATERIAL.Wall);
  loadCells(engine, cells, "steam condensation cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const stoneFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  const wallFlags = readU16(updated, (9 * 16 + 7) * CELL_STRIDE + 6);
  const stoneEnergy = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 4);
  const wallEnergy = readU16(updated, (9 * 16 + 7) * CELL_STRIDE + 4);
  assert((stoneFlags & CELL_FLAG.Wet) !== 0, "steam should condense onto stone");
  assert((wallFlags & CELL_FLAG.Wet) !== 0, "steam should condense onto wall");
  assert(stoneEnergy > wallEnergy, "stone should take more condensation than sealed wall");
});

withEngine(19, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Smoke, { energy: 90 });
  setCell(cells, 16, 8, 8, MATERIAL.Wall);
  loadCells(engine, cells, "smoke soot cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const wallFlags = readU16(updated, (8 * 16 + 8) * CELL_STRIDE + 6);
  assert((wallFlags & CELL_FLAG.Scorched) !== 0, "smoke should leave soot on wall");
  assert((wallFlags & CELL_FLAG.Wet) === 0, "smoke should not behave like condensation");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Moss, { age: 12, energy: 130, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 8, MATERIAL.Wall, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  loadCells(engine, cells, "weak wall moss cells should load");
  engine.tick();
  const weak = engine.getCellBytes();
  assert(kindAt(weak, 16, 8, 8) === MATERIAL.Wall, "wall should resist ordinary moss spread");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Moss, { age: 12, energy: 170, flags: CELL_FLAG.Wet });
  setCell(cells, 16, 8, 8, MATERIAL.Wall, { age: 12, energy: 90, flags: CELL_FLAG.Wet });
  loadCells(engine, cells, "strong wall moss cells should load");
  engine.tick();
  const strong = engine.getCellBytes();
  assert(kindAt(strong, 16, 8, 8) === MATERIAL.Moss, "fed moss should still cross a soaked wall");
});

withEngine(13, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Water);
  setCell(cells, 16, 7, 8, MATERIAL.Stardust, { energy: 190 });
  for (const [x, y] of [[7, 7], [8, 7], [9, 7], [9, 8], [7, 9], [8, 9], [9, 9]]) {
    setCell(cells, 16, x, y, MATERIAL.Stone);
  }
  loadCells(engine, cells, "stardust water cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Moonwater, "stardust should charge water into moonwater");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Lava, { energy: 255 });
  setCell(cells, 16, 8, 8, MATERIAL.Sand);
  for (const [x, y] of [[7, 9], [8, 9], [9, 9], [9, 8], [6, 8], [5, 8], [6, 9]]) {
    setCell(cells, 16, x, y, MATERIAL.Stone);
  }
  loadCells(engine, cells, "vitrification cells should load");
  for (let tick = 0; tick < 48; tick++) engine.tick();
  const updated = engine.getCellBytes();
  let glassCells = 0;
  for (let offset = 0; offset < updated.byteLength; offset += CELL_STRIDE) {
    if (updated[offset] === MATERIAL.Glass) glassCells++;
  }
  assert(glassCells > 0, "lava should vitrify dry sand into glass");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Stardust, { energy: 190 });
  setCell(cells, 16, 8, 8, MATERIAL.Fire, { energy: 240 });
  for (const [x, y] of [[6, 9], [7, 9], [8, 9], [9, 9], [6, 8], [9, 8]]) {
    setCell(cells, 16, x, y, MATERIAL.Stone);
  }
  loadCells(engine, cells, "starfire cells should load");
  let sparkled = false;
  for (let tick = 0; tick < 12 && !sparkled; tick++) {
    engine.tick();
    const updated = engine.getCellBytes();
    let stardust = 0;
    for (let offset = 0; offset < updated.byteLength; offset += CELL_STRIDE) {
      if (updated[offset] === MATERIAL.Stardust) stardust++;
    }
    sparkled = stardust >= 2;
  }
  assert(sparkled, "stardust should transmute adjacent fire into a sparkle burst");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 7, 8, MATERIAL.Fire, { energy: 240 });
  setCell(cells, 16, 8, 8, MATERIAL.Wall, { age: 30, energy: 190, flags: CELL_FLAG.Frozen });
  loadCells(engine, cells, "freeze-thaw wall cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Stone, "accumulated freeze-thaw stress should crumble wall into stone");
});

withEngine(7, (engine) => {
  const cells = new Uint8Array(16 * 16 * CELL_STRIDE);
  setCell(cells, 16, 8, 8, MATERIAL.Ember, { age: 10, energy: 230 });
  setCell(cells, 16, 7, 8, MATERIAL.Water);
  loadCells(engine, cells, "ember quench cells should load");
  engine.tick();
  const updated = engine.getCellBytes();
  const emberOffset = (8 * 16 + 8) * CELL_STRIDE;
  assert(kindAt(updated, 16, 8, 8) === MATERIAL.Ember, "quenched ember should stay as char");
  assert(readU16(updated, emberOffset + 4) < 120, "water should quench ember heat");
  assert((readU16(updated, emberOffset + 6) & CELL_FLAG.Wet) !== 0, "quenched ember should read wet");
});

console.log("JS fallback smoke checks passed");
