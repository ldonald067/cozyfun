import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "app", "src", "materials.ts");
const source = await readFile(sourcePath, "utf8");

const materialEnum = source.match(/export const MATERIAL = \{([\s\S]*?)\} as const;/);
if (!materialEnum) throw new Error("Could not find MATERIAL enum in app/src/materials.ts");

const expectedIds = [...materialEnum[1].matchAll(/^\s+([A-Za-z]+):\s+\d+/gm)].map((match) => match[1]);
const materialBlocks = [...source.matchAll(/\{\s*id:\s*MATERIAL\.([A-Za-z]+),[\s\S]*?\n\s+\}/g)];
const seen = new Set();
const failures = [];
let generatedOnly = 0;

for (const match of materialBlocks) {
  const [, id] = match;
  const block = match[0];
  const label = block.match(/label:\s*"([^"]+)"/)?.[1] ?? id;
  const identity = block.match(/identity:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/);

  seen.add(id);
  if (block.includes("userSelectable: false")) generatedOnly += 1;

  if (!identity) {
    failures.push(`${label} is missing exactly two identity traits`);
    continue;
  }

  const traits = identity.slice(1).map((trait) => trait.trim());
  for (const trait of traits) {
    if (trait.length < 8) failures.push(`${label} has a too-vague identity trait: "${trait}"`);
    if (/^(todo|tbd|unique|special)$/i.test(trait)) failures.push(`${label} has placeholder identity text: "${trait}"`);
  }
  if (traits[0].toLowerCase() === traits[1].toLowerCase()) failures.push(`${label} repeats the same identity trait twice`);
}

for (const id of expectedIds) {
  if (!seen.has(id)) failures.push(`MATERIAL.${id} is missing from MATERIALS`);
}

if (seen.size !== expectedIds.length) {
  failures.push(`Expected ${expectedIds.length} material definitions, found ${seen.size}`);
}

if (failures.length > 0) {
  console.error("Material identity audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Material identity audit passed: ${seen.size - generatedOnly} toolbar materials and ${generatedOnly} generated material have two traits.`);
