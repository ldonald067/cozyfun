// Ranks material pairs by palette similarity so visual uniqueness work targets
// the most confusable elements first. Distance is the "redmean" weighted RGB
// metric over each material's average palette color.
// Usage: node scripts/material-contrast.mjs [--check]
// With --check, fails when any pair falls below the distance floor.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "material-contrast");

const { MATERIALS } = await loadTsModule(path.join(root, "app", "src", "materials.ts"), "materials.generated.mjs");

const swatches = MATERIALS.filter((material) => material.slug !== "eraser").map((material) => ({
  label: material.label,
  generated: material.userSelectable === false,
  rgb: averageRgb(material.palette)
}));

const pairs = [];
for (let a = 0; a < swatches.length; a++) {
  for (let b = a + 1; b < swatches.length; b++) {
    pairs.push({
      pair: `${swatches[a].label} / ${swatches[b].label}`,
      generated: swatches[a].generated || swatches[b].generated,
      distance: Math.round(redmeanDistance(swatches[a].rgb, swatches[b].rgb))
    });
  }
}
pairs.sort((left, right) => left.distance - right.distance);

console.log("Closest material palette pairs (lower = more confusable):");
for (const entry of pairs.slice(0, 12)) {
  console.log(`- ${entry.distance.toString().padStart(3)}  ${entry.pair}${entry.generated ? "  (generated-only involved)" : ""}`);
}

if (process.argv.includes("--check")) {
  const DISTANCE_FLOOR = 45;
  const tooClose = pairs.filter((entry) => entry.distance < DISTANCE_FLOOR);
  if (tooClose.length > 0) {
    console.error(`Material contrast check failed: pairs below the ${DISTANCE_FLOOR} distance floor:`);
    for (const entry of tooClose) console.error(`- ${entry.distance}  ${entry.pair}`);
    process.exit(1);
  }
  console.log(`Material contrast check passed: closest pair is ${pairs[0].distance} (floor ${DISTANCE_FLOOR}).`);
}

function averageRgb(palette) {
  const sum = [0, 0, 0];
  for (const hex of palette) {
    const value = hex.replace("#", "");
    sum[0] += parseInt(value.slice(0, 2), 16);
    sum[1] += parseInt(value.slice(2, 4), 16);
    sum[2] += parseInt(value.slice(4, 6), 16);
  }
  return sum.map((channel) => channel / palette.length);
}

function redmeanDistance([r1, g1, b1], [r2, g2, b2]) {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

async function loadTsModule(sourcePath, fileName) {
  await mkdir(outputDir, { recursive: true });
  const requireFromApp = createRequire(path.join(root, "app", "package.json"));
  const ts = requireFromApp("typescript");
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      verbatimModuleSyntax: false
    }
  }).outputText;
  const modulePath = path.join(outputDir, fileName);
  await writeFile(modulePath, transpiled);
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
}
