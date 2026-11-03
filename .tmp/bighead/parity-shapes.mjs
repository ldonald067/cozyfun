// Scratch: write the engine's new BLOOM_SHAPES 0, 4, 5, 6 into the parity script's written-out tables.
import { readFileSync, writeFileSync } from "node:fs";
import { compileApp } from "../../scripts/compile-app.mjs";
const S = compileApp("bh-shapes", ["engine.ts", "materials.ts"]).load("engine").BLOOM_SHAPES;
const fmt = (v) => "[" + S[v].map(([x, y]) => `[${x}, ${y}]`).join(", ") + "]";
const path = "scripts/smoke-parity.mjs";
let s = readFileSync(path, "utf8");
const swap = (from, to) => { if (s.split(from).length !== 2) throw new Error(from); s = s.replace(from, to); };
const a = s.indexOf("const CUT_BLOOM_SHAPES = {"), b = s.indexOf("};", a) + 2;
s = s.slice(0, a) + `const CUT_BLOOM_SHAPES = {\n  0: ${fmt(0)},\n  5: ${fmt(5)},\n};` + s.slice(b);
const c = s.indexOf("const RESHAPED_HEADS = ["), d = s.indexOf("];", c) + 2;
s = s.slice(0, c) + `const RESHAPED_HEADS = [\n  [8, 4, ${fmt(4)}],\n  [24, 6, ${fmt(6)}],\n];` + s.slice(d);
swap("// The tulip cup and the nodding bluebell, BLOOM_SHAPES 4 and 6, as [crown x, variant, shape].",
  "// The tulip cup and the nodding bluebell, BLOOM_SHAPES 4 and 6, as [crown x, variant, shape]. The\n// crowns stand 16 apart, out of each other's reach (HEAD_REACH_X), so neither waits its turn.");
swap('    name: "a tulip opens a cup and a bluebell nods",\n    w: 30, h: 20,', '    name: "a tulip opens a cup and a bluebell nods",\n    w: 34, h: 20,');
swap("        for (let y = 2; y <= 16; y++) for (let x = cx - 4; x <= cx + 4; x++) {", "        for (let y = 2; y <= 16; y++) for (let x = cx - 6; x <= cx + 6; x++) {");
writeFileSync(path, s);
