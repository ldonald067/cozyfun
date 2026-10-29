// The night behind the pixels: a still watercolour wash in the landing poster's language, held
// dark and calm for the tray. The owner's pick (2026-10-29) was B2 on
// .tmp/pixel-review/watercolour2-sheet.png: every cell stays crisp, and only open air shows the
// wash. Mocked, it cost at most 6 luma of edge contrast (soil 52 to 47, lava 42 to 39).
//
// It is one fixed painting in board coordinates (cells, continuous), so the live tray, the
// postcard, the clip and every capture show the same sky behind the same cell, and a harness
// asking what colour a cell of air is gets the wash at that cell (`washAt`) rather than a flat
// colour no screen shows any more.
//
// Deep blue for most of the night, a broad indigo wash laid over it, violet blooming inside the
// indigo. Where the indigo wash dries out its edge darkens (a tide line), a slow mottle moves the
// pigment, and paper grain sits under all of it. Tones, thresholds and amounts are the mock's
// (watercolour2.py); its fields were blurred PIL noise, measured at mean 0.5 and sd 0.18, which
// is what the value noise here is scaled to.
import type { Rgb } from "./color";
import { hashCell } from "./hash";

export const WASH_DEEP: Rgb = [8, 12, 28];
export const WASH_INDIGO: Rgb = [15, 22, 56];
export const WASH_VIOLET: Rgb = [34, 20, 56];
/** Bitmap pixels a cell. Grain at a quarter cell reads as paper at play zoom; the rest is soft. */
export const WASH_PX_PER_CELL = 4;
/**
 * The least sky painted past each edge of the board, in cells. The tray asks for more when its
 * frame leaves a wider margin than this (`washMarginFor`): 90% kept on a snapped board's tight
 * axis is under 13 cells, but the other axis can exceed 16 (16.5 on a 293 px phone, review).
 */
export const WASH_MARGIN = 16;

// Lattice spacing of each field, in cells, chosen so each field's autocorrelation falls to a
// half at the mock's lag (19.7, 14.1 and 5.3 cells, measured on its blurred PIL fields).
const WIDE_PERIOD = 28;
const BROAD_PERIOD = 20;
const MOTTLE_PERIOD = 7.3;
// One Catmull-Rom octave over a uniform lattice has this sd (measured over 10^6 samples, mean
// 0.5006); scaling it to the mock's 0.18 lets the mock's thresholds carry over unchanged.
const LATTICE_SD = 0.2349;
const FIELD_SD = 0.18;
// The tide line: the mock subtracted a 4 px blur (1.25 cells) from a step at the broad wash's
// midpoint and darkened by up to 12% where three times that difference reached 1.
const TIDE_BLUR = 1.25;
const TIDE_DARKEN = 0.12;
const MOTTLE = 0.12;
const GRAIN = 0.22;
const GRAIN_SD = 0.086;

