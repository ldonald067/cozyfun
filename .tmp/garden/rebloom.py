# Scratch (2026-10-29): rain re-bloom prototypes as find/replace copies of app/src (never edited).
# python3 .tmp/garden/rebloom.py  ->  .tmp/garden/r-{today,drink,turnover}/app/src
import shutil, pathlib
repo = pathlib.Path(__file__).resolve().parents[2]
STEM_HEAD = """    const energy = readU16(old, idx + 4);
    if (energy <= 20 || y === 0) return;
    const above = this.index(x, y - 1);"""
FLOWER_HEAD = """    const cosmic = Boolean(flags & CELL_FLAG.Cosmic);

    // The crown is the one cell the stalk produced."""
WET = """const touchesWater = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
      if (!this.inBounds(x + dx, y + dy)) return false;
      const at = this.index(x + dx, y + dy);
      // Fresh water only: a drop or a pour that arrived in the last ten seconds, not a puddle.
      return (old[at] === MATERIAL.Water || old[at] === MATERIAL.Moonwater) && readU16(old, at + 2) < 200;
    });"""
CROWN_OF = """  // PROTO: the rooted crown this stalk cell or leaf belongs to; -2 for a stalk still growing
  // (no crown yet), -1 for none (its head is gone).
  private crownOf(x: number, y: number, old: Uint8Array) {
    for (const cx of [x, x - 1, x + 1]) {
      if (!this.inBounds(cx, y) || old[this.index(cx, y)] !== MATERIAL.Stem) continue;
      let top = y;
      while (top > 0 && old[this.index(cx, top - 1)] === MATERIAL.Stem) top--;
      if (top === 0) continue;
      const above = this.index(cx, top - 1);
      if (old[above] === MATERIAL.Flower && readU16(old, above + 6) & CELL_FLAG.Rooted) return above;
      if (readU16(old, this.index(cx, top) + 4) > 20) return -2;
    }
    return -1;
  }

  private stem("""
DRINK = [
  (STEM_HEAD, """    const energy = readU16(old, idx + 4);
    // PROTO A: water touching a spent plant anywhere wakes its seed head into a fresh bud.
    if (energy <= 20) {
      """ + WET + """
      if (touchesWater && this.chance(8)) {
        const crown = this.crownOf(x, y, old);
        if (crown >= 0 && readU16(old, crown + 2) > PETAL_SHED_AGE && readU16(old, crown + 4) < POLLEN_RESERVE) {
          writeU16(next, crown + 4, BLOOM_ENERGY);
          writeU16(next, crown + 2, 0);
        }
      }
    }
    if (energy <= 20 || y === 0) return;
    const above = this.index(x, y - 1);"""),
  (FLOWER_HEAD, """    const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
    if (flags & CELL_FLAG.Rooted && age > PETAL_SHED_AGE && energy < POLLEN_RESERVE) {
      """ + WET + """
      if (touchesWater && this.chance(8)) {
        writeU16(next, idx + 4, BLOOM_ENERGY);
        writeU16(next, idx + 2, 0);
        return;
      }
    }

    // The crown is the one cell the stalk produced."""),
  ("  private stem(", CROWN_OF),
]
TURNOVER = [
  (STEM_HEAD, """    const energy = readU16(old, idx + 4);
    // PROTO B: a stalk or leaf whose head is gone withers away.
    if (energy <= 20 && this.crownOf(x, y, old) === -1 && this.chance(40)) {
      next.fill(0, idx, idx + CELL_STRIDE);
      return;
    }
    if (energy <= 20 || y === 0) return;
    const above = this.index(x, y - 1);"""),
  (FLOWER_HEAD, """    const cosmic = Boolean(flags & CELL_FLAG.Cosmic);
    // PROTO B: a seed head a minute past going to seed drops its seed and lets go.
    if (flags & CELL_FLAG.Rooted && age > PETAL_SHED_AGE + 1200 && energy < POLLEN_RESERVE && this.chance(300)) {
      writeCellBytes(next, idx, MATERIAL.Seed, cell[1], 40, 0, 0);
      return;
    }

    // The crown is the one cell the stalk produced."""),
  ("  private stem(", CROWN_OF),
]
for name, edits in {"today": [], "drink": DRINK, "turnover": TURNOVER}.items():
    dst = repo / ".tmp/garden" / f"r-{name}" / "app/src"
    shutil.rmtree(dst.parent.parent, ignore_errors=True)
    shutil.copytree(repo / "app/src", dst)
    eng = dst / "engine.ts"; s = eng.read_text()
    for a, b in edits:
        assert s.count(a) == 1, (name, a[:50])
        s = s.replace(a, b)
    eng.write_text(s); print(name, len(edits))
