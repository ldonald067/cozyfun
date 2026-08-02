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

const HOT_LIGHT_KINDS = [MATERIAL.Fire, MATERIAL.Lava, MATERIAL.Meteor, MATERIAL.Spark] as const;
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

// One flat hue per plant, picked from the cell's variant rather than its position, so
// every cell of a head is the same colour and the head reads as one flower. Deriving
// petal colour from a per-cell hash — which is what this used to do — turned a bloom
// into confetti the moment it became more than a single cell. Five garden hues, in the
// same family as the pixel-flower reference: cornflower, tulip, daisy, buttercup, lilac.
const PETAL_HUES: ReadonlyArray<readonly [Rgb, Rgb]> = [
  [[126, 188, 242], [58, 122, 200]],
  [[236, 92, 86], [172, 38, 44]],
  [[248, 247, 238], [198, 196, 182]],
  [[250, 206, 88], [210, 150, 34]],
  [[190, 130, 236], [126, 70, 182]]
];
const COSMIC_PETAL: readonly [Rgb, Rgb] = [[228, 214, 255], [150, 118, 226]];
// Which BLOOM_SHAPES entries (sim/src/lib.rs) hold the crown at the middle of the head,
// where a bright eye belongs. The tulip and the lavender carry their petals *above* the
// crown, so gilding it would put a gold dot at the bloom's base rather than its heart.
// Indexed by the same `variant % 5` that picks the shape and the hue.
const BLOOM_SHAPE_HAS_EYE: readonly boolean[] = [true, true, false, false, true];
// The eye of an open head. Warm gold reads against every petal hue above, including
// the buttercup, because the disc is always the darker, denser of the two.
const FLOWER_DISC: readonly [Rgb, Rgb] = [[255, 216, 104], [198, 134, 30]];

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
  else if (kind === MATERIAL.Rocket) out = rocketColor(context);
  else if (kind === MATERIAL.Spark) out = sparkColor(context);
  else if (kind === MATERIAL.Wellspring) out = wellspringColor(context);
  else if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) out = vaporColor(context);
  else if (kind === MATERIAL.Seed) out = seedColor(context);
  else if (kind === MATERIAL.Stem) out = stemColor(context);
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
  if (kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor || kind === MATERIAL.Stardust || kind === MATERIAL.Spark)
    return color;
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

