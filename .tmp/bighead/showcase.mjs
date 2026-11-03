// Scratch: rewrite the showcase's garden row for big heads, its shape copy from the engine.
import { readFileSync, writeFileSync } from "node:fs";
import { compileApp } from "../../scripts/compile-app.mjs";
const S = compileApp("bh-show", ["engine.ts", "materials.ts"]).load("engine").BLOOM_SHAPES;
const names = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
const path = "scripts/material-showcase.mjs";
let s = readFileSync(path, "utf8");
const swap = (from, to) => { if (s.split(from).length !== 2) throw new Error("no unique match: " + from.slice(0, 80)); s = s.replace(from, to); };
const a = s.indexOf("    const BLOOM_SHAPES = [");
const b = s.indexOf("    ];\n", a) + "    ];\n".length;
s = s.slice(0, a) + "    const BLOOM_SHAPES = [\n" + S.map((sh, v) => `      [${sh.map(([x, y]) => `[${x},${y}]`).join(",")}], // ${v} ${names[v]}\n`).join("") + "    ];\n" + s.slice(b);
swap(`    // Grown plants: all five bloom silhouettes side by side, in the exact cell layout the
    // sim produces — a head is a crown with its shape's petals opened around it, on a leafy
    // stalk.`, `    // Grown plants: all eight bloom silhouettes, in the exact cell layout the sim produces —
    // a head is a crown with its shape's petals opened above it, on a stalk leafed on every
    // segment.`);
swap(`    // The row lives in the empty bottom band because a five-wide head needs real room —
    // the old right-hand strip could not fit these without the heads touching. It sits WEST
    // of x=72 on purpose: the sand pile and the stardust/pollen exhibits above that column
    // fall to the floor once the capture's sim starts, and they buried the first attempt.
    line(0, 69, 135, material.Wall);`, `    // The row lives in the empty bottom band because a head needs real room. Heads are 13
    // wide since 2026-10-29, so eight no longer fit WEST of x=72, where they have to start:
    // the sand pile and the stardust/pollen exhibits above that column fall to the floor once
    // the capture's sim starts, and they buried the first attempt. Four stand there; the
    // other four stand in two short beds further east, either side of x 150-184, where the
    // wet wall above drips onto the floor.
    line(0, 69, 135, material.Wall);
    line(114, 148, 135, material.Wall);
    line(185, 213, 135, material.Wall);`);
swap(`    // Heads are SEVEN cells wide now (dx -3..3), so the old seven-cell step put neighbours
    // edge to edge with no gap and the row read as one continuous band. Step eight leaves a
    // one-column gap. The row cannot simply spread rightward instead: the sand pile owns
    // column 72 onward, which is why this starts at 12 and the bud/spent pair moved left.
    bloom(12, 134, 0, 5, [[-1, 2], [1, 4]], 95, 200);        // cornflower
    bloom(20, 134, 1, 5, [[1, 2], [-1, 4]], 95, 200);        // poppy
    bloom(28, 134, 2, 5, [[-1, 2], [1, 4]], 95, 200);        // daisy
    bloom(36, 134, 3, 6, [[1, 2], [-1, 4]], 95, 200);        // sunflower
    bloom(44, 134, 4, 5, [[-1, 2], [1, 4]], 95, 200);        // tulip
    bloom(52, 134, 5, 5, [[1, 2], [-1, 4]], 95, 200);        // lavender
    bloom(60, 134, 6, 5, [[-1, 2], [1, 4]], 95, 200);        // bluebell`, `    // Heads are up to 13 cells wide (dx -6..6), so plants stand 14 apart: one column of gap.
    // A stalk is seven cells, the shortest a plant grows, with a leaf on every segment but the
    // top one, alternating sides, as the sim unfurls them.
    const LEAVES = [[-1, 1], [1, 2], [-1, 3], [1, 4], [-1, 5], [1, 6]];
    bloom(17, 134, 0, 7, LEAVES, 95, 200);        // cornflower
    bloom(31, 134, 1, 7, LEAVES, 95, 200);        // poppy
    bloom(45, 134, 2, 7, LEAVES, 95, 200);        // daisy
    bloom(59, 134, 3, 7, LEAVES, 95, 200);        // sunflower
    bloom(121, 134, 4, 7, LEAVES, 95, 200);       // tulip
    bloom(135, 134, 5, 7, LEAVES, 95, 200);       // lavender
    bloom(192, 134, 6, 7, LEAVES, 95, 200);       // bluebell`);
swap(`    bloom(68, 134, 7, 5, [[1, 2], [-1, 4]], 20, 3700, 2);    // cosmos, spent and shedding`,
  `    bloom(206, 134, 7, 7, LEAVES, 20, 3700, 2);   // cosmos, spent and shedding`);
swap(`    setCell(40, 130, material.Seed, 40, 0, flag.Windborne | flag.DriftEast, 3);`,
  `    setCell(67, 122, material.Seed, 40, 0, flag.Windborne | flag.DriftEast, 3);`);
writeFileSync(path, s);
