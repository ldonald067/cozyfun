// Scratch: the "rising steam never deletes falling water" parity scene on the working tree; on a
// tick where water drops by more than the fresh mist, print what took the water's cells.
import { build } from "./variant.mjs";
const { create: createFallbackEngine, M } = build("count-mist");
const names = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
const w = 40, h = 34, e = createFallbackEngine(w, h, 4211), p = (x, y, r, m) => e.paint(x, y, r, m, 100);
for (let x = 1; x <= 38; x++) { p(x, 1, 1, M.Wall); p(x, 32, 1, M.Wall); }
for (let y = 1; y <= 32; y++) { p(1, y, 1, M.Wall); p(38, y, 1, M.Wall); }
for (let y = 5; y <= 10; y++) for (let x = 8; x <= 31; x += 2) p(x + (y % 2), y, 1, M.Water);
for (let y = 22; y <= 28; y++) for (let x = 8; x <= 31; x += 2) p(x + ((y + 1) % 2), y, 1, M.Steam);
let prev = e.getCellBytes().slice();
const count = (c) => { let n = 0; for (let i = 0; i < c.length; i += 8) if (c[i] === M.Water) n++; return n; };
for (let t = 1; t <= 140; t++) {
  e.tick(); const c = e.getCellBytes();
  let fresh = 0;
  for (let i = 0; i < c.length; i += 8) if (c[i] === M.Steam && (c[i + 2] | (c[i + 3] << 8)) === 0 && (c[i + 4] | (c[i + 5] << 8)) === 30) fresh++;
  const thrown = globalThis.__mist ?? 0; globalThis.__mist = 0;
  const lost = count(prev) - count(c) - fresh;
  if (lost) console.log(`tick ${t}: board says lost ${lost} (water ${count(prev)} -> ${count(c)}, fresh mist on board ${fresh}, mist thrown ${thrown}, water unaccounted ${count(prev) - count(c) - thrown})`);
  if (false) {
    console.log(`tick ${t}: lost ${lost}`);
    for (let i = 0; i < c.length; i += 8) if (prev[i] === M.Water && c[i] !== M.Water) {
      const n = i / 8, x = n % w, y = Math.floor(n / w), f = c[i + 6] | (c[i + 7] << 8);
      console.log(`  (${x},${y}) water -> ${names[c[i]]} age ${c[i + 2] | (c[i + 3] << 8)} E ${c[i + 4] | (c[i + 5] << 8)} flags ${f}`);
    }
  }
  prev = c.slice();
}
