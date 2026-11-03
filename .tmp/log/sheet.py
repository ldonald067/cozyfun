# Scratch (2026-10-28): the burning-log strips on one labelled sheet. python3 .tmp/log/sheet.py
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
S = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
scenes = [("log", "One painted log, lit with a dab of flame"), ("stack", "A small stack of logs, lit the same way")]
rows = ["Live today (dark by ~7 s)", "A: whole log glows longer (~11 s)", "B: scattered sparks glow (~19 s)", "C: glowing cracks along the grain (~24 s)"]
LW, PAD, GAP = 330, 24, 6
strips = [Image.open(os.path.join(D, f"film-{n}.png")) for n, _ in scenes]
W = LW + max(s.width for s in strips) + PAD
H = PAD + sum(70 + s.height + PAD for s in strips)
sheet = Image.new("RGB", (W, H), (24, 26, 30)); d = ImageDraw.Draw(sheet); y = PAD
for (name, title), strip in zip(scenes, strips):
  d.text((PAD, y), title, font=F, fill=(235, 235, 235))
  d.text((PAD, y + 30), "frames at 3 s, 7 s, 10 s, 15 s, 22 s, 30 s", font=S, fill=(160, 165, 170)); y += 70
  sheet.paste(strip, (LW, y)); rh = (strip.height - GAP * (len(rows) - 1)) // len(rows)
  for i, r in enumerate(rows): d.text((PAD, y + i * (rh + GAP) + rh // 2 - 10), r, font=S, fill=(220, 220, 220))
  y += strip.height + PAD
sheet.save(os.path.join(D, "log-candidates-sheet.png")); print(os.path.join(D, "log-candidates-sheet.png"))
