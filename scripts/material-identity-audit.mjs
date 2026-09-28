import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { materialShowcaseScript } from "./material-showcase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "app", "src", "materials.ts");
const auditPath = path.join(root, "docs", "MATERIAL_AUDIT.md");
const showcasePath = path.join(root, "scripts", "material-showcase.mjs");
const source = await readFile(sourcePath, "utf8");
const audit = await readFile(auditPath, "utf8");
const showcase = await readFile(showcasePath, "utf8");

const materialEnum = source.match(/export const MATERIAL = \{([\s\S]*?)\} as const;/);
if (!materialEnum) throw new Error("Could not find MATERIAL enum in app/src/materials.ts");

const expectedIds = [...materialEnum[1].matchAll(/^\s+([A-Za-z]+):\s+\d+/gm)].map((match) => match[1]);
const materialBlocks = [...source.matchAll(/\{\s*id:\s*MATERIAL\.([A-Za-z]+),[\s\S]*?\n\s+\}/g)];
const seen = new Set();
const labels = new Map();
const failures = [];
const generatedLabels = new Set();

for (const match of materialBlocks) {
  const [, id] = match;
  const block = match[0];
  const label = block.match(/label:\s*"([^"]+)"/)?.[1] ?? id;
  const identity = block.match(/identity:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/);

  seen.add(id);
  labels.set(id, label);
  if (block.includes("userSelectable: false")) generatedLabels.add(label);

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
auditShowcaseCoverage(source, showcase, expectedIds, failures);

if (failures.length > 0) {
  console.error("Material identity audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Material identity audit passed: ${seen.size - generatedLabels.size} toolbar materials carry 4+ documented interaction roles and ${generatedLabels.size} generated materials carry 1-3; every material and cell state appears in the visual review board.`
);

function auditShowcaseCoverage(materialsSource, showcaseSource, materialIds, failures) {
  // The deterministic showcase (scripts/material-showcase.mjs) is the visual review
  // board: it renders through the real material renderer, and visual QA captures it.
  // We can only guarantee the board is COMPLETE here — that every material and every
  // cell state actually appears — so a color/interaction change can never ship a
  // material or state no capture renders. Whether two things are distinct enough is a
  // human/agent judgment on the capture (it accounts for glow, shape, and animation
  // that no averaged-color number can see); this check just makes sure nothing is
  // missing from the picture the reviewer looks at.
  for (const id of materialIds) {
    if (id === "Empty") continue;
    if (!new RegExp(`material\\.${id}\\b`).test(showcaseSource)) {
      failures.push(
        `material.${id} is not rendered in the visual review board (scripts/material-showcase.mjs); add it so visual QA shows it beside its neighbors`,
      );
    }
  }
  const flagBlock = materialsSource.match(/export const CELL_FLAG = \{([\s\S]*?)\} as const;/);
  const flagNames = flagBlock ? [...flagBlock[1].matchAll(/^\s+([A-Za-z]+):/gm)].map((match) => match[1]) : [];
  for (const flag of flagNames) {
    if (!new RegExp(`flag\\.${flag}\\b`).test(showcaseSource)) {
      failures.push(
        `cell state flag.${flag} is not shown in the visual review board; add a cell carrying it so its interaction color is reviewable`,
      );
    }
  }

  // ...and the VALUES have to match, not just the names. The showcase runs inside the page and
  // cannot import, so it used to carry hand-typed copies of both tables; one that wrote
  // Bedded: 64 passed the name checks above, set a bit that means nothing, and reviewed every
  // sandstone exhibit as plain lava rock. The builder now writes the real tables into the
  // script it generates, so this checks the GENERATED script — what the page actually runs —
  // against this file's own parse of materials.ts, which is an independent path to the same
  // values. A hand-typed map reintroduced with a wrong value still fails here.
  const bit = (expr) => {
    const shift = expr.match(/^\s*1\s*<<\s*(\d+)\s*$/);
    return shift ? 1 << Number(shift[1]) : Number(expr);
  };
  const realFlags = flagBlock
    ? Object.fromEntries([...flagBlock[1].matchAll(/^\s+([A-Za-z]+):\s*([^,\n]+)/gm)].map((m) => [m[1], bit(m[2])]))
    : {};
  const materialBlock = materialsSource.match(/export const MATERIAL = \{([\s\S]*?)\} as const;/);
  const realMaterials = materialBlock
    ? Object.fromEntries([...materialBlock[1].matchAll(/^\s+([A-Za-z]+):\s+(\d+)/gm)].map((m) => [m[1], Number(m[2])]))
    : {};
  const generated = materialShowcaseScript();
  for (const [table, real, source] of [["material", realMaterials, "MATERIAL"], ["flag", realFlags, "CELL_FLAG"]]) {
    // The whole line, not up to the first `}`: a map built with a spread nests braces.
    const shown = generated.match(new RegExp(`^\\s*const ${table} = (.*);\\s*$`, "m"));
    if (!shown) {
      failures.push(`the visual review board's generated script has no \`const ${table} = { ... }\` map to check against ${source}`);
      continue;
    }
    let parsed;
    try {
      parsed = Function(`return (${shown[1]});`)();
    } catch {
      failures.push(`the visual review board's \`const ${table}\` map does not evaluate: ${shown[1].slice(0, 80)}`);
      continue;
    }
    for (const name of new Set([...Object.keys(real), ...Object.keys(parsed)])) {
      if (parsed[name] !== real[name]) {
        failures.push(
          `the visual review board's ${table}.${name} is ${parsed[name] ?? "missing"} but ${source}.${name} is ${real[name] ?? "missing"}; ` +
            `its exhibits would carry the wrong value and be reviewed as something else`,
        );
      }
    }
  }
}

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

    const isTool = material === "Eraser";
    const isGenerated = generatedLabels.has(material);
    if (isTool || isGenerated) {
      if (roles.length < 1 || roles.length > 3) {
        failures.push(`${material} must document 1-3 interaction roles, found ${roles.length}`);
      }
    } else if (roles.length < 4 || roles.length > 6) {
      failures.push(`${material} must document 4-6 special interaction roles, found ${roles.length}`);
    }
    for (const role of roles) {
      if (role.length < 8) failures.push(`${material} has a too-vague interaction role: "${role}"`);
      if (/^(todo|tbd|unique|special)$/i.test(role)) failures.push(`${material} has placeholder interaction role text: "${role}"`);
    }
    if (coverage.length < 8 || /^(todo|tbd)$/i.test(coverage)) failures.push(`${material} needs concrete audit coverage notes`);
    if (!/\b(Tests?|Browser smoke|Visual QA|Source|Brush mode):/i.test(coverage)) {
      failures.push(`${material} coverage must cite concrete tests, source hooks, or harnesses`);
    }
  }

  for (const label of materialLabels.values()) {
    if (!matrix.has(label)) failures.push(`docs/MATERIAL_AUDIT.md Interaction Matrix is missing ${label}`);
  }
}
