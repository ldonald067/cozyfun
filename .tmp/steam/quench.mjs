// Scratch: the parity lava-quench scene, HEAD (.tmp/steam/base) against the working tree.
// node .tmp/steam/quench.mjs [seeds]
import { resolve } from "node:path";
import { compileApp } from "../../scripts/compile-app.mjs";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
const seeds = Number(process.argv[2] ?? 8), wr = Number(process.argv[3] ?? 3), pour = process.argv[4] === 'pour';
// The old lava guard (lava never deletes lava, but water may), on the working tree.
const sab = resolve(import.meta.dirname, "sab-oldguard");
mkdirSync(resolve(sab, "app/src"), { recursive: true });
const src = readFileSync(resolve(import.meta.dirname, "../../app/src/engine.ts"), "utf8");
const f = "    if (next[target] === MATERIAL.Lava) return false;\n";
if (src.split(f).length !== 2) throw new Error("guard not found");
writeFileSync(resolve(sab, "app/src/engine.ts"), src.replace(f, "    if (movingCell[0] === MATERIAL.Lava && next[target] === MATERIAL.Lava) return false;\n"));
copyFileSync(resolve(import.meta.dirname, "../../app/src/materials.ts"), resolve(sab, "app/src/materials.ts"));
for (const [label, root] of [["HEAD", resolve(import.meta.dirname, "base")], ["tree", undefined], ["oldguard", sab]]) {
  const app = compileApp(`steam-q-${label}`, ["engine.ts", "materials.ts"], root ? { root } : {});
  const M = app.load("materials").MATERIAL, { createFallbackEngine } = app.load("engine");
  const rows = [];
  for (let s = 0; s < seeds; s++) {
    const e = createFallbackEngine(70, 44, 169 + s), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
    for (let x = 1; x < 70; x += 3) p(x, 40, 1, M.Wall);
    for (const x of [1, 67]) for (let y = 20; y <= 39; y++) { p(x, y, 0, M.Wall); p(x + 1, y, 0, M.Wall); }
    p(22, 26, 4, M.Lava); if (!pour) p(47, 26, wr, M.Water);
    let prev = e.getCellBytes().slice(), quenched = 0, firstTouch = -1, deleted = 0;
    const k = (c, x, y) => (x < 0 || y < 0 || x >= 70 || y >= 44 ? 0 : c[(y * 70 + x) * 8]);
    for (let t = 1; t <= 600; t++) {
      if (pour && t >= 1 && t <= 40 && t % 4 === 1) p(47, 26, wr, M.Water);
      e.tick(); const c = e.getCellBytes();
      let was = 0, now = 0, set = 0;
      for (let y = 0; y < 44; y++) for (let x = 0; x < 70; x++) {
        if (k(c, x, y) === M.Lava) now++;
        if (k(prev, x, y) === M.Lava) { was++; if (k(c, x, y) === M.Stone) set++; }
        if (k(prev, x, y) === M.Lava && k(c, x, y) === M.Stone && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => k(prev, x + dx, y + dy) === M.Water)) { quenched++; if (firstTouch < 0) firstTouch = t; }
      }
      deleted += Math.max(0, was - now - set);
      prev = c.slice();
    }
    const n = (m) => { let a = 0; for (let i = 0; i < prev.length; i += 8) if (prev[i] === m) a++; return a; };
    rows.push(`del ${String(deleted).padStart(2)} q${String(quenched).padStart(3)} first@${String(firstTouch).padStart(3)} stone ${n(M.Stone)} lava ${n(M.Lava)} water ${n(M.Water)}`);
  }
  const qs = rows.map((r) => Number(r.match(/q\s*(\d+)/)[1])), ds = rows.map((r) => Number(r.match(/del\s*(\d+)/)[1]));
  console.log(`${label} (water r${wr}${pour ? ' pour' : ''}): quench >= 10 on ${qs.filter((q) => q >= 10).length}/${seeds}, min ${Math.min(...qs)}; deleted on ${ds.filter((d) => d > 0).length}/${seeds} seeds, seed 169: q ${qs[0]} del ${ds[0]}`);
}
