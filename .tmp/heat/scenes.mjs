// Scratch (2026-10-20): the heat batch's pictures. Painted materials only.
const basin = (p, M, x0, x1, top, floor) => {
  for (let x = x0; x <= x1; x++) { p(x, floor, 0, M.Wall); p(x, floor + 1, 0, M.Wall); }
  for (let y = top; y <= floor + 1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) p(x, y, 0, M.Wall);
};
export const SCENES = {
  // Canvas item 3: a pool with ice banks at both ends, a flame held to the middle of it.
  pool: { note: "ice banks in a pool, flame held 10 s in the middle (ice / hot water / mean water E / steam)",
    w: 50, h: 34, seed: 300, at: [20, 60, 120, 200, 320, 500],
    paint: (p, M) => {
      basin(p, M, 4, 45, 16, 28);
      for (let y = 21; y <= 27; y++) for (let x = 6; x <= 43; x++) p(x, y, 0, M.Water);
      for (let y = 19; y <= 27; y++) for (let x = 6; x <= 11; x++) { p(x, y, 0, M.Ice); p(x + 32, y, 0, M.Ice); }
    },
    act: (p, t, M) => { if (t < 200 && t % 4 === 0) p(25, 17, 2, M.Fire); },
    box: [6, 10, 43, 27],
    show: (s) => `ice ${String(s.ice).padStart(3)} hot ${String(s.hot).padStart(3)} E ${String(Math.round(s.sumE / Math.max(1, s.water))).padStart(3)} st ${String(s.steam).padStart(2)}` },
  // The audit's hot-melt basin: a slab of ice, a flame held to it for nine seconds.
  slab: { note: "audit basin: ice slab, flame held 9 s (ice / hot water / mean E / steam)",
    w: 30, h: 26, seed: 164, at: [40, 100, 200, 300, 400, 600],
    paint: (p, M) => {
      for (let x = 6; x <= 24; x++) p(x, 21, 1, M.Wall);
      for (let y = 12; y <= 21; y++) { p(6, y, 1, M.Wall); p(24, y, 1, M.Wall); }
      for (let y = 16; y <= 19; y++) for (let x = 9; x <= 21; x++) p(x, y, 1, M.Ice);
    },
    act: (p, t, M) => { if (t >= 20 && t < 200 && t % 4 === 0) p(15, 12, 3, M.Fire); },
    box: [8, 8, 22, 20],
    show: (s) => `ice ${String(s.ice).padStart(3)} hot ${String(s.hot).padStart(3)} E ${String(Math.round(s.sumE / Math.max(1, s.water))).padStart(3)} st ${String(s.steam).padStart(2)}` },
  // A pool warmed first, then ice dropped in at both ends.
  "warm-then-ice": { note: "pool warmed by a flame 10 s, ice dropped in at t=120 (ice / hot / mean E / steam)",
    w: 50, h: 34, seed: 600, at: [119, 140, 200, 260, 320, 500],
    paint: (p, M) => {
      basin(p, M, 4, 45, 16, 28);
      for (let y = 21; y <= 27; y++) for (let x = 6; x <= 43; x++) p(x, y, 0, M.Water);
    },
    act: (p, t, M) => {
      if (t < 200 && t % 4 === 0) p(25, 17, 2, M.Fire);
      if (t === 120) for (let y = 18; y <= 21; y++) for (let x = 8; x <= 11; x++) { p(x, y, 0, M.Ice); p(x + 30, y, 0, M.Ice); }
    },
    box: [6, 10, 43, 27],
    show: (s) => `ice ${String(s.ice).padStart(3)} hot ${String(s.hot).padStart(3)} E ${String(Math.round(s.sumE / Math.max(1, s.water))).padStart(3)} st ${String(s.steam).padStart(2)}` },
  // A puddle-sized pool, ice banks at both ends, a flame held over the middle from the start.
  puddle: { note: "puddle 16x3, ice banks both ends, flame held 10 s (ice / hot / mean E / steam)",
    w: 40, h: 30, seed: 700, at: [20, 60, 120, 200, 300, 500],
    paint: (p, M) => {
      basin(p, M, 8, 31, 18, 25);
      for (let y = 22; y <= 24; y++) for (let x = 10; x <= 29; x++) p(x, y, 0, M.Water);
      for (let y = 21; y <= 24; y++) for (let x = 10; x <= 12; x++) { p(x, y, 0, M.Ice); p(x + 17, y, 0, M.Ice); }
    },
    act: (p, t, M) => { if (t < 200 && t % 4 === 0) p(20, 19, 2, M.Fire); },
    box: [10, 12, 29, 24],
    show: (s) => `ice ${String(s.ice).padStart(3)} w ${String(s.water).padStart(3)} hot ${String(s.hot).padStart(3)} E ${String(Math.round(s.sumE / Math.max(1, s.water))).padStart(3)} st ${String(s.steam).padStart(2)}` },
  // The puddle warmed first, ice dropped in at both ends at t=100.
  "warm-puddle": { note: "puddle 16x3 warmed by a flame, ice dropped at both ends t=100 (ice / water / hot / mean E / steam)",
    w: 40, h: 30, seed: 800, at: [40, 99, 120, 160, 220, 320],
    paint: (p, M) => {
      basin(p, M, 8, 31, 18, 25);
      for (let y = 22; y <= 24; y++) for (let x = 10; x <= 29; x++) p(x, y, 0, M.Water);
    },
    act: (p, t, M) => {
      if (t < 200 && t % 4 === 0) p(20, 19, 2, M.Fire);
      if (t === 100) for (let y = 20; y <= 21; y++) for (let x = 11; x <= 12; x++) { p(x, y, 0, M.Ice); p(x + 16, y, 0, M.Ice); }
    },
    box: [10, 12, 29, 24],
    show: (s) => `ice ${String(s.ice).padStart(3)} w ${String(s.water).padStart(3)} hot ${String(s.hot).padStart(3)} E ${String(Math.round(s.sumE / Math.max(1, s.water))).padStart(3)} st ${String(s.steam).padStart(2)}` },
  // Canvas item 4: lava held in a trough, a one-cell wall, a two-cell gap, then a wall of ice.
  "ice-wall": { note: "lava poured into a basin 8 cells from a wall of ice (ice / frozen / lava / stone)",
    w: 50, h: 30, seed: 400, at: [40, 100, 160, 240, 400, 700],
    paint: (p, M) => {
      basin(p, M, 4, 45, 12, 24);
      for (let y = 12; y <= 21; y++) for (let x = 30; x <= 35; x++) p(x, y, 0, M.Ice);
    },
    act: (p, t, M) => { if (t < 160 && t % 4 === 0) p(18, 14, 2, M.Lava); },
    box: [6, 4, 43, 23],
    show: (s) => `ice ${String(s.ice).padStart(3)} fr ${String(s.frozen).padStart(2)} lava ${String(s.lava).padStart(2)} st ${String(s.stone).padStart(2)}` },
  // Item 6 as a player meets it: an ice block frosting a soil bed, lava poured four cells off.
  thaw: { note: "ice block frosting a soil bed, lava poured 4 cells off (ice / frozen / lava / stone)",
    w: 50, h: 30, seed: 500, at: [290, 340, 400, 500, 700, 1000],
    paint: (p, M) => {
      for (let x = 4; x <= 46; x++) { p(x, 25, 0, M.Wall); p(x, 26, 0, M.Wall); }
      for (let x = 6; x <= 44; x++) { p(x, 23, 0, M.Soil); p(x, 24, 0, M.Soil); }
      for (let y = 18; y <= 22; y++) for (let x = 27; x <= 32; x++) p(x, y, 0, M.Ice);
    },
    act: (p, t, M) => { if (t >= 300 && t < 340 && t % 4 === 0) p(20, 17, 1, M.Lava, 60); },
    box: [4, 4, 46, 24],
    show: (s) => `ice ${String(s.ice).padStart(2)} fr ${String(s.frozen).padStart(2)} lava ${String(s.lava).padStart(2)} st ${String(s.stone).padStart(2)}` },
};
