# Scratch: lava before/after strips on one labelled sheet. python3 .tmp/lavaflow/sheet.py
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
F = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
S = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
rows = [
  ("floor", "Poured mid-floor for 3 s", "2 s, 6 s, 15 s, 30 s, 50 s, 70 s"),
  ("slope", "Poured at the top of a slope", "2 s, 6 s, 12 s, 24 s, 40 s, 60 s"),
  ("spring", "A lava spring (part of a 160x90 board)", "10 s, 30 s, 1 min, 2 min, 3.3 min, 6.7 min"),
]
imgs = []
for name, title, times in rows:
    im = Image.open(f"{D}/{name}.png").convert("RGB")
    if im.width > 1500: im = im.resize((1500, round(im.height * 1500 / im.width)), Image.NEAREST)
    imgs.append((title, times, im))
W = max(im.width for *_, im in imgs) + 150
H = sum(im.height + 60 for *_, im in imgs) + 70
out = Image.new("RGB", (W, H), (24, 26, 30)); d = ImageDraw.Draw(out)
d.text((20, 18), "Lava: before (top of each pair, live today) and after (below)", fill=(235, 235, 235), font=F)
y = 70
for title, times, im in imgs:
    d.text((20, y), f"{title}   ·   {times}", fill=(220, 220, 220), font=S)
    y += 28
    out.paste(im, (130, y))
    d.text((20, y + im.height // 4 - 8), "before", fill=(170, 170, 170), font=S)
    d.text((20, y + 3 * im.height // 4 - 8), "after", fill=(170, 170, 170), font=S)
    y += im.height + 32
out.save(f"{D}/lava-sheet.png"); print(f"{D}/lava-sheet.png", out.size)
