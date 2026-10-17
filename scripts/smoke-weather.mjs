// Room weather schedules every drop at an absolute engine tick, and clearing the tray restarts
// that count at 0. For as long as nothing told the weather, a clear left an open window dry for
// as long as the tray had already run: twenty minutes of play, then twenty minutes without rain.
//
// This plays RoomWeather the way App.tsx does, once per sim tick while the window is open, then
// clears as `handleClear` does (`restart()`, and the tick count starts again), and asserts the
// opening drop comes as soon as it does on first sight. Two halves, each with its own check: the
// schedule restarts, and so does the census, which would otherwise hold a pre-clear "over the
// cap" count against the empty tray. Each is also played with the window shut across the clear
// until the count has climbed past where it was, which is why the clear tells the weather
// rather than the weather inferring it from a tick going backwards.
import { compileApp } from "./compile-app.mjs";

const app = compileApp("weather-cjs", ["weather.ts", "materials.ts"]);
const { RoomWeather } = app.load("weather");
const { MATERIAL, CELL_STRIDE } = app.load("materials");

const W = 160, H = 100;
const ROOM = "rain-desk";
// First sight schedules the opening drop within 0.3 x 340 x 1.5 = 153 ticks; 200 is ten
// seconds at ~20 ticks a second, the "within a few seconds" the window promises.
const OPENING_WITHIN = 200;
const DAYS = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const PLAYED = [500, 6000, 24000];

const empty = new Uint8Array(W * H * CELL_STRIDE);
// A tray well over Rain Desk's 2% water cap, so the census suppresses every drop.
const flooded = new Uint8Array(W * H * CELL_STRIDE);
for (let offset = 0; offset < flooded.length; offset += CELL_STRIDE) flooded[offset] = MATERIAL.Water;

/** Ticks from the window (re)opening after a clear to the first drop. */
function waitAfterClear(day, played, trayBefore, shutFor) {
  const weather = new RoomWeather(day);
  for (let tick = 1; tick <= played; tick++) weather.drop(ROOM, tick, W, H, () => trayBefore);
  weather.restart();
  // The engine counts from 0 again; with the window shut, the weather is not asked.
  const reopen = shutFor + 1;
  for (let tick = reopen; tick <= reopen + played + 2000; tick++) {
    if (weather.drop(ROOM, tick, W, H, () => empty)) return tick - reopen + 1;
  }
  return Infinity;
}

const failures = [];
const worst = {};
let cases = 0;
for (const [label, trayBefore] of [["schedule", empty], ["census", flooded]]) {
  for (const played of PLAYED) {
    for (const shutFor of [0, played + 1]) {
      for (const day of DAYS) {
        cases++;
        const wait = waitAfterClear(day, played, trayBefore, shutFor);
        worst[label] = Math.max(worst[label] ?? 0, wait);
        if (wait > OPENING_WITHIN) {
          failures.push(`${label}: ${played} ticks of play, a clear, the window shut for ${shutFor}, ${day}: ` +
            `first drop ${wait} ticks after it opened (want <= ${OPENING_WITHIN})`);
        }
      }
    }
  }
}

if (failures.length) {
  console.error(failures.slice(0, 8).join("\n"));
  throw new Error(`Weather smoke failed: ${failures.length} of ${cases} cleared trays waited past the opening drop`);
}
console.log(
  `Weather smoke passed: after a clear the opening drop lands within ${worst.schedule} ticks ` +
  `(${worst.census} after a flooded tray) in all ${cases} cases: ${DAYS.length} days, ` +
  `500 to 24,000 ticks of play, the window open or shut across the clear.`
);
