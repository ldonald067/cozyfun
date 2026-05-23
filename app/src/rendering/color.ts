export type Rgb = [number, number, number];

export function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgb(hex: string): Rgb {
  const cleaned = hex.replace("#", "");
  const value = Number.parseInt(cleaned, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function adjustRgb(color: Rgb, amount: number): Rgb {
  return [clampColor(color[0] + amount), clampColor(color[1] + amount), clampColor(color[2] + amount)];
}

export function mixRgb(color: Rgb, target: Rgb, amount: number): Rgb {
  const mix = Math.max(0, Math.min(1, amount));
  return [
    clampColor(color[0] + (target[0] - color[0]) * mix),
    clampColor(color[1] + (target[1] - color[1]) * mix),
    clampColor(color[2] + (target[2] - color[2]) * mix)
  ];
}
