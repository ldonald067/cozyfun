# Scratch (2026-10-29): big flower heads that take turns, as a copy of app/src (never edited).
# python3 .tmp/bighead/bighead.py  ->  .tmp/bighead/m-big/app/src
# Each head is our own design of our own species, drawn as a grid: X is the crown (the cell on
# the stalk tip, always the bottom row so nothing hangs beside the stalk), and every other
# letter is a petal cell and its tone: O rim, P petal, L light, C centre, D dark centre,
# G green (sepal or scape).
import shutil, pathlib, re, json
repo = pathlib.Path(__file__).resolve().parents[2]
ART = {
 0: ["...O.O.O.O...",   # cornflower: a ragged ball of florets on a green scaly cup
     "..OLOLPLOLO..",
     ".OLPPLPLPPLO.",
     "..LPPOPOPPL..",
     ".OLPOPPPOPLO.",
     "..OLPPOPPLO..",
     "...OGGGGGO...",
     "....GGGGG....",
     ".....GGG.....",
     ".....GXG....."],
 1: ["OO.........OO",   # poppy: a wide low bowl, a dark heart round a green seed capsule
     "OPO..OPO..OPO",
     "OPLOOPLPOOLPO",
     "OPLLPDDDPLLPO",
     ".OPLDDSDDLPO.",
     "..OPPDDDPPO..",
     "...OOPXPOO..."],
 2: [".....LLL.....",   # daisy: a star of thin white rays with gaps, a gold eye
     "..L..LPL..L..",
     ".LPL.LPL.LPL.",
     "..LPLCCCLPL..",
     "LLLPPCDCPPLLL",
     "..LPLCCCLPL..",
     ".LPL.LPL.LPL.",
     "..L..LPL..L..",
     ".....LXL....."],
 3: ["...P.P.P.P...",   # sunflower: the biggest; a seeded disc in a ring of rays
     "..PLPLPLPLP..",
     ".PLOOOOOOOLP.",
     "PLODCDCDCDOLP",
     ".PODDCDCDDOP.",
     "PLOCDDDDDCOLP",
     ".PODDCDCDDOP.",
     "PLODCDCDCDOLP",
     ".PLOOOOOOOLP.",
     "..PLPLPLPLP..",
     "...P.PXP.P..."],
 4: ["..O...O...O..",   # tulip: a tall cup with three pointed lips
     "..PO.OPO.OP..",
     "..PLOPLPOLP..",
     "..PLPPLPPLP..",
     "..PLPPLPPLP..",
     "..OPLPPPLPO..",
     "...OPPPPPO...",
     "....OPPPO....",
     ".....OXO....."],
 5: ["......L......",   # lavender: a tall narrow spike of florets
     ".....LPL.....",
     "......P......",
     ".....PLP.....",
     "....LPPPL....",
     ".....PLP.....",
     "....LPDPL....",
     ".....PDP.....",
     "....LPPPL....",
     ".....PDP.....",
     ".....GXG....."],
 6: [".......GGGG..",   # bluebell: a scape that arches over, bells hanging off it
     "......GG..G..",
     "......G..OPO.",
     "......G..PLP.",
     "....GGG..O.O.",
     "..OPO.G......",
     "..PLP.G......",
     "..O.O.GGG....",
     "......G.OPO..",
     "......G.PLP..",
     "......X.O.O.."],
 7: ["....OPPPO....",   # cosmos: broad petals with open gaps between, round a gold centre
     "....PLLLP....",
     ".O...PLP...O.",
     "OLO..OPO..OLO",
     "OLLPPOCOPPLLO",
     ".OPPPCDCPPPO.",
     "OLLPPOCOPPLLO",
     "OLO..OPO..OLO",
     ".O...PLP...O.",
     "....PLLLP....",
     "....OPXPO...."],
}
shapes, tones, reach = [], [], []
for v in range(8):
    rows = ART[v]
    assert all(len(r) == 13 for r in rows), v
    cells = {(x, y): ch for y, r in enumerate(rows) for x, ch in enumerate(r) if ch != "."}
    (cx, cy), = [p for p, ch in cells.items() if ch == "X"]
    assert cy == len(rows) - 1, (v, "crown must be on the bottom row")
    # Opening order: breadth-first from the crown, so a head opens outward and every petal
    # touches one already open (the sim's own rule for a shape).
    order, seen, frontier = [], {(cx, cy)}, [(cx, cy)]
    while frontier:
        nxt = []
        for (x, y) in frontier:
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                p = (x + dx, y + dy)
                if p in cells and p not in seen:
                    seen.add(p); nxt.append(p); order.append(p)
        frontier = nxt
    assert len(seen) == len(cells), (v, "disconnected", sorted(set(cells) - seen))
    offs = [(x - cx, y - cy) for (x, y) in order]
    assert all(not (dx == 0 and dy > 0) for dx, dy in offs)
    shapes.append(offs)
    # The crown takes its neighbours' tone: green where the head meets a green scape or sepal.
    crown_tone = "G" if any(cells.get(p) == "G" for p in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1))) else "P"
    tones.append({f"{x - cx},{y - cy}": (crown_tone if ch == "X" else ch) for (x, y), ch in cells.items()})
    dxs = [o[0] for o in offs]; dys = [o[1] for o in offs]
    reach.append([min(dxs), max(dxs), min(dys), max(dys)])
    print(v, len(offs) + 1, "cells", reach[-1])

