// Scratch (2026-10-28): painted materials only. A log on a wall floor, lit with a dab of flame.
export const W = 90, H = 170;
const floor = (p, M) => { for (let x = 30; x <= 60; x++) p(x, 161, 0, M.Wall); };
export const SCENES = {
  // The steam batch's log: 23 x 6 of wood, flame dabbed on top at t=2.
  log: { ticks: 1200, crop: [26, 120, 64, 163],
    paint: (p, M) => { floor(p, M); for (let y = 155; y <= 160; y++) for (let x = 34; x <= 56; x++) p(x, y, 0, M.Wood); },
    act: (p, t, M) => { if (t === 2) p(45, 153, 2, M.Fire); } },
  // A hearth: a small pile of three short logs.
  stack: { ticks: 1200, crop: [26, 120, 64, 163],
    paint: (p, M) => { floor(p, M); for (let y = 157; y <= 160; y++) for (let x = 36; x <= 54; x++) p(x, y, 0, M.Wood); for (let y = 153; y <= 156; y++) for (let x = 40; x <= 50; x++) p(x, y, 0, M.Wood); },
    act: (p, t, M) => { if (t === 2) p(45, 151, 2, M.Fire); } },
};
