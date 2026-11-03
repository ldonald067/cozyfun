// Scratch (2026-10-28, review fix): the worst a shed petal gets against the night and against a
// puff of the same variant, over every reachable age (0-140), cell position, tumble phase,
// falling and lying, and moonlit while a mote can still be (energy 150 drains 2 a tick: age < 75).
import { loadRenderer, redmeanDistance } from "../../scripts/interaction-scenes.mjs";
const { colorForCell } = loadRenderer("petal-sweep");
const W = 8, H = 8;
const names = ["cornflower", "poppy", "daisy", "sunflower", "tulip", "lavender", "bluebell", "cosmos"];
const render = (x, y, v, age, flags, floor, time) => {
  const cells = new Uint8Array(W * H * 8);
  const o = (y * W + x) * 8;
  cells[o] = 22; cells[o + 1] = v; cells[o + 2] = age & 255; cells[o + 3] = age >> 8;
  const energy = Math.max(0, 150 - 2 * age); cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags;
  if (floor) cells[((y + 1) * W + x) * 8] = 1;
  return colorForCell({ kind: 22, variant: v, age, energy, flags, time, cells, width: W, height: H, x, y });
};
const bg = colorForCell({ kind: 0, variant: 0, age: 0, energy: 0, flags: 0, time: 0, cells: new Uint8Array(W * H * 8), width: W, height: H, x: 1, y: 1 });
for (let v = 0; v < 8; v++) {
  const worst = { bg: [1e9], puff: [1e9] };
  for (let age = 0; age <= 140; age += 2) for (const cosmic of age < 75 ? [0, 4] : [0]) for (const floor of [false, true])
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) for (let t = 0; t < 3000; t += 90) {
      const pet = render(x, y, v, age, 2 | cosmic, floor, t), puff = render(x, y, v, age, cosmic, floor, t);
      const dBg = redmeanDistance(pet, bg), dP = redmeanDistance(pet, puff);
      if (dBg < worst.bg[0]) worst.bg = [dBg, age, cosmic, floor, x, y, t];
      if (dP < worst.puff[0]) worst.puff = [dP, age, cosmic, floor, x, y, t];
    }
  console.log(names[v].padEnd(11), "bg", worst.bg[0].toFixed(0).padStart(4), JSON.stringify(worst.bg.slice(1)), " puff", worst.puff[0].toFixed(0).padStart(4), JSON.stringify(worst.puff.slice(1)));
}
