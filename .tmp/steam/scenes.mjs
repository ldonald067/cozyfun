// Scratch (2026-10-23): steam that billows. Painted materials only; boards tall enough that
// steam fades before the ceiling (150 ticks of life, a cell a tick).
const wallBox = (p, M, x0, x1, top, floor) => {
  for (let x = x0; x <= x1; x++) { p(x, floor, 0, M.Wall); p(x, floor + 1, 0, M.Wall); }
  for (let y = top; y <= floor + 1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) p(x, y, 0, M.Wall);
};
export const W = 90, H = 170;
export const SCENES = {
  // A pot of water with a flame held at its surface for 20 s.
  kettle: { kind: "Steam", ticks: 500, film: [30, 80, 160, 300], crop: [20, 90, 70, 162],
    paint: (p, M) => { wallBox(p, M, 35, 55, 150, 160); for (let y = 155; y <= 159; y++) for (let x = 37; x <= 53; x++) p(x, y, 0, M.Water); },
    act: (p, t, M) => { if (t < 400 && t % 4 === 0) p(45, 152, 2, M.Fire, 55); } },
  // A wide pond warmed by a flame for 10 s, then left to simmer.
  pond: { kind: "Steam", ticks: 700, film: [40, 100, 180, 260], crop: [8, 90, 82, 162],
    paint: (p, M) => { wallBox(p, M, 10, 80, 148, 160); for (let y = 153; y <= 159; y++) for (let x = 12; x <= 78; x++) p(x, y, 0, M.Water); },
    act: (p, t, M) => { if (t < 200 && t % 4 === 0) p(45, 150, 2, M.Fire, 55); } },
  // A log lit with a dab of flame, then doused with water poured onto it.
  ember: { kind: "Steam", ticks: 600, film: [60, 80, 110, 160], crop: [20, 100, 70, 163],
    paint: (p, M) => { for (let x = 30; x <= 60; x++) { p(x, 161, 0, M.Wall); } for (let y = 155; y <= 160; y++) for (let x = 34; x <= 56; x++) p(x, y, 0, M.Wood); },
    act: (p, t, M) => { if (t === 2) p(45, 153, 2, M.Fire); if (t >= 50 && t < 100 && t % 3 === 0) p(45, 130, 3, M.Water, 55); } },
  // A lava pool with water poured straight onto it.
  lava: { kind: "Steam", ticks: 500, film: [30, 50, 80, 130], crop: [20, 100, 70, 162],
    paint: (p, M) => { wallBox(p, M, 25, 65, 148, 160); for (let y = 156; y <= 159; y++) for (let x = 27; x <= 63; x++) p(x, y, 0, M.Lava); },
    act: (p, t, M) => { if (t >= 20 && t < 80 && t % 3 === 0) p(45, 135, 3, M.Water, 55); } },
  // A painted block of steam and a painted block of smoke, to see how a body draws.
  body: { kind: "Steam", ticks: 30, film: [1, 10, 25], crop: [20, 120, 70, 150],
    paint: (p, M) => { for (let y = 135; y <= 142; y++) for (let x = 25; x <= 36; x++) p(x, y, 0, M.Steam); for (let y = 135; y <= 142; y++) for (let x = 50; x <= 61; x++) p(x, y, 0, M.Smoke); },
    act: () => {} },
  // Reference: smoke off the same log, burning undisturbed.
  smoke: { kind: "Smoke", ticks: 300, film: [60, 120, 200], crop: [20, 80, 70, 163],
    paint: (p, M) => { for (let x = 30; x <= 60; x++) { p(x, 161, 0, M.Wall); } for (let y = 155; y <= 160; y++) for (let x = 34; x <= 56; x++) p(x, y, 0, M.Wood); },
    act: (p, t, M) => { if (t === 2) p(45, 153, 2, M.Fire); } },
};
