import { CELL_FLAG, MATERIAL } from "../materials";
import { adjustRgb, mixRgb, type Rgb } from "./color";
import { cardinalNeighborCount, contactInfo, edgeInfo, hasNearbyKind, kindAt, readU16, sameKind, sameLiquid } from "./cells";
import { hashCell } from "./hash";

export type ShapeContext = {
  kind: number;
  color: Rgb;
  variant: number;
  age: number;
  energy: number;
  flags: number;
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
const LIFE_KINDS = [MATERIAL.Moss, MATERIAL.Seed, MATERIAL.Fungus, MATERIAL.Flower, MATERIAL.Soil] as const;
const PLANT_KINDS = [MATERIAL.Moss, MATERIAL.Seed, MATERIAL.Fungus, MATERIAL.Flower] as const;
const MOONWATER_KINDS = [MATERIAL.Moonwater] as const;
const STARDUST_KINDS = [MATERIAL.Stardust] as const;
const WATER_KINDS = [MATERIAL.Water] as const;
const OIL_KINDS = [MATERIAL.Oil] as const;
const EMBER_KINDS = [MATERIAL.Ember] as const;
const STEAM_KINDS = [MATERIAL.Steam] as const;
const EARTH_CONTACT_KINDS = [MATERIAL.Sand, MATERIAL.Soil, MATERIAL.Stone, MATERIAL.Wall, MATERIAL.Wood] as const;

export function emptyCellColor(cells: Uint8Array, width: number, height: number, x: number, y: number, time: number): Rgb {
  const background: Rgb = [9, 14, 20];
  if (kindAt(cells, width, height, x, y + 1) === MATERIAL.Ember) {
    const emberEnergy = readU16(cells, ((y + 1) * width + x) * 8 + 4);
    if (emberEnergy > 90) {
      const hash = hashCell(x, y, 3);
      const spark = Math.sin(time * 0.03 + hash * 1.7 + x * 0.9);
      if (spark > 0.92 && (hash & 3) === 0) {
        return mixRgb(background, [255, 196, 90], 0.62);
      }
    }
  }
  if (kindAt(cells, width, height, x, y + 1) === MATERIAL.Meteor) {
    const flicker = (Math.sin(time * 0.02 + x * 1.3) + 1) * 0.5;
    return mixRgb(background, [255, 170, 80], 0.2 + flicker * 0.14);
  }
  if (kindAt(cells, width, height, x, y + 2) === MATERIAL.Meteor) {
    return mixRgb(background, [255, 150, 70], 0.1);
  }
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
      return mixRgb(background, [255, 214, 138], 0.24 + twinkle * 0.16);
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
  else if (kind === MATERIAL.Fire) out = fireColor(context);
  else if (kind === MATERIAL.Lava) out = lavaColor(context);
  else if (kind === MATERIAL.Meteor) out = meteorColor(context);
  else if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) out = vaporColor(context);
  else if (kind === MATERIAL.Seed) out = seedColor(context);
  else if (kind === MATERIAL.Flower) out = flowerColor(context);
  else if (kind === MATERIAL.Ice) out = iceColor(context);
  else if (kind === MATERIAL.Glass) out = glassColor(context);
  else if (kind === MATERIAL.Ember) out = emberColor(context);
  else if (kind === MATERIAL.Stone) out = stoneColor(context);
  else if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater || kind === MATERIAL.Oil) out = liquidColor(context);
  else if (kind === MATERIAL.Moss || kind === MATERIAL.Fungus) out = growthColor(context);
  else if (kind === MATERIAL.Wood) out = woodColor(context);
  else if (kind === MATERIAL.Stardust) out = stardustColor(context);
  else if (kind === MATERIAL.Pollen) out = pollenColor(context);
  return nearbyLight(context, out);
}

// Branching frost veins for frozen solids, so deep cold reads as growth instead of a flat tint.
function frostFerns(out: Rgb, hash: number, x: number, y: number): Rgb {
  const branch = (x * 3 + y * 5 + (hash & 7)) % 11 === 0 || ((x ^ y) + (hash >> 3)) % 13 === 0;
  const vein = ((x + y * 2 + hash) & 7) === 0;
  if (branch) return mixRgb(out, [228, 249, 255], 0.5);
  if (vein) return mixRgb(out, [178, 224, 242], 0.35);
  return out;
}

function nearbyLight({ kind, cells, width, height, x, y }: ShapeContext, color: Rgb): Rgb {
  if (kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor || kind === MATERIAL.Stardust) return color;
  let out = color;
  if (hasNearbyKind(cells, width, height, x, y, HOT_LIGHT_KINDS)) {
    out = mixRgb(out, [255, 166, 82], kind === MATERIAL.Smoke || kind === MATERIAL.Steam ? 0.2 : 0.11);
  }
  if (kind !== MATERIAL.Moonwater && hasNearbyKind(cells, width, height, x, y, COSMIC_LIGHT_KINDS)) {
    const amount = kind === MATERIAL.Water || kind === MATERIAL.Ice ? 0.18 : kind === MATERIAL.Smoke || kind === MATERIAL.Steam ? 0.16 : 0.1;
    out = mixRgb(out, [150, 181, 255], amount);
  }
  if (kind === MATERIAL.Stone && hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS)) {
    out = mixRgb(out, [126, 164, 183], 0.14);
  }
  return out;
}

