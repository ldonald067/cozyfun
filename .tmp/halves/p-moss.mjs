import { play, M, F } from "./proto.mjs";
const nbrs = (g, i) => { const [x, y] = g.xyOf(i); const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.kindAt(x + dx, y + dy) >= 0) out.push((y + dy) * g.w + x + dx); return out; };
// Max bipartite matching new->parent (Kuhn). Deficiency > 0 proves some parent spread twice.
function deficiency(g, prev) {
  const N = []; for (let i = 0; i < g.size; i++) if (g.kindOf(i) === M.Moss && (prev.kindOf(i) === M.Wood || prev.kindOf(i) === M.Stone)) N.push(i);
  const adj = N.map((i) => nbrs(prev, i).filter((j) => prev.kindOf(j) === M.Moss));
  const owner = new Map();
  const tryK = (k, seen) => { for (const p of adj[k]) { if (seen.has(p)) continue; seen.add(p); if (!owner.has(p) || tryK(owner.get(p), seen)) { owner.set(p, k); return true; } } return false; };
  let m = 0; for (let k = 0; k < N.length; k++) if (tryK(k, new Set())) m++;
  return [N.length, N.length - m];
}
const [scene = "a", seed = "26"] = process.argv.slice(2);
const scenes = {
  a: { paint: (p) => { p(15, 20, 4, M.Wood); p(15, 15, 3, M.Water); p(9, 20, 1, M.Moss); } },
  c: { paint: (p) => { for (let y = 18; y <= 20; y++) for (let x = 6; x <= 34; x++) p(x, y, 0, M.Wood); for (let y = 12; y <= 17; y++) { p(5, y, 0, M.Wall); p(35, y, 0, M.Wall); } p(7, 17, 0, M.Moss); for (let x = 8; x <= 34; x += 2) p(x, 14, 1, M.Water); } },
  d: { paint: (p) => { for (let y = 16; y <= 21; y++) for (let x = 6; x <= 34; x++) p(x, y, 0, M.Wood); p(7, 15, 0, M.Moss); }, act: (p, t) => { if (t < 200 && t % 3 === 0) p(7 + Math.floor(t / 8), 10, 1, M.Water); } },
  e: { paint: (p) => { p(15, 20, 3, M.Stone); p(15, 16, 2, M.Water); p(10, 20, 1, M.Moss); } },
  b: { paint: (p) => { p(15, 20, 4, M.Wood); p(15, 20, 1, M.Moss); p(15, 13, 3, M.Water); } },
};
let newTotal = 0, def = 0, hot = 0, ticksDef = 0;
play({ w: 40, h: 28, seed: Number(seed), ticks: 1500, ...scenes[scene] }, 100, (g, prev, t) => {
  const [n, d] = deficiency(g, prev); newTotal += n; def += d; if (d) ticksDef++;
  hot = Math.max(hot, g.all(M.Moss).filter((i) => g.energyAt(i) > 150).length);
  return `moss ${g.count(M.Moss)} wood ${g.count(M.Wood)} new ${newTotal} deficient ${def} on ${ticksDef} ticks, max moss>150 ${hot}`;
});
