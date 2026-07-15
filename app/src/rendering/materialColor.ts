import { GLOW_MATERIALS, MATERIAL, MATERIAL_BY_ID, type MaterialId } from "../materials";
import { clampColor, hexToRgb, type Rgb } from "./color";
import { applyShapeLanguage, emptyCellColor } from "./shapeLanguage";

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
    b = clampColor(b + twinkle);
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

export function hasGlow(kind: number) {
  return GLOW_MATERIALS.has(kind as MaterialId);
}

export function glowIntensity(kind: number, energy: number, age: number, time: number) {
  const pulse = (Math.sin(time * 0.01 + age * 0.25) + 1) * 0.5;
  if (kind === MATERIAL.Ember) return clampColor(energy * 0.85 + (energy > 40 ? pulse * 35 : 0));
  const base = kind === MATERIAL.Stardust || kind === MATERIAL.Moonwater || kind === MATERIAL.Flower ? 80 : 120;
  return clampColor(base + energy * 0.45 + pulse * 55);
}

export function glowColorFor(kind: number): Rgb {
  const material = MATERIAL_BY_ID.get(kind as MaterialId);
  return hexToRgb(material?.glow ?? material?.color ?? "#ffffff");
}
