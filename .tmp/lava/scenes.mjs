// Scratch (2026-10-21): filmstrip scenes for lava and oil deleting themselves. Painted only.
import { M } from "../../scripts/interaction-scenes.mjs";
const basin = (p) => {
  for (let x = 0; x < 40; x++) p(x, 28, 1, M.Wall);
  for (let y = 10; y <= 28; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
};
const pour = (kind) => (p, t) => { if (t <= 90 && t % 3 === 1) p(20, 4, 4, kind); };
const spring = (kind) => ({ w: 220, h: 140, seed: 3, crop: [30, 50, 189, 137], scale: 2,
  paint: (p) => { for (let x = 0; x < 220; x++) p(x, 138, 1, M.Wall); p(110, 100, 4, M.Wellspring); },
  act: (p, t) => { if (t === 6) p(110, 94, 1, kind); } });
export const SCENES = {
  // The water budget's basin pour, for lava: 30 dabs over 4.5 s, then left alone.
  "lava-pour": { w: 40, h: 30, seed: 5, ticks: [30, 90, 200, 600, 1100, 1500], crop: [0, 4, 39, 29], scale: 4, paint: basin, act: pour(M.Lava) },
  "oil-pour": { w: 40, h: 30, seed: 5, ticks: [30, 90, 200, 400, 690], crop: [0, 4, 39, 29], scale: 4, paint: basin, act: pour(M.Oil) },
  "lava-spring": { ...spring(M.Lava), ticks: [300, 1000, 2000, 4000, 8000] },
  "oil-spring": { ...spring(M.Oil), ticks: [300, 1000, 2000, 4000, 8000] },
  // Oil poured onto a wide pond, as a player makes a slick to light.
  "oil-pond": { w: 70, h: 34, seed: 11, ticks: [40, 100, 200, 600, 1200], crop: [3, 20, 66, 30], scale: 3,
    paint: (p) => {
      for (let x = 0; x < 70; x++) { p(x, 30, 0, M.Wall); p(x, 31, 0, M.Wall); }
      for (let y = 20; y <= 31; y++) for (const x of [3, 4, 65, 66]) p(x, y, 0, M.Wall);
      for (let y = 25; y <= 29; y++) for (let x = 6; x <= 63; x++) p(x, y, 0, M.Water);
    },
    act: (p, t) => { if (t <= 36 && t % 3 === 1) p(34, 18, 3, M.Oil); } },
  // Item 6's basin: lava poured for 8 s beside a wall of ice.
  "lava-ice": { w: 50, h: 30, seed: 400, ticks: [40, 100, 200, 400, 700], crop: [4, 8, 45, 25], scale: 4,
    paint: (p) => {
      for (let x = 4; x <= 45; x++) { p(x, 24, 0, M.Wall); p(x, 25, 0, M.Wall); }
      for (let y = 12; y <= 25; y++) for (const x of [4, 5, 44, 45]) p(x, y, 0, M.Wall);
      for (let y = 12; y <= 21; y++) for (let x = 30; x <= 35; x++) p(x, y, 0, M.Ice);
    },
    act: (p, t) => { if (t < 160 && t % 4 === 0) p(18, 14, 2, M.Lava); } },
};
