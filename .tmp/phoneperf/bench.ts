// Scratch (2026-10-30): the real renderSandbox on three boards, for a phone. Built into
// page.html by build.mjs, from the source tree, so it times exactly what ships.
import { createFallbackEngine } from "../../app/src/engine";
import { CELL_STRIDE, MATERIAL as M } from "../../app/src/materials";
import { renderSandbox } from "../../app/src/renderer";

const W = 220, H = 140;
const $ = (id: string) => document.getElementById(id)!;
type Board = { id: string; cells: () => Uint8Array };

function filled(pick: (x: number, y: number) => number) {
  const cells = new Uint8Array(W * H * CELL_STRIDE);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * CELL_STRIDE;
    cells[o] = pick(x, y); cells[o + 1] = (x * 7 + y * 3) & 255; cells[o + 2] = (x + y) & 127;
  }
  return cells;
}
function played() {
  // Painted materials played forward, as a person leaves a board.
  const e = createFallbackEngine(W, H, 11), p = e.paint.bind(e);
  for (let x = 0; x < W; x += 3) p(x, 134, 2, M.Stone);
  for (let x = 20; x < 90; x += 3) p(x, 124, 3, M.Soil);
  for (let x = 24; x < 86; x += 6) p(x, 110, 1, M.Seed, 55);
  for (let x = 110; x < 200; x += 4) p(x, 100, 3, M.Water);
  for (let x = 120; x < 190; x += 4) p(x, 90, 1, M.Oil);
  for (let x = 30; x < 80; x += 5) p(x, 96, 2, M.Water, 55);
  for (let x = 96; x < 108; x += 3) p(x, 112, 3, M.Sand);
  for (let i = 0; i < 400; i++) e.tick();
  p(150, 70, 3, M.Fire, 55);
  for (let i = 0; i < 20; i++) e.tick();
  return e.getCellBytes().slice();
}
const BOARDS: Board[] = [
  { id: "water", cells: () => filled((_, y) => (y > H / 3 ? M.Water : 0)) },
  { id: "heat", cells: () => filled((_, y) => (y > 70 ? M.Lava : y > 35 ? M.Smoke : y > 25 ? M.Fire : 0)) },
  { id: "moonoil", cells: () => filled((x, y) => (y <= H / 3 ? 0 : x < W / 2 ? M.Moonwater : M.Oil)) },
  { id: "garden", cells: played },
];

// A desktop run pasted back reads just like a phone's, as one did on 2026-10-31. An iPad calls itself a Mac, so touch settles that.
const isPhone = /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
$("device").hidden = isPhone;

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));
const quantile = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * q)];

async function run() {
  const button = $("run") as HTMLButtonElement;
  const targets = { base: $("base") as HTMLCanvasElement, glow: $("glow") as HTMLCanvasElement, motes: $("motes") as HTMLCanvasElement, display: $("display") as HTMLCanvasElement };
  button.disabled = true; $("state").textContent = "Finding the screen's rate";
  const idle: number[] = [];
  let last = await nextFrame();
  for (let i = 0; i < 40; i++) { const t = await nextFrame(); idle.push(t - last); last = t; }
  const refresh = Math.round(1000 / quantile(idle, 0.5));
  const lines = [`phone timer ${__BUILD__} | ${navigator.userAgent}`, `device: ${isPhone ? "phone" : "NOT A PHONE"}`, `screen ${refresh} Hz, ${devicePixelRatio}x`];
  for (const { id, cells } of BOARDS) {
    $("state").textContent = `Timing ${$(id + "-name").textContent}`;
    await nextFrame();
    const bytes = cells();
    const engine = { width: () => W, height: () => H, getCellBytes: () => bytes } as never;
    const render: number[] = [], gap: number[] = [];
    let previous = 0;
    for (let f = 0; f < 150; f++) {
      const time = await nextFrame();
      if (f >= 30) gap.push(time - previous);
      const t0 = performance.now();
      renderSandbox(engine, targets, time);
      if (f >= 30) render.push(performance.now() - t0);
      previous = time;
    }
    const mean = render.reduce((a, b) => a + b, 0) / render.length;
    const fps = 1000 / (gap.reduce((a, b) => a + b, 0) / gap.length);
    const slow = quantile(render, 0.95);
    $(id + "-ms").textContent = mean.toFixed(1);
    $(id + "-p95").textContent = slow.toFixed(1);
    $(id + "-fps").textContent = fps.toFixed(0);
    ($(id + "-bar") as HTMLElement).style.width = Math.min(100, (mean / (1000 / 60)) * 100) + "%";
    lines.push(`${id}: ${mean.toFixed(1)} ms mean, ${slow.toFixed(1)} ms p95, ${fps.toFixed(0)} fps`);
  }
  const text = lines.join("\n");
  $("out").textContent = text; $("out").hidden = false;
  $("state").textContent = isPhone ? "Done. Copy the numbers and paste them into the chat." : "Done, but on a computer, so these are not phone numbers.";
  button.disabled = false; button.textContent = "Run again";
  ($("copy") as HTMLButtonElement).hidden = false;
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(text); $("copy").textContent = "Copied"; }
    catch { getSelection()?.selectAllChildren($("out")); $("copy").textContent = "Selected: copy it from the menu"; }
  };
}
declare const __BUILD__: string;
$("run").onclick = () => void run();