function wallColor({ color, variant, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 2, y >> 1, variant);
  const brickOffset = ((y >> 2) & 1) * 2;
  const brickX = (x + brickOffset) & 7;
  const brickY = y & 3;
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Wall);
  const heatContact = contactInfo(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const dampContact = contactInfo(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const plantContact = contactInfo(cells, width, height, x, y, PLANT_KINDS);
  const moonContact = contactInfo(cells, width, height, x, y, MOONWATER_KINDS);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
  const chipped = edge.count > 0 && ((hash + x * 3 + y * 5) % 37 === 0 || (brickX === 6 && brickY === 2));

  let out = adjustRgb(color, (hash % 5) * 3 - 6);
  if (brickX === 0 || brickY === 0) out = mixRgb(out, [24, 30, 39], 0.68);
  if (brickX === 1 || brickY === 1) out = mixRgb(out, [225, 232, 241], 0.22);
  if (brickX === 4 && brickY === 2 && hash % 3 === 0) out = mixRgb(out, [132, 142, 156], 0.22);
  if (edge.top || edge.left) out = mixRgb(out, [236, 241, 248], 0.3);
  if (edge.right || edge.bottom) out = mixRgb(out, [28, 32, 41], 0.24);
  if (chipped) out = mixRgb(out, [20, 24, 31], 0.48);
  if (dampContact.count > 0 || flags & CELL_FLAG.Wet || energy > 30) {
    out = mixRgb(out, [83, 105, 114], dampContact.bottom ? 0.34 : 0.26);
    if (brickX === 0 || brickY === 0 || dampContact.top) out = mixRgb(out, [129, 164, 173], 0.18);
    if ((brickX === 1 || brickY === 3) && hash % 4 === 0) out = mixRgb(out, [154, 184, 188], 0.18);
  }
  if (plantContact.count > 0 && (brickY === 3 || plantContact.bottom)) {
    out = mixRgb(out, [70, 112, 70], 0.28);
    if (hash % 11 === 0) out = mixRgb(out, [116, 151, 91], 0.36);
  }
  if (heatContact.count > 0) {
    out = mixRgb(out, heatContact.bottom ? [46, 37, 34] : [90, 58, 47], heatContact.bottom ? 0.4 : 0.28);
    if (brickY === 0 && hash % 3 === 0) out = mixRgb(out, [171, 89, 57], 0.26);
  }
  if (scorched) {
    out = mixRgb(out, [38, 31, 29], 0.46);
    if ((brickX === 0 || brickY === 0) && hash % 3 === 0) out = mixRgb(out, [16, 15, 16], 0.42);
    if (brickY === 3 && hash % 5 === 0) out = mixRgb(out, [82, 52, 38], 0.22);
  }
  if (frozen) {
    out = mixRgb(out, [172, 215, 228], edge.top ? 0.52 : 0.36);
    if (brickY === 0 || (brickX === 1 && hash % 2 === 0)) out = mixRgb(out, [235, 252, 255], 0.3);
    if (brickY === 3 && hash % 4 === 0) out = mixRgb(out, [122, 190, 211], 0.18);
    out = frostFerns(out, hash, x, y);
  }
  if (energy > 130) {
    if ((hash + brickX * 5 + brickY * 3) % 6 === 0) out = mixRgb(out, [15, 18, 24], 0.5);
    if ((brickX === 2 || brickY === 2) && hash % 7 === 0) out = mixRgb(out, [11, 13, 18], 0.42);
  }
  if (cosmic) {
    out = mixRgb(out, [119, 139, 211], 0.24);
    if (hash % 17 === 0) out = mixRgb(out, [199, 188, 255], 0.44);
    if (brickX === 1 && hash % 13 === 0) out = mixRgb(out, [236, 222, 255], 0.34);
  }
  if (moonContact.count > 0) {
    out = mixRgb(out, [93, 125, 184], 0.18);
    if ((brickX === 0 || brickY === 0 || moonContact.top) && hash % 5 === 0) out = mixRgb(out, [184, 196, 255], 0.34);
  }
  if ((hash + x + y) % 23 === 0) out = mixRgb(out, [70, 78, 91], 0.26);
  return out;
}

function sandColor({ color, variant, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 3) & 1)) & 3;
  const surface = !sameKind(cells, width, height, x, y - 1, MATERIAL.Sand);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Sand);
  const damp = Boolean(flags & CELL_FLAG.Wet) || energy > 35 || hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const warm = hasNearbyKind(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
  let out = adjustRgb(color, (hash % 5) * 3 - 6);
  if (surface || edge.left || edge.right) out = mixRgb(out, [238, 208, 124], 0.24);
  if (localY === 3 || hash % 11 === 0) out = mixRgb(out, [115, 82, 43], 0.24);
  if (localX === 0 && hash % 3 === 0) out = mixRgb(out, [250, 229, 151], 0.28);
  if (hash % 17 === 0) out = mixRgb(out, [84, 62, 38], 0.32);
  if (damp) {
    out = mixRgb(out, [111, 91, 69], 0.32);
    if ((localX === 2 || edge.bottom) && hash % 3 !== 0) out = mixRgb(out, [77, 65, 52], 0.24);
    if (surface || edge.top) out = mixRgb(out, [94, 113, 110], 0.16);
  }
  if (warm) out = mixRgb(out, [225, 137, 75], 0.18);
  if (scorched) {
    out = mixRgb(out, [91, 63, 45], 0.36);
    if (surface || hash % 5 === 0) out = mixRgb(out, [42, 30, 23], 0.28);
  }
  if (frozen) {
    out = mixRgb(out, [194, 225, 229], surface ? 0.48 : 0.32);
    if (surface || localY === 0) out = mixRgb(out, [239, 252, 255], 0.22);
    out = frostFerns(out, hash, x, y);
  }
  if (cosmic) {
    out = mixRgb(out, [142, 154, 215], 0.18);
    if (hash % 23 === 0) out = mixRgb(out, [219, 209, 255], 0.32);
  }
  return out;
}

