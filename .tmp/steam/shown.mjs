// Scratch: shown ticks per seed for the two new checks on the built wasm, as the audit plays
// them (seed + k * 1000). FLAME=<ticks> overrides how long the kettle's flame is held.
import { CHECKS, loadWasmEngine, runCheck, colorForCell } from "../../scripts/interaction-scenes.mjs";
const engine = await loadWasmEngine(process.env.ROOT);

const flame = Number(process.env.FLAME ?? 0), R = Number(process.env.R ?? 2), wasmRoot = process.env.ROOT;
for (const check of CHECKS.filter((c) => /billows into soft puffs|hisses up a cloud/.test(c.role))) {
  const c = { ...check };
  if (/billows/.test(c.role)) { const f = flame || 300; c.act = (p, t) => { if (t < f && t % 4 === 0) p(20, 23, R, 6, 55); }; c.ticks = f + 100; }
  const shown = [];
  for (let k = 0; k < 16; k++) shown.push(runCheck({ ...c, seed: c.seed + k * 1000 }, { engine, colorForCell }).visibleTicks);
  console.log(`${c.role}: shown ${shown.join(",")} (min ${Math.min(...shown)})`);
}
