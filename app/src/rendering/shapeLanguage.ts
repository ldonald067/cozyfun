import { MATERIAL } from "../materials";
import { adjustRgb, mixRgb, type Rgb } from "./color";
import { cardinalNeighborCount, edgeInfo, hasNearbyKind, kindAt, sameKind, sameLiquid } from "./cells";
import { hashCell } from "./hash";

export type ShapeContext = {
  kind: number;
  color: Rgb;
  variant: number;
  age: number;
  energy: number;
  time: number;
  cells: Uint8Array;
  width: number;
  height: number;
  x: number;
  y: number;
};

const HOT_LIGHT_KINDS = [MATERIAL.Fire, MATERIAL.Lava, MATERIAL.Meteor] as const;
const COSMIC_LIGHT_KINDS = [MATERIAL.Stardust, MATERIAL.Moonwater] as const;
const COOL_LIQUID_KINDS = [MATERIAL.Water, MATERIAL.Moonwater, MATERIAL.Ice] as const;
const LIFE_KINDS = [MATERIAL.Moss, MATERIAL.Seed, MATERIAL.Fungus, MATERIAL.Soil] as const;
const MOONWATER_KINDS = [MATERIAL.Moonwater] as const;
const WATER_KINDS = [MATERIAL.Water] as const;

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
  let out = context.color;
  if (kind === MATERIAL.Wall) out = wallColor(context);
  else if (kind === MATERIAL.Sand) out = sandColor(context);
  else if (kind === MATERIAL.Soil) out = soilColor(context);
  else if (kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor) out = heatColor(context);
  else if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) out = vaporColor(context);
  else if (kind === MATERIAL.Seed) out = seedColor(context);
  else if (kind === MATERIAL.Ice) out = iceColor(context);
  else if (kind === MATERIAL.Stone) out = stoneColor(context);
  else if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater || kind === MATERIAL.Oil) out = liquidColor(context);
  else if (kind === MATERIAL.Moss || kind === MATERIAL.Fungus) out = growthColor(context);
  else if (kind === MATERIAL.Wood) out = woodColor(context);
  else if (kind === MATERIAL.Stardust) out = stardustColor(context);
  return nearbyLight(context, out);
}

function nearbyLight({ kind, cells, width, height, x, y }: ShapeContext, color: Rgb): Rgb {
  if (kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor || kind === MATERIAL.Stardust) return color;
  let out = color;
  if (hasNearbyKind(cells, width, height, x, y, HOT_LIGHT_KINDS)) {
    out = mixRgb(out, [255, 166, 82], kind === MATERIAL.Smoke || kind === MATERIAL.Steam ? 0.2 : 0.11);
  }
  if (kind !== MATERIAL.Moonwater && hasNearbyKind(cells, width, height, x, y, COSMIC_LIGHT_KINDS)) {
    out = mixRgb(out, [150, 181, 255], kind === MATERIAL.Water || kind === MATERIAL.Ice ? 0.18 : 0.1);
  }
  if (kind === MATERIAL.Stone && hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS)) {
    out = mixRgb(out, [126, 164, 183], 0.14);
  }
  return out;
}

function wallColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 2, y >> 1, variant);
  const brickOffset = ((y >> 2) & 1) * 2;
  const brickX = (x + brickOffset) & 7;
  const brickY = y & 3;
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Wall);

  let out = adjustRgb(color, (hash % 5) * 4 - 8);
  if (brickX === 0 || brickY === 0) out = mixRgb(out, [31, 36, 45], 0.58);
  if (brickX === 1 || brickY === 1) out = mixRgb(out, [216, 223, 235], 0.24);
  if (edge.top || edge.left) out = mixRgb(out, [232, 238, 247], 0.26);
  if (edge.right || edge.bottom) out = mixRgb(out, [35, 39, 48], 0.2);
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

