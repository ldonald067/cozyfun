// Scratch: the new lava check on sabotaged copies of the tree's engine (dice untouched), and with its water left out.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKS, jsEngine, runCheck, auditVerdict, colorForCell, M } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
const GUARD = "    if (next[target] === MATERIAL.Lava) return false;\n";
const SAB = {
  tree: null,
  "water-deletes": GUARD.replace("if (", "if (!waterLike(movingCell[0]) && "),
  "grains-delete": GUARD.replace("if (", "if (movingCell[0] !== MATERIAL.Stone && movingCell[0] !== MATERIAL.Sand && "),
  "lava-only": GUARD.replace("if (", "if (movingCell[0] === MATERIAL.Lava && "),
};
const c = CHECKS.find((k) => k.role === "water and quench stone never delete the lava they meet");
const dry = { ...c, paint: (p) => { for (const x of [1, 67]) for (let y = 20; y <= 39; y++) { p(x, y, 0, M.Wall); p(x + 1, y, 0, M.Wall); } p(22, 26, 4, M.Lava); } };
const seeds = Number(process.argv[2] ?? 32);
for (const [name, guard] of Object.entries(SAB)) {
  let root;
  if (guard) {
    root = resolve(".tmp/lavafix/sab-" + name); mkdirSync(resolve(root, "app/src"), { recursive: true });
    const src = readFileSync("app/src/engine.ts", "utf8"); if (src.split(GUARD).length !== 2) throw new Error("anchor");
    writeFileSync(resolve(root, "app/src/engine.ts"), src.replace(GUARD, guard)); copyFileSync("app/src/materials.ts", resolve(root, "app/src/materials.ts"));
  }
  const engine = jsEngine(compileApp("lavafix-" + name, ["engine.ts", "materials.ts"], root ? { root } : {}).load("engine").createFallbackEngine);
  for (const [label, check] of name === "tree" ? [["scene", c], ["no water", dry]] : [["scene", c]]) {
    const tally = {};
    for (let k = 0; k < seeds; k++) { const v = auditVerdict({ ...check, ...runCheck({ ...check, seed: check.seed + k * 1000 }, { engine, colorForCell }) }); const key = v.kind === "pass" ? "pass" : v.why[0].replace(/\d+/g, "N"); tally[key] = (tally[key] ?? 0) + 1; }
    console.log(name.padEnd(14), label.padEnd(9), JSON.stringify(tally));
  }
}
