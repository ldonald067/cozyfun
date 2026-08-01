import { CELL_FLAG, GLOW_MATERIALS, MATERIAL, MATERIAL_BY_ID, type MaterialId } from "../materials";
import { clampColor, hexToRgb, type Rgb } from "./color";
import { applyShapeLanguage, emptyCellColor, WELLSPRING_TINTS } from "./shapeLanguage";

export function colorForCell(options: {
  kind: number;
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
}): Rgb {
  const { kind, variant, age, energy, flags, time, cells, width, height, x, y } = options;
  if (kind === MATERIAL.Empty) return emptyCellColor(cells, width, height, x, y, time);

  const material = MATERIAL_BY_ID.get(kind as MaterialId);
  if (!material) return [255, 0, 255];
  const hex = material.palette[variant % material.palette.length] ?? material.color;
  let [r, g, b] = hexToRgb(hex);

  if (kind === MATERIAL.Fire) {
    const pulse = Math.sin(time * 0.022 + variant + age * 0.3) * 22;
    r = clampColor(r + pulse + energy * 0.08);
    g = clampColor(g + pulse * 0.6);
  }

  if (kind === MATERIAL.Lava) {
    const pulse = Math.sin(time * 0.005 + variant + age * 0.05) * 10;
    r = clampColor(r + pulse + energy * 0.06);
    g = clampColor(g + pulse * 0.3);
  }

  if (kind === MATERIAL.Meteor) {
    const pulse = Math.sin(time * 0.012 + variant + age * 0.2) * 18;
    r = clampColor(r + pulse + energy * 0.08);
    g = clampColor(g + pulse * 0.5);
  }

  if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) {
    const shimmer = Math.sin(time * 0.004 + variant * 1.7 + age * 0.05) * 12;
    b = clampColor(b + shimmer);
    g = clampColor(g + shimmer * 0.6);
  }

  if (kind === MATERIAL.Stardust) {
    const twinkle = Math.sin(time * 0.018 + variant * 3 + age * 0.13) * 32;
    r = clampColor(r + twinkle);
    g = clampColor(g + twinkle * 0.7);
  }

  if (kind === MATERIAL.Seed) {
    const sprout = variant % 3 === 1 ? 32 : 0;
    g = clampColor(g + sprout + Math.sin(time * 0.003 + variant) * 4);
    r = clampColor(r - sprout * 0.35);
  }

  if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) {
    const fade = Math.max(0.35, 1 - age / (kind === MATERIAL.Steam ? 180 : 220));
    r = clampColor(r * fade + 9 * (1 - fade));
    g = clampColor(g * fade + 14 * (1 - fade));
    b = clampColor(b * fade + 20 * (1 - fade));
  }

  return applyShapeLanguage({ kind, color: [r, g, b], variant, age, energy, flags, time, cells, width, height, x, y });
}

// State-gated night lights: these materials glow only in a particular state, so the
// glow itself carries information (attuned, lit, freshly fused, star-etched).
// Every argument is required on purpose: defaulting energy/age to 0 would fail OPEN
// (a glass cell would read as freshly fused), so a caller must pass real cell state.
export function hasGlow(kind: number, flags: number, energy: number, age: number) {
  if (kind === MATERIAL.Moss || kind === MATERIAL.Stone) return (flags & CELL_FLAG.Cosmic) !== 0;
  if (kind === MATERIAL.Wellspring) return WELLSPRING_TINTS[energy & 255] !== undefined;
  if (kind === MATERIAL.Rocket) return energy > 0;
  if (kind === MATERIAL.Glass) return age < 70;
  return GLOW_MATERIALS.has(kind as MaterialId);
}

export function glowIntensity(kind: number, energy: number, age: number, time: number) {
  const pulse = (Math.sin(time * 0.01 + age * 0.25) + 1) * 0.5;
  if (kind === MATERIAL.Ember) return clampColor(energy * 0.85 + (energy > 40 ? pulse * 35 : 0));
  if (kind === MATERIAL.Moss) return clampColor(46 + energy * 0.28 + pulse * 26);
  if (kind === MATERIAL.Pollen) return clampColor(30 + energy * 0.25 + pulse * 20);
  if (kind === MATERIAL.Spark) return clampColor(50 + energy * 0.6 + pulse * 45);
  // Steam is lit BY sources, it is not one: a faint moonlit sheen that fades as the
  // wisp ages, far below fire's floor so a kettle never outshines its own flame.
  if (kind === MATERIAL.Steam) return clampColor(16 + energy * 0.06 + pulse * 8 - age * 0.2);
  // A wellspring's energy stores a material id, not a magnitude — steady rune light.
  if (kind === MATERIAL.Wellspring) return clampColor(56 + pulse * 30);
  if (kind === MATERIAL.Rocket) return clampColor(70 + energy * 0.35 + pulse * 40);
  // Fresh glass blooms with the vitrify flash, then cools back to an unlit pane.
  // Two decays, mirroring the base layer's own flash/cooling pair, so the bloom
  // fades continuously instead of stepping when the white-hot moment ends.
  if (kind === MATERIAL.Glass) {
    const cooling = Math.max(0, 1 - age / 70);
    const flash = Math.max(0, 1 - age / 8);
    return clampColor(cooling * (95 + pulse * 18) + flash * 55);
  }
  // Constellation-etched stone: a soft starfield, not a lamp.
  if (kind === MATERIAL.Stone) return clampColor(24 + pulse * 16);
  // A bloom's energy is its remaining lifetime, not a heat value. Scaling glow by it the
  // way the sources below do would light a fresh flower like a lantern; this is a soft
  // nightlight that dims as the bloom spends its arc.
  if (kind === MATERIAL.Flower) return clampColor(28 + Math.min(energy, 200) * 0.12 + pulse * 14);
  const base = kind === MATERIAL.Stardust || kind === MATERIAL.Moonwater ? 80 : 120;
  return clampColor(base + energy * 0.45 + pulse * 55);
}

export function glowColorFor(kind: number, flags: number, energy: number, age: number): Rgb {
  if (kind === MATERIAL.Moss && (flags & CELL_FLAG.Cosmic) !== 0) return [159, 232, 196];
  if (kind === MATERIAL.Stone) return [199, 188, 255];
  // The rune glow takes the hue of the remembered material, so attunement reads at night.
  if (kind === MATERIAL.Wellspring) return WELLSPRING_TINTS[energy & 255];
  if (kind === MATERIAL.Rocket) return [255, 223, 154];
  // Vitrify amber cooling into the pane's own mint as the flash fades.
  if (kind === MATERIAL.Glass) {
    const cool = Math.min(1, age / 70);
    return [255 - (255 - 149) * cool, 190 + (224 - 190) * cool, 110 + (208 - 110) * cool];
  }
  const material = MATERIAL_BY_ID.get(kind as MaterialId);
  return hexToRgb(material?.glow ?? material?.color ?? "#ffffff");
}

