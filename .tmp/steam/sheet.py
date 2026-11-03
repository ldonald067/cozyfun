# Scratch (2026-10-23): the four steam strips on one labelled sheet. python3 .tmp/steam/sheet.py
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
S = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
scenes = [
  ("kettle", "A pot with a flame held to it (flame lifts at 20 s)", "1.5 s, 4 s, 8 s, 15 s"),
  ("pond", "A pond with a flame held to it for 10 s", "2 s, 5 s, 9 s, 13 s"),
  ("ember", "A burning log doused with water", "3 s, 4 s, 5.5 s, 8 s"),
  ("lava", "Water poured onto a lava pool", "1.5 s, 2.5 s, 4 s, 6.5 s"),
]
import sys
TAG = sys.argv[1] if len(sys.argv) > 1 else ""
rows = sys.argv[2].split("|") if len(sys.argv) > 2 else ["Live today", "A: puffs that fade in 2 s", "B: puffs that fade in 3 s"]
LW, PAD, GAP = 230, 24, 6
strips = [Image.open(os.path.join(D, f"film-{n}{TAG}.png")) for n, _, _ in scenes]
W = LW + max(s.width for s in strips) + PAD
H = PAD + sum(70 + s.height + PAD for s in strips)
sheet = Image.new("RGB", (W, H), (24, 26, 30))
d = ImageDraw.Draw(sheet)
y = PAD
for (name, title, times), strip in zip(scenes, strips):
  d.text((PAD, y), title, font=F, fill=(235, 235, 235))
  d.text((PAD, y + 30), f"frames at {times}", font=S, fill=(160, 165, 170))
  y += 70
  sheet.paste(strip, (LW, y))
  rh = (strip.height - GAP * (len(rows) - 1)) // len(rows)
  for i, r in enumerate(rows):
    d.text((PAD, y + i * (rh + GAP) + rh // 2 - 10), r, font=S, fill=(220, 220, 220))
  y += strip.height + PAD
out = os.path.join(D, "steam-built-sheet.png" if TAG else "steam-candidates-sheet.png")
sheet.save(out)
print(out, sheet.size)