function wallColor({ color, variant, age, energy, flags, cells, width, height, x, y }: ShapeContext) {
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
    // High freeze-thaw stress: the wall is about to crumble into stone. Draw
    // spatially coherent fracture veins — a dark fissure with a pale relief lip —
    // that thread continuously across neighboring cells, so a cracking wall reads
    // distinctly from the flat bluish damp tint above. Deepens as it nears crumble.
    const stress = Math.min(1, (energy - 130) / 40);
    const vein = (x * 3 + y * 2) % 9;
    const branch = (x * 2 - y * 3 + 33) % 11;
    if (vein === 0 || branch === 0) out = mixRgb(out, [4, 6, 10], 0.58 + 0.28 * stress);
    else if (vein === 1 || branch === 1) out = mixRgb(out, [172, 180, 194], 0.32 + 0.2 * stress);
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
  const patina = Math.min(1, age / 12000);
  if (patina > 0.1) {
    // Long-standing walls weather visibly: mortar darkens, faces stain, corners chip.
    if (brickX === 0 || brickY === 0) out = mixRgb(out, [26, 27, 30], 0.3 * patina);
    if ((hash + brickX * 3 + brickY) % 9 === 0) out = mixRgb(out, [88, 90, 96], 0.35 * patina);
    if (patina > 0.5 && (hash + x * 5 + y * 7) % 23 === 0) out = mixRgb(out, [20, 24, 31], 0.4 * patina);
  }
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

function pollenColor({ color, variant, age, flags, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const bob = (Math.sin(time * 0.01 + hash * 1.3 + x) + 1) * 0.5;
  let out = mixRgb(color, [255, 246, 214], 0.3 + bob * 0.25);
  if ((hash & 7) === 2) out = mixRgb(out, [232, 194, 106], 0.4);
  // Cosmic pollen carries a moonlit sheen so the cosmic lineage reads mid-flight.
  if (flags & CELL_FLAG.Cosmic) out = mixRgb(out, [178, 190, 255], 0.35 + bob * 0.15);
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

// Rune glint tints for an attuned wellspring, keyed by the remembered material id.
// The hue a wellspring shows for each material it can remember. Shared with the glow
// layer (materialColor.ts) so the carved rune and its night bloom can never drift
// apart, and so the key set stays the single source of truth for "is this attuned".
export const WELLSPRING_TINTS: Record<number, Rgb> = {
  [MATERIAL.Water]: [120, 178, 255],
  [MATERIAL.Moonwater]: [170, 180, 242],
  [MATERIAL.Lava]: [255, 122, 48],
  [MATERIAL.Fire]: [255, 214, 120],
  [MATERIAL.Sand]: [228, 200, 130],
  [MATERIAL.Soil]: [170, 128, 90],
  [MATERIAL.Oil]: [140, 160, 128],
  [MATERIAL.Seed]: [150, 210, 120],
  [MATERIAL.Stardust]: [180, 140, 255],
  [MATERIAL.Meteor]: [255, 155, 77],
  [MATERIAL.Rocket]: [216, 92, 106]
};

function wellspringColor({ color, variant, energy, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Wellspring);
  // Moonlit carved stone, not night-camouflage: lift the body toward slate-silver so
  // the block silhouettes against the #091018 sky instead of melting into it.
  let out = mixRgb(color, [96, 112, 148], 0.3 - (hash & 3) * 0.05);
  // Chiselled rim: bright top/left, deep shadow bottom/right — a carved block reads
  // from its edges even at a two-cell placement.
  if (edge.top || edge.left) out = mixRgb(out, [168, 186, 218], 0.42);
  if (edge.bottom || edge.right) out = mixRgb(out, [8, 12, 22], 0.44);
  // Small placements (1-2 cells, mostly exposed) always carve: a lone block must
  // still read as runed stone, and attuned-vs-dormant must survive at that size.
  const rune =
    edge.count >= 3 ||
    (x * 5 + y * 3 + (hash & 7)) % 9 === 0 ||
    ((x ^ y) + (hash >> 2)) % 11 === 0;
  if (!rune) return out;
  const tint = WELLSPRING_TINTS[energy & 255];
  if (tint) {
    const pulse = (Math.sin(time * 0.006 + hash * 0.9) + 1) * 0.5;
    out = mixRgb(out, tint, 0.55 + pulse * 0.3);
    // Lit rune cores: a few near-white pixels make attunement legible when the
    // spring is only a couple of cells on screen.
    if (hash % 5 === 0) out = mixRgb(out, [255, 253, 244], 0.4 + pulse * 0.2);
    return out;
  }
  // Dormant runes sleep in colourless pewter. Deliberately desaturated rather than
  // blue-silver: an unlit rune must not be mistakable for the palest attunement
  // (Moonwater's lavender), which a cool silver was too close to at one-cell sizes.
  return mixRgb(out, [176, 178, 174], 0.5);
}

// Classic firework hues; each spark picks one deterministically, so every
// burst blooms as a multicolor shell.
// Warm-leaning festive hues (gold, rose, mint, sky, magenta) that read apart from
// Stardust's cool blue-violet. Keep app/src/materials.ts Spark.palette in sync.
const FIREWORK_HUES: Rgb[] = [
  [255, 210, 126],
  [255, 133, 173],
  [127, 230, 189],
  [164, 198, 255],
  [224, 122, 246]
];

function sparkColor({ variant, age, energy, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const hue = FIREWORK_HUES[hash % FIREWORK_HUES.length];
  if (age < 3) return mixRgb([255, 250, 230], hue, 0.25);
  const life = Math.min(1, energy / 235);
  let out = mixRgb([96, 44, 34], hue, 0.2 + life * 0.8);
  const blink = (hash + age + Math.floor(time * 0.02)) % 5 === 0;
  if (blink) out = mixRgb(out, [255, 255, 240], 0.55);
  return out;
}

function rocketColor({ color, variant, energy, time, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  if (energy > 0) {
    // A lit grain is the bright climbing head of the firework.
    const flicker = (Math.sin(time * 0.03 + hash * 1.7) + 1) * 0.5;
    let out = mixRgb(color, [255, 236, 176], 0.55 + flicker * 0.25);
    if (hash % 5 === 0) out = [255, 248, 214];
    return out;
  }
  let out = mixRgb(color, [58, 18, 22], (hash & 3) * 0.09);
  if (hash % 6 === 0) out = mixRgb(out, [232, 220, 210], 0.55);
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
  if (rooted && wet) {
    // Germination arc: the shoot visibly climbs and pales toward a bud as the seed feeds.
    const growth = Math.min(1, (energy - 40) / 160) * Math.min(1, age / 60);
    if (growth > 0.15) out = mixRgb(out, [104, 178, 84], 0.25 + growth * 0.3);
    if (growth > 0.35 && localY <= 1) out = mixRgb(out, [138, 214, 102], 0.4 + growth * 0.3);
    if (growth > 0.6 && localY === 0) out = mixRgb(out, [196, 240, 134], 0.45 + growth * 0.3);
    if (growth > 0.85 && (localY === 0 || localX === 1) && (hash & 3) !== 1) out = mixRgb(out, [240, 252, 186], 0.55);
  }
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

function stemColor({ color, variant, energy, flags, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const localX = (x + (hash & 1)) & 3;
  const above = kindAt(cells, width, height, x, y - 1);
  const below = kindAt(cells, width, height, x, y + 1);
  const growingTip = energy > 20 && above !== MATERIAL.Stem && above !== MATERIAL.Flower;
  // A stalk cell only ever gains a horizontal Stem neighbour when a leaf unfurls beside
  // it, and the leaf itself is the one of the pair with no stalk running through it.
  const leftStem = sameKind(cells, width, height, x - 1, y, MATERIAL.Stem);
  const rightStem = sameKind(cells, width, height, x + 1, y, MATERIAL.Stem);
  const isLeaf =
    (leftStem || rightStem) && !(above === MATERIAL.Stem && below === MATERIAL.Stem);

  let out = mixRgb(color, [76, 143, 56], 0.25);
  if (isLeaf) {
    // A leaf is a single cell, so sub-cell veining would be invisible. What has to read
    // at play zoom is leaf against stalk, and that is a flatter, deeper green beside the
    // stalk's lit one.
    out = mixRgb(out, [68, 132, 54], 0.68);
    if ((hash & 3) === 0) out = mixRgb(out, [92, 158, 66], 0.22);
  } else {
    if (localX === 1 || localX === 2) out = mixRgb(out, [151, 219, 108], 0.4);
    if (growingTip) out = mixRgb(out, [214, 244, 160], 0.45);
  }
  if (flags & CELL_FLAG.Cosmic) out = mixRgb(out, [165, 220, 255], 0.2);
  if (flags & CELL_FLAG.Scorched) out = mixRgb(out, [52, 40, 26], 0.6);
  if (flags & CELL_FLAG.Frozen) out = mixRgb(out, [190, 228, 238], 0.55);
  return out;
}

// A bloom is a small cluster of Flower cells, so a cell's job is read off state the sim
// already keeps — no new cell data:
//   no Flower neighbours          -> an unopened bud, still a green knob
//   rooted, with petals around it -> the disc, the bright eye of an open head
//   anything else                 -> a petal
// Rooted is exactly the crown the stalk produced, and the crown is the cell the petals
// opened around, so it is the middle of the head by construction. Counting neighbours
// alone cannot find it: the stem occupies one of the crown's four cardinal sides, so no
// cell in a real head ever has four Flower neighbours.
//
// The count is over all EIGHT faces, not the four cardinals. Petals can open into corners,
// and a crown whose only petal sits diagonally has zero cardinal neighbours — counting
// cardinals rendered that half-open bloom as two separate buds.
function flowerColor({ variant, age, energy, flags, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x, y, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Flower);
  let neighbours = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (sameKind(cells, width, height, x + dx, y + dy, MATERIAL.Flower)) neighbours++;
    }
  }
  const cosmic = Boolean(flags & CELL_FLAG.Cosmic) || hasNearbyKind(cells, width, height, x, y, COSMIC_LIGHT_KINDS);
  // Energy is the bloom's remaining lifetime, not moisture. Reading it as wetness — the
  // old `energy > 70` — now tints every healthy flower, because a fresh bloom starts at 200.
  const wet = Boolean(flags & CELL_FLAG.Wet) || hasNearbyKind(cells, width, height, x, y, COOL_LIQUID_KINDS);
  const oilContact = contactInfo(cells, width, height, x, y, OIL_KINDS);
  const frozen = Boolean(flags & CELL_FLAG.Frozen);
  const scorched = Boolean(flags & CELL_FLAG.Scorched);
  const bloom = Math.min(1, age / 28);
  const [petalLight, petalDark] = cosmic ? COSMIC_PETAL : PETAL_HUES[variant % PETAL_HUES.length];
  // The last of the arc: a bloom dulls toward grey before its petals let go, so a garden
  // past its peak reads as past its peak rather than staying showroom-fresh until cells
  // start vanishing.
  const fade = energy < 80 ? Math.min(0.4, (80 - energy) / 150) : 0;

  const rooted = Boolean(flags & CELL_FLAG.Rooted);
  let out: Rgb;
  if (neighbours === 0) {
    // Unopened bud. A bud is one cell, so it gets one flat colour and cannot show sepals
    // wrapping a tip. Leading with the plant's own dark hue under a green wash is what
    // makes it read: a deep knob of the colour about to open, clearly not the lit stalk
    // beneath it. Leading with green instead put a muddy olive dot on top of the stem.
    out = mixRgb(petalDark, [58, 104, 58], 0.28 - bloom * 0.1);
    if ((hash & 3) === 0) out = mixRgb(out, [104, 160, 82], 0.18);
  } else if (rooted && BLOOM_SHAPE_HAS_EYE[variant % PETAL_HUES.length]) {
    // Disc: a dense golden eye, flecked so it does not read as a flat square.
    out = mixRgb(FLOWER_DISC[0], FLOWER_DISC[1], ((x ^ y) & 1) === 0 ? 0.1 : 0.42);
    if ((hash & 7) === 0) out = mixRgb(out, [255, 246, 196], 0.5);
  } else {
    // Petal: the plant's one hue, darkening toward the rim so the head reads round
    // rather than as a block. Corner cells (attached on one side only) take the most,
    // which is what rounds the silhouette.
    out = petalLight;
    const rim = edge.count >= 2 ? 0.42 : edge.count === 1 ? 0.2 : 0.06;
    out = mixRgb(out, petalDark, rim);
    if (edge.top && !edge.bottom) out = mixRgb(out, [255, 255, 255], 0.16 * bloom);
    if (edge.bottom && !edge.top) out = mixRgb(out, petalDark, 0.22);
    if ((hash & 7) === 0) out = mixRgb(out, petalDark, 0.16);
  }

  if (fade > 0) out = mixRgb(out, [122, 108, 88], fade);
  if (wet) out = mixRgb(out, [146, 222, 152], 0.12);
  if (cosmic) {
    const pulse = (Math.sin(time * 0.012 + hash * 0.001) + 1) * 0.5;
    out = mixRgb(out, [165, 202, 255], 0.12 + pulse * 0.14);
  }
  if (oilContact.count > 0) {
    out = mixRgb(out, [45, 49, 31], oilContact.top ? 0.44 : 0.3);
    if ((edge.top || edge.left) && hash % 3 === 0) out = mixRgb(out, [126, 121, 64], 0.28);
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

function glassColor({ color, variant, age, energy, flags, time, cells, width, height, x, y }: ShapeContext) {
  const hash = hashCell(x >> 1, y >> 1, variant);
  const edge = edgeInfo(cells, width, height, x, y, MATERIAL.Glass);
  // A pane is mostly the night behind it: start from the sky and lay only a whisper
  // of mint film over it, so glass reads transparent instead of as solid chalk.
  let out = mixRgb([9, 14, 20], color, 0.18);
  // A slow diagonal sheen drifts across the pane — the moving band of caught light
  // that says "glass" even where the interior is nearly see-through.
  const band = (x + y + Math.floor(time * 0.004)) % 11;
  if (band === 0) out = mixRgb(out, [214, 240, 236], 0.3);
  else if (band === 1) out = mixRgb(out, [214, 240, 236], 0.14);
  if (((x + y * 2 + (hash & 3)) & 7) === 0) out = mixRgb(out, [216, 252, 240], 0.3);
  // The frame carries the identity: bright lit rim up top, deep teal shadow below.
  if (edge.top || edge.left) out = mixRgb(out, [234, 255, 246], 0.5);
  if (edge.bottom || edge.right) out = mixRgb(out, [46, 116, 98], 0.42);
  if ((hash & 31) === 5) out = mixRgb(out, [255, 255, 255], 0.6);
  const misting = hasNearbyKind(cells, width, height, x, y, STEAM_KINDS);
  const dewed = (flags & CELL_FLAG.Wet) !== 0;
  if (misting || dewed) {
    // Condensation is a field of micro-droplets, not a coat of paint. Two flat
    // washes used to stack here and turn a steamy dome back into grey chalk, so
    // instead: keep the dark see-through body under only a breath of haze, scatter
    // beads that catch the light, and — once there is enough water to move — carve
    // the vertical tracks where drops have slid down and wiped the pane clear.
    // Bright speckle over dark glass, streaked by even darker runs, is a texture
    // nothing else in the roster wears.
    const dew = dewed ? Math.min(1, energy / 46) : 0;
    const drop = hashCell(x, y, variant + 5);
    // The haze stays deliberately thin — most of the pane must still read through.
    out = mixRgb(out, [188, 214, 220], (misting ? 0.11 : 0.05) + dew * 0.07);
    // Beads first, over the whole pane, so a track cell is a wiped bead rather than a
    // cell that took a different branch. Keeping these independent is what lets the
    // track fade in continuously below.
    if ((drop & 3) === 1) out = mixRgb(out, [224, 240, 244], 0.24 + dew * 0.32);
    else if ((drop & 7) === 4) out = mixRgb(out, [198, 222, 228], 0.12 + dew * 0.14);
    // A track has to be stable down a column or it reads as speckle instead of a run,
    // so it can only be seeded on x: both `variant` and the 2x2 block hash change as y
    // advances, and folding either one in chops the track into two-row dashes. Spacing
    // is modular rather than a hash test, because hashed columns clump and leave gaps
    // wide enough for a small pane to contain no track at all; the jitter keeps that
    // spacing from looking ruled, and the jog lets a track wander a column every eight
    // rows the way a real drip does.
    const jog = hashCell(0, y >> 3, 7) & 1;
    const jitter = hashCell(x >> 3, 0, 11) & 3;
    const track = (x + jog + jitter) % 5 === 0;
    // Wipe strength ramps with dew rather than switching on at a threshold, so a pane
    // does not darken all at once when one more unit of water lands on it.
    const wipe = Math.max(0, Math.min(1, (dew - 0.2) / 0.45));
    if (track && wipe > 0) {
      // A track reads DARKER than the fog around it: the glass behind it has been
      // wiped clear, so the night shows through the runs.
      out = mixRgb(out, [11, 19, 25], (0.38 + dew * 0.24) * wipe);
      // The bead riding down that track is the brightest thing on the pane.
      if (((y * 5 + (drop >> 2)) & 7) === 0) out = mixRgb(out, [238, 250, 255], 0.72 * wipe);
    }
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
  if (edge.count === 0) {
    // Mineral veins: rare clustered strata glint inside larger stone masses only.
    const veinSeed = hashCell(x >> 3, y >> 3, 1);
    if ((veinSeed & 15) === 3 && (x * 2 + y * 3 + (veinSeed & 7)) % 19 < 2) {
      out = mixRgb(out, (veinSeed & 16) !== 0 ? [212, 190, 140] : [176, 196, 214], 0.4);
      if (((x ^ y) & 7) === 2) out = mixRgb(out, [236, 226, 190], 0.35);
    }
  }
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
    if (Boolean(flags & CELL_FLAG.Wet) && energy > 150) {
      // Deeply hydrated moss reads vividly lush, so a generous watering shows at a glance.
      out = mixRgb(out, [96, 214, 118], 0.28);
    }
    if (Boolean(flags & CELL_FLAG.Wet) && energy > 110 && (hash % 4 === 0 || (edge.top && hash % 3 === 0))) {
      out = mixRgb(out, [222, 248, 255], 0.55);
    }
    if (cosmic) {
      out = mixRgb(out, [143, 238, 177], moonFed ? 0.34 : 0.22);
      if (edge.top && hash % 3 !== 2) out = mixRgb(out, [196, 255, 219], 0.4);
    }
    if (edge.top && age > 150 && damp && hash % 5 === 0) {
      // Mature damp moss raises tiny sporophyte tufts, like the real plant.
      out = mixRgb(out, [186, 224, 120], 0.5);
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
