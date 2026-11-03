# Scratch: the rain re-bloom filmstrip with labels. python3 .tmp/garden/resheet.py
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
S = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
strip = Image.open(os.path.join(D, "rebloom-film.png"))
rows = [("Today, watered again", "at 5:00, poured from above"),
        ("Today, in the rain", "the rain room's rate, from 5:00"),
        ("A, in the rain", "fresh rain on any part counts"),
        ("B, in the rain", "spent plants wither; seeds regrow")]
cols = ["4:50 spent", "5:30", "6:30", "8:00", "10:00"]
n, GAP, LW, PAD = len(rows), 6, 330, 20
rh = (strip.height - (n - 1) * GAP) // n
cw = (strip.width - (len(cols) - 1) * GAP) // len(cols)
W, H = LW + strip.width + PAD, 70 + strip.height + PAD
sheet = Image.new("RGB", (W, H), (24, 26, 30)); d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "One bed watered once at 0:00, gone to seed by ~4:30; then water from 5:00 (same seed in every row)", font=F, fill=(235, 235, 235))
for i, c in enumerate(cols):
  d.text((LW + i * (cw + GAP) + cw // 2 - 40, 46), c, font=S, fill=(200, 200, 200))
sheet.paste(strip, (LW, 70))
for i, (t, sub) in enumerate(rows):
  y = 70 + i * (rh + GAP) + rh // 2 - 22
  d.text((PAD, y), t, font=F, fill=(235, 235, 235)); d.text((PAD, y + 28), sub, font=S, fill=(170, 170, 170))
sheet.save(os.path.join(D, "rebloom-sheet.png")); print(sheet.size)
