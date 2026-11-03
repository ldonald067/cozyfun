# Measure the reference sheet 3.png: art-pixel size, head size, tones per head and luminance spread.
import sys
from PIL import Image
from collections import Counter
im = Image.open(sys.argv[1]).convert("RGB"); W, H = im.size; px = im.load()
# art pixel size: most common horizontal run length of identical colour (ignoring the background)
bg = Counter(px[x, y] for x in range(0, W, 7) for y in range(0, H, 7)).most_common(1)[0][0]
runs = Counter()
for y in range(0, H, 3):
    run = 1
    for x in range(1, W):
        if px[x, y] == px[x - 1, y]: run += 1
        else:
            if px[x - 1, y] != bg and run < 30: runs[run] += 1
            run = 1
print("background", bg, "run lengths", runs.most_common(6))
S = int(sys.argv[2]) if len(sys.argv) > 2 else runs.most_common(1)[0][0]
ox, oy = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, 0)
gw, gh = (W - ox) // S, (H - oy) // S
g = [[px[ox + x * S + S // 2, oy + y * S + S // 2] for x in range(gw)] for y in range(gh)]
lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def green(c): r, gg, b = c; return gg > r + 25 and gg >= b - 10
def redmean(a, b):
    r = (a[0] + b[0]) / 2; dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return ((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db) ** 0.5
# find heads: connected non-bg non-green components of size >= 30
seen = set(); heads = []
for y in range(gh):
    for x in range(gw):
        c = g[y][x]
        if (x, y) in seen or c == bg or green(c) or sum(abs(c[i] - bg[i]) for i in range(3)) < 30: continue
        stack = [(x, y)]; comp = []; seen.add((x, y))
        while stack:
            a, b = stack.pop(); comp.append((a, b))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (a + dx, b + dy)
                if 0 <= n[0] < gw and 0 <= n[1] < gh and n not in seen:
                    cc = g[n[1]][n[0]]
                    if cc != bg and not green(cc) and sum(abs(cc[i] - bg[i]) for i in range(3)) >= 30:
                        seen.add(n); stack.append(n)
        if len(comp) >= 30: heads.append(comp)
print("art pixel", S, "grid", gw, "x", gh, "heads", len(heads))
for comp in sorted(heads, key=lambda c: (min(p[1] for p in c) // 20, min(p[0] for p in c))):
    xs = [p[0] for p in comp]; ys = [p[1] for p in comp]
    cols = Counter(g[b][a] for a, b in comp)
    ls = sorted(lum(c) for c in cols)
    dark = min(cols, key=lum); light = max(cols, key=lum)
    print(f"head at {min(xs)},{min(ys)} size {max(xs)-min(xs)+1}x{max(ys)-min(ys)+1} cells {len(comp)} tones {len(cols)} "
          f"lum {ls[0]:.0f}-{ls[-1]:.0f} (spread {ls[-1]-ls[0]:.0f}) redmean dark-light {redmean(dark, light):.0f}  top tones {[c for c,_ in cols.most_common(6)]}")
