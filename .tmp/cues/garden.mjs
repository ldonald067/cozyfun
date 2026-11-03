// Does a painted one-plant garden on a wide bed sow new plants from seeds its flowers set?
// Counts a plant as sown only where a glided seed landed; prints plants and loose seeds over time.
import { compileApp } from "../../scripts/compile-app.mjs";
import { resolve } from "node:path";
const BASE = process.env.BASE === "1";
const app = compileApp(BASE ? "garden-probe-base" : "garden-probe", ["materials.ts", "engine.ts"], BASE ? { root: resolve(import.meta.dirname, "base") } : {});
const { createFallbackEngine } = app.load("engine");
const { MATERIAL: M, CELL_FLAG: F } = app.load("materials");
const W = 80, H = 40, S = 8;
const fl = (c, i) => c[i + 6] | (c[i + 7] << 8);
const seedList = (process.argv[2] ?? "1,2,3,4").split(",").map(Number), ticks = Number(process.argv[3] ?? 8000);
for (const seed of seedList) {
  const e = createFallbackEngine(W, H, seed);
  for (let x = 4; x <= 76; x++) e.paint(x, 36, 3, M.Soil, 55);
  e.paint(40, 31, 1, M.Seed); e.paint(40, 26, 3, M.Water);
  const landedAt = new Set();
  const landings = []; const landOn = {};
  let sown = 0, firstSown = -1, pollinated = 0;
  const report = [];
  for (let t = 0; t < ticks; t++) {
    if (t % 400 === 200) for (let x = 6; x <= 74; x += 3) e.paint(x, 20, 1, M.Water, 30);
    const b = e.getCellBytes().slice();
    e.tick();
    const a = e.getCellBytes();
    for (let i = 0; i < a.length; i += S) {
      if (b[i] === M.Pollen && a[i] === M.Seed) pollinated++;
      if (a[i] === M.Seed && b[i] === M.Seed && fl(b, i) & F.Windborne && !(fl(a, i) & F.Windborne)) {
        landedAt.add(i);
        // distance to the nearest plant cell, and what it landed on
        const x = (i / S) % W, y = Math.floor(i / S / W);
        let best = 99;
        for (let j = 0; j < a.length; j += S) if (a[j] === M.Stem || a[j] === M.Flower) best = Math.min(best, Math.max(Math.abs((j / S) % W - x), Math.abs(Math.floor(j / S / W) - y)));
        const on = a[i + W * S];
        landings.push(best);
        landOn[on] = (landOn[on] ?? 0) + 1;
      }
      if (b[i] === M.Seed && a[i] === M.Stem && landedAt.has(i)) { sown++; if (firstSown < 0) firstSown = t; }
    }
    if ((t + 1) % 2000 === 0) {
      let crowns = 0, loose = 0;
      for (let i = 0; i < a.length; i += S) {
        if (a[i] === M.Flower && fl(a, i) & F.Rooted) crowns++;
        if (a[i] === M.Seed && !(fl(a, i) & F.Rooted)) loose++;
      }
      report.push(`t${t + 1}: ${crowns} heads, ${loose} loose seeds`);
    }
  }
  // Landed seeds still lying in a spot where they could grow (clear of every plant), and how wet.
  {
    const a = e.getCellBytes();
    const plants = []; for (let j = 0; j < a.length; j += S) if (a[j] === M.Stem || a[j] === M.Flower) plants.push([(j / S) % W, Math.floor(j / S / W)]);
    let clear = 0, clearWet = 0, groundWet = 0;
    for (const i of landedAt) {
      if (a[i] !== M.Seed) continue;
      const x = (i / S) % W, y = Math.floor(i / S / W);
      if (plants.some(([px, py]) => Math.abs(px - x) <= 6 && Math.abs(py - y) <= 6)) continue;
      clear++;
      if (fl(a, i) & F.Wet || (a[i + 4] | (a[i + 5] << 8)) > 70) clearWet++;
      const b2 = i + W * S; if (fl(a, b2) & F.Wet || (a[b2 + 4] | (a[b2 + 5] << 8)) > 60) groundWet++;
    }
    console.log(`  landed seeds lying clear of every plant: ${clear} (wet ${clearWet}, on damp ground ${groundWet})`);
  }
  const hist = {}; for (const d of landings) { const k = d > 6 ? ">6" : d; hist[k] = (hist[k] ?? 0) + 1; }
  const names = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
  console.log("  landed at plant distance", JSON.stringify(hist), "on", JSON.stringify(Object.fromEntries(Object.entries(landOn).map(([k, v]) => [names[k], v]))));
  console.log(`seed ${seed}: pollinated ${pollinated}, sown ${sown} (first @${firstSown}) | ${report.join(" | ")}`);
}