dst = repo / ".tmp/bighead/m-big/app/src"
shutil.rmtree(dst.parent.parent, ignore_errors=True)
shutil.copytree(repo / "app/src", dst)

def edit(path, pairs):
    s = path.read_text()
    for a, b in pairs:
        assert s.count(a) == 1, (path.name, a[:70])
        s = s.replace(a, b)
    path.write_text(s)

eng = dst / "engine.ts"
s = eng.read_text()
start = s.index("export const BLOOM_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [")
end = s.index("];", start) + 2
s = s[:start] + "export const BLOOM_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = " + json.dumps(shapes) + ";" + s[end:]
eng.write_text(s)
edit(eng, [
 ("const BLOOM_ENERGY = 200;\nconst BLOOM_ENERGY_COSMIC = 250;", "const BLOOM_ENERGY = 250;\nconst BLOOM_ENERGY_COSMIC = 255;"),
 ("const PETAL_COST = 2;", "const PETAL_COST = 1;"),
 ("    if (energy > POLLEN_RESERVE && age > 24 && this.chance(cosmic ? 90 : 200)) {",
  "    // MOCK: a bud waiting its turn makes no pollen, or it spends the budget it opens with.\n    if (energy > POLLEN_RESERVE && age > 24 && !(flags & CELL_FLAG.Rooted && !this.flowerTouches(x, y, old)) && this.chance(cosmic ? 90 : 200)) {"),
 ("    if (flags & CELL_FLAG.Rooted && energy > CROWN_RESERVE && age > 12 && this.chance(cosmic ? 8 : 12)) {\n      const petal = this.nextPetalSite(x, y, cell[1], old, next);\n      if (petal >= 0) {",
  "    // MOCK: a bud waits while another head is open within reach, and opens fast.\n    if (flags & CELL_FLAG.Rooted && energy > CROWN_RESERVE && age > 12 && !this.headInReach(x, y, old, next) && this.chance(cosmic ? 2 : 3)) {\n      const petal = this.nextPetalSite(x, y, cell[1], old, next);\n      if (petal >= 0) {\n        // MOCK: a head's arc starts when it opens, not when its bud formed.\n        if (!this.flowerTouches(x, y, old)) writeU16(next, idx + 2, 0);"),
 ("        (kind === MATERIAL.Flower && age % BLOOM_CLOCK !== 0) ||",
  "        (kind === MATERIAL.Flower && (age % BLOOM_CLOCK !== 0 || this.waitingBud(cellIndex, next))) ||"),
 ("  private stem(", """  // MOCK: another rooted crown within a big head's reach with a petal open beside it.
  private headInReach(x: number, y: number, old: Uint8Array, next: Uint8Array) {
    for (let cy = Math.max(0, y - 10); cy <= Math.min(this.h - 1, y + 10); cy++) {
      for (let cx = Math.max(0, x - 12); cx <= Math.min(this.w - 1, x + 12); cx++) {
        if (cx === x && cy === y) continue;
        const at = this.index(cx, cy);
        for (const cells of [old, next]) {
          if (cells[at] !== MATERIAL.Flower || !(readU16(cells, at + 6) & CELL_FLAG.Rooted)) continue;
          if (this.flowerTouches(cx, cy, cells)) return true;
        }
      }
    }
    return false;
  }

  private flowerTouches(x: number, y: number, cells: Uint8Array) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      if (this.inBounds(x + dx, y + dy) && cells[this.index(x + dx, y + dy)] === MATERIAL.Flower) return true;
    }
    return false;
  }

  // MOCK: a bud waiting its turn keeps its budget.
  private waitingBud(cellIndex: number, cells: Uint8Array) {
    const idx = cellIndex * CELL_STRIDE;
    if (!(readU16(cells, idx + 6) & CELL_FLAG.Rooted)) return false;
    const x = cellIndex % this.w, y = Math.floor(cellIndex / this.w);
    if (this.flowerTouches(x, y, cells)) return false;
    return readU16(cells, idx + 2) <= PETAL_SHED_AGE || readU16(cells, idx + 4) >= POLLEN_RESERVE;
  }

  private stem("""),
])

