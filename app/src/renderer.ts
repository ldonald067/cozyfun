import type { SandboxEngine } from "./engine";
import { CELL_STRIDE } from "./materials";
import { readU16 } from "./rendering/cells";
import { colorForCell, glowColorFor, glowIntensity, hasGlow } from "./rendering/materialColor";

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
    const color = colorForCell({ kind, variant, age, energy, time, cells, width, height, x, y });

    base.data[pixelOffset] = color[0];
    base.data[pixelOffset + 1] = color[1];
    base.data[pixelOffset + 2] = color[2];
    base.data[pixelOffset + 3] = 255;

    if (hasGlow(kind)) {
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

export type PostcardOptions = {
  sceneTitle: string;
  moodTitle: string;
  musicSource: string;
};

export async function exportPostcard(engine: SandboxEngine, base: HTMLCanvasElement, glow: HTMLCanvasElement, options: PostcardOptions) {
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
  roundRect(ctx, 58, 58, width + 44, height + 44, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 224, 170, 0.18)";
  ctx.stroke();
  ctx.drawImage(glow, 80, 80, width, height);
  ctx.drawImage(base, 80, 80, width, height);

  ctx.fillStyle = "#f4dfb8";
  ctx.font = "600 30px Georgia, serif";
  ctx.fillText(options.sceneTitle, 80, height + 118);
  ctx.fillStyle = "#99b8c8";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(`${options.moodTitle} - ${options.musicSource} - ${engine.source.toUpperCase()} sim - tick ${engine.tickCount()}`, 80, height + 148);
  ctx.fillStyle = "rgba(255, 226, 177, 0.5)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("cozy pixel sandbox", 80, height + 174);

  const url = card.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `night-desk-terrarium-${Date.now()}.png`;
  anchor.click();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function ensureCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
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
