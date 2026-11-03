// Scratch: violet and deep coverage of the board for each wide-field seed (the mock's draw: 7.4% / 49%).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { compileApp } from "../../scripts/compile-app.mjs";
compileApp("nightsky-seeds", ["rendering/nightWash.ts", "materials.ts"]);
const file = new URL("../nightsky-seeds/rendering/nightWash.js", import.meta.url).pathname;
const src = readFileSync(file, "utf8");
const require = createRequire(import.meta.url);
for (const wideSeed of [1, 5, 6, 7, 9, 10, 12, 14]) for (const broadSeed of [2, 8]) {
  const out = file.replace(".js", `-${wideSeed}-${broadSeed}.js`);
  writeFileSync(out, src.replace("field(1, u, v, WIDE_PERIOD)", `field(${wideSeed}, u, v, WIDE_PERIOD)`).replaceAll("field(2, ", `field(${broadSeed}, `));
  const w = require(out);
  let v = 0, d = 0, n = 0;
  for (let y = 0; y < 140; y++) for (let x = 0; x < 220; x++) { const [r, g, b] = w.washAt(x, y); n++; v += r - g > 4; d += b < 36; }
  console.log(`wide ${wideSeed} broad ${broadSeed}: violet ${(v / n).toFixed(3)} deep ${(d / n).toFixed(3)}`);
}
