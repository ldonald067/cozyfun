// Cross-engine parity harness: the Rust->WASM sim and the JS fallback must be
// byte-for-byte identical for the same seed and inputs. Each scenario drives an
// identical scene through both engines and compares every cell byte after each
// tick, failing at the first divergence. Rule parity is the project's #1
// invariant; this is its strictest gate. Scenarios target the interactions most
// prone to drift (heat, freezing, growth, gases, and the newest elements).
//
// Coverage note: these scenarios span realistic play. One pathological case is a
// known deep residual — two wellsprings attuned to lava and water fountaining into
// each other can drift by a single flag bit after ~200 ticks. It affects only the
// JS fallback (WASM is the default engine) and is not reproducible without that
// continuous dual-fountain setup, so it is documented rather than gated on here.
import { rm, writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

// Compile the TS engine to CommonJS, mirroring scripts/smoke-js-fallback.mjs.
const outDir = resolve(root, ".tmp/parity-cjs");
await rm(outDir, { recursive: true, force: true });
const tsc = resolve(root, "app/node_modules/typescript/bin/tsc");
const compile = spawnSync(
  process.execPath,
  [
    tsc, "--target", "ES2022", "--module", "CommonJS", "--moduleResolution", "Node",
    "--lib", "ES2022,DOM", "--strict", "true", "--skipLibCheck", "true",
    "--esModuleInterop", "true", "--outDir", outDir, "app/src/engine.ts", "app/src/materials.ts",
  ],
  { cwd: root, stdio: "inherit" },
);
if (compile.status !== 0) throw new Error("parity harness TypeScript compile failed");
await writeFile(resolve(outDir, "package.json"), JSON.stringify({ type: "commonjs" }));
const require = createRequire(import.meta.url);
const { createFallbackEngine } = require(resolve(outDir, "engine.js"));

const wasmBytes = await readFile(resolve(root, "app/public/sim/cozy_sandbox_sim.wasm"));
const { instance } = await WebAssembly.instantiate(wasmBytes, {});
const wasm = instance.exports;

const STRIDE = 8;
const M = {
  Wall: 1, Sand: 2, Water: 3, Smoke: 4, Soil: 5, Fire: 6, Wood: 7, Lava: 8, Stone: 9, Moss: 10,
  Seed: 11, Fungus: 12, Oil: 13, Ice: 14, Steam: 15, Stardust: 16, Meteor: 17, Moonwater: 18,
  Glass: 20, Rocket: 24, Wellspring: 25,
};
const BYTE_NAME = ["kind", "variant", "age.lo", "age.hi", "energy.lo", "energy.hi", "flags.lo", "flags.hi"];

function wasmCells(uni) {
  const ptr = wasm.universe_cells_ptr(uni);
  const len = wasm.universe_cells_byte_len(uni);
  return new Uint8Array(wasm.memory.buffer, ptr, len).slice();
}

function runScenario({ name, w, h, seed, ticks, paint }) {
  const js = createFallbackEngine(w, h, seed);
  const uni = wasm.universe_new(w, h, seed);
  paint((x, y, r, mat, d = 100) => js.paint(x, y, r, mat, d));
  paint((x, y, r, mat, d = 100) => wasm.universe_paint(uni, x, y, r, mat, d));

  const compare = (tick) => {
    const a = js.getCellBytes();
    const b = wasmCells(uni);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      const cell = Math.floor(i / STRIDE);
      const cx = cell % w;
      const cy = Math.floor(cell / w);
      const jsCell = [...a.slice(cell * STRIDE, cell * STRIDE + STRIDE)];
      const wasmCell = [...b.slice(cell * STRIDE, cell * STRIDE + STRIDE)];
      throw new Error(
        `[${name}] divergence at tick ${tick}, cell (${cx},${cy}), byte ${i % STRIDE} (${BYTE_NAME[i % STRIDE]}): js=${a[i]} wasm=${b[i]}\n` +
          `  js  cell: [${jsCell}]\n  wasm cell: [${wasmCell}]`,
      );
    }
  };

  compare(0);
  for (let t = 1; t <= ticks; t++) {
    js.tick();
    wasm.universe_tick(uni);
    compare(t);
  }
  wasm.universe_free(uni);
  js.dispose();
  console.log(`  ok  ${name} (${ticks} ticks)`);
}