shape = dst / "rendering/shapeLanguage.ts"
s = shape.read_text()
start = s.index("export const FLOWER_REACH: readonly (readonly [number, number, number, number])[] = [")
end = s.index("];", start) + 2
s = s[:start] + "export const FLOWER_REACH: readonly (readonly [number, number, number, number])[] = " + json.dumps(reach) + ";\n// MOCK: each big head's tone per offset from its crown.\nconst BIG_TONES: readonly Record<string, string>[] = " + json.dumps(tones) + ";\n" + """function bigTone(variant: number, species: Species, dx: number, dy: number): Rgb | null {
  const tone = BIG_TONES[variant & 7][`${dx},${dy}`];
  if (!tone) return null;
  const eye = species.eye;
  switch (tone) {
    case "O": return mixRgb(species.dark, [24, 16, 34], 0.38);
    case "P": return mixRgb(species.light, species.dark, 0.42);
    case "L": return mixRgb(species.light, [255, 255, 255], 0.22);
    case "C": return eye ? eye : mixRgb(species.light, [255, 255, 255], 0.5);
    // A near-black eye (the poppy's) would match the night sky, so its dark is the petal's own.
    case "D": return eye && eye[0] + eye[1] + eye[2] > 200 ? mixRgb(eye, [0, 0, 0], 0.42) : mixRgb(species.dark, [0, 0, 0], 0.45);
    case "G": return [92, 156, 76];
    case "S": return [128, 150, 96];
    default: return null;
  }
}
""" + s[end:]
shape.write_text(s)
edit(shape, [
 ("  } else if (rooted) {\n    out = eyeColour(variant, species, x, y, hash);",
  "  } else if (rooted) {\n    out = bigTone(variant, species, 0, 0) ?? eyeColour(variant, species, x, y, hash);"),
 ("      out = petalColour(variant, species, crown.dx, crown.dy, opening, isFlower);",
  "      out = bigTone(variant, species, crown.dx, crown.dy) ?? petalColour(variant, species, crown.dx, crown.dy, opening, isFlower);"),
])
print("mock written to", dst)
