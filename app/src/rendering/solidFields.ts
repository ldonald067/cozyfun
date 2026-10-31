import { hashCell } from "./hash";

// The solids' large shapes: stone's broken faces, ice's fractures, wood's grain, soil's pebbles.
// Each is wider than a cell's neighbours can tell it, so each is laid out once, at load, as a
// 256x256 tile that wraps, and a frame only looks it up. Solids are most of a played board, and
// finding the nearest fracture cell by cell would be paid on every one of them, every frame.
//
// 256 because the board is 220x140, so a tile never shows twice. At 64 the first full board had
// four copies of every knot side by side.
//
// The tiles are keyed on position, not on a cell's variant, because variant changes cell by cell
// and these shapes have to run across many cells. So a falling stone slides through its pattern
// for the moment it falls, and it settles back into one rock when it lands.
const TILE = 256;
const SPAN = TILE * TILE;
const TAU = Math.PI * 2;

export function tileIndex(x: number, y: number) {
  return ((y & (TILE - 1)) << 8) | (x & (TILE - 1));
}

const wrapped = (d: number) => {
  const a = Math.abs(d) % TILE;
  return Math.min(a, TILE - a);
};
const unit = (a: number, b: number, salt: number) => (hashCell(a, b, salt) % 1000) / 999;
const clampByte = (value: number) => Math.max(-127, Math.min(127, Math.round(value)));

export const SEAM_CRACK = 1;
export const SEAM_LIP = 2;

// Rock breaks along planes. Every face is a plane tilted its own way to the light, so tone runs
// across it in bands; a shared edge is sometimes an open crack and sometimes only a change of
// tone, because a rock cracked along every face reads as crazy paving rather than as one mass.
function buildStone() {
  const tone = new Int8Array(SPAN);
  const seam = new Uint8Array(SPAN);
  const across = 24, size = TILE / across;
  const wrap = (i: number) => (i + across) % across;
  const faces = across * across;
  const faceX = new Float32Array(faces), faceY = new Float32Array(faces);
  const planeX = new Float32Array(faces), planeY = new Float32Array(faces), lean = new Float32Array(faces);
  for (let id = 0; id < faces; id++) {
    const i = id % across, j = (id - i) / across;
    faceX[id] = (i + 0.15 + unit(i, j, 21) * 0.7) * size;
    faceY[id] = (j + 0.15 + unit(i, j, 22) * 0.7) * size;
    planeX[id] = unit(i, j, 23) * 2 - 1;
    planeY[id] = unit(i, j, 24) * 2 - 1;
    lean[id] = unit(i, j, 25) * 36 - 18;
  }
  const signed = (d: number) => ((d + TILE * 1.5) % TILE) - TILE / 2;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    let first = Infinity, second = Infinity, near = 0, next = 0;
    const homeX = Math.floor(x / size), homeY = Math.floor(y / size);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const id = wrap(homeY + dj) * across + wrap(homeX + di);
      const dx = wrapped(x - faceX[id]), dy = wrapped(y - faceY[id]) * 1.2;
      const d = dx * dx + dy * dy;
      if (d < first) { second = first; next = near; first = d; near = id; }
      else if (d < second) { second = d; next = id; }
    }
    const plane = signed(x - faceX[near]) * planeX[near] + signed(y - faceY[near]) * planeY[near];
    // Bands of 7 levels, not a smooth ramp: this is still pixel art, and a ramp reads as a render.
    tone[tileIndex(x, y)] = clampByte(Math.round((lean[near] + plane * 2.6) / 7) * 7);
    const pair = near < next ? near * 577 + next : next * 577 + near;
    if (Math.sqrt(second) - Math.sqrt(first) < 0.95 && hashCell(pair, 3) % 2 === 0) seam[tileIndex(x, y)] = SEAM_CRACK;
  }
  // The lip below and right of a crack faces the light, which is what makes it read as cut in.
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const here = tileIndex(x, y);
    if (!seam[here] && (seam[tileIndex(x - 1, y)] === SEAM_CRACK || seam[tileIndex(x, y - 1)] === SEAM_CRACK)) seam[here] = SEAM_LIP;
  }
  return { tone, seam };
}

export const FRACTURE_LINE = 1;
export const FRACTURE_SHADE = 2;
export const ICE_BUBBLE = 3;

