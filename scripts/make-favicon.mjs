// Draws the site icon: a cornflower, the game's own species 0.
//
//   node scripts/make-favicon.mjs
//
// The icon is GENERATED rather than checked in as a mystery binary, for the same
// reason the sandbox itself is procedural: the source of truth is a readable cell grid
// plus the game's own palettes.
//
// Colours are IMPORTED, not copied. `SPECIES[0]` (cornflower) comes from
// app/src/rendering/shapeLanguage.ts and the stalk greens from the Stem entry in
// app/src/materials.ts, both compiled to CommonJS the same way the parity and audit
// harnesses do it. An earlier version pasted the hex triples under a comment claiming
// they tracked the app, which is a promise nothing could keep: a palette edit would
// have left the icon quietly wrong forever.
//
//   node scripts/make-favicon.mjs           regenerate the committed icons
//   node scripts/make-favicon.mjs --check   fail if the committed icons are stale
//
// The --check mode runs in `npm run check`, because a generator whose output is
// committed and never verified is just two sources of truth wearing one coat.
//
// Outputs, all into app/public/:
//   favicon.svg          - what modern browsers actually use
//   favicon.ico          - so a bare /favicon.ico request can never 404 again
//   apple-touch-icon.png - iOS home screen; opaque, because Apple masks transparency

import { deflateSync } from "node:zlib";
import { writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "app", "public");
const check = process.argv.includes("--check");

// Pull the real palettes out of the app, compiled to CommonJS exactly as the parity
// and audit harnesses do. Neither module may use `import.meta`, which is already an
// invariant for materials.ts and holds for the renderer.
const cjsDir = path.join(root, ".tmp/favicon-cjs");
await rm(cjsDir, { recursive: true, force: true });
const compiled = spawnSync(
  process.execPath,
  [path.join(root, "app/node_modules/typescript/bin/tsc"),
   "--target", "ES2022", "--module", "CommonJS", "--moduleResolution", "Node", "--lib",
   "ES2022,DOM", "--strict", "true", "--skipLibCheck", "true", "--esModuleInterop", "true",
   "--outDir", cjsDir, "app/src/rendering/shapeLanguage.ts", "app/src/materials.ts"],
  { cwd: root, stdio: "inherit" }
);
if (compiled.status !== 0) throw new Error("make-favicon: TypeScript compile failed");
await writeFile(path.join(cjsDir, "package.json"), JSON.stringify({ type: "commonjs" }));
const require = createRequire(import.meta.url);
const { SPECIES } = require(path.join(cjsDir, "rendering/shapeLanguage.js"));
const { MATERIAL, MATERIALS } = require(path.join(cjsDir, "materials.js"));

const rgb = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const cornflower = SPECIES[0];
const stem = MATERIALS.find((m) => m.id === MATERIAL.Stem);
if (!cornflower?.eye || !stem) throw new Error("make-favicon: the app palettes moved; update this script");

const C = {
  L: rgb(cornflower.light), // petal, lit
  D: rgb(cornflower.dark),  // petal, shaded — outer edge, so the head reads round at 16px
  E: rgb(cornflower.eye),   // the golden disc at the crown
  S: stem.color,            // stalk
  F: stem.palette[3],       // leaf, the flatter green the renderer uses beside a lit stalk
  // Not in any palette module: this is the app shell's own background from styles.css,
  // used only to make the iOS icon opaque.
  bg: "#080c12"
};

// 16x16 cells. Row 0 is the top; a dot is empty.
//
// Drawn to match the pixel-flower reference this project's blooms were designed from:
// a squarish head with a darker rim and a gold centre, over a stalk with a symmetric
// pair of bold leaves. Those leaves are load-bearing — without them a head on a stalk
// reads as a lollipop. The sim's own BLOOM_SHAPES[0] is rounder, which is right on a
// tray where a head is five cells and wrong on an icon that is 16 across in total.
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

// Opaque and padded for iOS: it composites onto its own rounded tile and does not
// honour transparency, so a transparent icon comes out as a black square.
const wanted = [
  ["favicon.svg", Buffer.from(svg(), "utf8")],
  ["favicon.ico", ico(png(32, null), 32)],
  ["apple-touch-icon.png", png(160, C.bg)]
];

await mkdir(outDir, { recursive: true });

if (check) {
  const stale = [];
  for (const [name, bytes] of wanted) {
    const onDisk = await readFile(path.join(outDir, name)).catch(() => null);
    if (!onDisk) stale.push(`${name} is missing`);
    else if (!onDisk.equals(bytes)) stale.push(`${name} does not match the generator`);
  }
  if (stale.length) {
    console.error(
      `\nFavicon check FAILED:\n${stale.map((line) => `  - ${line}`).join("\n")}\n\n` +
        `  The committed icons and scripts/make-favicon.mjs have drifted. Usually this means\n` +
        `  a palette moved under the icon: it colours itself from SPECIES[0] and the Stem\n` +
        `  entry, so a renderer or materials edit changes it. Regenerate and commit:\n\n` +
        `      node scripts/make-favicon.mjs\n`
    );
    process.exit(1);
  }
  console.log(`Favicon check passed: ${wanted.length} committed icons match the generator (${C.L} petals, ${C.E} centre, ${C.S} stalk).`);
} else {
  for (const [name, bytes] of wanted) {
    await writeFile(path.join(outDir, name), bytes);
    console.log(`wrote app/public/${name}`);
  }
}
