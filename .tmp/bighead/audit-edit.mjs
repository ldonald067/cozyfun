// Scratch: rework the audit's flower checks for big heads that take turns.
import { readFileSync, writeFileSync } from "node:fs";
import { compileApp } from "../../scripts/compile-app.mjs";
const S = compileApp("bh-aud", ["engine.ts", "materials.ts"]).load("engine").BLOOM_SHAPES;
const fmt = (v) => "[" + S[v].map(([x, y]) => `[${x}, ${y}]`).join(", ") + "]";
const path = "scripts/interaction-scenes.mjs";
let s = readFileSync(path, "utf8");
const swap = (from, to) => { if (s.split(from).length !== 2) throw new Error("no unique match: " + from.slice(0, 90)); s = s.replace(from, to); };
const a = s.indexOf("// BLOOM_SHAPES 4 and 6 from sim/src/lib.rs, written out because these two checks witness");
const b = s.indexOf("};\n", a) + 3;
s = s.slice(0, a) + `// BLOOM_SHAPES 3, 4 and 6 from sim/src/lib.rs, written out because these checks witness
// exactly them: retuning any of these shapes should have to come through here.
const RESHAPED_HEADS = {
  3: ${fmt(3)},
  4: ${fmt(4)},
  6: ${fmt(6)},
};
` + s.slice(b);
swap(`// Every plant standing under a rooted crown: its stalk (the run of Stem straight under the
// crown), its leaves (Stem beside that run, not itself standing on Stem) and its head (Flower
// of its species within the widest silhouette's reach of the crown).`,
`// Every plant standing under a rooted crown: its stalk (the run of Stem straight under the
// crown), its leaves (Stem beside that run, not itself standing on Stem) and its head (Flower
// of its species within the widest head's reach of the crown: six either side, ten up).`);
swap(`    for (let y = cy - 5; y <= cy + 1; y++) for (let hx = x - 3; hx <= x + 3; hx++) {`,
  `    for (let y = cy - 10; y <= cy; y++) for (let hx = x - 6; hx <= x + 6; hx++) {`);
swap(`  { m: "Flower", covers: "flower.opens", role: "opens a tulip into a cup", w: 220, h: 48, seed: 25, ticks: 1500,
    paint: wideMeadow, outcome: (g) => wholeHeads(g, 4) },
  { m: "Flower", covers: "flower.opens", role: "nods a bluebell's bells off a bent scape", w: 220, h: 48, seed: 26, ticks: 1500,
    paint: wideMeadow, outcome: (g) => wholeHeads(g, 6) },`,
`  { m: "Flower", covers: "flower.opens", role: "opens a tulip into a cup", w: 220, h: 48, seed: 25, ticks: TWO_WAVES,
    paint: wideMeadow, outcome: (g) => wholeHeads(g, 4) },
  { m: "Flower", covers: "flower.opens", role: "nods a bluebell's bells off a bent scape", w: 220, h: 48, seed: 26, ticks: TWO_WAVES,
    paint: wideMeadow, outcome: (g) => wholeHeads(g, 6) },
  { m: "Flower", covers: "flower.opens", role: "opens a sunflower whole, the biggest head", w: 220, h: 48, seed: 29, ticks: TWO_WAVES,
    // The budget check in play: 109 petals is the most a crown opens, and at a reserve of 100
    // a lone sunflower stalled at 90 of 110 cells (2026-10-29). STAT_SUNFLOWER.
    paint: wideMeadow, outcome: (g) => wholeHeads(g, 3) },
  { m: "Flower", covers: "flower.opens", role: "a bed watered once blooms again in a second wave", w: 220, h: 48, seed: 30, ticks: 7200,
    // The owner's pick (2026-10-29): heads 13 across on plants seven apart take turns, so a
    // bed blooms in two waves. A head's arc starts when it opens, so its crown's age says when:
    // the witness is SECOND_WAVE heads of twenty cells or more, all opened after the third
    // minute, open at once. STAT_WAVES.
    paint: wideMeadow,
    outcome: (g, before, memo) => {
      memo.t = (memo.t ?? -1) + 1; // called once before the first tick, then once a tick
      const late = grownPlants(g).filter((pl) => pl.head.length >= 20 && pl.age <= memo.t - 3600);
      return late.length >= SECOND_WAVE ? late.flatMap((pl) => pl.head) : [];
    } },`);
swap(`    outcome: (g) => {
      const held = grownPlants(g).filter((pl) => pl.age >= 2400 && pl.head.length >= 5);
      return held.length >= 12 ? held.flatMap((pl) => pl.head) : [];
    } },`,
`    outcome: (g) => {
      const held = grownPlants(g).filter((pl) => pl.age >= 2400 && pl.head.length >= 20);
      return held.length >= HELD_HEADS ? held.flatMap((pl) => pl.head) : [];
    } },`);
swap(`// Every plant standing under a rooted crown:`, `// A bed blooms in two waves (HEAD_REACH_X in sim/src/lib.rs), the second about four minutes
// after the first, so a check that waits for a given head waits for both.
const TWO_WAVES = 6000;
const HELD_HEADS = 1, SECOND_WAVE = 1; // PENDING

// Every plant standing under a rooted crown:`);
writeFileSync(path, s);
