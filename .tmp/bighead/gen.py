# Scratch: write the big heads into sim/src/lib.rs and app/src/engine.ts from the designs in
# bighead.py (opening order breadth-first from the crown). python3 .tmp/bighead/gen.py
import pathlib, re
repo = pathlib.Path(__file__).resolve().parents[2]
src = (repo / ".tmp/bighead/bighead.py").read_text()
ns = {}
exec(src[src.index("ART = {"):src.index("shapes, tones, reach = [], [], []")], ns)
ART = ns["ART"]
NOTES = [
 "Cornflower: a ragged ball of florets on a green scaly cup.",
 "Poppy: a wide low bowl, a dark heart round a green seed capsule.",
 "Daisy: a star of thin white rays with gaps, a gold eye.",
 "Sunflower: the biggest, a seeded disc in a ring of rays.",
 "Tulip: a tall cup with three pointed lips.",
 "Lavender: a tall narrow spike of florets.",
 "Bluebell: a scape that arches over, bells hanging off it.",
 "Cosmos: broad petals with open gaps between, round a gold centre.",
]
shapes = []
for v in range(8):
    rows = ART[v]
    cells = {(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch != "."}
    (cx, cy), = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "X"]
    order, seen, frontier = [], {(cx, cy)}, [(cx, cy)]
    while frontier:
        nxt = []
        for (x, y) in frontier:
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                p = (x + dx, y + dy)
                if p in cells and p not in seen:
                    seen.add(p); nxt.append(p); order.append(p)
        frontier = nxt
    assert len(seen) == len(cells)
    shapes.append([(x - cx, y - cy) for (x, y) in order])

rust = """/// Per-plant bloom silhouettes, chosen by `variant & 7` exactly as the renderer picks the
/// plant's hue and tones: `HEAD_ART` in `app/src/rendering/shapeLanguage.ts` draws each head as a
/// grid, and `renderer:probe` holds these offsets to it cell for cell. Offsets are relative to the
/// crown, the cell on the stalk's tip, which is the bottom of every head, so no petal opens beside
/// the stalk where leaves grow. Petals open breadth-first from the crown: a head opens outward and
/// every petal touches one already open, so a half-open bloom is never a scatter of cells.
///
/// Heads are up to 13 cells across and 11 tall, the owner's pick (2026-10-29) from a close-up
/// against the old heads of 3 to 7 cells, which read as blobs of one colour: at this size a
/// species has room for a rim, gaps and a centre. Lined up at the crown, no two outlines share
/// more than 71% of their cells (cornflower and tulip); the old heads' worst pair was 75%.
const BLOOM_SHAPES: [&[(i32, i32)]; 8] = [
"""
for v, s in enumerate(shapes):
    rust += f"    // {v} {NOTES[v]}\n    &[" + ", ".join(f"({dx}, {dy})" for dx, dy in s) + "],\n"
rust += "];\n"
ts = """// Per-plant bloom silhouettes, chosen by `variant & 7`. Offsets are relative to the crown, at
// the bottom of the head, and open in listed order. Mirrors BLOOM_SHAPES in sim/src/lib.rs.
export const BLOOM_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
"""
for v, s in enumerate(shapes):
    ts += f"  // {v} {NOTES[v].split(':')[0]}\n  [" + ", ".join(f"[{dx}, {dy}]" for dx, dy in s) + "],\n"
ts += "];\n"

lib = repo / "sim/src/lib.rs"; s = lib.read_text()
a = s.index("/// Per-plant bloom silhouettes")
b = s.index("];\n", s.index("const BLOOM_SHAPES: [&[(i32, i32)]; 8] = [")) + 3
s = s[:a] + rust + s[b:]
lib.write_text(s)
eng = repo / "app/src/engine.ts"; t = eng.read_text()
a = t.index("// Per-plant bloom silhouettes")
b = t.index("];\n", t.index("export const BLOOM_SHAPES: ReadonlyArray")) + 3
t = t[:a] + ts + t[b:]
eng.write_text(t)
print([len(s) for s in shapes])
