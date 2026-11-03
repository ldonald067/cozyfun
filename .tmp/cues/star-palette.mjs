// Worst-phase distance between a star spark and every plain spark, through the real renderer,
// for candidate star palettes. Each candidate patches STAR_HUES and the strobe in a copy of
// app/src. Also reports the worst-phase distance to stardust and to the night tray.
import { cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadRenderer } from "../../scripts/interaction-scenes.mjs";

const repo = resolve(import.meta.dirname, "../..");
const CANDIDATES = {
  violetDeep: {
    hues: "[[160, 108, 255], [190, 132, 255], [142, 96, 236], [208, 150, 255]]",
    strobe: "return strobe ? adjustRgb(out, 30) : out;",
  },
  violetCool: {
    hues: "[[156, 110, 255], [182, 134, 255], [138, 100, 238], [170, 124, 255]]",
    strobe: "return strobe ? adjustRgb(out, 30) : out;",
  },
  violetIndigo: {
    hues: "[[150, 104, 255], [176, 124, 255], [122, 98, 242], [190, 118, 250]]",
    strobe: "return strobe ? adjustRgb(out, 26) : out;",
  },
};
const redmean = (a, b) => {
  const r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
};
const W = 24, H = 16, S = 8;
const cell = (kind, energy, age, flags, variant) => {
  const cells = new Uint8Array(W * H * S);
  const o = (4 * W + 12) * S;
  cells[o] = kind; cells[o + 1] = variant; cells[o + 2] = age; cells[o + 4] = energy & 255; cells[o + 5] = energy >> 8; cells[o + 6] = flags;
  return cells;
};
for (const [name, patch] of Object.entries(CANDIDATES)) {
  const root = resolve(repo, ".tmp/cues/pal-" + name);
  rmSync(root, { recursive: true, force: true });
  cpSync(resolve(repo, "app/src"), resolve(root, "app/src"), { recursive: true });
  if (patch) {
    const p = resolve(root, "app/src/rendering/shapeLanguage.ts");
    let s = readFileSync(p, "utf8");
    s = s.replace(/export const STAR_HUES: Rgb\[\] = \[[\s\S]*?\n\];/, `export const STAR_HUES: Rgb[] = ${patch.hues};`);
    s = s.replace("return strobe ? mixRgb(out, [255, 255, 255], 0.45) : out;", patch.strobe);
    writeFileSync(p, s);
  }
  const { colorForCell, materials } = loadRenderer("pal-" + name, root);
  const { MATERIAL: M, CELL_FLAG: F } = materials;
  const at = (cells, t) => colorForCell({ kind: cells[(4 * W + 12) * S], variant: cells[(4 * W + 12) * S + 1], age: cells[(4 * W + 12) * S + 2], energy: cells[(4 * W + 12) * S + 4] | (cells[(4 * W + 12) * S + 5] << 8), flags: cells[(4 * W + 12) * S + 6], time: t, cells, width: W, height: H, x: 12, y: 4 });
  let worstPlain = Infinity, wp = "", worstDust = Infinity, worstNight = Infinity;
  for (const e of [40, 60, 90, 120, 155, 190, 235]) for (const a of [3, 6, 10, 15, 20]) for (const sv of [0, 1, 2, 3]) {
    const star = cell(M.Spark, e, a, F.Cosmic, sv);
    for (const pe of [40, 90, 155, 235]) for (const pa of [3, 6, 10, 15]) for (const pv of [0, 1, 2, 3]) {
      const plain = cell(M.Spark, pe, pa, 0, pv);
      for (let t = 0; t < 2000; t += 10) {
        const d = redmean(at(star, t), at(plain, t));
        if (d < worstPlain) { worstPlain = d; wp = `star e${e} a${a} v${sv} vs plain e${pe} a${pa} v${pv} t${t}`; }
      }
    }
    for (const de of [0, 60, 120]) for (const dv of [0, 1, 2, 3]) {
      const dust = cell(M.Stardust, de, 40, 0, dv);
      for (let t = 0; t < 2000; t += 50) worstDust = Math.min(worstDust, redmean(at(star, t), at(dust, t)));
    }
    for (let t = 0; t < 2000; t += 50) worstNight = Math.min(worstNight, redmean(at(star, t), [9, 16, 24]));
  }
  console.log(`${name.padEnd(11)} worst vs plain ${Math.round(worstPlain)} (${wp}); vs stardust ${Math.round(worstDust)}; vs night ${Math.round(worstNight)}`);
}