// Ice fails along long clean planes, which show as white sheets seen edge on, and it traps air as
// it sets. Lines are walked straight rather than wandering, or they read as frost, which is what
// frosted stone already draws.
function buildIce() {
  const mark = new Uint8Array(SPAN);
  for (let n = 0; n < 170; n++) {
    const angle = unit(n, 0, 31) * Math.PI;
    const length = 10 + unit(n, 1, 31) * unit(n, 8, 31) * 58;
    const startX = unit(n, 2, 31) * TILE, startY = unit(n, 3, 31) * TILE;
    for (let s = 0; s < length; s += 0.5) {
      const x = Math.round(startX + Math.cos(angle) * s), y = Math.round(startY + Math.sin(angle) * s);
      mark[tileIndex(x, y)] = FRACTURE_LINE;
      const below = tileIndex(x + 1, y + 1);
      if (!mark[below]) mark[below] = FRACTURE_SHADE;
    }
  }
  for (let n = 0; n < 420; n++) {
    const x = Math.floor(unit(n, 4, 32) * TILE), y = Math.floor(unit(n, 5, 32) * TILE);
    if (!mark[tileIndex(x, y)]) mark[tileIndex(x, y)] = ICE_BUBBLE;
  }
  return mark;
}

export const GRAIN_LINE = 1;
export const GRAIN_KNOT = 2;

// Wood's grain runs upright, the way a trunk grows. It cannot run sideways: soil's beds do, and
// `renderer:probe` scores two fabrics sharing an axis as zero, because at 29 redmean colour cannot
// keep them apart. The lines bend round a knot rather than stopping at it, and that bend is most
// of what says wood. The spacing is a whole number of lines to the tile, so it wraps without a seam.
function buildWood() {
  const tone = new Int8Array(SPAN);
  const mark = new Uint8Array(SPAN);
  const period = TILE / 52;
  // One knot in reach of most planks, scattered rather than in rows, some big and some barely there.
  const knots: number[][] = [];
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
    if (unit(i, j, 33) < 0.35) continue;
    knots.push([(i + unit(i, j, 34)) * (TILE / 9), (j + unit(i, j, 35)) * (TILE / 9), 1.8 + unit(i, j, 36) * unit(i, j, 37) * 4.4]);
  }
  // A knot reaches a few cells, so each one stamps its own box rather than every cell asking each knot.
  const bend = new Float32Array(SPAN);
  const core = new Float32Array(SPAN).fill(Infinity);
  for (const [kx, ky, r] of knots) {
    const reachX = Math.ceil(r * 4), reachY = Math.ceil((r * 4) / 0.62);
    for (let dy = -reachY; dy <= reachY; dy++) for (let dx = -reachX; dx <= reachX; dx++) {
      const here = tileIndex(Math.round(kx) + dx, Math.round(ky) + dy);
      const d = Math.hypot(dx, dy * 0.62);
      bend[here] -= Math.sign(dx) * r * 1.5 * Math.exp(-(d * d) / (2 * r * r));
      core[here] = Math.min(core[here], d / r);
    }
  }
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const here = tileIndex(x, y);
    // The third term squeezes and spreads the lines, because a tree grows faster in some years.
    const u = x + bend[here] + Math.sin((TAU * 3 * y) / TILE + (TAU * 2 * x) / TILE) * 1.7 + Math.sin((TAU * 8 * y) / TILE + (TAU * 5 * x) / TILE) * 0.7
      + Math.sin((TAU * 7 * x) / TILE + 2) * 2.4;
    const phase = ((u % period) + period) % period;
    tone[here] = clampByte(Math.sin((TAU * 11 * x) / TILE + 1) * 9 + (phase > 2 && phase < 3.4 ? 6 : 0));
    if (phase < 1.05) mark[here] = GRAIN_LINE;
    if (core[here] < 0.5) mark[here] = GRAIN_KNOT;
  }
  return { tone, mark };
}

// Stones in the earth come in twos and threes, not as an even scatter.
function buildPebbles() {
  const mark = new Uint8Array(SPAN);
  for (let n = 0; n < 240; n++) {
    const x = Math.floor(unit(n, 6, 41) * TILE), y = Math.floor(unit(n, 7, 41) * TILE);
    mark[tileIndex(x, y)] = 1;
    if (n % 3 !== 0) mark[tileIndex(x + 1, y)] = 1;
    if (n % 4 === 1) mark[tileIndex(x, y + 1)] = 1;
  }
  return mark;
}

const stone = buildStone();
const wood = buildWood();
export const STONE_TONE = stone.tone;
export const STONE_SEAM = stone.seam;
export const ICE_MARK = buildIce();
export const WOOD_TONE = wood.tone;
export const WOOD_MARK = wood.mark;
export const SOIL_PEBBLE = buildPebbles();
