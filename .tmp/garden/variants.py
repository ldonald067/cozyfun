# Scratch: garden variants as find/replace copies of app/src (never edited). python3 .tmp/garden/variants.py
import shutil, pathlib
repo = pathlib.Path(__file__).resolve().parents[2]
BIG = [("200 + (cell[1] & 3) * 55 + (cosmic ? 55 : 0)", "365 + (cell[1] & 3) * 55 + (cosmic ? 55 : 0)"),
       ("    if (y % 2 !== 0) return;\n    const lx = Math.floor(y / 2) % 2 === 0 ? x - 1 : x + 1;", "    const lx = y % 2 === 0 ? x - 1 : x + 1;")]
LAST = [("const PETAL_SHED_AGE = 1200;", "const PETAL_SHED_AGE = 3600;")]
VARIANTS = {"base": [], "bigger": BIG, "lasting": LAST, "both": BIG + LAST}
for name, edits in VARIANTS.items():
    dst = repo / ".tmp/garden" / f"v-{name}" / "app/src"
    shutil.rmtree(dst.parent.parent, ignore_errors=True)
    shutil.copytree(repo / "app/src", dst)
    for f in ("tsconfig.json", "package.json"):
        if (repo / f).exists(): shutil.copy(repo / f, dst.parent.parent / f)
    if (repo / "app/tsconfig.json").exists(): shutil.copy(repo / "app/tsconfig.json", dst.parent / "tsconfig.json")
    eng = dst / "engine.ts"
    s = eng.read_text()
    for a, b in edits:
        assert s.count(a) == 1, (name, a)
        s = s.replace(a, b)
    eng.write_text(s)
    print(name, len(edits), "edits")