function soilColor({ color, variant, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const surface = !sameKind(cells, width, height, x, y - 1, MATERIAL.Soil);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Soil);
  const looseEdge = edge.count > 0 || cardinalNeighborCount(cells, width, height, x, y, MATERIAL.Soil) < 3;
  const rootContact = contactInfo(cells, width, height, x, y, PLANT_KINDS);
  const waterContact = contactInfo(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const wet = energy > 40 || Boolean(flags & CELL_FLAG.Wet) || waterContact.count > 0;
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const localX = (x + hash) & 3;
  const localY = (y + (hash >> 2)) & 3;
  let out = adjustRgb(color, (hash % 7) * 4 - 14);

  if (surface) out = mixRgb(out, [141, 96, 61], 0.32);
  if (looseEdge || hash % 11 === 0) out = mixRgb(out, [43, 27, 21], 0.34);
  if ((localX === 1 && hash % 5 === 0) || rootContact.count > 0) out = mixRgb(out, [83, 61, 39], rootContact.count > 0 ? 0.24 : 0.16);
  if (localY === 2 && rootContact.count > 0) out = mixRgb(out, [39, 30, 23], 0.24);
  if (wet) {
    out = mixRgb(out, [48, 43, 38], waterContact.top ? 0.32 : 0.24);
    if (surface || waterContact.top) out = mixRgb(out, [73, 87, 74], 0.22);
  }
  if (hash % 19 === 0 || (kindAt(cells, width, height, x, y - 1) === MATERIAL.Moss && hash % 5 === 0)) {
    out = mixRgb(out, [89, 126, 70], wet ? 0.44 : 0.32);
  }
  if (cosmic) {
    out = mixRgb(out, [132, 151, 215], 0.24);
    if (hash % 17 === 0) out = mixRgb(out, [213, 203, 255], 0.34);
  }
  if (scorched) {
    out = mixRgb(out, [34, 25, 22], 0.46);
    if (looseEdge || hash % 7 === 0) out = mixRgb(out, [17, 16, 15], 0.28);
  }
  if (frozen) {
    out = mixRgb(out, [172, 214, 230], surface ? 0.52 : 0.38);
    if (surface || localY === 0) out = mixRgb(out, [233, 252, 255], 0.22);
    out = frostFerns(out, hash, x, y);
  }
  return out;
}

function pollenColor({ color, variant, age, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const bob = (Math.sin(time * 0.01 + hash * 1.3 + x) + 1) * 0.5;
  let out = mixRgb(color, [255, 246, 214], 0.3 + bob * 0.25);
  if ((hash & 7) === 2) out = mixRgb(out, [232, 194, 106], 0.4);
  const fade = Math.max(0, 1 - age / 150);
  return mixRgb([9, 14, 20], out, 0.55 + fade * 0.45);
}

function fireColor({ color, variant, age, energy, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Fire);
  const wetContact = contactInfo(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const flicker = Math.sin(time * 0.024 + hash * 1.1 + y * 0.8);
  const tongue = (x + (hash & 3) + Math.floor(time * 0.02)) % 3;
  let out = mixRgb(color, [255, 240, 168], 0.2 + Math.max(0, flicker) * 0.2);
  if (age < 12 || energy > 200) out = mixRgb(out, [255, 250, 214], 0.45);
  if (edge.top) out = tongue === 0 ? mixRgb(out, [9, 14, 20], 0.6) : mixRgb(out, [255, 238, 150], 0.5);
  if ((edge.left || edge.right) && tongue === 2) out = mixRgb(out, [9, 14, 20], 0.3);
  if (edge.bottom) out = mixRgb(out, [255, 118, 36], 0.4);
  if (wetContact.count > 0) out = mixRgb(out, [196, 231, 255], wetContact.top ? 0.34 : 0.26);
  if (hash % 17 === 0) out = [255, 248, 205];
  return out;
}

function lavaColor({ color, variant, energy, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 1, y >> 1, variant);
  const fine = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Lava);
  const cooling = hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const pulse = (Math.sin(time * 0.004 + hash * 0.7) + 1) * 0.5;
  const crusted = edge.top || cooling || (fine % 6 === 0 && edge.count > 0);
  const seam = ((x + (hash & 3)) & 3) === 0 || ((x ^ y) + fine) % 9 === 0;
  let out = mixRgb(color, [40, 13, 11], 0.4);
  out = mixRgb(out, [255, 96, 26], (0.1 + pulse * 0.14) * (energy > 0 ? energy / 255 : 1));
  if (crusted) {
    out = mixRgb(out, [24, 16, 18], cooling ? 0.72 : 0.58);
    if (seam && !cooling) out = mixRgb(out, [255, 158, 54], 0.7 + pulse * 0.15);
    if (seam && cooling) out = mixRgb(out, [214, 120, 70], 0.4);
  } else if (seam) {
    out = mixRgb(out, [255, 190, 80], 0.42 + pulse * 0.2);
  }
  if (edge.bottom || edge.left || edge.right) out = mixRgb(out, [30, 12, 12], 0.35);
  return out;
}

function meteorColor({ color, variant, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Meteor);
  const falling = kindAt(cells, width, height, x, y + 1) === MATERIAL.Empty;
  let out = mixRgb(color, [255, 214, 120], 0.35);
  if (falling) {
    out = mixRgb(out, [255, 246, 200], 0.5);
    if (edge.top) out = mixRgb(out, [255, 150, 60], 0.35);
  } else {
    if (edge.bottom || edge.right || hash % 7 === 0) out = mixRgb(out, [45, 38, 43], 0.58);
    if (edge.top || edge.left) out = mixRgb(out, [255, 238, 158], 0.4);
  }
  if (hash % 11 === 0) out = mixRgb(out, [255, 229, 124], 0.36 + (Math.sin(time * 0.02 + x) + 1) * 0.1);
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
  const hotContact = contactInfo(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const cosmicContact = contactInfo(cells, width, height, x, y, COSMIC_LIGHT_KINDS);
  const warm = hotContact.count > 0;
  const cosmic = cosmicContact.count > 0;

  const steam = kind === MATERIAL.Steam;
  let out = steam ? mixRgb(color, [219, 226, 231], 0.34) : mixRgb(color, [86, 88, 92], 0.34);
  if (edge) out = mixRgb(out, [9, 14, 20], steam ? 0.22 : 0.44);
  else out = adjustRgb(out, steam ? 16 : 4);
  if (rim) out = mixRgb(out, [9, 14, 20], steam ? 0.1 : 0.32);
  if (!rim && hash % 5 === 0) out = mixRgb(out, steam ? [239, 250, 253] : [169, 173, 174], steam ? 0.5 : 0.28);
  if (localY === 3 || hash % 7 === 0) out = mixRgb(out, steam ? [126, 167, 184] : [54, 53, 50], steam ? 0.16 : 0.34);
  if (!steam && hash % 11 === 0) out = mixRgb(out, [42, 38, 35], 0.28);
  if (warm) out = mixRgb(out, [255, 183, 116], steam ? (hotContact.bottom ? 0.24 : 0.18) : 0.1);
  if (cosmic) out = mixRgb(out, [178, 186, 255], steam ? (cosmicContact.bottom ? 0.28 : 0.22) : 0.12);
  return mixRgb([9, 14, 20], out, steam ? 0.58 + fade * 0.38 : 0.44 + fade * 0.34);
}

function seedColor({ color, variant, age, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const neighbors = cardinalNeighborCount(cells, width, height, x, y, MATERIAL.Seed);
  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 2) & 1)) & 3;
  const edge = neighbors < 3;
  const below = kindAt(cells, width, height, x, y + 1);
  const soilContact = contactInfo(cells, width, height, x, y, [MATERIAL.Soil, MATERIAL.Moss]);
  const moonContact = contactInfo(cells, width, height, x, y, MOONWATER_KINDS);
  const oilContact = contactInfo(cells, width, height, x, y, OIL_KINDS);
  const wet = energy > 70 || Boolean(flags & CELL_FLAG.Wet);
  const rooted = Boolean(flags & CELL_FLAG.Rooted) || below === MATERIAL.Soil || soilContact.count > 0;
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic) || moonContact.count > 0;
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const fed = wet || rooted || cosmic;
  let out = edge ? mixRgb(color, [47, 25, 17], 0.64) : mixRgb(color, [119, 68, 34], 0.46);
  if (localX === 1 && localY <= 2) out = mixRgb(out, [222, 154, 82], 0.26);
  if (localY === 3 || hash % 7 === 0) out = mixRgb(out, [51, 27, 16], 0.3);
  if (wet) out = mixRgb(out, [168, 117, 58], 0.34);
  if (fed || hash % 3 === 0 || (age > 24 && hash % 4 === 0)) out = mixRgb(out, [95, 181, 82], rooted ? 0.82 : 0.56);
  if (below === MATERIAL.Soil && localY === 3) out = mixRgb(out, [39, 27, 18], 0.24);
  if (rooted && (localY === 3 || soilContact.bottom)) out = mixRgb(out, [35, 73, 32], 0.46);
  if (rooted && localY === 0 && hash % 4 === 0) out = mixRgb(out, [174, 227, 115], 0.32);
  if (cosmic) out = mixRgb(out, [184, 211, 255], moonContact.bottom ? 0.3 : 0.24);
  if (oilContact.count > 0) {
    out = mixRgb(out, [38, 42, 27], oilContact.top ? 0.56 : 0.42);
    if (edge || localY === 0 || hash % 6 === 0) out = mixRgb(out, [88, 86, 48], 0.22);
    if (!wet && hash % 5 === 0) out = mixRgb(out, [18, 22, 15], 0.34);
  }
  if (scorched) out = mixRgb(out, [42, 26, 19], 0.62);
  if (frozen) out = mixRgb(out, [186, 225, 237], 0.58);
  return out;
}