function heatColor({ kind, color, variant, age, energy, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const pulse = (Math.sin(time * 0.018 + age * 0.19 + hash * 0.0003) + 1) * 0.5;

  if (kind === MATERIAL.Lava) {
    const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Lava);
    const cooling = hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS);
    const localX = (x + (hash & 1)) & 3;
    const localY = (y + ((hash >> 2) & 1)) & 3;
    const seam = localX === 0 || localY === 0 || ((x + y + hash) % 11 === 0 && localX !== 3);
    const crust = !seam && (hash % 5 === 0 || edge.count >= 2 || cooling);
    let out = mixRgb(color, [91, 27, 22], crust ? 0.58 : 0.24);
    if (seam && !cooling) out = mixRgb(out, [255, 205, 88], 0.58 + pulse * 0.2);
    if (seam && cooling) out = mixRgb(out, [255, 183, 101], 0.36 + pulse * 0.08);
    if (cooling) out = mixRgb(out, [39, 45, 51], 0.3);
    if (localX === 3 || localY === 3 || edge.bottom) out = mixRgb(out, [35, 20, 19], 0.34);
    if (edge.top) out = mixRgb(out, [255, 147, 54], 0.28);
    return out;
  }

  if (kind === MATERIAL.Meteor) {
    const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Meteor);
    let out = mixRgb(color, [255, 196, 91], 0.28 + pulse * 0.22);
    if (edge.top || edge.left) out = mixRgb(out, [255, 238, 168], 0.34);
    if (edge.bottom || edge.right || hash % 7 === 0) out = mixRgb(out, [65, 47, 45], 0.48);
    return out;
  }

  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Fire);
  const wetEdge = hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const flameTip = edge.top || (hash + y + Math.floor(time * 0.02)) % 13 === 0;
  let out = mixRgb(color, [255, 75, 30], edge.bottom ? 0.36 : 0.12);
  if (flameTip) out = mixRgb(out, [255, 232, 142], 0.52 + pulse * 0.18);
  if (edge.left || edge.right) out = mixRgb(out, [210, 38, 25], 0.24);
  if (wetEdge) out = mixRgb(out, [196, 231, 255], 0.26);
  if (hash % 17 === 0) out = [255, 246, 189];
  if (energy && energy > 180) out = mixRgb(out, [255, 240, 160], 0.18);
  return out;
}

function vaporColor({ kind, color, variant, age, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const sameNeighbors = cardinalNeighborCount(cells, width, height, x, y, kind);
  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 3) & 1)) & 3;
  const rim = localX === 0 || localY === 0 || localX === 3 || localY === 3;
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
  if (rim) out = mixRgb(out, [9, 14, 20], kind === MATERIAL.Steam ? 0.14 : 0.28);
  if (!rim && hash % 5 === 0) out = mixRgb(out, [226, 236, 242], kind === MATERIAL.Steam ? 0.42 : 0.24);
  if (localY === 3 || hash % 7 === 0) out = mixRgb(out, [63, 70, 78], kind === MATERIAL.Steam ? 0.1 : 0.26);
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
  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 2) & 1)) & 3;
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Ice);
  const crack = (localX === localY && hash % 5 === 0) || (localX + localY === 3 && hash % 7 === 0);
  let out = mixRgb(color, [186, 238, 250], 0.44);

  if (localX === 0 || localY === 0 || edge.top || edge.left) out = mixRgb(out, [245, 254, 255], 0.66);
  if (localX === 3 || localY === 3 || edge.right || edge.bottom) out = mixRgb(out, [42, 93, 132], 0.48);
  if (localX === 1 && localY === 1) out = mixRgb(out, [255, 255, 255], 0.52);
  if (localX === 2 && localY === 1) out = mixRgb(out, [211, 249, 255], 0.28);
  if (crack) out = mixRgb(out, [39, 96, 131], 0.58);
  if (hash % 31 === 0 && (localX === 1 || localY === 1)) out = mixRgb(out, [255, 255, 255], 0.64);
  return out;
}

function stoneColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const blockHash = hashCell(x >> 1, y >> 1, variant);
  const facet = hashCell(x >> 2, y >> 2, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Stone);
  const localX = (x + (facet & 1)) & 3;
  const localY = (y + ((facet >> 2) & 1)) & 3;
  let out = adjustRgb(color, (blockHash % 7) * 5 - 15);
  if (localX === 0 || localY === 0 || edge.top || edge.left) out = mixRgb(out, [157, 164, 174], 0.24);
  if (localX === 3 || localY === 3 || edge.right || edge.bottom) out = mixRgb(out, [35, 38, 46], 0.32);
  if ((localX === 1 && localY === 2 && facet % 3 === 0) || (x + y + blockHash) % 13 === 0) {
    out = mixRgb(out, [31, 33, 39], 0.56);
  }
  if (((x ^ y ^ blockHash) & 31) === 3) out = mixRgb(out, [194, 198, 205], 0.18);
  return out;
}

