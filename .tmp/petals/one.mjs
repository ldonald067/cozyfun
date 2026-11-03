// Scratch: one audit check's raw runCheck numbers on the shipped wasm. node .tmp/petals/one.mjs <roleRegex> [seed...]
import { CHECKS, runCheck, loadWasmEngine, colorForCell } from "../../scripts/interaction-scenes.mjs";
const [re, ...seeds] = process.argv.slice(2);
const engine = await loadWasmEngine();
for (const c of CHECKS.filter((c) => new RegExp(re).test(c.role))) for (const s of seeds.length ? seeds.map(Number) : [c.seed]) {
  const r = runCheck({ ...c, seed: s }, { engine, colorForCell });
  console.log(c.covers, s, JSON.stringify({ first: r.firstTick, peak: r.peakCells, spread: r.spreadCells, ticks: r.visibleTicks, contrast: Math.round(r.contrast) }));
}
