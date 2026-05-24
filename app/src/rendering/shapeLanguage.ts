import { MATERIAL } from "../materials";
import { adjustRgb, mixRgb, type Rgb } from "./color";
import { cardinalNeighborCount, kindAt, sameKind, sameLiquid } from "./cells";
import { hashCell } from "./hash";

export type ShapeContext = {
  kind: number;
  color: Rgb;
  variant: number;
  age: number;
  time: number;
  cells: Uint8Array;
  width: number;
  height: number;
  x: number;
  y: number;
};

export function emptyCellColor(cells: Uint8Array, width: number, height: number, x: number, y: number, time: number): Rgb {
  const background: Rgb = [9, 14, 20];
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ];
  for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i];
    if (kindAt(cells, width, height, x + dx, y + dy) !== MATERIAL.Stardust) continue;
    const hash = hashCell(x, y, i);
    if ((hash & 3) === 0) {
      const twinkle = (Math.sin(time * 0.018 + hash * 0.0001) + 1) * 0.5;
      return mixRgb(background, [154, 128, 255], 0.28 + twinkle * 0.16);
    }
  }
  return background;
}

export function applyShapeLanguage(context: ShapeContext): Rgb {
  const { kind } = context;
  if (kind === MATERIAL.Wall) return wallColor(context);
  if (kind === MATERIAL.Sand) return sandColor(context);
  if (kind === MATERIAL.Soil) return soilColor(context);
  if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) return vaporColor(context);
  if (kind === MATERIAL.Seed) return seedColor(context);
  if (kind === MATERIAL.Ice) return iceColor(context);
  if (kind === MATERIAL.Stone) return stoneColor(context);
  if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) return liquidColor(context);
  if (kind === MATERIAL.Stardust) return stardustColor(context);
  return context.color;
}

function wallColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 2, y >> 1, variant);
  const brickOffset = ((y >> 2) & 1) * 2;
  const brickX = (x + brickOffset) & 7;
  const brickY = y & 3;
  const exposed =
    !sameKind(cells, width, height, x, y - 1, MATERIAL.Wall) ||
    !sameKind(cells, width, height, x - 1, y, MATERIAL.Wall) ||
    !sameKind(cells, width, height, x + 1, y, MATERIAL.Wall) ||
    !sameKind(cells, width, height, x, y + 1, MATERIAL.Wall);

  let out = adjustRgb(color, (hash % 5) * 4 - 8);
  if (brickX === 0 || brickY === 0) out = mixRgb(out, [36, 42, 52], 0.48);
  if (brickX === 1 || brickY === 1) out = mixRgb(out, [208, 216, 228], 0.22);
  if (exposed) out = mixRgb(out, [226, 231, 240], 0.24);
  if ((hash + x + y) % 23 === 0) out = mixRgb(out, [76, 82, 94], 0.32);
  return out;
}

function sandColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  let out = adjustRgb(color, (hash % 5) * 3 - 6);
  if (hash % 11 === 0) out = adjustRgb(out, -24);
  if (hash % 13 === 0) out = mixRgb(out, [239, 213, 139], 0.28);
  if (!sameKind(cells, width, height, x, y - 1, MATERIAL.Sand)) out = adjustRgb(out, 7);
  return out;
}

function soilColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const surface = !sameKind(cells, width, height, x, y - 1, MATERIAL.Soil);
  const edge = cardinalNeighborCount(cells, width, height, x, y, MATERIAL.Soil) < 3;
  let out = adjustRgb(color, (hash % 7) * 4 - 14);

  if (surface) out = mixRgb(out, [131, 92, 61], 0.28);
  if (edge) out = mixRgb(out, [53, 34, 25], 0.22);
  if (hash % 11 === 0) out = mixRgb(out, [41, 27, 21], 0.45);
  if (hash % 19 === 0 || (kindAt(cells, width, height, x, y - 1) === MATERIAL.Moss && hash % 5 === 0)) {
    out = mixRgb(out, [89, 126, 70], 0.35);
  }
  return out;
}

