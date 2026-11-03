# 3.png sampled at its art-pixel grid (5.4 px): per head, size, tones (colours >= 20 redmean apart) and spread.
from PIL import Image
import math
from collections import Counter
im = Image.open("../flowers-ref/3.png").convert("RGB"); W, H = im.size; px = im.load()
S = 5.4
def phase(axis):
    e = []
    for a in range(40, 340, 2):
        for b in range(1, W if axis == 0 else H):
            p, q = (px[b - 1, a], px[b, a]) if axis == 0 else (px[a, b - 1], px[a, b])
            if sum(abs(p[i] - q[i]) for i in range(3)) > 120: e.append(b)
    c = sum(math.cos(2 * math.pi * x / S) for x in e); s = sum(math.sin(2 * math.pi * x / S) for x in e)
    return (math.atan2(s, c) / (2 * math.pi) * S) % S
fx, fy = phase(0), phase(1)
gw, gh = int((W - fx) / S), int((H - fy) / S)
def at(x, y):  # median of the 3x3 centre of an art pixel
    cx, cy = fx + (x + 0.5) * S, fy + (y + 0.5) * S
    pts = sorted((px[int(cx) + dx, int(cy) + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1)), key=sum)
    return pts[4]
g = [[at(x, y) for x in range(gw)] for y in range(gh - 1)]
gh -= 1
bg = (255, 246, 247)
lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def rm(a, b):
    r = (a[0] + b[0]) / 2; dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return ((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db) ** 0.5
def plant(c): r, gg, b = c; return (gg > r + 20 and gg >= b - 25)  # stems, leaves, teal outline greens
# heads: the 8 flowers sit in a 4x2 grid; head = non-bg, non-plant cells in the upper part of each slot
slots = [(96, 36, 186, 130), (214, 36, 300, 130), (326, 30, 418, 130), (442, 36, 530, 130),
         (88, 196, 186, 280), (210, 196, 300, 280), (332, 200, 412, 280), (442, 196, 530, 280)]
names = ["red", "pale blue", "pink", "purple", "lilac", "orange", "blue", "sunflower"]
for name, (x0, y0, x1, y1) in zip(names, slots):
    cells = []
    for y in range(int((y0 - fy) / S), int((y1 - fy) / S)):
        for x in range(int((x0 - fx) / S), int((x1 - fx) / S)):
            c = g[y][x]
            if rm(c, bg) < 40 or plant(c): continue
            cells.append((x, y, c))
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    # tones: greedy cluster at 40 redmean
    tones = []
    for _, _, c in sorted(cells, key=lambda t: lum(t[2])):
        for t in tones:
            if rm(t[0], c) < 40: t[1] += 1; break
        else: tones.append([c, 1])
    tones = [t for t in tones if t[1] >= 2]
    ls = [lum(t[0]) for t in tones]
    dark = min(tones, key=lambda t: lum(t[0]))[0]; light = max(tones, key=lambda t: lum(t[0]))[0]
    print(f"{name:10s} head {max(xs)-min(xs)+1}x{max(ys)-min(ys)+1} art px, {len(cells)} cells, {len(tones)} tones, "
          f"lum {min(ls):.0f}-{max(ls):.0f}, dark-light redmean {rm(dark, light):.0f}: " + " ".join("#%02x%02x%02x/%d" % (*t[0], t[1]) for t in tones))
