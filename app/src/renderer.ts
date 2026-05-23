import type { SandboxEngine } from "./engine";
import { CELL_STRIDE, GLOW_MATERIALS, MATERIAL, MATERIAL_BY_ID, type MaterialId } from "./materials";

type RenderTargets = {
  base: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  motes: HTMLCanvasElement;
};

export function renderSandbox(engine: SandboxEngine, targets: RenderTargets, time: number) {
  const width = engine.width();
  const height = engine.height();
  ensureCanvasSize(targets.base, width, height);
  ensureCanvasSize(targets.glow, width, height);
  ensureCanvasSize(targets.motes, targets.motes.clientWidth || 800, targets.motes.clientHeight || 500);

  const baseCtx = targets.base.getContext("2d", { alpha: false });
  const glowCtx = targets.glow.getContext("2d", { alpha: true });
  if (!baseCtx || !glowCtx) return;

  const cells = engine.getCellBytes();
  const base = baseCtx.createImageData(width, height);
  const glow = glowCtx.createImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const cellOffset = i * CELL_STRIDE;
    const kind = cells[cellOffset];
    const variant = cells[cellOffset + 1];
    const age = readU16(cells, cellOffset + 2);
    const energy = readU16(cells, cellOffset + 4);
    const pixelOffset = i * 4;
    const color = colorFor(kind, variant, age, energy, time, cells, width, height, x, y);
    base.data[pixelOffset] = color[0];
    base.data[pixelOffset + 1] = color[1];
    base.data[pixelOffset + 2] = color[2];
    base.data[pixelOffset + 3] = 255;

    if (GLOW_MATERIALS.has(kind as MaterialId)) {
      const intensity = glowIntensity(kind, energy, age, time);
      const glowColor = glowColorFor(kind);
      glow.data[pixelOffset] = glowColor[0];
      glow.data[pixelOffset + 1] = glowColor[1];
      glow.data[pixelOffset + 2] = glowColor[2];
      glow.data[pixelOffset + 3] = intensity;
    }
  }

  baseCtx.putImageData(base, 0, 0);
  glowCtx.clearRect(0, 0, width, height);
  glowCtx.putImageData(glow, 0, 0);
  drawMotes(targets.motes, time);
}

export async function exportPostcard(engine: SandboxEngine, base: HTMLCanvasElement, glow: HTMLCanvasElement) {
  const scale = 3;
  const width = base.width * scale;
  const height = base.height * scale;
  const card = document.createElement("canvas");
  card.width = width + 160;
  card.height = height + 180;
  const ctx = card.getContext("2d");
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, card.width, card.height);
  gradient.addColorStop(0, "#0d121b");
  gradient.addColorStop(0.45, "#18202a");
  gradient.addColorStop(1, "#1f2830");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, card.width, card.height);

  ctx.fillStyle = "rgba(255, 224, 170, 0.08)";
  ctx.fillRect(58, 58, width + 44, height + 44);
  ctx.drawImage(glow, 80, 80, width, height);
  ctx.drawImage(base, 80, 80, width, height);

  ctx.fillStyle = "#f4dfb8";
  ctx.font = "600 30px Georgia, serif";
  ctx.fillText("Night Desk Terrarium", 80, height + 125);
  ctx.fillStyle = "#99b8c8";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(`${engine.source.toUpperCase()} sim · tick ${engine.tickCount()}`, 80, height + 154);

  const url = card.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `night-desk-terrarium-${Date.now()}.png`;
  anchor.click();
}

function ensureCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function colorFor(
  kind: number,
  variant: number,
  age: number,
  energy: number,
  time: number,
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): [number, number, number] {
  if (kind === MATERIAL.Empty) return emptyColorFor(cells, width, height, x, y, time);
  const material = MATERIAL_BY_ID.get(kind as MaterialId);
  if (!material) return [255, 0, 255];
  const hex = material.palette[variant % material.palette.length] ?? material.color;
  let [r, g, b] = hexToRgb(hex);

  if (kind === MATERIAL.Fire || kind === MATERIAL.Lava || kind === MATERIAL.Meteor) {
    const pulse = Math.sin(time * 0.012 + variant + age * 0.2) * 18;
    r = clamp(r + pulse + energy * 0.08);
    g = clamp(g + pulse * 0.5);
  }

  if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) {
    const shimmer = Math.sin(time * 0.004 + variant * 1.7 + age * 0.05) * 12;
    b = clamp(b + shimmer);
    g = clamp(g + shimmer * 0.6);
  }

  if (kind === MATERIAL.Stardust) {
    const twinkle = Math.sin(time * 0.018 + variant * 3 + age * 0.13) * 32;
    r = clamp(r + twinkle);
    b = clamp(b + twinkle);
  }

  if (kind === MATERIAL.Seed) {
    const sprout = variant % 3 === 1 ? 32 : 0;
    g = clamp(g + sprout + Math.sin(time * 0.003 + variant) * 4);
    r = clamp(r - sprout * 0.35);
  }

  if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) {
    const fade = Math.max(0.35, 1 - age / (kind === MATERIAL.Steam ? 180 : 220));
    r = clamp(r * fade + 9 * (1 - fade));
    g = clamp(g * fade + 14 * (1 - fade));
    b = clamp(b * fade + 20 * (1 - fade));
  }

  return shapeColorFor(kind, [r, g, b], variant, age, time, cells, width, height, x, y);
}

