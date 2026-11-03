// Scratch (2026-10-23): how gathered is steam? node .tmp/steam/measure.mjs <variant,...> [seeds] [scene,...]
// Per scene, over every tick and seed, for the gas cells below row 8: share with no cardinal
// gas neighbour / with 2+, share touching another (8-neighbour), share in 8-connected bodies of
// 4+ cells, peak cells on the board, and cell-ticks (volume). Thermal steam is E > 30 (not mist).
import { build } from "./variant.mjs";
import { SCENES, W, H } from "./scenes.mjs";
const [names = "live", seedsArg = "8", only] = process.argv.slice(2);
const seeds = Number(seedsArg);
for (const name of names.split(",")) {
  const { create, M } = build(name);
  console.log(`\n=== ${name}`);
  for (const [sname, sc] of Object.entries(SCENES)) {
    if (only && !only.split(",").includes(sname)) continue;
    const K = M[sc.kind];
    const st = { hotPeak: 0, n: 0, c0: 0, c2: 0, t8: 0, big: 0, peak: 0, mist: 0, hot: 0, water: [] };
    for (let s = 0; s < seeds; s++) {
      const e = create(W, H, 4100 + s * 7), p = (x, y, r, m, d = 100) => e.paint(x, y, r, m, d);
      sc.paint(p, M);
      let waterStart = -1;
      for (let t = 1; t <= sc.ticks; t++) {
        sc.act(p, t, M); e.tick();
        const b = e.getCellBytes();
        const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : b[(y * W + x) * 8]);
        let count = 0, hotNow = 0;
        const seen = new Uint8Array(W * H);
        for (let y = 8; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 8;
          if (b[i] !== K) continue;
          count++;
          const E = b[i + 4] | (b[i + 5] << 8);
          if (sc.kind === "Steam" && E <= 30) st.mist++; else { st.hot++; hotNow++; }
          st.n++;
          const card = [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)].filter((k) => k === K).length;
          if (card === 0) st.c0++;
          if (card >= 2) st.c2++;
          let any = card > 0;
          if (!any) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (at(x + dx, y + dy) === K) any = true;
          if (any) st.t8++;
          if (!seen[y * W + x]) {
            const stack = [[x, y]], comp = []; seen[y * W + x] = 1;
            while (stack.length) {
              const [cx, cy] = stack.pop(); comp.push(1);
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (ny < 8 || at(nx, ny) !== K || seen[ny * W + nx]) continue;
                seen[ny * W + nx] = 1; stack.push([nx, ny]);
              }
            }
            if (comp.length >= 4) st.big += comp.length;
          }
        }
        st.peak = Math.max(st.peak, count); st.hotPeak = Math.max(st.hotPeak, hotNow);
      }
    }
    // `big` counts every cell of a 4+ body, mist included where it joins; clamp for display.
    const pct = (a) => `${Math.round((100 * a) / Math.max(1, st.n))}%`.padStart(4);
    console.log(`  ${sname.padEnd(7)} alone ${pct(st.c0)}  2+ ${pct(st.c2)}  touch ${pct(st.t8)}  in4+ ${pct(Math.min(st.big, st.n))}  peak ${String(st.peak).padStart(4)} (${(100 * st.peak / (W * H)).toFixed(2)}%)  hot peak ${String(st.hotPeak).padStart(4)}  cell-ticks ${st.n} (hot ${st.hot})`);
  }
}
