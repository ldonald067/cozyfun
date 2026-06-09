import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "app", "src", "materials.ts");
const auditPath = path.join(root, "docs", "MATERIAL_AUDIT.md");
const source = await readFile(sourcePath, "utf8");
const audit = await readFile(auditPath, "utf8");

const materialEnum = source.match(/export const MATERIAL = \{([\s\S]*?)\} as const;/);
if (!materialEnum) throw new Error("Could not find MATERIAL enum in app/src/materials.ts");

const expectedIds = [...materialEnum[1].matchAll(/^\s+([A-Za-z]+):\s+\d+/gm)].map((match) => match[1]);
const materialBlocks = [...source.matchAll(/\{\s*id:\s*MATERIAL\.([A-Za-z]+),[\s\S]*?\n\s+\}/g)];
const seen = new Set();
const labels = new Map();
const failures = [];
let generatedOnly = 0;

for (const match of materialBlocks) {
  const [, id] = match;
  const block = match[0];
  const label = block.match(/label:\s*"([^"]+)"/)?.[1] ?? id;
  const identity = block.match(/identity:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/);

  seen.add(id);
  labels.set(id, label);
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

if (/\bPhase\s+\d+\b/i.test(audit)) failures.push("docs/MATERIAL_AUDIT.md still contains stale phase labels");
auditInteractionMatrix(audit, labels, failures);

if (failures.length > 0) {
  console.error("Material identity audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Material identity audit passed: ${seen.size - generatedOnly} toolbar materials and ${generatedOnly} generated material have two traits plus 1-3 documented roles.`
);

function auditInteractionMatrix(markdown, materialLabels, failures) {
  const section = markdown.match(/## Interaction Matrix\s+([\s\S]*?)(?:\n## |\s*$)/);
  if (!section) {
    failures.push("docs/MATERIAL_AUDIT.md is missing an Interaction Matrix section");
    return;
  }

  const rows = section[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|\s*-+/.test(line));
  const matrix = new Map();

  for (const row of rows.slice(1)) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const [material, rolesCell, coverage] = cells;
    const roles = rolesCell.split(";").map((role) => role.trim()).filter(Boolean);
    matrix.set(material, { roles, coverage });

    if (roles.length < 1 || roles.length > 3) failures.push(`${material} must document 1-3 interaction roles, found ${roles.length}`);
    for (const role of roles) {
      if (role.length < 8) failures.push(`${material} has a too-vague interaction role: "${role}"`);
      if (/^(todo|tbd|unique|special)$/i.test(role)) failures.push(`${material} has placeholder interaction role text: "${role}"`);
    }
    if (coverage.length < 8 || /^(todo|tbd)$/i.test(coverage)) failures.push(`${material} needs concrete audit coverage notes`);
  }

  for (const label of materialLabels.values()) {
    if (!matrix.has(label)) failures.push(`docs/MATERIAL_AUDIT.md Interaction Matrix is missing ${label}`);
  }
}