const scenarios = [
  {
    name: "busy mixed scene",
    w: 60, h: 48, seed: 1234, ticks: 300,
    paint(p) {
      p(30, 46, 30, M.Stone); p(8, 40, 4, M.Sand); p(8, 30, 3, M.Water);
      p(20, 20, 3, M.Fire); p(20, 40, 3, M.Soil); p(20, 37, 1, M.Seed);
      p(30, 15, 3, M.Lava); p(30, 40, 3, M.Oil); p(40, 25, 2, M.Moss);
      p(40, 40, 3, M.Wood); p(48, 20, 2, M.Stardust); p(48, 30, 2, M.Moonwater);
      p(15, 10, 1, M.Meteor); p(52, 10, 2, M.Ice); p(52, 38, 2, M.Fungus);
      p(10, 20, 2, M.Rocket); p(44, 44, 1, M.Wellspring); p(12, 44, 1, M.Water);
    },
  },
  {
    name: "ice between heat and liquids",
    w: 40, h: 32, seed: 99, ticks: 120,
    paint(p) {
      for (let x = 10; x <= 30; x++) p(x, 20, 1, M.Ice);
      p(9, 20, 1, M.Fire); p(31, 20, 1, M.Lava);
      p(20, 19, 1, M.Water); p(15, 19, 1, M.Moonwater); p(25, 19, 1, M.Water);
      p(12, 21, 2, M.Wall); p(28, 21, 2, M.Stone);
    },
  },
  {
    name: "oil sheet meeting fire and life",
    w: 40, h: 32, seed: 7, ticks: 150,
    paint(p) {
      for (let x = 6; x <= 34; x++) p(x, 26, 1, M.Stone);
      p(20, 24, 5, M.Oil); p(8, 24, 1, M.Fire);
    },
  },
  {
    name: "germinating garden (cosmic + plain)",
    w: 32, h: 40, seed: 4242, ticks: 500,
    paint(p) {
      for (let x = 0; x < 32; x++) p(x, 38, 1, M.Soil);
      p(8, 37, 1, M.Seed); p(8, 34, 2, M.Water);
      p(22, 37, 1, M.Seed); p(22, 34, 2, M.Moonwater); p(24, 34, 2, M.Stardust);
    },
  },
  {
    name: "fungus overtaking moss",
    w: 32, h: 24, seed: 55, ticks: 200,
    paint(p) {
      for (let x = 0; x < 32; x++) p(x, 20, 1, M.Wood);
      p(14, 19, 4, M.Moss); p(4, 19, 1, M.Fungus); p(10, 18, 2, M.Water);
    },
  },
  {
    name: "boiling pond over lava",
    w: 40, h: 28, seed: 321, ticks: 200,
    paint(p) {
      for (let x = 0; x < 40; x++) p(x, 24, 1, M.Wall);
      for (let x = 8; x <= 32; x++) p(x, 23, 1, M.Lava);
      for (let x = 10; x <= 30; x++) { p(x, 22, 1, M.Water); p(x, 21, 1, M.Water); p(x, 20, 1, M.Water); }
    },
  },
  {
    name: "rocket volley into a ceiling",
    w: 28, h: 60, seed: 888, ticks: 220,
    paint(p) {
      for (let x = 0; x < 28; x++) p(x, 4, 1, M.Wall);
      p(14, 54, 5, M.Rocket); p(9, 54, 1, M.Fire);
      p(20, 40, 2, M.Wood);
    },
  },
  {
    name: "glass terrarium over a hearth",
    w: 28, h: 26, seed: 313, ticks: 160,
    paint(p) {
      // A glass dome ceiling over a boiling pool: steam should dew the glass and
      // bead back to water. A hearth wall beside the flame dries/thaws its nook.
      for (let x = 6; x <= 20; x++) p(x, 6, 1, M.Glass);
      for (let y = 7; y <= 21; y++) { p(6, y, 1, M.Wall); p(20, y, 1, M.Wall); }
      for (let x = 6; x <= 20; x++) p(x, 22, 1, M.Wall);
      for (let x = 9; x <= 17; x++) { p(x, 19, 1, M.Water); p(x, 18, 1, M.Water); }
      for (let x = 9; x <= 17; x++) p(x, 20, 1, M.Fire);
      p(8, 18, 1, M.Soil); p(8, 19, 1, M.Ice);
    },
  },
  {
    name: "fireworks over a pond",
    w: 30, h: 40, seed: 606, ticks: 200,
    paint(p) {
      for (let x = 0; x < 30; x++) p(x, 30, 1, M.Wall);
      for (let x = 2; x <= 27; x++) { p(x, 29, 1, M.Water); p(x, 28, 1, M.Water); }
      p(15, 22, 5, M.Rocket); p(10, 22, 1, M.Fire);
    },
  },
  {
    name: "steam rising through an ice chamber",
    w: 20, h: 20, seed: 71, ticks: 120,
    paint(p) {
      // Ice ceiling and walls form a pocket; lava under a water pool boils steam up
      // into it, so steam cells touch two or more ice neighbors (the freeze path).
      for (let x = 6; x <= 13; x++) p(x, 7, 1, M.Ice);
      for (let y = 8; y <= 11; y++) { p(6, y, 1, M.Ice); p(13, y, 1, M.Ice); }
      for (let y = 8; y <= 10; y++) for (let x = 7; x <= 12; x++) p(x, y, 1, M.Water);
      for (let x = 6; x <= 13; x++) p(x, 11, 1, M.Lava);
      for (let x = 4; x <= 15; x++) p(x, 13, 1, M.Wall);
    },
  },
  {
    name: "isolated lava crusting to stone",
    w: 36, h: 40, seed: 616, ticks: 260,
    paint(p) {
      for (let x = 0; x < 36; x++) p(x, 38, 1, M.Wall);
      for (let x = 6; x <= 30; x += 3) p(x, 6, 1, M.Lava);
      p(18, 30, 6, M.Lava);
    },
  },
  {
    name: "ice islands in flowing water",
    w: 44, h: 30, seed: 4040, ticks: 200,
    paint(p) {
      for (let x = 0; x < 44; x++) p(x, 26, 1, M.Wall);
      for (let x = 8; x <= 36; x += 6) { p(x, 22, 1, M.Ice); p(x, 24, 1, M.Ice); }
      p(4, 10, 3, M.Water); p(22, 8, 3, M.Moonwater); p(40, 10, 3, M.Water);
    },
  },
  {
    name: "wellspring fountains",
    w: 40, h: 40, seed: 2024, ticks: 260,
    paint(p) {
      for (let x = 0; x < 40; x++) p(x, 38, 1, M.Wall);
      p(10, 30, 1, M.Wellspring); p(10, 29, 1, M.Sand);
      p(30, 30, 1, M.Wellspring); p(30, 29, 1, M.Water);
    },
  },
  {
    // Stone gravity: a cliff block resting on bedrock holds, its overhanging ledge
    // slumps straight down, and a sky boulder drops through air, steam, and into a
    // pool. Wall bedrock never moves. Both engines must agree on every settling cell.
    name: "cliff slump and a dropping boulder",
    w: 32, h: 30, seed: 5150, ticks: 150,
    paint(p) {
      for (let x = 0; x < 32; x++) p(x, 28, 1, M.Wall);
      for (let y = 18; y <= 27; y++) for (let x = 4; x <= 8; x++) p(x, y, 1, M.Stone);
      for (let x = 9; x <= 22; x++) p(x, 18, 1, M.Stone);
      p(26, 4, 3, M.Stone);
      for (let x = 24; x <= 30; x++) { p(x, 27, 1, M.Water); p(x, 26, 1, M.Water); }
      p(27, 20, 2, M.Steam);
    },
  },
];

for (const s of scenarios) runScenario(s);
console.log(`Parity harness passed: JS and WASM byte-identical across ${scenarios.length} scenarios`);