function flowerColor({ color, variant, age, energy, flags, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 2) & 1)) & 3;
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Flower);
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic) || hasNearbyKind(cells, width, height, x, y, COSMIC_LIGHT_KINDS);
  const wet = Boolean(flags & CELL_FLAG.Wet) || energy > 70 || hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const oilContact = contactInfo(cells, width, height, x, y, OIL_KINDS);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const bloom = Math.min(1, age / 28);
  const petalShift = (hash + variant) % 4;
  const petal: Rgb = cosmic
    ? petalShift === 0
      ? [190, 158, 255]
      : [235, 218, 255]
    : petalShift === 0
      ? [245, 143, 190]
      : petalShift === 1
        ? [244, 205, 102]
        : [238, 235, 155];
  let out = mixRgb(color, [70, 151, 79], 0.46);

  if (localY >= 2 || edge.bottom) out = mixRgb(out, [44, 118, 55], 0.44);
  if ((localX === 1 || localX === 2 || edge.top) && bloom > 0.25) out = mixRgb(out, petal, 0.5 + bloom * 0.28);
  if ((localX === 1 && localY === 1) || hash % 11 === 0) out = mixRgb(out, [255, 232, 127], 0.5);
  if (edge.top || edge.left) out = mixRgb(out, cosmic ? [239, 231, 255] : [255, 246, 187], 0.2 + bloom * 0.18);
  if (wet) out = mixRgb(out, [146, 222, 152], 0.14);
  if (cosmic) {
    const pulse = (Math.sin(time * 0.012 + hash * 0.001) + 1) * 0.5;
    out = mixRgb(out, [165, 202, 255], 0.18 + pulse * 0.16);
  }
  if (oilContact.count > 0) {
    out = mixRgb(out, [45, 49, 31], oilContact.top ? 0.44 : 0.3);
    if ((edge.top || localY === 0) && hash % 3 === 0) out = mixRgb(out, [126, 121, 64], 0.28);
  }
  if (scorched) out = mixRgb(out, [55, 37, 31], 0.62);
  if (frozen) out = mixRgb(out, [207, 236, 245], 0.56);
  if (age < 8) out = mixRgb(out, [255, 252, 224], 0.55 * (1 - age / 8));
  return out;
}

