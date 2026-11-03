// Scratch: write the engine's poppy and sunflower shapes into the parity script for TOUCHING_CROWNS.
import { readFileSync, writeFileSync } from "node:fs";
import { compileApp } from "../../scripts/compile-app.mjs";
const S = compileApp("bh-shapes2", ["engine.ts", "materials.ts"]).load("engine").BLOOM_SHAPES;
const fmt = (v) => "[" + S[v].map(([x, y]) => `[${x}, ${y}]`).join(", ") + "]";
const path = "scripts/smoke-parity.mjs";
let s = readFileSync(path, "utf8");
s = s.replace("[10, 13, 1, 0, CUT_BLOOM_SHAPES_POPPY]", `[10, 13, 1, 0, ${fmt(1)}]`).replace("[17, 10, 3, CELL_FLAG.Cosmic, CUT_BLOOM_SHAPES_SUNFLOWER]", `[17, 10, 3, CELL_FLAG.Cosmic, ${fmt(3)}]`);
writeFileSync(path, s);
