# Scratch: the garden filmstrip with row and column labels. python3 .tmp/garden/sheet.py
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
S = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
strip = Image.open(os.path.join(D, "garden-film.png"))
rows = [("Today", "heads full ~1 min, gone by ~2 min"),
        ("A: bigger plants", "taller stalks, a leaf every row"),
        ("B: blooms that last", "heads full ~3 min, gone by ~4 min"),
        ("A + B", "both")]
cols = ["30 s", "75 s", "110 s", "150 s", "220 s"]
n, GAP, LW, PAD = len(rows), 6, 330, 20
rh = (strip.height - (n - 1) * GAP) // n
cw = (strip.width - (len(cols) - 1) * GAP) // len(cols)
W, H = LW + strip.width + PAD, 70 + strip.height + PAD
sheet = Image.new("RGB", (W, H), (24, 26, 30)); d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "One painted bed: soil, a row of seeds, one watering (same seed in every row)", font=F, fill=(235, 235, 235))
for i, c in enumerate(cols):
  d.text((LW + i * (cw + GAP) + cw // 2 - 20, 46), c, font=S, fill=(200, 200, 200))
sheet.paste(strip, (LW, 70))
for i, (t, sub) in enumerate(rows):
  y = 70 + i * (rh + GAP) + rh // 2 - 22
  d.text((PAD, y), t, font=F, fill=(235, 235, 235)); d.text((PAD, y + 28), sub, font=S, fill=(170, 170, 170))
sheet.save(os.path.join(D, "garden-sheet.png")); print(sheet.size)