const smoothstep = (lo: number, hi: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

const lattice = (seed: number, i: number, j: number) => hashCell(i, j, seed) / 4294967296;

function latticeRow(seed: number, i: number, j: number, t: number) {
  return catmullRom(lattice(seed, i - 1, j), lattice(seed, i, j), lattice(seed, i + 1, j), lattice(seed, i + 2, j), t);
}

/** Smooth noise at mean 0.5, sd `FIELD_SD`. */
function field(seed: number, u: number, v: number, period: number) {
  const x = u / period;
  const y = v / period;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const tx = x - i;
  const raw = catmullRom(latticeRow(seed, i, j - 1, tx), latticeRow(seed, i, j, tx), latticeRow(seed, i, j + 1, tx), latticeRow(seed, i, j + 2, tx), y - j);
  return 0.5 + (raw - 0.5) * (FIELD_SD / LATTICE_SD);
}

type WashFields = { wide: number; broad: number; slope: number; mottle: number };

/**
 * The wash's smooth fields at board point (u, v). `slope` is the broad field's gradient, per cell.
 * The seeds pick the painting: 14 for the violet puts it on 8.6% of the board and leaves 48%
 * deep, nearest of sixteen draws to the mock the owner picked from (7.4% and 49%).
 */
function fieldsAt(u: number, v: number): WashFields {
  const broad = field(2, u, v, BROAD_PERIOD);
  const du = (field(2, u + 1, v, BROAD_PERIOD) - field(2, u - 1, v, BROAD_PERIOD)) / 2;
  const dv = (field(2, u, v + 1, BROAD_PERIOD) - field(2, u, v - 1, BROAD_PERIOD)) / 2;
  return { wide: field(14, u, v, WIDE_PERIOD), broad, slope: Math.hypot(du, dv), mottle: field(3, u, v, MOTTLE_PERIOD) };
}

/** Wash colour from its fields, before grain, as [r, g, b] floats, into `out`. */
function washColour({ wide, broad, slope, mottle }: WashFields, out: [number, number, number]) {
  const violet = smoothstep(125 / 255, 200 / 255, wide);
  const laid = smoothstep(80 / 255, 190 / 255, broad);
  // Distance inside the indigo wash's dried edge, in cells; the line is on the wet side only.
  const inside = (broad - 127 / 255) / Math.max(slope, 1e-4);
  const tide = inside > 0 ? Math.min(1, 3 / (1 + Math.exp((1.702 * inside) / TIDE_BLUR))) : 0;
  const shade = (1 - tide * TIDE_DARKEN) * ((1 - MOTTLE + mottle * MOTTLE) / (1 - MOTTLE / 2));
  for (let c = 0; c < 3; c++) {
    const top = WASH_INDIGO[c] + (WASH_VIOLET[c] - WASH_INDIGO[c]) * violet;
    out[c] = (WASH_DEEP[c] + (top - WASH_DEEP[c]) * laid) * shade;
  }
}

// A bitmap pixel's centre, in cells off its cell's centre: -0.375, -0.125, 0.125, 0.375.
const OFFSETS = Array.from({ length: WASH_PX_PER_CELL }, (_, k) => (k + 0.5) / WASH_PX_PER_CELL - 0.5);

const lerp2 = (a: number, b: number, c: number, d: number, tx: number, ty: number) => {
  const top = a + (b - a) * tx;
  return top + (c + (d - c) * tx - top) * ty;
};

/**
 * The wash at one bitmap pixel of a cell, grain left out, into `out`. `nine` holds the fields at
 * the centres of the cell and its eight neighbours, row by row; the pixel interpolates between
 * the four centres nearest it.
 */
function pixelColour(nine: WashFields[], ox: number, oy: number, fields: WashFields, out: [number, number, number]) {
  const i = ox < 0 ? 0 : 1;
  const j = oy < 0 ? 0 : 1;
  const tx = ox - i + 1;
  const ty = oy - j + 1;
  const a = nine[j * 3 + i];
  const b = nine[j * 3 + i + 1];
  const c = nine[j * 3 + i + 3];
  const d = nine[j * 3 + i + 4];
  fields.wide = lerp2(a.wide, b.wide, c.wide, d.wide, tx, ty);
  fields.broad = lerp2(a.broad, b.broad, c.broad, d.broad, tx, ty);
  fields.slope = lerp2(a.slope, b.slope, c.slope, d.slope, tx, ty);
  fields.mottle = lerp2(a.mottle, b.mottle, c.mottle, d.mottle, tx, ty);
  washColour(fields, out);
}

const measured = new Map<number, Rgb>();

/**
 * The wash behind cell (x, y) as a player sees it, grain left out: the mean of the same pixels
 * `paintNightWash` draws there. A centre sample is not enough: a tide line can darken part of a
 * cell, and measured 3 levels off the painted cell where one crossed it.
 */
export function washAt(x: number, y: number): Rgb {
  const key = (x + 32768) * 65536 + (y + 32768);
  const known = measured.get(key);
  if (known) return known;
  const nine: WashFields[] = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) nine.push(fieldsAt(x + di + 0.5, y + dj + 0.5));
  const sum = [0, 0, 0];
  const fields: WashFields = { wide: 0, broad: 0, slope: 0, mottle: 0 };
  const colour: [number, number, number] = [0, 0, 0];
  for (const oy of OFFSETS) for (const ox of OFFSETS) {
    pixelColour(nine, ox, oy, fields, colour);
    for (let c = 0; c < 3; c++) sum[c] += colour[c];
  }
  const n = OFFSETS.length * OFFSETS.length;
  const out: Rgb = [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
  measured.set(key, out);
  return out;
}

export type NightWash = {
  width: number;
  height: number;
  /** RGBA, opaque. */
  data: Uint8ClampedArray<ArrayBuffer>;
  /** The board's rectangle inside the bitmap, in bitmap pixels. */
  board: { x: number; y: number; width: number; height: number };
};

/**
 * The cells of sky a board drawn at `cell` CSS px needs on every side to fill a `boxWidth` x
 * `boxHeight` frame whose board sits at (`left`, `top`), with a cell to spare for rounding.
 */
export function washMarginFor(boxWidth: number, boxHeight: number, left: number, top: number, boardWidth: number, boardHeight: number, cell: number) {
  const widest = Math.max(left, top, boxWidth - left - boardWidth, boxHeight - top - boardHeight);
  return Math.max(WASH_MARGIN, Math.ceil(widest / cell) + 1);
}

/**
 * Paint the wash for a `cols` x `rows` board with `margin` cells of sky round it. The smooth
 * fields are sampled once a cell, at its centre, and interpolated between: their features are 5
 * cells and up, so that is indistinguishable from sampling every pixel, at a sixteenth of the cost.
 */
export function paintNightWash(cols: number, rows: number, margin = WASH_MARGIN): NightWash {
  const gw = cols + margin * 2;
  const gh = rows + margin * 2;
  const grid: WashFields[] = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) grid.push(fieldsAt(i - margin + 0.5, j - margin + 0.5));
  const s = WASH_PX_PER_CELL;
  const width = gw * s;
  const height = gh * s;
  const data = new Uint8ClampedArray(width * height * 4);
  const fields: WashFields = { wide: 0, broad: 0, slope: 0, mottle: 0 };
  const colour: [number, number, number] = [0, 0, 0];
  const nine: WashFields[] = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    // Past the outermost centres the sky holds its edge value.
    for (let k = 0; k < 9; k++) {
      const nj = Math.min(gh - 1, Math.max(0, j + Math.floor(k / 3) - 1));
      const ni = Math.min(gw - 1, Math.max(0, i + (k % 3) - 1));
      nine[k] = grid[nj * gw + ni];
    }
    for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
      pixelColour(nine, OFFSETS[sx], OFFSETS[sy], fields, colour);
      const px = i * s + sx;
      const py = j * s + sy;
      // Two uniforms make a triangular grain; scaled to the mock's sd, centred on no change.
      const h = hashCell(px, py, 4);
      const grain = (((h & 0xffff) + (h >>> 16)) / 65535 - 1) * (GRAIN_SD / 0.408);
      const paper = (1 - GRAIN / 2 + grain * GRAIN) / (1 - GRAIN / 2);
      const o = (py * width + px) * 4;
      data[o] = colour[0] * paper;
      data[o + 1] = colour[1] * paper;
      data[o + 2] = colour[2] * paper;
      data[o + 3] = 255;
    }
  }
  return { width, height, data, board: { x: margin * s, y: margin * s, width: cols * s, height: rows * s } };
}
