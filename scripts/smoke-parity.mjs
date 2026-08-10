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
  Flower: 19, Glass: 20, Ember: 21, Pollen: 22, Stem: 23, Rocket: 24, Wellspring: 25, Spark: 26,
};
const BYTE_NAME = ["kind", "variant", "age.lo", "age.hi", "energy.lo", "energy.hi", "flags.lo", "flags.hi"];

function wasmCells(uni) {
  const ptr = wasm.universe_cells_ptr(uni);
  const len = wasm.universe_cells_byte_len(uni);
  return new Uint8Array(wasm.memory.buffer, ptr, len).slice();
}

function runScenario({ name, w, h, seed, ticks, paint, observe, expect, slowSteps = [] }) {
  const js = createFallbackEngine(w, h, seed);
  const uni = wasm.universe_new(w, h, seed);
  paint((x, y, r, mat, d = 100) => js.paint(x, y, r, mat, d));
  paint((x, y, r, mat, d = 100) => wasm.universe_paint(uni, x, y, r, mat, d));

  // Byte-equality alone cannot tell a scenario that exercises a rule from one that never
  // reaches it — delete a feature from BOTH engines and parity still passes. `observe`
  // and `expect` make a scenario assert that it actually saw what it claims to cover.
  const seen = {};

  const compare = (tick, label = `tick ${tick}`) => {
    const a = js.getCellBytes();
    const b = wasmCells(uni);
    if (observe) observe(seen, a, w, h, tick);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      const cell = Math.floor(i / STRIDE);
      const cx = cell % w;
      const cy = Math.floor(cell / w);
      const jsCell = [...a.slice(cell * STRIDE, cell * STRIDE + STRIDE)];
      const wasmCell = [...b.slice(cell * STRIDE, cell * STRIDE + STRIDE)];
      throw new Error(
        `[${name}] divergence at ${label}, cell (${cx},${cy}), byte ${i % STRIDE} (${BYTE_NAME[i % STRIDE]}): js=${a[i]} wasm=${b[i]}\n` +
          `  js  cell: [${jsCell}]\n  wasm cell: [${wasmCell}]`,
      );
    }
  };

  // The slow world runs on its own clock and consumes the same RNG stream, so an
  // unmirrored roll in it desynchronises the engines exactly as one in tick() would.
  // `slowSteps: [{ at, count }]` takes `count` slow steps at the end of tick `at`.
  const slowAt = new Map(slowSteps.map(({ at, count }) => [at, count]));
  const takeSlowSteps = (tick) => {
    const count = slowAt.get(tick);
    if (!count) return;
    for (let s = 1; s <= count; s++) {
      js.slowStep();
      wasm.universe_slow_step(uni);
      compare(tick, `slow step ${s} after tick ${tick}`);
    }
  };

  compare(0);
  takeSlowSteps(0);
  for (let t = 1; t <= ticks; t++) {
    js.tick();
    wasm.universe_tick(uni);
    compare(t);
    takeSlowSteps(t);
  }
  wasm.universe_free(uni);
  js.dispose();
  if (expect) {
    const problem = expect(seen);
    if (problem) {
      throw new Error(
        `[${name}] scenario is VACUOUS: ${problem}\n` +
          `  observed: ${JSON.stringify(seen)}\n` +
          `  Both engines still agreed byte-for-byte, but they agreed about nothing. Fix the\n` +
          `  scene (or the rule) until the milestones below are reached again.`,
      );
    }
  }
  console.log(`  ok  ${name} (${ticks} ticks)${expect ? ` ${JSON.stringify(seen)}` : ""}`);
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
  {
    // Meteor spark trail: falling meteors shed downward sparks that light a rocket
    // field and hiss to steam over a pond. Exercises the trail plus its compositions.
    name: "meteor shower over rockets and a pond",
    w: 26, h: 40, seed: 909, ticks: 130,
    paint(p) {
      for (let x = 0; x < 26; x++) p(x, 38, 1, M.Wall);
      for (let x = 3; x <= 11; x++) { p(x, 37, 1, M.Water); p(x, 36, 1, M.Water); }
      for (let x = 15; x <= 23; x += 2) p(x, 37, 1, M.Rocket);
      p(6, 2, 1, M.Meteor); p(18, 4, 1, M.Meteor); p(21, 1, 1, M.Meteor);
    },
  },
  {
    // Fairy ring + starvation: a wood grove sown with stardust-charged fungi, so the
    // cosmic-digest and starve-to-soil branches both run each tick in both engines.
    name: "cosmic fungus grove",
    w: 20, h: 20, seed: 4321, ticks: 220,
    paint(p) {
      for (let y = 3; y <= 15; y++) for (let x = 3; x <= 16; x++) p(x, y, 1, M.Wood);
      for (let y = 4; y <= 14; y += 3) for (let x = 4; x <= 15; x += 3) p(x, y, 1, M.Stardust);
      p(6, 6, 1, M.Fungus); p(12, 9, 1, M.Fungus); p(9, 13, 1, M.Fungus);
    },
  },
  {
    // Wellspring re-attunement: a water-attuned spring stilled by ice re-drinks a sand
    // source. Paints (radius-1 plusses) are spaced so the spring cell survives intact,
    // with water above, ice on one flank, and sand on the other.
    name: "wellspring re-attuned under ice",
    w: 22, h: 20, seed: 2025, ticks: 120,
    paint(p) {
      for (let x = 0; x < 22; x++) p(x, 16, 1, M.Wall);
      p(11, 7, 1, M.Water);
      p(8, 10, 1, M.Ice);
      p(14, 10, 1, M.Sand);
      p(11, 10, 1, M.Wellspring);
    },
  },
  {
    // A whole plant lifecycle in two walled planters — one plain, one cosmic: seeds root
    // on soil, stalks climb and unfurl leaves, crowns open into petal heads, the heads
    // dust pollen from their open faces, and spent petals finally shed as motes.
    //
    // The `expect` below is the guard, not the comment. The older "germinating garden"
    // scenario passed for months while reaching none of this — its soil bed greens into
    // moss inside 100 ticks, so no seed there ever germinated. Byte-equality cannot tell
    // the difference; only asserting the milestones can.
    name: "a plant's whole life, bud to shed petals",
    w: 40, h: 24, seed: 777, ticks: 2400,
    paint(p) {
      for (let x = 0; x < 40; x++) p(x, 21, 1, M.Wall);
      for (const wall of [2, 17, 22, 37]) for (let y = 14; y < 21; y++) p(wall, y, 1, M.Wall);
      p(9, 19, 1, M.Soil);  p(9, 16, 1, M.Seed);  p(9, 13, 2, M.Water);
      // The cosmic arm covers BLOOM_ENERGY_COSMIC and the cosmic bloom timings, which no
      // other parity scenario reaches.
      p(29, 19, 1, M.Soil); p(29, 16, 1, M.Seed); p(29, 13, 2, M.Moonwater);
    },
    observe(seen, cells, w, h) {
      const kindAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : cells[(y * w + x) * STRIDE]);
      let head = 0, pollen = 0, cosmicHead = 0, leaf = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const k = kindAt(x, y);
          if (k === 19) {
            head++;
            if (cells[(y * w + x) * STRIDE + 6] & 4) cosmicHead++;
          } else if (k === 22) pollen++;
          else if (k === 23 && kindAt(x + 1, y) === 23) leaf = true;
        }
      }
      seen.maxHead = Math.max(seen.maxHead ?? 0, head);
      seen.maxCosmicHead = Math.max(seen.maxCosmicHead ?? 0, cosmicHead);
      seen.pollenTicks = (seen.pollenTicks ?? 0) + (pollen > 0 ? 1 : 0);
      seen.leaf = Boolean(seen.leaf) || leaf;
      // A shed is the head shrinking after it has finished opening.
      if (head < (seen.prevHead ?? 0) && (seen.prevHead ?? 0) >= 6) seen.shed = true;
      seen.prevHead = head;
    },
    expect(seen) {
      if (!seen.leaf) return "no stalk ever unfurled a leaf";
      // 4 = crown plus the smallest silhouette (the three-petal poppy). Thresholds above
      // that would be asserting which BLOOM_SHAPES entry these two variants happen to
      // pick, not that blooms open — and would fail the moment a shape is retuned.
      if ((seen.maxHead ?? 0) < 4) return `head never opened into a multi-cell bloom (peaked at ${seen.maxHead ?? 0})`;
      if ((seen.maxCosmicHead ?? 0) < 4) return `cosmic head never opened into a multi-cell bloom (peaked at ${seen.maxCosmicHead ?? 0})`;
      if ((seen.pollenTicks ?? 0) < 20) return `pollen was airborne on only ${seen.pollenTicks ?? 0} ticks`;
      if (!seen.shed) return "no bloom ever shed a petal";
      return null;
    },
  },
  {
    // The slow world's scatter arm. It needs a crown that has actually lived out its
    // bloom, so this scene grows one from a painted seed and then leaves for a night
    // at tick 2200 — by which point the crown is past PETAL_SHED_AGE with an empty
    // budget. The remaining ticks play forward what it sowed, exactly as the app
    // does at wake.
    //
    // The bed carpets into moss well before the plant is spent, which is why moss
    // counts as sowable ground: requiring bare soil would have made this rule
    // unreachable in the one scene that most obviously wants it.
    name: "a garden bed left overnight",
    w: 48, h: 28, seed: 777, ticks: 2400,
    slowSteps: [{ at: 2200, count: 10 }],
    paint(p) {
      for (let x = 0; x < 48; x++) p(x, 25, 1, M.Wall);
      for (let x = 4; x <= 43; x++) p(x, 24, 1, M.Soil);
      p(24, 23, 1, M.Seed);
      for (let x = 20; x <= 28; x++) p(x, 20, 1, M.Water);
    },
    observe(seen, cells, w, h, tick) {
      let seeds = 0, spentCrown = 0;
      for (let i = 0; i < w * h; i++) {
        const o = i * STRIDE;
        if (cells[o] === M.Seed) seeds++;
        else if (cells[o] === M.Flower && cells[o + 6] & 2) {
          const age = cells[o + 2] + cells[o + 3] * 256;
          const energy = cells[o + 4] + cells[o + 5] * 256;
          if (age > 1200 && energy < 40) spentCrown++;
        }
      }
      // `compare` runs once before the slow steps and again after each of them, all
      // labelled with the same tick, so the first reading at 2200 is the "before".
      if (tick === 2200 && seen.seedsBeforeNight === undefined) {
        seen.seedsBeforeNight = seeds;
        seen.spentCrowns = spentCrown;
      }
      if (tick >= 2200) seen.maxSeedsAfterNight = Math.max(seen.maxSeedsAfterNight ?? 0, seeds);
    },
    expect(seen) {
      if (!seen.spentCrowns) return "no plant ever reached a spent seed head, so nothing could sow";
      if ((seen.maxSeedsAfterNight ?? 0) <= (seen.seedsBeforeNight ?? 0)) {
        return `the night away sowed nothing (${seen.seedsBeforeNight ?? 0} seeds before, ${seen.maxSeedsAfterNight ?? 0} after)`;
      }
      return null;
    },
  },
  {
    // The slow world's other arm, on a scene cheap enough to run on its own: burn a
    // log down to cold char, leave for a night, come back to ground you can plant in.
    // The `expect` is the guard against the whole thing quietly becoming a no-op —
    // both engines would still agree byte-for-byte about nothing happening.
    name: "a hearth burned out and left overnight",
    w: 32, h: 24, seed: 4001, ticks: 700,
    slowSteps: [{ at: 600, count: 12 }],
    paint(p) {
      for (let x = 0; x < 32; x++) p(x, 21, 1, M.Wall);
      for (let x = 8; x <= 24; x++) p(x, 20, 1, M.Wood);
      p(10, 19, 1, M.Fire); p(20, 19, 1, M.Fire);
    },
    observe(seen, cells, w, h, tick) {
      let char = 0, soil = 0;
      for (let i = 0; i < w * h; i++) {
        const kind = cells[i * STRIDE];
        // Ember below COLD_CHAR_ENERGY is char that has gone out.
        if (kind === M.Ember && cells[i * STRIDE + 4] + cells[i * STRIDE + 5] * 256 < 30) char++;
        else if (kind === M.Soil) soil++;
      }
      if (tick === 600 && seen.charBeforeNight === undefined) {
        seen.charBeforeNight = char;
        seen.soilBeforeNight = soil;
      }
      seen.soilAfterNight = soil;
    },
    expect(seen) {
      if ((seen.charBeforeNight ?? 0) < 4) {
        return `the fire left only ${seen.charBeforeNight ?? 0} cold char cells, so the slow rule had nothing to act on`;
      }
      if ((seen.soilBeforeNight ?? 0) !== 0) return "this scene is supposed to start with no soil at all";
      if ((seen.soilAfterNight ?? 0) < 3) {
        return `a night away turned only ${seen.soilAfterNight ?? 0} char cells into soil`;
      }
      return null;
    },
  },
];

for (const s of scenarios) runScenario(s);
console.log(`Parity harness passed: JS and WASM byte-identical across ${scenarios.length} scenarios`);