function vaporColor({ kind, color, variant, age, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const sameNeighbors = cardinalNeighborCount(cells, width, height, x, y, kind);
  const edge = sameNeighbors < 3;
  const fade = Math.max(0, 1 - age / (kind === MATERIAL.Steam ? 155 : 210));
  const warm =
    kindAt(cells, width, height, x - 1, y) === MATERIAL.Fire ||
    kindAt(cells, width, height, x + 1, y) === MATERIAL.Fire ||
    kindAt(cells, width, height, x, y + 1) === MATERIAL.Fire ||
    kindAt(cells, width, height, x - 1, y) === MATERIAL.Lava ||
    kindAt(cells, width, height, x + 1, y) === MATERIAL.Lava ||
    kindAt(cells, width, height, x, y + 1) === MATERIAL.Lava;

  let out = edge ? mixRgb(color, [9, 14, 20], kind === MATERIAL.Steam ? 0.28 : 0.42) : adjustRgb(color, 12);
  if (hash % 5 === 0) out = mixRgb(out, [226, 236, 242], kind === MATERIAL.Steam ? 0.36 : 0.22);
  if (hash % 7 === 0) out = mixRgb(out, [63, 70, 78], kind === MATERIAL.Steam ? 0.12 : 0.24);
  if (warm) out = mixRgb(out, [255, 183, 116], kind === MATERIAL.Steam ? 0.18 : 0.12);
  return mixRgb([9, 14, 20], out, 0.52 + fade * 0.42);
}

function seedColor({ color, variant, age, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const neighbors = cardinalNeighborCount(cells, width, height, x, y, MATERIAL.Seed);
  const edge = neighbors < 3;
  let out = edge ? mixRgb(color, [48, 25, 17], 0.62) : mixRgb(color, [116, 66, 34], 0.44);
  if (hash % 7 === 0) out = mixRgb(out, [224, 163, 89], 0.28);
  if (hash % 3 === 0 || (age > 24 && hash % 4 === 0)) out = mixRgb(out, [95, 181, 82], 0.78);

  const below = kindAt(cells, width, height, x, y + 1);
  if (below === MATERIAL.Soil || below === MATERIAL.Moss || below === MATERIAL.Moonwater) out = mixRgb(out, [116, 202, 94], 0.32);
  return out;
}

function iceColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 2, y >> 2, variant);
  const localX = x & 3;
  const localY = y & 3;
  const top = !sameKind(cells, width, height, x, y - 1, MATERIAL.Ice);
  const left = !sameKind(cells, width, height, x - 1, y, MATERIAL.Ice);
  const right = !sameKind(cells, width, height, x + 1, y, MATERIAL.Ice);
  const bottom = !sameKind(cells, width, height, x, y + 1, MATERIAL.Ice);
  let out = mixRgb(color, [179, 235, 250], 0.38);

  if (localX === 0 || localY === 0) out = mixRgb(out, [240, 253, 255], 0.72);
  if (localX === 3 || localY === 3) out = mixRgb(out, [44, 94, 133], 0.5);
  if (top || left) out = adjustRgb(out, 28);
  if (right || bottom) out = mixRgb(out, [40, 83, 122], 0.46);
  if (localX === 1 && localY === 1) out = mixRgb(out, [255, 255, 255], 0.46);
  if ((localX === 2 && localY === 2) || hash % 19 === 0) out = mixRgb(out, [55, 120, 154], 0.32);
  if (hash % 31 === 0 && (localX === 1 || localY === 1)) out = mixRgb(out, [255, 255, 255], 0.58);
  return out;
}

function stoneColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const blockHash = hashCell(x >> 1, y >> 1, variant);
  const facet = hashCell(x >> 2, y >> 2, variant);
  const edge =
    !sameKind(cells, width, height, x, y - 1, MATERIAL.Stone) ||
    !sameKind(cells, width, height, x + 1, y, MATERIAL.Stone) ||
    !sameKind(cells, width, height, x, y + 1, MATERIAL.Stone) ||
    !sameKind(cells, width, height, x - 1, y, MATERIAL.Stone);
  let out = adjustRgb(color, (blockHash % 7) * 5 - 15);
  if (((x + facet) & 3) === 0) out = mixRgb(out, [157, 164, 174], 0.18);
  if (((y + facet) & 3) === 3) out = mixRgb(out, [41, 45, 54], 0.22);
  if (edge) out = mixRgb(out, [36, 39, 47], 0.4);
  if ((x + y + blockHash) % 13 === 0 || ((x ^ y ^ blockHash) & 31) === 3) out = mixRgb(out, [38, 40, 46], 0.5);
  return out;
}

function liquidColor({ kind, color, variant, time, cells, width, height, x, y }: ShapeContext) {
  const top = !sameLiquid(cells, width, height, x, y - 1, kind);
  const left = sameLiquid(cells, width, height, x - 1, y, kind);
  const right = sameLiquid(cells, width, height, x + 1, y, kind);
  const bottom = sameLiquid(cells, width, height, x, y + 1, kind);
  const hash = hashCell(x, y, variant);
  let out = color;
  if (left || right) out = mixRgb(out, [99, 167, 220], kind === MATERIAL.Moonwater ? 0.2 : 0.14);
  if (top) out = mixRgb(out, kind === MATERIAL.Moonwater ? [220, 249, 255] : [143, 204, 240], 0.34);
  if (!bottom) out = mixRgb(out, [30, 72, 116], 0.18);
  if ((left || right) && hash % 17 === 0) out = adjustRgb(out, 28 + Math.sin(time * 0.005 + variant) * 10);
  return out;
}

function stardustColor({ color, variant, age, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const twinkle = (Math.sin(time * 0.02 + age * 0.2 + hash * 0.0002) + 1) * 0.5;
  let out = mixRgb(color, hash % 3 === 0 ? [255, 233, 159] : [174, 227, 255], 0.32 + twinkle * 0.28);
  if (hash % 9 === 0) out = [255, 246, 197];
  return adjustRgb(out, twinkle * 22);
}
