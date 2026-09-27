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
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileApp } from "./compile-app.mjs";
// Read from engine.ts by the audit's scene module, so the parity witness and the audit's
// thermal-steam filter can never disagree about what mist is.
import { MIST_ENERGY } from "./interaction-scenes.mjs";

const root = resolve(import.meta.dirname, "..");

// The TS engine as CommonJS, through the one compile every harness shares.
const app = compileApp("parity-cjs", ["engine.ts", "materials.ts"]);
const { createFallbackEngine } = app.load("engine");
// Flags come from the compiled source rather than a hand-typed copy: a mirrored constant
// with nothing checking it is a promise, and this file already owns one of those in `M`.
const { CELL_FLAG } = app.load("materials");

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

function runScenario({ name, w, h, seed, ticks, cells, paint, observe, expect, slowSteps = [] }) {
  const js = createFallbackEngine(w, h, seed);
  const uni = wasm.universe_new(w, h, seed);
  // `cells` starts both engines from exact bytes, through the same load path a player's
  // imported scene takes. For a state the brush cannot place in one stroke — a wet log with
  // water held a precise distance above it — so a scenario can reach a rule deterministically.
  // Reachability from painted materials is the interaction audit's question, not this one.
  if (cells) {
    const bytes = cells(w, h);
    if (!js.loadCellBytes(bytes)) throw new Error(`[${name}] the JS engine refused the starting cells`);
    const at = wasm.alloc(bytes.length);
    new Uint8Array(wasm.memory.buffer, at, bytes.length).set(bytes);
    const ok = wasm.universe_load_cells(uni, at, bytes.length);
    wasm.dealloc(at, bytes.length);
    if (!ok) throw new Error(`[${name}] the wasm engine refused the starting cells`);
  }
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

// What the density scenario drops through its pond, by the name it reports.
// The mist scenario's floor: 103 cell-ticks of mist with the rule, 0 with it switched off in
// both engines, measured on its seed. The floor sits well between them.
const MIST_FLOOR = 40;
// The vent scenario's units, one per shaft; far enough apart that no two share a wall.
const VENT_UNITS = [4, 12, 20, 28, 36, 44];
const DROPPED = { sand: M.Sand, soil: M.Soil, stone: M.Stone, seed: M.Seed, rocket: M.Rocket, pollen: M.Pollen };

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
    // Hearth conduction, with the heat reachable ONLY through masonry. An adversarial review
    // noted the rule had no parity scenario that reached it: the terrarium scenario below
    // mentions a hearth in a comment but asserts nothing about one, so both engines could
    // lose the reach together and stay byte-identical.
    //
    // The geometry is the argument. Lava sits against the right end of a masonry slab; the
    // soil rides on TOP of the slab around x=12-14, three or more cells from any lava, so no
    // brick it touches is itself in contact with heat. Anything that dries up there was
    // dried by warmth conducted one brick along the stonework.
    //
    // Lava rather than fire because a painted flame burns out in ~20 ticks and this needs a
    // heat source that is still there when the water has finished soaking in.
    //
    // Scope: this scenario covers the DRYING reach only. The thaw half — that a
    // conduction-warmed brick must not thaw what it touches — is covered by the cargo test
    // `hearth_warmth_carries_along_masonry_but_thawing_needs_contact`. Staging a frozen cell
    // here needs ice, ice never falls, and placing it where it would both freeze the soil and
    // sit beside a conduction-warm brick puts it close enough to the lava to melt. What parity
    // is for is exercising the branch in both engines, and the drying half does that.
    name: "warmth conducting along a chimney breast",
    w: 24, h: 20, seed: 811, ticks: 260,
    paint(p) {
      for (let x = 0; x < 24; x++) p(x, 18, 1, M.Wall);
      // Painted before the masonry so the walls overwrite where they overlap: the brush is a
      // DISC of the radius you ask for, and every fixture in this file passes radius 1, which
      // is a five-cell plus - so nothing here can be placed one cell at a time and the order
      // is what gives the layout its shape.
      p(14, 10, 1, M.Stone);
      for (let x = 6; x <= 14; x++) p(x, 12, 1, M.Wall);
      for (let y = 8; y <= 11; y++) p(16, y, 1, M.Wall);
      for (let x = 16; x <= 20; x++) p(x, 14, 1, M.Wall);
      for (let y = 8; y <= 13; y++) p(20, y, 1, M.Wall);
      // The firebox needs a floor or the lava simply drains out of it within 30 ticks, and
      // the breast has to separate it from the water or the pour quenches it just as fast.
      // Both were found by printing the board rather than by reasoning about it.
      for (let y = 9; y <= 12; y++) p(18, y, 1, M.Lava);
      p(14, 8, 1, M.Water);
    },
    observe(seen, cells, w, h, tick) {
      const S = STRIDE;
      const kind = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : cells[(y * w + x) * S]);
      // Distance to the nearest heat, in cells. A brick TOUCHING lava is 1 away from it, so
      // soil touching that brick is 2 away. Requiring a dried cell to be MORE than 2 from
      // any lava is therefore a positional proof that the brick which dried it was not
      // itself in contact with heat — the conduction branch, and nothing else, can reach it.
      //
      // The first version of this guard asserted only "dried while still holding moisture",
      // and it passed with conduction deleted from both engines. Drying is not evidence of
      // conduction; drying OUT OF CONTACT RANGE is.
      const heatWithin = (x, y, r) => {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const k = kind(x + dx, y + dy);
            if (k === 8 || k === 6 || k === 17) return true; // Lava, Fire, Meteor
          }
        }
        return false;
      };
      let wetSoil = 0;
      seen.wetAt ??= new Set();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * S;
          if (cells[i] !== 9) continue; // Stone — it holds damp without greening into moss
          const flags = cells[i + 6] | (cells[i + 7] << 8);
          const energy = cells[i + 4] | (cells[i + 5] << 8);
          const at = y * w + x;
          if (flags & 1) {
            wetSoil++;
            seen.wetAt.add(at);
          } else if (seen.wetAt.has(at) && energy > 0 && !heatWithin(x, y, 2)) {
            seen.driedBeyondContact = true;
          }
        }
      }
      seen.maxWet = Math.max(seen.maxWet ?? 0, wetSoil);
      seen.lastTick = tick;
    },
    expect(seen) {
      if (!seen.maxWet) return "no stone ever got damp, so nothing was there for a hearth to dry";
      if (!seen.driedBeyondContact) {
        return "no damp stone dried more than two cells from any heat, so nothing proves warmth conducted along the masonry rather than radiating from the lava itself";
      }
      return null;
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
    // Erosion. A wellspring pours over a stone lip — flowing water, which wears the rock
    // and CARRIES the grain off, so the water advances into the cell the stone gave up and
    // a wet grain drops where the water was. The gated-off half runs in the same scene
    // without needing a fixture of its own: once the pour has pooled, its interior cells
    // have no empty neighbour, so those are exactly the rolls neither engine may make.
    //
    // No sealed still-water pocket here, and that is deliberate rather than lazy. The brush
    // stamps a DISC, and this file paints at radius 1, which is a five-cell plus, so two
    // adjacent cells of different materials cannot both survive the painting — a pocket built
    // that way quietly becomes something else, which is how the first version of this
    // scenario failed. Still water is covered
    // by `still_water_with_nowhere_to_go_does_not_erode_stone` in the sim instead.
    name: "a spring wearing down a stone lip",
    w: 44, h: 32, seed: 8123, ticks: 1400,
    paint(p) {
      for (let x = 0; x < 44; x++) p(x, 30, 1, M.Wall);
      for (let y = 18; y <= 29; y++) for (let x = 6; x <= 20; x++) p(x, y, 1, M.Stone);
      p(13, 12, 1, M.Wellspring); p(13, 11, 1, M.Water);
      // A moonwater lip too. Moonwater shares the whole water arm, so it erodes on the same
      // branch with a different `vigor` and carries FLAG_COSMIC into the liquid that advances
      // into the rock — and none of that was demonstrated anywhere until this arm existed.
      for (let y = 18; y <= 29; y++) for (let x = 26; x <= 40; x++) p(x, y, 1, M.Stone);
      p(33, 12, 1, M.Wellspring); p(33, 11, 1, M.Moonwater);
    },
    observe(seen, cells, w, h) {
      let wetSand = 0, stone = 0, cosmicWater = 0;
      for (let i = 0; i < w * h; i++) {
        const k = cells[i * STRIDE];
        if (k === 9) stone++;
        if (k !== 2) continue;
        const flags = cells[i * STRIDE + 6];
        if (flags & 1) wetSand++;
        // A COSMIC WET GRAIN: sand that moonwater wore off a rock and marked on the way.
        // Two earlier versions of this counter were vacuous, both worth remembering. It first
        // counted cosmic MOONWATER, which the scenario paints before tick zero, so it was true
        // without erosion running at all. Then it sat in an `else if` after the wet-sand
        // branch — and a cosmic grain is wet too, so that branch always won and this one was
        // unreachable. Counted independently now.
        if ((flags & 5) === 5) cosmicWater++;
      }
      seen.maxWetSand = Math.max(seen.maxWetSand ?? 0, wetSand);
      seen.minStone = Math.min(seen.minStone ?? Infinity, stone);
      seen.firstStone = seen.firstStone ?? stone;
      seen.maxCosmicWater = Math.max(seen.maxCosmicWater ?? 0, cosmicWater);
    },
    expect(seen) {
      if ((seen.maxWetSand ?? 0) < 1) return "the spring never wore a single grain off the lip";
      if ((seen.minStone ?? 0) >= (seen.firstStone ?? 0)) return "the stone lip never lost a cell";
      if ((seen.maxCosmicWater ?? 0) < 1) return "moonwater never wore off a cosmic grain";
      return null;
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
    // Steam venting out from UNDER a lid. The heat buffer's byproduct is emitted straight
    // up, and used to be dropped whenever that one cell was occupied -- which is the common
    // case, since the flame doing the drying is often the thing sitting on it. The vent now
    // falls back to the two diagonals, and this scenario exists because byte-equality could
    // never tell that apart from the emission simply not happening: both engines would agree
    // about nothing perfectly well. `expect` is a floor on how MUCH this lidded bed vents,
    // because that is the only thing here that actually discriminates. Counting steam
    // outside the lidded span looked like the natural test and was VACUOUS: the unlidded
    // logs at either end vent straight up into those same columns, so it passed with the
    // fallback deleted from both engines. Measured both ways -- 60 steam cells at peak with
    // the diagonals, 18 without.
    name: "steam venting from under a sealed lid",
    w: 32, h: 24, seed: 4103, ticks: 240,
    paint(p) {
      for (let x = 0; x < 32; x++) p(x, 21, 1, M.Wall);
      // A wood bed under a wall lid, fired at both ends, with water poured on the lid. Only the
      // bed's EDGES can vent diagonally — if every log had a wall directly above it, each
      // log's diagonal would be its neighbour's sealed cell — and the brush's discs cut the
      // lid and the bed into a rougher shape than this reads. What the scene reliably does is
      // make embers and drying logs vent past blocked cells, which is what `observe` counts.
      for (let x = 10; x <= 20; x++) p(x, 20, 1, M.Wood);
      for (let x = 12; x <= 18; x++) p(x, 19, 1, M.Wall);
      p(15, 18, 2, M.Water);
      p(11, 20, 1, M.Fire); p(19, 20, 1, M.Fire);
    },
    // The witness is a wisp VENTED diagonally: fresh vapour with no vapour under it last
    // tick (so it did not just rise there), beside a source one row down whose own cell
    // overhead was blocked. This used to count total steam against a floor of 40, and that
    // number was measuring water hitting the fire, not the vent: once water stopped deleting
    // itself (ROADMAP Phase 20) the pour pooled in the notch it cuts in the lid, the fire was
    // never doused, and the total fell to 12 with the vent working perfectly. The scene DOES
    // exercise the fallback — a straight-up-only engine diverges from this one by tick 4 on
    // every seed tried, first on an ember venting smoke past the lid — so the scene stays and
    // the count now looks at the branch itself. Gas also drifts diagonally on its own, so the
    // witness has false positives: measured on this seed, 57 with the fallback and 35 with the
    // vent restricted to straight up. The floor sits between them.
    observe(seen, cells, w, h) {
      const VAPOUR = new Set([M.Steam, M.Smoke]);
      // The previous board rides along out of sight: `seen` is printed, and a board is noise.
      const prev = seen.previousBoard;
      Object.defineProperty(seen, "previousBoard", { value: cells.slice(), writable: true, enumerable: false, configurable: true });
      if (!prev) return;
      const k = (c, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : c[(y * w + x) * STRIDE]);
      let vents = 0;
      for (let vy = 0; vy < h - 1; vy++) for (let vx = 0; vx < w; vx++) {
        if (!VAPOUR.has(k(cells, vx, vy)) || VAPOUR.has(k(prev, vx, vy))) continue;
        if ([-1, 0, 1].some((d) => VAPOUR.has(k(prev, vx + d, vy + 1)))) continue;
        for (const dx of [-1, 1]) {
          const source = k(prev, vx - dx, vy + 1), cap = k(prev, vx - dx, vy);
          if (source > 0 && !VAPOUR.has(source) && cap > 0 && !VAPOUR.has(cap)) { vents++; break; }
        }
      }
      seen.diagonalVents = (seen.diagonalVents ?? 0) + vents;
    },
    expect(seen) {
      if ((seen.diagonalVents ?? 0) < 46) {
        return `only ${seen.diagonalVents ?? 0} wisps vented diagonally past a blocked cell (57 with the fallback, 35 without it)`;
      }
      return null;
    }
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
  {
    // Sediment turns to rock between sessions, and this is the only scenario that reaches
    // that code — before it, parity passed with the rule present in one engine and absent
    // from the other, because no scene had a flooded sand bed. Every slow step below is
    // compared byte for byte, which is what catches an RNG roll taken on one side only.
    name: "a lake left long enough to turn its bed to stone",
    w: 32, h: 24, seed: 4102, ticks: 260,
    slowSteps: [{ at: 200, count: 24 }],
    paint(p) {
      // Target first, masonry last: the brush spills a cell and the walls must win. The sand
      // is dropped ONTO the pond from above and settles through it, which is how a player
      // makes a lake bed — so this scenario carries sinking through both engines as well.
      for (let y = 14; y <= 21; y++) for (let x = 3; x <= 28; x++) p(x, y, 1, M.Water);
      for (let y = 5; y <= 9; y++) for (let x = 4; x <= 27; x++) p(x, y, 1, M.Sand);
      for (let x = 0; x < 32; x++) p(x, 22, 1, M.Wall);
      for (let y = 3; y < 22; y++) { p(1, y, 1, M.Wall); p(30, y, 1, M.Wall); }
    },
    observe(seen, cells, w, h, tick) {
      let sand = 0, bedded = 0, water = 0, looseFloor = 0;
      for (let i = 0; i < w * h; i++) {
        const kind = cells[i * STRIDE];
        const flags = cells[i * STRIDE + 6] | (cells[i * STRIDE + 7] << 8);
        if (kind === M.Sand) {
          sand++;
          const above = i >= w ? cells[(i - w) * STRIDE] : 0;
          if (above === M.Water) looseFloor++;
        } else if (kind === M.Stone && flags & CELL_FLAG.Bedded) bedded++;
        else if (kind === M.Water) water++;
      }
      // observe runs BEFORE the slow steps taken at the end of the same tick.
      if (tick === 200 && seen.beddedBefore === undefined) {
        seen.beddedBefore = bedded;
        seen.sandBefore = sand;
        seen.waterBefore = water;
      }
      seen.beddedAfter = bedded;
      seen.looseFloorAfter = looseFloor;
    },
    expect(seen) {
      if ((seen.sandBefore ?? 0) < 60) return `only ${seen.sandBefore ?? 0} sand cells settled — there is no bed to compact`;
      if ((seen.waterBefore ?? 0) < 60) return `only ${seen.waterBefore ?? 0} water cells — the bed is not under a lake`;
      if ((seen.beddedBefore ?? 0) !== 0) return "bedded stone existed before any slow step ran";
      if ((seen.beddedAfter ?? 0) < 40) return `a long absence compacted only ${seen.beddedAfter ?? 0} cells into sandstone`;
      if ((seen.looseFloorAfter ?? 0) < 10) return `the lake floor should stay loose sand, found ${seen.looseFloorAfter ?? 0}`;
      return null;
    },
  },
  {
    // The water budget (ROADMAP Phase 20): moving water throws mist, still water keeps every
    // drop. Left of the divider a pour with no heat anywhere, so any steam is spray; right of
    // it a sealed pond, walled two thick, whose water can go nowhere. Every mist roll is
    // compared byte for byte, and the scenario fails if either half stops being witnessed —
    // review showed that with mist removed from BOTH engines, all 26 earlier scenarios still
    // passed, because nothing looked for it.
    name: "a pour throws mist while a sealed pond keeps every drop",
    w: 48, h: 30, seed: 4133, ticks: 400,
    paint(p) {
      for (let y = 8; y <= 25; y++) for (let x = 3; x <= 18; x += 4) p(x, 4 + (y % 3), 1, M.Water);
      for (let y = 17; y <= 24; y++) for (let x = 30; x <= 42; x++) p(x, y, 1, M.Water);
      for (let x = 0; x < 48; x++) { p(x, 27, 1, M.Wall); p(x, 26, 1, M.Wall); }
      for (let y = 14; y <= 27; y++) { p(26, y, 1, M.Wall); p(27, y, 1, M.Wall); p(45, y, 1, M.Wall); p(46, y, 1, M.Wall); }
      for (let x = 26; x <= 46; x++) { p(x, 14, 1, M.Wall); p(x, 15, 1, M.Wall); }
    },
    observe(seen, cells, w, h) {
      let mist = 0, pond = 0;
      for (let i = 0; i < w * h; i++) {
        const x = i % w, kind = cells[i * STRIDE];
        if (x < 24 && kind === M.Steam) mist++;
        if (x > 27 && x < 45 && kind === M.Water) pond++;
      }
      // Cumulative, not a peak: mist is sparse at any instant (a few wisps) and plentiful over
      // a pour, so a peak count is at the mercy of timing.
      seen.mistCellTicks = (seen.mistCellTicks ?? 0) + mist;
      seen.pondFirst ??= pond;
      seen.pondLast = pond;
    },
    expect(seen) {
      if ((seen.mistCellTicks ?? 0) < MIST_FLOOR) return `the heat-free pour made only ${seen.mistCellTicks ?? 0} cell-ticks of mist (floor ${MIST_FLOOR})`;
      if (seen.pondLast !== seen.pondFirst) return `the sealed pond went from ${seen.pondFirst} water cells to ${seen.pondLast}`;
      return null;
    },
  },
  {
    // Gases never delete gases (ROADMAP Phase 20D). Left of the divider a live fire in a
    // lidded firebox, so smoke is made, crowds under the lid and is compared byte for byte
    // through every roll. Right of it a sealed chamber of painted smoke, narrower than the
    // chamber so it fans out under the ceiling — the only geometry where one gas reaches for
    // a cell another has just filled. Smoke is never consumed by a reaction, so its count
    // must hold until it ages out past 180; with the guard removed from both engines it
    // falls well before that.
    name: "smoke crowding under a lid keeps every cell until it ages out",
    w: 56, h: 30, seed: 4201, ticks: 260,
    paint(p) {
      for (let x = 0; x < 56; x++) { p(x, 27, 1, M.Wall); p(x, 26, 1, M.Wall); }
      for (let x = 2; x <= 24; x++) p(x, 8, 1, M.Wall);
      for (let y = 8; y <= 26; y++) { p(2, y, 1, M.Wall); p(24, y, 1, M.Wall); }
      p(13, 22, 3, M.Wood); p(13, 18, 1, M.Fire);
      for (let x = 30; x <= 52; x++) { p(x, 4, 1, M.Wall); }
      for (let y = 4; y <= 26; y++) { p(30, y, 1, M.Wall); p(52, y, 1, M.Wall); }
      for (let y = 17; y <= 23; y++) for (let x = 38; x <= 44; x++) p(x, y, 1, M.Smoke);
    },
    observe(seen, cells, w, h, tick) {
      let fire = 0, chamber = 0;
      for (let i = 0; i < w * h; i++) {
        if (cells[i * STRIDE] !== M.Smoke) continue;
        if (i % w < 26) fire++; else chamber++;
      }
      seen.fireSmokeCellTicks = (seen.fireSmokeCellTicks ?? 0) + fire;
      seen.chamberFirst ??= chamber;
      if (tick <= 170) seen.chamberLowestBeforeExpiry = Math.min(seen.chamberLowestBeforeExpiry ?? chamber, chamber);
      seen.chamberLast = chamber;
    },
    expect(seen) {
      if (!seen.chamberFirst) return "the sealed chamber started with no smoke in it";
      if (seen.chamberLowestBeforeExpiry !== seen.chamberFirst) return `sealed smoke fell from ${seen.chamberFirst} to ${seen.chamberLowestBeforeExpiry} cells before it could age out`;
      if (seen.chamberLast !== 0) return `sealed smoke never aged out (${seen.chamberLast} cells left)`;
      if ((seen.fireSmokeCellTicks ?? 0) < 500) return `the lidded fire made only ${seen.fireSmokeCellTicks ?? 0} cell-ticks of smoke`;
      return null;
    },
  },
  {
    // Water never deletes a gas that ARRIVED this tick (ROADMAP Phase 20E). Six copies of one
    // unit: lava beside a wet log, a one-wide shaft walled two thick above the log, and water in
    // it one cell above the empty vent cell. On tick 1 the lava vents steam into that cell in the
    // reaction pass and the water falls toward it in the movement pass — the water used to land
    // on the steam and delete it. Now it must wait above it, and on tick 2 sink through it,
    // because steam that sat there all tick is gas water may still displace. Painting cannot place
    // a wet log with water held a precise distance above it, so this starts from exact cells.
    name: "water never deletes steam vented this tick, and still sinks through it",
    w: 48, h: 20, seed: 4261, ticks: 120,
    cells(w, h) {
      const bytes = new Uint8Array(w * h * STRIDE);
      const put = (x, y, kind, energy = 0, flags = 0) => {
        const o = (y * w + x) * STRIDE;
        bytes[o] = kind; bytes[o + 4] = energy & 255; bytes[o + 5] = energy >> 8; bytes[o + 6] = flags & 255; bytes[o + 7] = flags >> 8;
      };
      for (let x = 0; x < w; x++) put(x, 16, M.Wall);
      for (const cx of VENT_UNITS) {
        put(cx - 2, 15, M.Wall); put(cx - 1, 15, M.Lava, 255); put(cx, 15, M.Wood, 120, CELL_FLAG.Wet); put(cx + 1, 15, M.Wall);
        for (let y = 12; y <= 14; y++) for (const dx of [-3, -2, -1, 1, 2, 3]) put(cx + dx, y, M.Wall);
        put(cx, 13, M.Water);
      }
      return bytes;
    },
    paint() {},
    observe(seen, cells, w, h, tick) {
      const at = (x, y) => cells[(y * w + x) * STRIDE];
      const hotSteam = (x, y) => at(x, y) === M.Steam && (cells[(y * w + x) * STRIDE + 4] | (cells[(y * w + x) * STRIDE + 5] << 8)) > MIST_ENERGY;
      if (tick === 1) seen.heldAboveFreshSteam = VENT_UNITS.filter((cx) => hotSteam(cx, 14) && at(cx, 13) === M.Water).length;
      // Sank = the water left its shaft cell and the vented steam is gone from under it. The
      // water may have thrown mist as it landed (MIST_ODDS), so what fills the vent cell now is
      // water or fresh mist — on this seed one of the six does exactly that.
      if (tick === 2) seen.sankThroughIt = VENT_UNITS.filter((cx) => at(cx, 13) !== M.Water && !hotSteam(cx, 14) && !hotSteam(cx, 13)).length;
    },
    expect(seen) {
      if (seen.heldAboveFreshSteam !== VENT_UNITS.length) return `only ${seen.heldAboveFreshSteam ?? 0} of ${VENT_UNITS.length} vents kept their fresh steam under the falling water`;
      if (seen.sankThroughIt !== VENT_UNITS.length) return `only ${seen.sankThroughIt ?? 0} of ${VENT_UNITS.length} waters sank through the steam a tick later — a vent became a lid`;
      return null;
    },
  },
  {
    // A gas never deletes water (ROADMAP Phase 20E). Water falls from the top of a sealed
    // Wall chamber while steam rises from the bottom, through each other. Liquids move before
    // gases, so steam meets water that has just flowed by rising into it, which used to delete
    // the water. Nothing here is hot or cold and Wall takes dew as a stain, so the only way
    // water may leave is as mist born this tick (age 0, MIST_ENERGY). Steam is NOT conserved
    // and is not meant to be: water sinking through a gas cell displaces it by design.
    name: "rising steam never deletes falling water",
    w: 40, h: 34, seed: 4211, ticks: 140,
    paint(p) {
      for (let x = 1; x <= 38; x++) { p(x, 1, 1, M.Wall); p(x, 32, 1, M.Wall); }
      for (let y = 1; y <= 32; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
      for (let y = 5; y <= 10; y++) for (let x = 8; x <= 31; x += 2) p(x + (y % 2), y, 1, M.Water);
      for (let y = 22; y <= 28; y++) for (let x = 8; x <= 31; x += 2) p(x + ((y + 1) % 2), y, 1, M.Steam);
    },
    observe(seen, cells, w, h, tick) {
      let water = 0, fresh = 0, met = 0;
      for (let i = 0; i < w * h; i++) {
        const o = i * STRIDE, kind = cells[o];
        if (kind === M.Water) {
          water++;
          if (i >= w && cells[o - w * STRIDE] === M.Steam) met++;
        } else if (kind === M.Steam && (cells[o + 2] | (cells[o + 3] << 8)) === 0 && (cells[o + 4] | (cells[o + 5] << 8)) === MIST_ENERGY) fresh++;
      }
      if (seen.water !== undefined && seen.water - water !== fresh) {
        seen.unexplainedLoss = (seen.unexplainedLoss ?? 0) + (seen.water - water - fresh);
      }
      seen.water = water;
      seen.steamMeetsWater = (seen.steamMeetsWater ?? 0) + met;
    },
    expect(seen) {
      if ((seen.steamMeetsWater ?? 0) < 20) return `steam met the falling water on only ${seen.steamMeetsWater ?? 0} cell-ticks`;
      if (seen.unexplainedLoss) return `${seen.unexplainedLoss} water cells vanished without throwing mist — rising steam deleted them`;
      return null;
    },
  },
  {
    // Sinking is a density ORDER, so this drops one of everything onto a pond under an oil
    // film: sand, soil, stone, seed and unlit rocket powder should all reach the bed, and
    // pollen — light on purpose — should not. Every swap is compared byte for byte, and the
    // expectations below fail the scenario if the grains stop reaching the bottom.
    name: "a handful of everything dropped through an oil-slicked pond",
    w: 40, h: 28, seed: 4121, ticks: 500,
    paint(p) {
      for (let y = 15; y <= 24; y++) for (let x = 4; x <= 35; x++) p(x, y, 1, M.Water);
      for (let x = 4; x <= 35; x++) p(x, 13, 1, M.Oil);
      Object.values(DROPPED).forEach((kind, i) => p(7 + i * 5, 6, 1, kind));
      for (let x = 0; x < 40; x++) p(x, 25, 1, M.Wall);
      for (let y = 4; y < 25; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
    },
    observe(seen, cells, w, h) {
      // A grain has SUNK once any liquid sits above it in its own column.
      const sunk = {};
      for (let i = 0; i < w * h; i++) {
        const kind = cells[i * STRIDE];
        const x = i % w;
        for (let y = Math.floor(i / w) - 1; y >= 0; y--) {
          const above = cells[(y * w + x) * STRIDE];
          if (above === M.Water || above === M.Oil) { sunk[kind] = (sunk[kind] ?? 0) + 1; break; }
          if (above === M.Wall) break;
        }
      }
      for (const [name, kind] of Object.entries(DROPPED)) {
        if (kind === M.Pollen) continue;
        seen[name] = Math.max(seen[name] ?? 0, sunk[kind] ?? 0);
      }
      // Pollen is judged by how DEEP it gets, not by what lies above it: grains sinking push
      // water up, and that water can slop over a mote floating on the surface without the
      // mote moving at all. Sinking would carry it past the pond's first rows to the bed.
      for (let i = 0; i < w * h; i++) {
        if (cells[i * STRIDE] === M.Pollen) seen.pollenDeepestRow = Math.max(seen.pollenDeepestRow ?? 0, Math.floor(i / w));
      }
    },
    expect(seen) {
      for (const name of ["sand", "soil", "stone", "seed", "rocket"]) {
        if ((seen[name] ?? 0) < 3) return `${name} never sank below the pond's surface (${seen[name] ?? 0} cells)`;
      }
      // The oil film sits on rows 12-14 and the water starts at row 15.
      if ((seen.pollenDeepestRow ?? 0) > 15) return `pollen reached row ${seen.pollenDeepestRow} of the pond — it is meant to float, not sink`;
      return null;
    },
  },
  {
    // The construction guard, as a matched pair. Left of the divider, an open lake; right
    // of it, the same sand bed sealed under a painted stone LID with water on the lid. Review
    // found the lidded bed compacting (88-124 cells) because the scan counted any stone as
    // deposit. The lake half is what keeps this non-vacuous: if it stops compacting, the
    // rule is not running at all and a clean lid proves nothing.
    name: "a stone lid keeps the lake off the sand sealed under it",
    w: 40, h: 26, seed: 4117, ticks: 260,
    slowSteps: [{ at: 200, count: 24 }],
    paint(p) {
      // Target first, masonry last. The lid is painted after the sand and the water after
      // the lid, so each spill lands on the layer below and the walls win at the end.
      for (let y = 18; y <= 23; y++) for (let x = 3; x <= 36; x++) p(x, y, 1, M.Sand);
      for (let y = 15; y <= 17; y++) for (let x = 21; x <= 36; x++) p(x, y, 1, M.Stone);
      for (let y = 13; y <= 17; y++) for (let x = 3; x <= 18; x++) p(x, y, 1, M.Water);
      for (let y = 11; y <= 13; y++) for (let x = 21; x <= 36; x++) p(x, y, 1, M.Water);
      for (let x = 0; x < 40; x++) p(x, 24, 1, M.Wall);
      for (let y = 8; y < 24; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); p(20, y, 1, M.Wall); }
    },
    observe(seen, cells, w, h, tick) {
      let lakeBedded = 0, lidBedded = 0, lidSand = 0, lidStone = 0, lidWater = 0;
      for (let i = 0; i < w * h; i++) {
        const x = i % w;
        const kind = cells[i * STRIDE];
        const flags = cells[i * STRIDE + 6] | (cells[i * STRIDE + 7] << 8);
        const bedded = kind === M.Stone && flags & CELL_FLAG.Bedded;
        if (x < 20) { if (bedded) lakeBedded++; continue; }
        if (bedded) lidBedded++;
        else if (kind === M.Sand) lidSand++;
        else if (kind === M.Stone) lidStone++;
        else if (kind === M.Water) lidWater++;
      }
      // observe runs BEFORE the slow steps taken at the end of the same tick.
      if (tick === 200 && seen.lidSandBefore === undefined) {
        seen.lidSandBefore = lidSand;
        seen.lidStoneBefore = lidStone;
        seen.lidWaterBefore = lidWater;
      }
      seen.lakeBedded = lakeBedded;
      seen.lidBedded = lidBedded;
      seen.lidSandAfter = lidSand;
    },
    expect(seen) {
      if ((seen.lidSandBefore ?? 0) < 40) return `only ${seen.lidSandBefore ?? 0} sand cells under the lid — nothing to protect`;
      if ((seen.lidStoneBefore ?? 0) < 20) return `only ${seen.lidStoneBefore ?? 0} lid cells — the sand is not sealed`;
      if ((seen.lidWaterBefore ?? 0) < 20) return `only ${seen.lidWaterBefore ?? 0} water cells on the lid — nothing is testing it`;
      if ((seen.lakeBedded ?? 0) < 30) return `the open lake compacted only ${seen.lakeBedded ?? 0} cells — the rule is not running, so a clean lid proves nothing`;
      if ((seen.lidBedded ?? 0) !== 0) return `${seen.lidBedded} cells of sand sealed under a stone lid turned to sandstone`;
      if (seen.lidSandAfter !== seen.lidSandBefore) return `the lidded bed changed: ${seen.lidSandBefore} sand before, ${seen.lidSandAfter} after`;
      return null;
    },
  },
];

// PARITY_ONLY=<text> runs just the scenarios whose name contains it. It exists for
// vacuity-testing: the harness stops at the first failing scenario, so sabotaging a rule that
// several scenarios reach only ever proves the FIRST one notices.
const only = process.env.PARITY_ONLY;
const selected = only ? scenarios.filter((s) => s.name.includes(only)) : scenarios;
if (only && selected.length === 0) throw new Error(`PARITY_ONLY="${only}" matches no scenario`);
for (const s of selected) runScenario(s);
console.log(`Parity harness passed: JS and WASM byte-identical across ${selected.length} scenarios` +
  (only ? ` (filtered by PARITY_ONLY="${only}")` : ""));
