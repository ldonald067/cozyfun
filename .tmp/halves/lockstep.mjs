// Scratch: play scenes on the JS mirror and on a sabotaged copy in lockstep, diffing every cell.
// node .tmp/halves/lockstep.mjs <sabotage> <seeds>
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { M, FLOOR_FROM_BOTTOM } from "../../scripts/interaction-scenes.mjs";
import { compileApp } from "../../scripts/compile-app.mjs";
import { SABOTAGES } from "./sabotages.mjs";
const repo = resolve(import.meta.dirname, "../..");
const [name, seedArg = "8"] = process.argv.slice(2);
const base = compileApp("halves-base", ["engine.ts", "materials.ts"]).load("engine").createFallbackEngine;
const root = resolve(repo, ".tmp/halves/root-" + name);
mkdirSync(resolve(root, "app/src"), { recursive: true });
let src = readFileSync(resolve(repo, "app/src/engine.ts"), "utf8");
for (const [f, r] of SABOTAGES[name]) { if (src.split(f).length !== 2) throw new Error("not one match"); src = src.replace(f, r); }
writeFileSync(resolve(root, "app/src/engine.ts"), src);
copyFileSync(resolve(repo, "app/src/materials.ts"), resolve(root, "app/src/materials.ts"));
const sab = compileApp("halves-" + name, ["engine.ts", "materials.ts"], { root }).load("engine").createFallbackEngine;
const SCENES = {
  "wet sand oiled": { w: 30, h: 26, ticks: 1500, paint: (p) => { p(15, 19, 3, M.Sand); p(15, 13, 2, M.Water); },
    act: (p, t) => { if (t === 300) p(15, 10, 3, M.Oil); if (t === 600) p(15, 8, 2, M.Water); } },
  "seed bed oiled": { w: 30, h: 26, ticks: 2000, paint: (p) => { p(15, 20, 3, M.Soil); p(15, 17, 1, M.Seed); p(15, 15, 2, M.Oil); p(15, 12, 3, M.Water); } },
  "oil slick on a watered garden": { w: 40, h: 34, ticks: 3000, paint: (p) => { p(20, 28, 4, M.Soil); p(20, 23, 3, M.Seed); p(20, 18, 3, M.Water); },
    act: (p, t) => { if (t === 200) p(20, 14, 3, M.Oil); if (t === 400) p(20, 10, 3, M.Water); } },
  "rain on oiled sand and wood": { w: 40, h: 30, ticks: 2000, paint: (p) => { p(12, 24, 3, M.Sand); p(28, 24, 3, M.Wood); p(20, 18, 2, M.Oil); },
    act: (p, t) => { if (t % 40 === 0 && t < 1200) p(8 + (t / 40 % 25), 3, 1, M.Water, 30); } },
};
for (const [label, s] of Object.entries(SCENES)) {
  let diffTicks = 0, cellTicks = 0, kindDiff = 0, longest = 0;
  for (let k = 0; k < Number(seedArg); k++) {
    const a = base(s.w, s.h, 900 + k * 1000), b = sab(s.w, s.h, 900 + k * 1000);
    for (const e of [a, b]) { const p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d); s.paint(p); for (let x = 1; x < s.w; x += 3) p(x, s.h - FLOOR_FROM_BOTTOM, 1, M.Wall); }
    const run = new Map();
    for (let t = 1; t <= s.ticks; t++) {
      for (const e of [a, b]) if (s.act) s.act((x, y, r, m, d = 100) => e.paint(x, y, r, m, d), t);
      a.tick(); b.tick();
      const ca = a.getCellBytes(), cb = b.getCellBytes();
      let any = false;
      for (let i = 0; i < s.w * s.h; i++) {
        let same = true;
        for (let o = 0; o < 8; o++) if (ca[i * 8 + o] !== cb[i * 8 + o]) { same = false; break; }
        if (same) { run.delete(i); continue; }
        any = true; cellTicks++;
        if (ca[i * 8] !== cb[i * 8]) kindDiff++;
        const r = (run.get(i) ?? 0) + 1; run.set(i, r); longest = Math.max(longest, r);
      }
      if (any) diffTicks++;
    }
    a.dispose(); b.dispose();
  }
  console.log(`${label.padEnd(30)} ticks differing ${diffTicks}  cell-ticks ${cellTicks}  of which material differs ${kindDiff}  longest one cell differs ${longest} ticks`);
}