function iceColor({ color, variant, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 2, y >> 2, variant);
  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 2) & 1)) & 3;
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Ice);
  const crack = (localX === localY && hash % 5 === 0) || (localX + localY === 3 && hash % 7 === 0);
  const heatContact = hasNearbyKind(cells, width, height, x, y, HOT_LIGHT_KINDS);
  let out = mixRgb(color, [186, 238, 250], 0.44);

  if (localX === 0 || localY === 0 || edge.top || edge.left) out = mixRgb(out, [245, 254, 255], 0.66);
  if (localX === 3 || localY === 3 || edge.right || edge.bottom) out = mixRgb(out, [42, 93, 132], 0.48);
  if (localX === 1 && localY === 1) out = mixRgb(out, [255, 255, 255], 0.52);
  if (localX === 2 && localY === 1) out = mixRgb(out, [211, 249, 255], 0.28);
  if (crack) out = mixRgb(out, [39, 96, 131], 0.58);
  if (heatContact) out = mixRgb(out, [183, 224, 236], 0.34);
  if (hash % 31 === 0 && (localX === 1 || localY === 1)) out = mixRgb(out, [255, 255, 255], 0.64);
  return out;
}

function emberColor({ variant, energy, flags, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const heat = Math.min(1, energy / 220);
  let out: Rgb = [33, 22, 14];
  if ((x + (hash & 1)) % 3 === 0) out = mixRgb(out, [60, 41, 25], 0.5);
  if ((hash & 15) === 2) out = mixRgb(out, [74, 50, 29], 0.4);
  if (heat > 0.05) {
    const pulse = (Math.sin(time * 0.008 + hash * 0.7 + x + y) + 1) * 0.5;
    out = mixRgb(out, [255, 120, 40], heat * (0.4 + pulse * 0.3));
    if ((hash & 7) === 0) out = mixRgb(out, [255, 208, 120], heat * 0.7);
  }
  if (flags & CELL_FLAG.Wet) out = mixRgb(out, [40, 52, 58], 0.4);
  return out;
}

function glassColor({ color, variant, age, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 1, y >> 1, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Glass);
  let out = mixRgb(color, [198, 246, 230], 0.3);
  out = mixRgb(out, [9, 14, 20], 0.24);
  if (((x + y * 2 + (hash & 3)) & 7) === 0) out = mixRgb(out, [216, 252, 240], 0.44);
  if (edge.top || edge.left) out = mixRgb(out, [234, 255, 246], 0.52);
  if (edge.bottom || edge.right) out = mixRgb(out, [36, 102, 84], 0.44);
  if ((hash & 31) === 5) out = mixRgb(out, [255, 255, 255], 0.6);
  if (hasNearbyKind(cells, width, height, x, y, STEAM_KINDS)) {
    // Steam fogs the pane with a soft condensation film.
    out = mixRgb(out, [214, 226, 230], 0.42);
    if ((hash & 3) === 1) out = mixRgb(out, [236, 242, 244], 0.3);
  }
  if (age < 8) out = mixRgb(out, [255, 244, 214], 0.6 * (1 - age / 8));
  if (age < 70) out = mixRgb(out, [255, 176, 96], 0.36 * (1 - age / 70));
  return out;
}

function stoneColor({ color, variant, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const blockHash = hashCell(x >> 1, y >> 1, variant);
  const facet = hashCell(x >> 2, y >> 2, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Stone);
  const dampContact = contactInfo(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const plantContact = contactInfo(cells, width, height, x, y, PLANT_KINDS);
  const heatContact = contactInfo(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const moonContact = contactInfo(cells, width, height, x, y, MOONWATER_KINDS);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
  const localX = (x + (facet & 1)) & 3;
  const localY = (y + ((facet >> 2) & 1)) & 3;
  let out = mixRgb(adjustRgb(color, (blockHash % 7) * 5 - 15), [82, 81, 76], 0.16);
  if (localX === 0 || localY === 0 || edge.top || edge.left) out = mixRgb(out, [171, 172, 168], 0.3);
  if (localX === 3 || localY === 3 || edge.right || edge.bottom) out = mixRgb(out, [28, 31, 37], 0.38);
  if ((localX === 1 && localY === 2 && facet % 3 === 0) || (x + y + blockHash) % 13 === 0) {
    out = mixRgb(out, [24, 26, 31], 0.62);
  }
  if (localX + localY === 2 && facet % 5 === 0) out = mixRgb(out, [121, 118, 104], 0.22);
  if (((x ^ y ^ blockHash) & 31) === 3) out = mixRgb(out, [192, 187, 169], 0.22);
  if (dampContact.count > 0 || flags & CELL_FLAG.Wet || energy > 30) {
    out = mixRgb(out, [86, 111, 122], dampContact.top ? 0.36 : 0.26);
    if (edge.top || localY === 0 || dampContact.bottom) out = mixRgb(out, [128, 166, 179], 0.22);
    if ((localX === 1 || localY === 0) && facet % 4 === 0) out = mixRgb(out, [150, 181, 185], 0.18);
  }
  if (plantContact.count > 0 && (edge.top || edge.left || plantContact.bottom)) {
    out = mixRgb(out, [78, 105, 75], 0.24);
    if (facet % 9 === 0 || localX === 1) out = mixRgb(out, [109, 145, 83], 0.34);
  }
  if (heatContact.count > 0 && (localX === 0 || localY === 0 || edge.top)) {
    out = mixRgb(out, [152, 96, 68], 0.28);
    if (facet % 5 === 0) out = mixRgb(out, [211, 119, 72], 0.22);
  }
  if (scorched) {
    out = mixRgb(out, [63, 46, 41], 0.48);
    if (localX === localY || facet % 11 === 0) out = mixRgb(out, [22, 20, 22], 0.44);
    if (edge.top && facet % 5 === 0) out = mixRgb(out, [119, 72, 50], 0.22);
  }
  if (frozen) {
    out = mixRgb(out, [179, 220, 232], edge.top || localY === 0 ? 0.54 : 0.38);
    if (localX + localY === 3 || facet % 13 === 0) out = mixRgb(out, [237, 253, 255], 0.3);
    if (edge.left || localX === 0) out = mixRgb(out, [123, 190, 211], 0.16);
    out = frostFerns(out, facet, x, y);
  }
  if (cosmic) {
    out = mixRgb(out, [118, 134, 204], 0.26);
    if (facet % 17 === 0) out = mixRgb(out, [195, 184, 255], 0.42);
    if (localX === 2 && facet % 19 === 0) out = mixRgb(out, [237, 224, 255], 0.32);
  }
  if (moonContact.count > 0) {
    out = mixRgb(out, [94, 145, 203], 0.24);
    if (localX === localY || facet % 11 === 0 || moonContact.bottom) out = mixRgb(out, [202, 193, 255], 0.32);
  }
  return out;
}

function liquidColor({ kind, color, variant, energy, flags, time, cells, width, height, x, y }: ShapeContext) {
  const top = !sameLiquid(cells, width, height, x, y - 1, kind);
  const left = sameLiquid(cells, width, height, x - 1, y, kind);
  const right = sameLiquid(cells, width, height, x + 1, y, kind);
  const bottom = sameLiquid(cells, width, height, x, y + 1, kind);
  const hash = hashCell(x, y, variant);
  const ripple = (x + y * 2 + Math.floor(time * 0.012) + hash) % 17 === 0;
  const heatContact = contactInfo(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const lifeContact = contactInfo(cells, width, height, x, y, LIFE_KINDS);
  const earthContact = contactInfo(cells, width, height, x, y, EARTH_CONTACT_KINDS);
  const oilContact = contactInfo(cells, width, height, x, y, OIL_KINDS);
  let out = color;
  if (kind === MATERIAL.Water && hasNearbyKind(cells, width, height, x, y, EMBER_KINDS)) {
    // Charcoal ink: water running over char picks up a sooty murk.
    out = mixRgb(out, [31, 29, 27], 0.32);
  }
  if (kind === MATERIAL.Oil && top) {
    // Iridescent slick: real oil films split light into faint green-violet-blue bands.
    const phase = (x * 2 + y + Math.floor(time * 0.006)) % 9;
    const sheen: Rgb = phase < 3 ? [96, 122, 90] : phase < 6 ? [110, 92, 128] : [80, 108, 130];
    out = mixRgb(out, sheen, 0.35);
    if ((hash + phase) % 7 === 0) out = mixRgb(out, [150, 160, 172], 0.3);
  }
  if (kind === MATERIAL.Water && energy > 120) {
    // Water's energy is temperature: simmering water warms and bubbles, boiling water churns.
    const rolling = energy > 190;
    out = mixRgb(out, [186, 170, 158], 0.1 + (energy / 255) * 0.1);
    const bubble = (x * 7 + y * 13 + Math.floor(time * 0.02) + hash) % (rolling ? 4 : 9) === 0;
    if (bubble) out = mixRgb(out, [240, 252, 255], rolling ? 0.66 : 0.5);
  }

  if (kind === MATERIAL.Oil) {
    const nearHeat = heatContact.count > 0;
    const frozen = Boolean(flags & CELL_FLAG.Frozen);
    const sheen = top || ((left || right) && (hash % 13 === 0 || ripple));
    out = mixRgb(out, [8, 13, 12], 0.18);
    if (top) out = mixRgb(out, [73, 88, 62], 0.3);
    if (!bottom) out = mixRgb(out, [3, 7, 7], 0.48);
    if (sheen) out = mixRgb(out, nearHeat ? [218, 132, 78] : [166, 158, 93], nearHeat ? 0.36 : 0.34);
    if (hash % 17 === 0 && (top || left || right)) out = mixRgb(out, [214, 192, 116], 0.24);
    if (nearHeat) out = mixRgb(out, heatContact.top ? [240, 158, 82] : [95, 49, 30], heatContact.top ? 0.42 : 0.28);
    if (lifeContact.count > 0) out = mixRgb(out, [19, 24, 18], lifeContact.bottom ? 0.38 : 0.24);
    if (frozen) out = mixRgb(out, [158, 190, 190], 0.44);
    return out;
  }

  if (left || right) out = mixRgb(out, kind === MATERIAL.Moonwater ? [126, 164, 244] : [72, 148, 218], kind === MATERIAL.Moonwater ? 0.28 : 0.2);
  if (top) out = mixRgb(out, kind === MATERIAL.Moonwater ? [238, 250, 255] : [166, 226, 255], kind === MATERIAL.Moonwater ? 0.54 : 0.44);
  if (!bottom) out = mixRgb(out, [24, 58, 106], kind === MATERIAL.Moonwater ? 0.1 : 0.2);
  if (!left || !right) out = mixRgb(out, [20, 56, 96], kind === MATERIAL.Moonwater ? 0.08 : 0.12);
  if (heatContact.count > 0) {
    out = mixRgb(out, [226, 245, 255], kind === MATERIAL.Moonwater ? 0.34 : 0.28);
    if (top || heatContact.top) out = mixRgb(out, [255, 255, 255], 0.18);
  }
  if (kind === MATERIAL.Water) {
    if (earthContact.count > 0) {
      out = mixRgb(out, [76, 116, 120], earthContact.bottom ? 0.22 : 0.14);
      if ((top || ripple) && hash % 5 === 0) out = mixRgb(out, [139, 183, 185], 0.18);
    }
    if (lifeContact.count > 0) out = mixRgb(out, [89, 151, 128], lifeContact.bottom ? 0.18 : 0.12);
    if (oilContact.count > 0) {
      out = mixRgb(out, [68, 76, 62], oilContact.top ? 0.36 : 0.24);
      if (top || ripple || hash % 11 === 0) out = mixRgb(out, [156, 171, 136], 0.28);
    }
  }
  if ((left || right) && (ripple || hash % 29 === 0)) out = adjustRgb(out, 24 + Math.sin(time * 0.005 + variant) * 10);
  if (kind === MATERIAL.Moonwater) {
    const moonPulse = (Math.sin(time * 0.006 + hash * 0.0004) + 1) * 0.5;
    const crescent = (top && (x + hash) % 5 <= 1) || (!left && y % 3 === 0) || (!right && y % 4 === 0);
    out = mixRgb(out, [141, 143, 255], 0.12);
    if (crescent) out = mixRgb(out, [250, 243, 255], 0.56 + moonPulse * 0.16);
    if (hash % 19 === 0) out = mixRgb(out, [229, 203, 255], 0.56);
    if (lifeContact.count > 0) out = mixRgb(out, [180, 255, 207], lifeContact.top ? 0.32 : 0.24);
    if (oilContact.count > 0) {
      out = mixRgb(out, [216, 199, 255], 0.34);
      if (top || hash % 7 === 0) out = mixRgb(out, [255, 242, 191], 0.24);
    }
  }
  return out;
}

function growthColor({ kind, color, variant, age, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, kind);
  const moonFed = hasNearbyKind(cells, width, height, x, y, MOONWATER_KINDS);
  const starFed = hasNearbyKind(cells, width, height, x, y, STARDUST_KINDS);
  const cosmic = moonFed || starFed || Boolean(flags & CELL_FLAG.Cosmic);
  const damp = cosmic || Boolean(flags & CELL_FLAG.Wet) || energy > 70 || hasNearbyKind(cells, width, height, x, y, WATER_KINDS);
  const oilContact = contactInfo(cells, width, height, x, y, OIL_KINDS);
  const heatContact = contactInfo(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  let out = color;

  if (kind === MATERIAL.Moss) {
    const localX = (x + (hash & 1)) & 3;
    const localY = (y + ((hash >> 2) & 1)) & 3;
    const leafy = localY === 0 || localX === 1 || hash % 7 === 0 || age > 90;
    if (edge.top || edge.left || leafy) out = mixRgb(out, damp ? [153, 230, 108] : [124, 187, 78], leafy ? 0.44 : 0.34);
    if (edge.bottom || localY === 3 || hash % 9 === 0) out = mixRgb(out, [21, 68, 36], 0.38);
    if (hash % 13 === 0) out = mixRgb(out, [214, 235, 112], 0.38);
    if (damp) {
      out = mixRgb(out, [102, 180, 83], 0.22);
      if (edge.top || hash % 11 === 0) out = mixRgb(out, [207, 241, 153], 0.38);
    }
    if (Boolean(flags & CELL_FLAG.Wet) && energy > 110 && (hash % 6 === 0 || (edge.top && hash % 3 === 0))) {
      out = mixRgb(out, [222, 248, 255], 0.55);
    }
    if (cosmic) {
      out = mixRgb(out, [143, 238, 177], moonFed ? 0.34 : 0.22);
      if (edge.top && hash % 3 !== 2) out = mixRgb(out, [196, 255, 219], 0.4);
    }
    if (oilContact.count > 0) {
      out = mixRgb(out, [32, 42, 27], oilContact.top ? 0.42 : 0.28);
      if (edge.top || hash % 4 === 0) out = mixRgb(out, [86, 88, 47], 0.24);
    }
    if (heatContact.count > 0) out = mixRgb(out, [116, 68, 43], heatContact.top ? 0.34 : 0.22);
    if (scorched) out = mixRgb(out, [48, 39, 28], 0.58);
    if (frozen) {
      out = mixRgb(out, [176, 224, 232], 0.6);
      if (edge.top || localY === 0) out = mixRgb(out, [239, 252, 255], 0.34);
    }
    return out;
  }

  const localX = (x + (hash & 1)) & 3;
  const localY = (y + ((hash >> 3) & 1)) & 3;
  const seedContact = contactInfo(cells, width, height, x, y, [MATERIAL.Seed]);
  const mossContact = contactInfo(cells, width, height, x, y, [MATERIAL.Moss]);
  const woodContact = contactInfo(cells, width, height, x, y, [MATERIAL.Wood]);
  const soilContact = contactInfo(cells, width, height, x, y, [MATERIAL.Soil]);
  const rottingSeed = seedContact.count > 0;
  const digestingWood = woodContact.count > 0;
  const overtakingMoss = mossContact.count > 0;
  const soilDecomposer = soilContact.count > 0;
  const cap = edge.top || localY === 0 || (hash % 6 === 0 && localY < 3);
  const gill = localY === 1 && (localX === 1 || localX === 2);
  const spore = hash % 13 === 0 || (age > 80 && hash % 9 === 0);

  out = mixRgb(out, [108, 61, 128], 0.16);
  if (cosmic) out = mixRgb(out, moonFed ? [158, 153, 255] : [190, 147, 255], 0.22);
  if (soilDecomposer) out = mixRgb(out, [176, 126, 103], 0.2);
  if (digestingWood) out = mixRgb(out, [196, 139, 82], 0.3);
  if (overtakingMoss) out = mixRgb(out, [132, 158, 96], 0.26);
  if (rottingSeed) out = mixRgb(out, [161, 67, 117], 0.34);
  if (oilContact.count > 0) {
    out = mixRgb(out, [42, 42, 31], oilContact.top ? 0.42 : 0.28);
    if (cap || hash % 5 === 0) out = mixRgb(out, [99, 90, 49], 0.22);
  }
  if (heatContact.count > 0) out = mixRgb(out, [111, 62, 50], heatContact.top ? 0.32 : 0.22);

  const capColor: Rgb = rottingSeed
    ? [216, 91, 151]
    : cosmic
      ? moonFed
        ? [158, 168, 255]
        : [198, 143, 255]
      : digestingWood
        ? [223, 160, 93]
        : overtakingMoss
          ? [181, 190, 104]
          : soilDecomposer
            ? [202, 143, 118]
            : [230, 164, 224];
  const gillColor: Rgb = rottingSeed
    ? [255, 181, 211]
    : cosmic
      ? [226, 215, 255]
      : digestingWood
        ? [252, 214, 159]
        : overtakingMoss
          ? [227, 232, 151]
          : [254, 218, 244];
  const sporeColor: Rgb = rottingSeed
    ? [255, 194, 220]
    : cosmic
      ? [235, 224, 255]
      : digestingWood
        ? [255, 226, 178]
        : overtakingMoss
          ? [229, 240, 173]
          : [250, 229, 239];

  if (cap) out = mixRgb(out, capColor, 0.66);
  if (gill) out = mixRgb(out, gillColor, 0.6);
  if (edge.bottom || localY === 3 || hash % 11 === 0) out = mixRgb(out, rottingSeed ? [86, 33, 65] : digestingWood ? [98, 58, 42] : [83, 45, 104], 0.42);
  if (spore) out = mixRgb(out, sporeColor, 0.72);
  if (damp) out = mixRgb(out, cosmic ? [195, 190, 255] : [168, 216, 190], cosmic ? 0.36 : 0.22);
  if (age > 110 && !damp) out = mixRgb(out, [93, 68, 84], 0.24);
  if (scorched) {
    out = mixRgb(out, [50, 34, 38], 0.58);
    if (cap || hash % 7 === 0) out = mixRgb(out, [24, 20, 22], 0.26);
  }
  if (frozen) {
    out = mixRgb(out, [188, 222, 240], 0.5);
    if (cap || gill) out = mixRgb(out, [238, 251, 255], 0.22);
  }
  return out;
}

function woodColor({ color, variant, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 1, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Wood);
  const ring = (x + hash) % 6 === 0 || (y + hash) % 11 === 0;
  const heatContact = contactInfo(cells, width, height, x, y, HOT_LIGHT_KINDS);
  const dampContact = contactInfo(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const plantContact = contactInfo(cells, width, height, x, y, PLANT_KINDS);
  const charred = heatContact.count > 0;
  const damp = dampContact.count > 0 || Boolean(flags & CELL_FLAG.Wet) || energy > 30;
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
  const endGrain = edge.left || edge.right;
  let out = adjustRgb(color, (hash % 5) * 4 - 8);
  if (ring) out = mixRgb(out, [57, 31, 20], 0.38);
  if ((x + y + hash) % 13 === 0) out = mixRgb(out, [166, 112, 66], 0.26);
  if (edge.top || edge.left) out = mixRgb(out, [175, 119, 71], 0.2);
  if (edge.right || edge.bottom) out = mixRgb(out, [55, 31, 20], 0.2);
  if (endGrain && ((y + hash) & 3) === 0) out = mixRgb(out, [196, 140, 83], 0.22);
  if (charred || scorched) {
    out = mixRgb(out, heatContact.top || scorched ? [42, 23, 18] : [63, 34, 24], heatContact.top || scorched ? 0.54 : 0.4);
    if (ring || hash % 9 === 0) out = mixRgb(out, [16, 12, 11], 0.36);
    if (edge.top && hash % 5 === 0) out = mixRgb(out, [101, 51, 32], 0.2);
  }
  if (damp) {
    out = mixRgb(out, [66, 60, 47], dampContact.bottom ? 0.32 : 0.24);
    if (edge.bottom || dampContact.top) out = mixRgb(out, [86, 108, 83], 0.24);
    if (edge.top || endGrain) out = mixRgb(out, [112, 132, 104], 0.16);
  }
  if (plantContact.count > 0 && hash % 5 === 0) out = mixRgb(out, [74, 113, 64], 0.28);
  if (cosmic) {
    out = mixRgb(out, [116, 138, 201], 0.28);
    if (hash % 19 === 0) out = mixRgb(out, [182, 189, 255], 0.34);
    if (ring && hash % 5 === 0) out = mixRgb(out, [221, 212, 255], 0.24);
  }
  if (frozen) {
    out = mixRgb(out, [166, 205, 216], 0.48);
    if (edge.top || endGrain) out = mixRgb(out, [228, 248, 255], 0.3);
    out = frostFerns(out, hash, x, y);
  }
  return out;
}

function stardustColor({ color, variant, age, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const twinkle = (Math.sin(time * 0.02 + age * 0.2 + hash * 0.0002) + 1) * 0.5;
  const moonContact = hasNearbyKind(cells, width, height, x, y, MOONWATER_KINDS);
  let out = mixRgb(color, hash % 3 === 0 ? [186, 214, 255] : [255, 224, 140], 0.32 + twinkle * 0.28);
  if (moonContact) out = mixRgb(out, [236, 222, 255], 0.34);
  if (hash % 9 === 0) out = [255, 240, 180];
  return adjustRgb(out, twinkle * 22);
}
