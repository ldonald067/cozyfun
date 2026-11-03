# Scratch: frames.raw -> water-mock.gif (panels side by side, labelled) and a still sheet.
import json, os
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(here, "frames.json")))
PW, PH, F, P = meta["PW"], meta["PH"], meta["FRAMES"], meta["PANELS"]
raw = open(os.path.join(here, "frames.raw"), "rb").read()
GAP, TOP = 8, 22
frames = []
for f in range(F):
    img = Image.new("RGB", (P * PW + (P - 1) * GAP, PH + TOP), (24, 24, 30))
    d = ImageDraw.Draw(img)
    for p in range(P):
        o = ((f * P + p) * PH * PW) * 3
        img.paste(Image.frombytes("RGB", (PW, PH), raw[o:o + PW * PH * 3]), (p * (PW + GAP), TOP))
        d.text((p * (PW + GAP) + 4, 5), meta["labels"][p], fill=(230, 230, 236))
    frames.append(img)
dur = int(1000 / meta["fps"])
frames[0].save(os.path.join(here, "water-mock.gif"), save_all=True, append_images=frames[1:], duration=dur, loop=0, optimize=False)
# Still: three moments, stacked.
pick = [0, F // 2, F - 1]
still = Image.new("RGB", (frames[0].width, len(pick) * (frames[0].height + GAP)), (24, 24, 30))
for i, f in enumerate(pick): still.paste(frames[f], (0, i * (frames[0].height + GAP)))
still.save(os.path.join(here, "water-still.png"))
print("gif", frames[0].size, F, "frames at", dur, "ms")
