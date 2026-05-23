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
  if (kind === MATERIAL.Sand) return sandColor(context);
  if (kind === MATERIAL.Seed) return seedColor(context);
  if (kind === MATERIAL.Ice) return iceColor(context);
  if (kind === MATERIAL.Stone) return stoneColor(context);
  if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) return liquidColor(context);
  if (kind === MATERIAL.Stardust) return stardustColor(context);
  return context.color;
}

function sandColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  let out = adjustRgb(color, (hash % 5) * 3 - 6);
  if (hash % 11 === 0) out = adjustRgb(out, -24);
  if (hash % 13 === 0) out = mixRgb(out, [239, 213, 139], 0.28);
  if (!sameKind(cells, width, height, x, y - 1, MATERIAL.Sand)) out = adjustRgb(out, 7);
  return out;
}

function seedColor({ color, variant, age, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const neighbors = cardinalNeighborCount(cells, width, height, x, y, MATERIAL.Seed);
  const edge = neighbors < 3;
  let out = edge ? mixRgb(color, [76, 43, 25], 0.54) : mixRgb(color, [151, 92, 46], 0.34);
  if (hash % 7 === 0) out = mixRgb(out, [220, 154, 82], 0.35);
  if (hash % 5 === 0 || (age > 24 && hash % 4 === 0)) out = mixRgb(out, [93, 157, 76], 0.7);

  const below = kindAt(cells, width, height, x, y + 1);
  if (below === MATERIAL.Soil || below === MATERIAL.Moss || below === MATERIAL.Moonwater) out = mixRgb(out, [101, 172, 83], 0.22);
  return out;
}

function iceColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const localX = (x + variant) & 3;
  const localY = (y + (variant >> 1)) & 3;
  const top = !sameKind(cells, width, height, x, y - 1, MATERIAL.Ice);
  const left = !sameKind(cells, width, height, x - 1, y, MATERIAL.Ice);
  const right = !sameKind(cells, width, height, x + 1, y, MATERIAL.Ice);
  const bottom = !sameKind(cells, width, height, x, y + 1, MATERIAL.Ice);
  let out = mixRgb(color, [181, 238, 250], 0.28);

  if (localX === 0 || localY === 0) out = mixRgb(out, [236, 253, 255], 0.58);
  if (localX === 3 || localY === 3) out = mixRgb(out, [58, 119, 156], 0.38);
  if (top || left) out = adjustRgb(out, 26);
  if (right || bottom) out = mixRgb(out, [49, 96, 134], 0.42);
  if ((localX === 1 && localY === 2) || (hash % 17 === 0 && localX !== 0)) out = mixRgb(out, [39, 105, 145], 0.55);
  if (hash % 29 === 0 || (top && localX === 1)) out = mixRgb(out, [255, 255, 255], 0.62);
  return out;
}

function stoneColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const blockHash = hashCell(x >> 1, y >> 1, variant);
  const edge =
    !sameKind(cells, width, height, x, y - 1, MATERIAL.Stone) ||
    !sameKind(cells, width, height, x + 1, y, MATERIAL.Stone) ||
    !sameKind(cells, width, height, x, y + 1, MATERIAL.Stone) ||
    !sameKind(cells, width, height, x - 1, y, MATERIAL.Stone);
  let out = adjustRgb(color, (blockHash % 7) * 5 - 15);
  if (edge) out = mixRgb(out, [50, 53, 60], 0.32);
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