function liquidColor({ kind, color, variant, time, cells, width, height, x, y }: ShapeContext) {
  const top = !sameLiquid(cells, width, height, x, y - 1, kind);
  const left = sameLiquid(cells, width, height, x - 1, y, kind);
  const right = sameLiquid(cells, width, height, x + 1, y, kind);
  const bottom = sameLiquid(cells, width, height, x, y + 1, kind);
  const hash = hashCell(x, y, variant);
  const ripple = (x + y * 2 + Math.floor(time * 0.012) + hash) % 17 === 0;
  let out = color;

  if (kind === MATERIAL.Oil) {
    if (top) out = mixRgb(out, [88, 105, 80], 0.22);
    if (!bottom) out = mixRgb(out, [8, 12, 10], 0.38);
    if ((left || right) && hash % 13 === 0) out = mixRgb(out, [117, 127, 95], 0.28);
    return out;
  }

  if (left || right) out = mixRgb(out, [99, 167, 220], kind === MATERIAL.Moonwater ? 0.24 : 0.16);
  if (top) out = mixRgb(out, kind === MATERIAL.Moonwater ? [229, 252, 255] : [151, 212, 246], 0.42);
  if (!bottom) out = mixRgb(out, [24, 58, 106], kind === MATERIAL.Moonwater ? 0.1 : 0.2);
  if (!left || !right) out = mixRgb(out, [20, 56, 96], kind === MATERIAL.Moonwater ? 0.08 : 0.12);
  if ((left || right) && (ripple || hash % 29 === 0)) out = adjustRgb(out, 24 + Math.sin(time * 0.005 + variant) * 10);
  if (kind === MATERIAL.Moonwater) {
    const moonPulse = (Math.sin(time * 0.006 + hash * 0.0004) + 1) * 0.5;
    const crescent = (top && (x + hash) % 5 <= 1) || (!left && y % 3 === 0) || (!right && y % 4 === 0);
    const lifeContact = hasNearbyKind(cells, width, height, x, y, LIFE_KINDS);
    const heatContact = hasNearbyKind(cells, width, height, x, y, HOT_LIGHT_KINDS);
    if (crescent) out = mixRgb(out, [246, 239, 255], 0.46 + moonPulse * 0.18);
    if (hash % 19 === 0) out = mixRgb(out, [224, 199, 255], 0.5);
    if (lifeContact) out = mixRgb(out, [180, 255, 207], 0.24);
    if (heatContact) out = mixRgb(out, [241, 252, 255], 0.34);
  } else if (hasNearbyKind(cells, width, height, x, y, HOT_LIGHT_KINDS)) {
    out = mixRgb(out, [198, 236, 255], 0.22);
  }
  return out;
}

function growthColor({ kind, color, variant, age, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, kind);
  const moonFed = hasNearbyKind(cells, width, height, x, y, MOONWATER_KINDS);
  const damp = moonFed || hasNearbyKind(cells, width, height, x, y, WATER_KINDS);
  let out = color;

  if (kind === MATERIAL.Moss) {
    if (edge.top || edge.left) out = mixRgb(out, [129, 202, 111], 0.32);
    if (edge.bottom || hash % 9 === 0) out = mixRgb(out, [30, 77, 40], 0.34);
    if (hash % 7 === 0 || age > 90) out = mixRgb(out, [182, 223, 126], 0.24);
    if (moonFed) out = mixRgb(out, [143, 238, 177], 0.22);
    return out;
  }

  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 3) & 1)) & 3;
  const cap = edge.top || localY === 0 || (hash % 6 === 0 && localY < 3);
  const gill = localY === 1 && (localX === 1 || localX === 2);
  const spore = hash % 13 === 0 || (age > 80 && hash % 9 === 0);
  if (cap) out = mixRgb(out, [230, 164, 224], 0.48);
  if (gill) out = mixRgb(out, [254, 218, 244], 0.4);
  if (edge.bottom || localY === 3 || hash % 11 === 0) out = mixRgb(out, [83, 45, 104], 0.42);
  if (spore) out = mixRgb(out, [250, 229, 239], 0.58);
  if (damp) out = mixRgb(out, moonFed ? [195, 190, 255] : [168, 216, 190], moonFed ? 0.28 : 0.16);
  return out;
}

function woodColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 1, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Wood);
  let out = adjustRgb(color, (hash % 5) * 4 - 8);
  if ((x + hash) % 5 === 0) out = mixRgb(out, [55, 31, 20], 0.35);
  if ((x + y + hash) % 13 === 0) out = mixRgb(out, [156, 104, 61], 0.25);
  if (edge.top || edge.left) out = mixRgb(out, [175, 119, 71], 0.2);
  if (edge.right || edge.bottom) out = mixRgb(out, [55, 31, 20], 0.2);
  return out;
}

function stardustColor({ color, variant, age, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const twinkle = (Math.sin(time * 0.02 + age * 0.2 + hash * 0.0002) + 1) * 0.5;
  let out = mixRgb(color, hash % 3 === 0 ? [255, 233, 159] : [174, 227, 255], 0.32 + twinkle * 0.28);
  if (hash % 9 === 0) out = [255, 246, 197];
  return adjustRgb(out, twinkle * 22);
}
