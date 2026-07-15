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
    const flags = readU16(cells, cellOffset + 6);
    const pixelOffset = i * 4;
    const color = colorForCell({ kind, variant, age, energy, flags, time, cells, width, height, x, y });

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
  soundSource: string;
  discoveries?: string;
};

export async function exportPostcard(engine: SandboxEngine, base: HTMLCanvasElement, glow: HTMLCanvasElement, options: PostcardOptions) {
  const scale = 3;
  const width = base.width * scale;
  const height = base.height * scale;
  const card = document.createElement("canvas");
  const margin = 80;
  const footerHeight = 190;
  card.width = width + margin * 2;
  card.height = height + margin + footerHeight;
  const ctx = card.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const gradient = ctx.createLinearGradient(0, 0, card.width, card.height);
  gradient.addColorStop(0, "#0d121b");
  gradient.addColorStop(0.45, "#18202a");
  gradient.addColorStop(1, "#1f2830");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, card.width, card.height);

  ctx.fillStyle = "rgba(255, 224, 170, 0.08)";
  roundRect(ctx, margin - 22, margin - 22, width + 44, height + 44, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 224, 170, 0.18)";
  ctx.stroke();
  ctx.drawImage(glow, margin, margin, width, height);
  ctx.drawImage(base, margin, margin, width, height);

  const footerY = margin + height + 48;
  ctx.fillStyle = "#f4dfb8";
  ctx.font = "600 30px Georgia, serif";
  drawFittedText(ctx, options.sceneTitle, margin, footerY, width);
  ctx.fillStyle = "#99b8c8";
  ctx.font = "18px system-ui, sans-serif";
  drawFittedText(ctx, `${options.moodTitle} / ${options.soundSource}`, margin, footerY + 32, width);
  ctx.fillStyle = "rgba(153, 184, 200, 0.82)";
  ctx.font = "15px system-ui, sans-serif";
  const simLine = `${engine.source.toUpperCase()} sim  |  tick ${engine.tickCount()}  |  ${dateStamp()}`;
  drawFittedText(ctx, options.discoveries ? `${simLine}  |  ✦ ${options.discoveries}` : simLine, margin, footerY + 60, width);
  ctx.fillStyle = "rgba(255, 226, 177, 0.5)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("cozy pixel sandbox", margin, footerY + 92);

  await downloadCanvas(card, `${exportSlug(options.sceneTitle)}-${dateStamp()}.png`, "image/png");
}

export async function exportClip(engine: SandboxEngine, base: HTMLCanvasElement, glow: HTMLCanvasElement, options: PostcardOptions) {
  if (!("MediaRecorder" in window) || !("captureStream" in HTMLCanvasElement.prototype)) return false;

  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = base.width * scale;
  canvas.height = base.height * scale + 74;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const stream = canvas.captureStream(12);
  const mimeType = clipMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    return false;
  }
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<Blob>((resolve) => {
    recorder.addEventListener(
      "stop",
      () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(chunks, { type: "video/webm" }));
      },
      { once: true }
    );
  });

  const started = performance.now();
  const duration = 3200;
  recorder.start();

  await new Promise<void>((resolve) => {
    const draw = (time: number) => {
      drawClipFrame(ctx, canvas, base, glow, engine, options);
      if (time - started >= duration) {
        resolve();
        return;
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });

  recorder.stop();
  const blob = await stopped;
  if (blob.size === 0) return false;
  downloadBlob(blob, `${exportSlug(options.sceneTitle)}-${dateStamp()}.webm`);
  return true;
}

function clipMimeType() {
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string, type: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type));
  if (!blob) return;
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function drawClipFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  base: HTMLCanvasElement,
  glow: HTMLCanvasElement,
  engine: SandboxEngine,
  options: PostcardOptions
) {
  const sceneHeight = canvas.height - 74;
  ctx.fillStyle = "#0d121b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.72;
  ctx.drawImage(glow, 0, 0, canvas.width, sceneHeight);
  ctx.globalAlpha = 1;
  ctx.drawImage(base, 0, 0, canvas.width, sceneHeight);
  ctx.fillStyle = "rgba(13, 18, 27, 0.92)";
  ctx.fillRect(0, sceneHeight, canvas.width, 74);
  ctx.fillStyle = "#f4dfb8";
  ctx.font = "600 24px Georgia, serif";
  drawFittedText(ctx, options.sceneTitle, 24, sceneHeight + 31, canvas.width - 48);
  ctx.fillStyle = "#99b8c8";
  ctx.font = "15px system-ui, sans-serif";
  drawFittedText(ctx, `${options.moodTitle} - ${options.soundSource} - ${engine.source.toUpperCase()} sim - tick ${engine.tickCount()}`, 24, sceneHeight + 56, canvas.width - 48);
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

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  const suffix = "...";
  let fitted = text;
  while (fitted.length > 0 && ctx.measureText(`${fitted}${suffix}`).width > maxWidth) fitted = fitted.slice(0, -1);
  ctx.fillText(`${fitted}${suffix}`, x, y);
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

function exportSlug(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `night-desk-terrarium-${slug}` : "night-desk-terrarium";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