function emptyColorFor(cells: Uint8Array, width: number, height: number, x: number, y: number, time: number): [number, number, number] {
  const background: [number, number, number] = [9, 14, 20];
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

function shapeColorFor(
  kind: number,
  color: [number, number, number],
  variant: number,
  age: number,
  time: number,
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): [number, number, number] {
  if (kind === MATERIAL.Sand) return sandColor(color, variant, cells, width, height, x, y);
  if (kind === MATERIAL.Seed) return seedColor(color, variant, age, cells, width, height, x, y);
  if (kind === MATERIAL.Ice) return iceColor(color, variant, cells, width, height, x, y);
  if (kind === MATERIAL.Stone) return stoneColor(color, variant, cells, width, height, x, y);
  if (kind === MATERIAL.Water || kind === MATERIAL.Moonwater) return liquidColor(kind, color, variant, time, cells, width, height, x, y);
  if (kind === MATERIAL.Stardust) return stardustColor(color, variant, age, time, x, y);
  return color;
}

function sandColor(color: [number, number, number], variant: number, cells: Uint8Array, width: number, height: number, x: number, y: number) {
  const hash = hashCell(x, y, variant);
  let out = adjustRgb(color, (hash % 5) * 3 - 6);
  if (hash % 11 === 0) out = adjustRgb(out, -24);
  if (hash % 13 === 0) out = mixRgb(out, [239, 213, 139], 0.28);
  if (!sameKind(cells, width, height, x, y - 1, MATERIAL.Sand)) out = adjustRgb(out, 7);
  return out;
}

function seedColor(
  color: [number, number, number],
  variant: number,
  age: number,
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
) {
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

function iceColor(color: [number, number, number], variant: number, cells: Uint8Array, width: number, height: number, x: number, y: number) {
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

function stoneColor(color: [number, number, number], variant: number, cells: Uint8Array, width: number, height: number, x: number, y: number) {
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

function liquidColor(
  kind: number,
  color: [number, number, number],
  variant: number,
  time: number,
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
) {
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

function stardustColor(color: [number, number, number], variant: number, age: number, time: number, x: number, y: number) {
  const hash = hashCell(x, y, variant);
  const twinkle = (Math.sin(time * 0.02 + age * 0.2 + hash * 0.0002) + 1) * 0.5;
  let out = mixRgb(color, hash % 3 === 0 ? [255, 233, 159] : [174, 227, 255], 0.32 + twinkle * 0.28);
  if (hash % 9 === 0) out = [255, 246, 197];
  return adjustRgb(out, twinkle * 22);
}

function kindAt(cells: Uint8Array, width: number, height: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) return -1;
  return cells[(y * width + x) * CELL_STRIDE];
}

function sameKind(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number) {
  return kindAt(cells, width, height, x, y) === kind;
}

function sameLiquid(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number) {
  const other = kindAt(cells, width, height, x, y);
  if (kind === MATERIAL.Moonwater) return other === MATERIAL.Moonwater || other === MATERIAL.Water;
  return other === kind;
}

function cardinalNeighborCount(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number) {
  let count = 0;
  if (sameKind(cells, width, height, x, y - 1, kind)) count++;
  if (sameKind(cells, width, height, x + 1, y, kind)) count++;
  if (sameKind(cells, width, height, x, y + 1, kind)) count++;
  if (sameKind(cells, width, height, x - 1, y, kind)) count++;
  return count;
}

function hashCell(x: number, y: number, variant = 0) {
  let hash = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519) ^ Math.imul(variant + 1, 326648991);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function adjustRgb(color: [number, number, number], amount: number): [number, number, number] {
  return [clamp(color[0] + amount), clamp(color[1] + amount), clamp(color[2] + amount)];
}

function mixRgb(color: [number, number, number], target: [number, number, number], amount: number): [number, number, number] {
  const mix = Math.max(0, Math.min(1, amount));
  return [
    clamp(color[0] + (target[0] - color[0]) * mix),
    clamp(color[1] + (target[1] - color[1]) * mix),
    clamp(color[2] + (target[2] - color[2]) * mix)
  ];
}

function glowIntensity(kind: number, energy: number, age: number, time: number) {
  const pulse = (Math.sin(time * 0.01 + age * 0.25) + 1) * 0.5;
  const base = kind === MATERIAL.Stardust || kind === MATERIAL.Moonwater ? 80 : 120;
  return clamp(base + energy * 0.45 + pulse * 55);
}

function glowColorFor(kind: number): [number, number, number] {
  const material = MATERIAL_BY_ID.get(kind as MaterialId);
  return hexToRgb(material?.glow ?? material?.color ?? "#ffffff");
}

function drawMotes(canvas: HTMLCanvasElement, time: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = canvas.clientWidth || 800;
  const height = canvas.clientHeight || 500;
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  for (let i = 0; i < 42; i++) {
    const x = ((i * 83 + time * 0.006 * (i % 5 + 1)) % (width + 80)) - 40;
    const y = (i * 47 + Math.sin(time * 0.001 + i) * 18) % height;
    const alpha = 0.08 + (i % 7) * 0.018;
    ctx.fillStyle = `rgba(246, 221, 168, ${alpha})`;
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
  ctx.restore();
}

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const value = Number.parseInt(cleaned, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
