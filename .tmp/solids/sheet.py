# Scratch: frames.raw -> solids.gif (panels side by side, labelled), a stacked still, and one crop per material.
import json, os
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(here, "frames.json")))
PW, PH, F, P = meta["PW"], meta["PH"], meta["FRAMES"], meta["PANELS"]
raw = open(os.path.join(here, "frames.raw"), "rb").read()
GAP, TOP = 8, 22
def panel(f, p):
    o = ((f * P + p) * PH * PW) * 3
    return Image.frombytes("RGB", (PW, PH), raw[o:o + PW * PH * 3])
frames = []
for f in range(F):
    img = Image.new("RGB", (P * PW + (P - 1) * GAP, PH + TOP), (24, 24, 30))
    d = ImageDraw.Draw(img)
    for p in range(P):
        img.paste(panel(f, p), (p * (PW + GAP), TOP))
        d.text((p * (PW + GAP) + 4, 5), meta["labels"][p], fill=(230, 230, 236))
    frames.append(img)
dur = int(1000 / meta["fps"])
frames[0].save(os.path.join(here, "solids.gif"), save_all=True, append_images=frames[1:], duration=dur, loop=0, optimize=False)
frames[0 if F < 2 else F - 1].save(os.path.join(here, "solids-still.png"))
print("gif", frames[0].size, F, "frames at", dur, "ms")

# Today alone and Build alone at twice the film's scale, from a dry frame before the flame.
f = min(F - 1, 45)
for p, name in enumerate(["today", "build"][:P]):
    panel(f, p).resize((PW * 2, PH * 2), Image.NEAREST).crop((0, PH, PW * 2, PH * 2)).save(os.path.join(here, f"solids-{name}.png"))

# Build, the flame's moment too.
panel(F - 1, 1).resize((PW * 2, PH * 2), Image.NEAREST).crop((0, PH, PW * 2, PH * 2)).save(os.path.join(here, "solids-build-late.png"))
