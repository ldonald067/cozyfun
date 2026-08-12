// Draws the site icon: a cornflower, the game's own species 0.
//
//   node scripts/make-favicon.mjs
//
// The icon is GENERATED rather than checked in as a mystery binary, for the same
// reason the sandbox itself is procedural: the source of truth is a readable cell
// grid, the colours are lifted from the game's real palettes, and regenerating it
// after a palette change is one command instead of a round trip through an editor.
//
// Colours come from `SPECIES[0]` in app/src/rendering/shapeLanguage.ts (cornflower)
// and the Stem palette in app/src/materials.ts. The silhouette is the same shape the
// sim grows: BLOOM_SHAPES[0], a round head with its corners knocked off, on a stalk
// with leaves on alternating sides.
//
// Outputs, all into app/public/:
//   favicon.svg          - what modern browsers actually use
//   favicon.ico          - so a bare /favicon.ico request can never 404 again
//   apple-touch-icon.png - iOS home screen; opaque, because Apple masks transparency
//
// The 404 these fix went unnoticed for months because the local QA server answered
// /favicon.ico with a 204. That shim is gone; see docs/HARNESS.md.

import { deflateSync } from "node:zlib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "app", "public");

// SPECIES[0] cornflower + the Stem palette. Keep these in step with the app.
const C = {
  L: "#7ebcf2", // petal, lit
  D: "#3a7ac8", // petal, shaded — outer edge, so the head reads round at 16px
  E: "#ffd868", // the golden disc at the crown
  S: "#7cc258", // stalk
  F: "#4c8f38", // leaf, the flatter green the renderer uses beside a lit stalk
  bg: "#080c12" // the app's own night background, for the opaque iOS icon
};

// 16x16 cells. Row 0 is the top; a dot is empty.
//
// Drawn to match the pixel-flower reference this project's blooms were designed from:
// a squarish head with a darker rim and a gold centre, over a stalk with bold leaves
// in a symmetric pair. Two earlier passes were wrong about that. At 8x8 the head was
// too coarse to be anything but a blue box, and at 16 with a *round* head plus two
// small offset leaves it read as a lollipop — the reference's leaves are large, and
// they are most of what makes a stick with a blob on top read as a flower.
//
// The sim's own BLOOM_SHAPES[0] is rounder than this, which is right on a 220x140
// tray where a head is five cells. An icon is 16 across in total; it needs the
// reference's blockier read, not a faithful scale model of the in-game silhouette.
const GRID = [
  "................",
  "....DDDDDDDD....",
  "...DDLLLLLLDD...",
  "...DLLLLLLLLD...",
  "...DLLLEELLLD...",
  "...DLLLEELLLD...",
  "...DLLLLLLLLD...",
  "...DDLLLLLLDD...",
  "....DDDDDDDD....",
  ".......SS.......",
  ".....FFSSFF.....",
  "...FFFFSSFFFF...",
  ".......SS.......",
  ".......SS.......",
  ".......SS.......",
  ".......SS......."
];
const CELLS = GRID.length;

function cellsWithColor() {
  const out = [];
  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      const key = GRID[y][x];
      if (key !== ".") out.push({ x, y, fill: C[key] });
    }
  }
  return out;
}

// ── SVG ──────────────────────────────────────────────────────────────────────
function svg() {
  const rects = cellsWithColor()
    .map(({ x, y, fill }) => `<rect x="${x * 2}" y="${y * 2}" width="2" height="2" fill="${fill}"/>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <title>Night Desk Terrarium</title>
  ${rects}
</svg>
`;
}

// ── PNG ──────────────────────────────────────────────────────────────────────
// A minimal encoder: truecolour+alpha, one IDAT, no filtering. Small icons do not
// need a filter heuristic, and hand-rolling it keeps this script dependency-free.
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function hex(value) {
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
}

/** Render the grid at `size` px. `background` null means transparent. */
function png(size, background) {
  const scale = size / CELLS;
  if (!Number.isInteger(scale)) throw new Error(`icon size ${size} is not a whole multiple of ${CELLS}`);
  const pixels = Buffer.alloc(size * size * 4);
  if (background) {
    const [r, g, b] = hex(background);
    for (let i = 0; i < size * size; i++) pixels.set([r, g, b, 255], i * 4);
  }
  for (const { x, y, fill } of cellsWithColor()) {
    const [r, g, b] = hex(fill);
    for (let py = y * scale; py < (y + 1) * scale; py++) {
      for (let px = x * scale; px < (x + 1) * scale; px++) {
        pixels.set([r, g, b, 255], (py * size + px) * 4);
      }
    }
  }
  // Prepend the per-scanline filter byte (0 = none).
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/** ICO wrapping a single PNG — allowed since Vista and far simpler than a DIB. */
function ico(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);  // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

await mkdir(outDir, { recursive: true });
const written = [];

await writeFile(path.join(outDir, "favicon.svg"), svg());
written.push("favicon.svg");

const icoPng = png(32, null);
await writeFile(path.join(outDir, "favicon.ico"), ico(icoPng, 32));
written.push("favicon.ico");

// Opaque and padded: iOS composites onto its own rounded tile and does not honour
// transparency, so a transparent icon comes out as a black square.
await writeFile(path.join(outDir, "apple-touch-icon.png"), png(160, C.bg));
written.push("apple-touch-icon.png");

for (const name of written) console.log(`wrote app/public/${name}`);
