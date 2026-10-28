import { Eraser } from "lucide-react";
import { MATERIAL, type MaterialDef } from "../materials";

// A tray icon is a specimen jar of the material's own pixels, so the chip matches what the
// brush paints instead of standing for it with a symbol. Eight cells across at 24px is a
// 3px cell, close to a sim cell at play zoom.
const GRID = 8;

// The tray panel's wash where the chips sit, as the ring's contrast is measured against it.
const PANEL_RGB: Rgb = [27, 33, 58];
// Toward white rather than the cream, so the lift keeps the hue: Wellspring stays violet.
const RING_LIFT_TOWARD: Rgb = [255, 255, 255];
// WCAG's floor for graphical objects. Wellspring's identity colour measured 1.44:1 on the
// old panel and Soil 2.66:1, so a ring in the raw colour would vanish for those two.
const RING_MIN_CONTRAST = 3;

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The material's identity colour, mixed toward the poster cream only as far as it must go to read. */
export function readableMaterialColor(hex: string) {
  const base = hexToRgb(hex);
  for (let step = 0; step <= 10; step++) {
    const t = step / 10;
    const mixed = base.map((channel, i) => Math.round(channel + (RING_LIFT_TOWARD[i] - channel) * t)) as Rgb;
    if (contrast(mixed, PANEL_RGB) >= RING_MIN_CONTRAST) return `rgb(${mixed.join(" ")})`;
  }
  return `rgb(${RING_LIFT_TOWARD.join(" ")})`;
}

// Fixed hash, so a chip is the same speckle on every load and in every capture.
function pick(palette: string[], a: number, b: number, salt: number) {
  const hash = Math.imul(a * 73 + b * 151 + salt * 977, 2654435761) >>> 0;
  return palette[(hash >>> 13) % palette.length];
}

function cellColor(material: MaterialDef, x: number, y: number) {
  const { palette } = material;
  if (material.id === MATERIAL.Wall) {
    // Bricks, not noise: the averaged greys of Wall and Stone sit close, the pattern does not.
    // Two-cell courses over a dark mortar row, each brick one shade from the lighter half.
    const byLight = [...palette].sort((a, b) => luminance(hexToRgb(a)) - luminance(hexToRgb(b)));
    const course = Math.floor(y / 3);
    const shifted = x + (course % 2) * 2;
    if (y % 3 === 2 || shifted % 4 === 3) return byLight[0];
    return pick(byLight.slice(Math.floor(byLight.length / 2)), Math.floor(shifted / 4), course, material.id);
  }
  return pick(palette, x, y, material.id);
}

export function MaterialChip({ material }: { material: MaterialDef }) {
  if (material.id === MATERIAL.Empty) {
    return (
      <span className="material-icon material-chip empty-chip" aria-hidden="true">
        <Eraser size={14} strokeWidth={2.15} />
      </span>
    );
  }
  const cells = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      cells.push(<rect key={y * GRID + x} x={x} y={y} width={1} height={1} fill={cellColor(material, x, y)} />);
    }
  }
  return (
    <span className="material-icon material-chip" aria-hidden="true">
      <svg viewBox={`0 0 ${GRID} ${GRID}`} shapeRendering="crispEdges">
        {cells}
      </svg>
    </span>
  );
}
