import os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
W, H = 600, 600
raw = open(os.path.join(here, "states.raw"), "rb").read()
a = Image.frombytes("RGB", (W, H), raw[:W*H*3]); b = Image.frombytes("RGB", (W, H), raw[W*H*3:W*H*6])
o = Image.new("RGB", (W*2+12, H), (24,24,30)); o.paste(a,(0,0)); o.paste(b,(W+12,0)); o.save(os.path.join(here,"states.png"))
