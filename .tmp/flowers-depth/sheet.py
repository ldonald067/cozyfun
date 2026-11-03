# One labelled sheet of the batch's filmstrips: live (top of each pair) against this branch.
from PIL import Image, ImageDraw, ImageFont
F = "/System/Library/Fonts/Supplemental/Arial.ttf"
big, small = ImageFont.truetype(F, 22), ImageFont.truetype(F, 15)
parts = [
    ("A tulip and a bluebell opening from a bud (2, 6, 12, 20, 35, 55 s)", ".tmp/film/reshape-opening.png", 1),
    ("The eight species, up close", ".tmp/film/flowers-species.png", 1),
    ("Weather on a poppy and a daisy: plain, wet, frozen, charred, moonlit (top two rows live, bottom two new)", ".tmp/film/flowers-states.png", 1),
    ("A meadow from soil, seeds and one watering, at play size: 15, 25, 35, 50 s (live, new, per pair)", ".tmp/flowers-depth/out/meadow-film-s3-4107.png", 2),
    ("Another meadow (seed 9301) at 35 s, at play size", ".tmp/flowers-depth/out/meadow-film-s3-9301.png", 2),
]
ims = [(t, Image.open(p).convert("RGB"), k) for t, p, k in parts]
ims = [(t, im.resize((im.width * k, im.height * k), Image.NEAREST), k) for t, im, k in ims]
W = max(im.width for _, im, _ in ims) + 80
H = 110 + sum(im.height + 70 for _, im, _ in ims)
sheet = Image.new("RGB", (W, H), (13, 18, 32))
d = ImageDraw.Draw(sheet)
d.text((40, 30), "Flowers: an outline in each head's own colour, a tulip cup and a nodding bluebell", font=big, fill=(244, 223, 184))
d.text((40, 62), "In every pair the TOP row is the game as it is live, the BOTTOM row is this batch. Meadows are shown at twice play size.", font=small, fill=(185, 194, 211))
y = 110
for t, im, k in ims:
    d.text((40, y), t, font=small, fill=(211, 217, 228))
    sheet.paste(im, (40, y + 26))
    y += im.height + 70
sheet.save(".tmp/flowers-depth/flowers-batch-sheet.png")
print(sheet.size)
