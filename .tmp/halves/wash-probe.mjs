import { loadWasmEngine, grid, M } from "../../scripts/interaction-scenes.mjs";
const engine = await loadWasmEngine();
for (const seed of [111, 1111, 2111]) {
  const u = engine.create(30, 26, seed);
  u.paint(15, 20, 4, M.Wood, 100); u.paint(15, 16, 1, M.Fire, 100);
  for (let x = 1; x < 30; x += 3) u.paint(x, 22, 1, M.Wall, 100);
  const line = [];
  for (let t = 1; t <= 600; t++) {
    u.tick();
    if (t % 50 === 0) {
      const g = grid(u.view(), 30, 26);
      const em = g.all(M.Ember);
      line.push(`t${t}: wood ${g.count(M.Wood)} hot ${em.filter((i) => g.energyAt(i) >= 30).length} cold ${em.filter((i) => g.energyAt(i) < 30).length}`);
    }
  }
  console.log(seed, line.join(" | "));
  u.free();
}
