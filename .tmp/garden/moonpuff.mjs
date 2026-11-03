// Scratch: the moonlit-pollen check's tallies per seed, with the highest flower row.
// node .tmp/garden/moonpuff.mjs [seed...]
import { CHECKS, runCheck, loadWasmEngine, colorForCell, M } from "../../scripts/interaction-scenes.mjs";
const engine = await loadWasmEngine(process.env.ROOT ? (await import("node:path")).resolve(process.env.ROOT) : undefined);
const c = CHECKS.find((c) => /moonlit garden puffs pollen/.test(c.role));
for (const s of process.argv.slice(2).map(Number)) {
  let memo, top = [99, 99];
  const r = runCheck({ ...c, seed: s, outcome: (g, b, m, prev) => {
    memo = m;
    for (const i of g.all(M.Flower)) { const [x, y] = g.xyOf(i); const k = x < 30 ? 0 : 1; top[k] = Math.min(top[k], y); }
    return c.outcome(g, b, m, prev);
  } }, { engine, colorForCell });
  const rate = memo.puffs.map((n, k) => (n / memo.open[k]).toFixed(4));
  console.log(s, "first", r.firstTick, "puffs", memo.puffs, "open", memo.open, "rate", rate, "ratio", (rate[1] / rate[0]).toFixed(2), "top row", top);
}
