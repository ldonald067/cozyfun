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
    const cellOffset = i * CELL_STRIDE;
    const kind = cells[cellOffset];
    const variant = cells[cellOffset + 1];
    const age = readU16(cells, cellOffset + 2);
    const energy = readU16(cells, cellOffset + 4);
    const pixelOffset = i * 4;
    const color = colorFor(kind, variant, age, energy, time);
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

function colorFor(kind: number, variant: number, age: number, energy: number, time: number): [number, number, number] {
  if (kind === MATERIAL.Empty) return [9, 14, 20];
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

  if (kind === MATERIAL.Smoke || kind === MATERIAL.Steam) {
    const fade = Math.max(0.35, 1 - age / (kind === MATERIAL.Steam ? 180 : 220));
    r = clamp(r * fade + 9 * (1 - fade));
    g = clamp(g * fade + 14 * (1 - fade));
    b = clamp(b * fade + 20 * (1 - fade));
  }

  return [r, g, b];
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
