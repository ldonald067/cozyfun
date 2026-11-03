# Build candidate copies of app/src under .tmp/flowers-depth/<name>/app/src, patching shapeLanguage.ts only.
import shutil, subprocess, sys, pathlib
repo = pathlib.Path(__file__).resolve().parents[2]
here = pathlib.Path(__file__).resolve().parent
COMMON = '''
// --- flowers-depth candidate helpers (scratch) ---
const RAMP_SHADE: Rgb = [44, 12, 64];
const RAMP_LIGHT: Rgb = [255, 244, 224];
function deepOf(species: Species): Rgb { return mixRgb(species.dark, RAMP_SHADE, 0.42); }
'''
A = '''
// A: lit from above. Top faces catch a warm light, undersides fall into a deep shade of the hue.
function depth(out: Rgb, variant: number, species: Species, dx: number, dy: number, opening: boolean, isFlower: (ox: number, oy: number) => boolean): Rgb {
  const ring = Math.max(Math.abs(dx), Math.abs(dy));
  if (ring === 1 && !opening && species.eye !== null) return out;
  const top = !isFlower(0, -1), bottom = !isFlower(0, 1), left = !isFlower(-1, 0), right = !isFlower(1, 0);
  const deep = deepOf(species);
  if (bottom) return mixRgb(out, deep, left || right ? 0.8 : 0.62);
  if (right && !top) return mixRgb(out, deep, 0.45);
  if (top) return mixRgb(out, RAMP_LIGHT, left ? 0.5 : 0.34);
  if (left) return mixRgb(out, RAMP_LIGHT, 0.2);
  return out;
}
'''
B = '''
// B: layered rings. A deep rim of the hue all round, a lighter body inside it, the mark at the centre.
function depth(out: Rgb, variant: number, species: Species, dx: number, dy: number, opening: boolean, isFlower: (ox: number, oy: number) => boolean): Rgb {
  const ring = Math.max(Math.abs(dx), Math.abs(dy));
  if (ring === 1 && !opening && species.eye !== null) return out;
  const top = !isFlower(0, -1), bottom = !isFlower(0, 1), left = !isFlower(-1, 0), right = !isFlower(1, 0);
  const exposed = +top + +bottom + +left + +right;
  const deep = deepOf(species);
  if (exposed > 0 && (species.eye === null || ring >= 2)) return mixRgb(out, deep, top && !bottom && exposed === 1 ? 0.4 : 0.7);
  return mixRgb(out, RAMP_LIGHT, dy < 0 && dx <= 0 ? 0.45 : 0.24);
}
'''
NONE = '''
function depth(out: Rgb, ..._rest: unknown[]): Rgb { return out; }
'''
OUTLINE_OLD = '''  for (const [dx, dy] of directions) {
    if (kindAt(cells, width, height, x + dx, y + dy) !== MATERIAL.Flower) continue;
    const base = ((y + dy) * width + x + dx) * CELL_STRIDE;
    if (readU16(cells, base + 6) & CELL_FLAG.Rooted) continue;
    const flags = readU16(cells, base + 6);
    let ring = deepOf(SPECIES[cells[base + 1] & 7]);
    if (flags & CELL_FLAG.Scorched) ring = mixRgb(CHAR, BLACK, 0.3);
    else if (flags & CELL_FLAG.Frozen) ring = mixRgb(FROST, ring, 0.55);
    else if (flags & CELL_FLAG.Cosmic) ring = mixRgb(ring, STARLIGHT, 0.4);
    return mixRgb(ring, background, 0.3);
  }
  return background;
}
'''
OUTLINE = '''  if (ringed >= 0) {
    const base = ringed;
    const flags = readU16(cells, base + 6);
    let ring = deepOf(SPECIES[cells[base + 1] & 7]);
    if (flags & CELL_FLAG.Scorched) ring = mixRgb(CHAR, BLACK, 0.3);
    else if (flags & CELL_FLAG.Frozen) ring = mixRgb(FROST, ring, 0.55);
    else if (flags & CELL_FLAG.Cosmic) ring = mixRgb(ring, STARLIGHT, 0.4);
    return mixRgb(ring, background, 0.3);
  }
  return background;
}
'''
OLD_LOOP = '''  for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i];
    if (kindAt(cells, width, height, x + dx, y + dy) !== MATERIAL.Stardust) continue;'''
NEW_LOOP = '''  let ringed = -1;
  for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i];
    const near = kindAt(cells, width, height, x + dx, y + dy);
    if (near === MATERIAL.Flower && ringed < 0) {
      const at = ((y + dy) * width + x + dx) * CELL_STRIDE;
      if (!(readU16(cells, at + 6) & CELL_FLAG.Rooted)) ringed = at;
    }
    if (near !== MATERIAL.Stardust) continue;'''
VARIANTS = {"today": (NONE, False), "A": (A, False), "B": (B, False), "C": (NONE, True), "AC": (A, True)}
for name in sys.argv[1:] or VARIANTS:
    body, outline = VARIANTS[name]
    root = here / name
    if root.exists(): shutil.rmtree(root)
    root.mkdir(parents=True)
    subprocess.run(f"git -C {repo} archive HEAD app/src | tar -x -C {root}", shell=True, check=True)
    f = root / "app/src/rendering/shapeLanguage.ts"
    s = f.read_text()
    call = "out = petalColour(variant, species, crown.dx, crown.dy, opening, isFlower);"
    assert s.count(call) == 1
    s = s.replace(call, call + "\n      out = depth(out, variant, species, crown.dx, crown.dy, opening, isFlower);")
    if outline:
        tail = "  return background;\n}\n"
        i = s.index(tail, s.index("export function emptyCellColor"))
        s = s[:i] + OUTLINE + s[i + len(tail):]
        assert s.count(OLD_LOOP) == 1
        s = s.replace(OLD_LOOP, NEW_LOOP)
    s += COMMON + body
    f.write_text(s)
    print("built", name)
