// Scratch (2026-10-28): lava flow variants as find/replace copies of app/src/engine.ts (never edited).
// Mode: head (HEAD's engine) | live (working tree) | cad | press2 | press1 | visc | pressvisc ; VISC=k odds.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { compileApp } from "../../scripts/compile-app.mjs";
const repo = resolve(import.meta.dirname, "../..");
const DISPATCH = "if (kind === MATERIAL.Lava) this.liquid(idx, x, y, cell, old, next, 2);";
const LAVA = (mode, k) => `  private lava(idx: number, x: number, y: number, cell: Uint8Array, old: Uint8Array, next: Uint8Array) {
    if (this.ticks % 4 >= 2) return;
    const side = this.ticks % 2 === 0 ? 1 : -1;
    const falls = [[0, 1], [side, 1], [-side, 1]];
    for (const [dx, dy] of falls) if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
    const pressed = y > 0 && old[this.index(x, y - 1)] === MATERIAL.Lava;
    const mode: string = ${JSON.stringify(mode)};
    let dirs: number[][] = [];
    if (mode === "cad") dirs = [[side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0]];
    else if (mode === "press2") dirs = pressed ? [[side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0]] : [];
    else if (mode === "press1") dirs = pressed ? [[side, 0], [-side, 0]] : [];
    else if (mode === "visc") dirs = this.chance(${k}) ? [[side, 0], [-side, 0]] : [];
    else if (mode === "pressvisc") dirs = pressed ? [[side, 0], [-side, 0], [side * 2, 0], [-side * 2, 0]] : this.chance(${k}) ? [[side, 0], [-side, 0]] : [];
    else if (mode === "press1visc") dirs = pressed ? [[side, 0], [-side, 0]] : this.chance(${k}) ? [[side, 0], [-side, 0]] : [];
    for (const [dx, dy] of dirs) if (this.move(idx, x + dx, y + dy, cell, old, next)) return;
  }

  private oil(`;
export function build(mode = "live", k = 4) {
  const name = mode === "live" || mode === "head" ? mode : `${mode}-${k}`;
  const root = resolve(repo, ".tmp/lavaflow/root-" + name);
  mkdirSync(resolve(root, "app/src"), { recursive: true });
  let src = mode === "head" ? execSync("git show HEAD:app/src/engine.ts", { cwd: repo, encoding: "utf8" }) : readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
  if (mode !== "live" && mode !== "head") {
    for (const [f, r] of [[DISPATCH, "if (kind === MATERIAL.Lava) this.lava(idx, x, y, cell, old, next);"], ["  private oil(", LAVA(mode, k)]]) {
      if (src.split(f).length !== 2) throw new Error(`no single match for ${f.slice(0, 60)}`);
      src = src.replace(f, r);
    }
  }
  writeFileSync(resolve(root, "app/src/engine.ts"), src);
  copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
  const app = compileApp("lavaflow-" + name, ["engine.ts", "materials.ts"], { root });
  return { create: app.load("engine").createFallbackEngine, M: app.load("materials").MATERIAL, root, name };
}
