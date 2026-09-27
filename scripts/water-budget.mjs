// How much water does the game keep?
//
// No rule in the sim decides how much water a scene holds. What decides it today is the move
// clobber (docs/HARNESS.md, "The move clobber"): moving water deletes water that flowed into
// the same cell a moment earlier, so pours lose some and fountains lose almost everything,
// while still water keeps all of it. `npm run clobber:census` counts those deletions; this
// measures what they add up to, on the shipped wasm build, in the three places a player
// would notice.
//
//   1. A water wellspring on the real 220x140 board. Nothing caps a spring's pour; this is
//      what bounds it. Measured when this tool was written: about 280 cells, 1% of the
//      board, steady from tick 1,000 to 16,000 — and 8,837 cells, 29% of the board, once
//      moving water stopped deleting itself. docs/VISUAL_PIPELINE.md used to credit the
//      bound to "every substrate drinking standing water"; the clobber was doing it.
//   2. Water poured into a basin: how much of what the brush laid down is still there.
//   3. Sand poured into a pond: how much of the pond survives the sand sinking through it.
//
// Since ROADMAP Phase 20B the sink is deliberate — moving water throws mist, and no liquid
// deletes another — and the same three read: spring 7.2%, pour 84% kept, pond 94% kept.
// It reports, and exits 0; each later step of Phase 20 is judged against these numbers.
import { M, loadWasmEngine } from "./interaction-scenes.mjs";

const engine = await loadWasmEngine();

function board(w, h, seed) {
  const b = engine.create(w, h, seed);
  const count = (kind) => {
    const cells = b.view();
    let n = 0;
    for (let i = 0; i < cells.length; i += 8) if (cells[i] === kind) n++;
    return n;
  };
  // Paint and report how many cells of `kind` the stroke actually added.
  const paint = (x, y, r, kind, density = 100) => {
    const before = count(kind);
    b.paint(x, y, r, kind, density);
    return count(kind) - before;
  };
  const ticks = (n) => { for (let t = 0; t < n; t++) b.tick(); };
  return { count, paint, ticks, free: () => b.free() };
}

function basin(b, w, top, bottom, left, right) {
  for (let x = 0; x < w; x++) b.paint(x, bottom + 1, 1, M.Wall);
  for (let y = top; y <= bottom + 1; y++) { b.paint(left, y, 1, M.Wall); b.paint(right, y, 1, M.Wall); }
}

console.log("\nWater budget, on the shipped wasm build.\n");

// 1. The spring. The default brush (radius 4), taught with a single stroke of water.
{
  const W = 220, H = 140;
  const b = board(W, H, 3);
  for (let x = 0; x < W; x++) b.paint(x, H - 2, 1, M.Wall);
  b.paint(110, 100, 4, M.Wellspring);
  b.ticks(5);
  b.paint(110, 94, 1, M.Water);
  const samples = [];
  let t = 0;
  for (const at of [1000, 4000, 16000]) {
    b.ticks(at - t);
    t = at;
    const n = b.count(M.Water);
    samples.push(`tick ${at}: ${n} (${((100 * n) / (W * H)).toFixed(1)}%)`);
  }
  b.free();
  console.log(`  a water wellspring on the 220x140 board   ${samples.join("   ")}`);
}

// 2. Water poured into a walled basin, stroke by stroke, then left to settle.
{
  const W = 40, H = 30;
  const b = board(W, H, 5);
  basin(b, W, 10, 27, 1, 38);
  let painted = 0;
  for (let t = 0; t < 90; t++) { if (t % 3 === 0) painted += b.paint(20, 4, 4, M.Water); b.ticks(1); }
  b.ticks(600);
  const kept = b.count(M.Water);
  b.free();
  console.log(`  water poured into a basin                  ${painted} painted, ${kept} kept (${((100 * kept) / painted).toFixed(0)}%)`);
}

// 3. Sand poured into a standing pond at the default brush and powder density.
{
  const W = 40, H = 30;
  const b = board(W, H, 5);
  basin(b, W, 10, 27, 1, 38);
  for (let y = 18; y <= 26; y++) for (let x = 3; x <= 36; x++) b.paint(x, y, 1, M.Water);
  b.ticks(200);
  const pond = b.count(M.Water);
  let sand = 0;
  for (let t = 0; t < 60; t++) { if (t % 3 === 0) sand += b.paint(20, 4, 4, M.Sand, 55); b.ticks(1); }
  b.ticks(600);
  const kept = b.count(M.Water);
  b.free();
  console.log(`  sand poured into a pond                    ${sand} grains into ${pond} water, ${kept} water kept (${((100 * kept) / pond).toFixed(0)}%)`);
}
