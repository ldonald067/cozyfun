# States, reshapes and life stages for the design canvas. One pixel per cell.
from PIL import Image, ImageFilter, ImageChops
from mock import (SHAPES, LIGHT, DARK, BG, WALL, CAP, OUT, mix, WHITE, BLACK, petal, crown,
                  stalk_color, today, proposed, row)

def crop(bx, x0=-4, x1=4, y0=121, y1=134):
    im = Image.open(CAP).convert("RGB")
    out = Image.new("RGB", (x1 - x0 + 1, y1 - y0 + 1), BG)
    for cy in range(y0, y1 + 1):
        for cx in range(bx + x0, bx + x1 + 1):
            if 0 <= cx < 220: out.putpixel((cx - bx - x0, cy - y0), im.getpixel((cx * 4 + 2, cy * 4 + 2)))
    return out

def plant(shape, colour, n=5, crown_c=None, extra=None):
    """A stalk of n cells under a head; colour(dx, dy) paints each petal."""
    out = Image.new("RGB", (9, 14), BG)
    ox, base = 4, 13
    for x in range(9): out.putpixel((x, base), WALL)
    for i in range(1, n + 1): out.putpixel((ox, base - i), stalk_color(i, n))
    for lx, ly in [(-1, 2), (1, 4)]: out.putpixel((ox + lx, base - ly), stalk_color(0, n, side=lx))
    cy = base - n - 1
    if crown_c: out.putpixel((ox, cy), crown_c)
    for dx, dy in shape:
        c = colour(dx, dy)
        if c and 0 <= ox + dx < 9 and 0 <= cy + dy < 14: out.putpixel((ox + dx, cy + dy), c)
    for (x, y), c in (extra or {}).items(): out.putpixel((ox + x, cy + y), c)
    return out

POPPY = 1
P = SHAPES[POPPY]
pp = lambda dx, dy: petal(POPPY, dx, dy, P)

# --- States: today's rule applied to today's real poppy, beside the proposed rule. ---
def today_state(state):
    t = crop(12 + 8 * POPPY)
    tints = {"wet": ((146, 222, 152), 0.12), "frozen": ((207, 236, 245), 0.56),
             "scorched": ((55, 37, 31), 0.62), "cosmic": ((165, 202, 255), 0.26)}
    if state == "open": return t
    tint, k = tints[state]
    for y in range(t.height):
        for x in range(t.width):
            c = t.getpixel((x, y))
            # petals only: the reds of the head, not the stalk, wall or night
            if c[0] > 120 and c[1] < 140 and y < 10: t.putpixel((x, y), mix(c, tint, k))
    return t

def prop_state(state):
    s = set(P)
    def edge(dx, dy): return any((dx + a, dy + b) not in s and (dx + a, dy + b) != (0, 0) for a, b in [(0, -1), (-1, 0), (1, 0), (0, 1)])
    def colour(dx, dy):
        c = pp(dx, dy)
        h = (dx * 7 + dy * 13) & 7
        if state == "wet":
            # wet petals deepen, and a few tips hold a bead of dew
            c = mix(c, BLACK, 0.12)
            if edge(dx, dy) and h in (1, 5): c = (236, 246, 255)
        elif state == "frozen":
            # frost grows in from the rims; hearts keep their colour, dimmed
            c = mix(c, (216, 240, 250), 0.78) if edge(dx, dy) else mix(c, (120, 150, 190), 0.35)
            if edge(dx, dy) and h == 3: c = WHITE
        elif state == "scorched":
            # char eats in from the rim, with a live ember line where it meets petal
            ring = max(abs(dx), abs(dy))
            c = (40, 28, 26) if ring == 3 or (edge(dx, dy) and dy < 0) else (232, 110, 40) if ring == 2 else mix(c, (55, 37, 31), 0.3)
        elif state == "cosmic":
            # moonlit: petals cool toward starlight silver, tips brightest
            c = mix(c, (176, 196, 255), 0.55)
            if edge(dx, dy): c = mix(c, WHITE, 0.3)
        return c
    cc = crown(POPPY)
    if state == "frozen": cc = mix(cc, (216, 240, 250), 0.4)
    if state == "cosmic": cc = (220, 230, 255)
    return plant(P, colour, crown_c=cc)

def glow(img, scale, colour, radius, strength):
    """Bake the night-light glow the game adds over cells, for one mockup."""
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    mask = Image.new("RGB", big.size, BLACK)
    for y in range(img.height):
        for x in range(img.width):
            c = img.getpixel((x, y))
            if c[2] > 200 and c[0] > 150 and y < 10:
                mask.paste(colour, (x * scale, y * scale, (x + 1) * scale, (y + 1) * scale))
    halo = mask.filter(ImageFilter.GaussianBlur(radius)).point(lambda v: int(v * strength))
    return ImageChops.add(big, halo)

# --- Reshapes: the two species whose problem is shape, not colour. ---
TULIP_CUP = [(-2, -3), (0, -3), (2, -3), (-2, -2), (-1, -2), (0, -2), (1, -2), (2, -2),
             (-2, -1), (-1, -1), (0, -1), (1, -1), (2, -1), (-1, 0), (1, 0)]
def tulip_cup(dx, dy):
    c = {-3: (252, 184, 208), -2: (244, 140, 178), -1: (222, 98, 146), 0: (190, 62, 110)}[dy]
    if dx == -1 and dy in (-2, -1): c = mix(c, WHITE, 0.3)
    if dx == 2 and dy >= -2: c = mix(c, (150, 44, 90), 0.4)
    return c
BLUEBELL_NOD = [(0, -1), (0, -2), (0, -3), (1, -4), (2, -4), (3, -3), (1, -3), (1, -2), (3, -2), (3, -1), (-1, -3), (-1, -2)]
def bluebell_nod(dx, dy):
    scape = {(0, -1), (0, -2), (0, -3), (1, -4), (2, -4), (3, -3)}
    if (dx, dy) in scape: return (70, 124, 84)
    mouth = (dx, dy + 1) not in set(BLUEBELL_NOD)
    return (150, 162, 246) if mouth else (64, 70, 178)

# --- Life stages, proposed, for the poppy. ---
def stage(name):
    if name == "bud":
        return plant(P, lambda dx, dy: None, crown_c=(150, 120, 70), extra={(0, -1): (196, 60, 56)})
    if name == "opening":
        # the first petals out are the outer reds, cupped over a still-hidden heart
        return plant(P, lambda dx, dy: (236, 92, 86) if dy == -1 and abs(dx) <= 1 else None, crown_c=(150, 120, 70))
    if name == "open":
        return plant(P, pp, crown_c=crown(POPPY))
    if name == "pollen":
        gold = (255, 214, 96)
        return plant(P, lambda dx, dy: gold if (dx, dy) in [(-1, -1), (1, 0)] else pp(dx, dy), crown_c=crown(POPPY),
                     extra={(-2, -4): gold, (2, -5): mix(gold, BG, 0.4)})
    if name == "fading":
        keep = [(-1, -1), (0, -1), (1, -1), (-2, 0), (-1, 0), (1, 0), (2, 0), (-2, -1)]
        return plant(P, lambda dx, dy: mix(pp(dx, dy), (122, 108, 88), 0.45) if (dx, dy) in keep else None,
                     crown_c=crown(POPPY), extra={(3, 2): mix((172, 38, 44), BG, 0.3)})
    if name == "seedhead":
        # a poppy goes to a grey-green capsule with a dark crown cap
        # a poppy goes to a grey-green capsule; its last stubborn petals read as the dark star cap
        return plant(P, lambda dx, dy: (74, 64, 76) if (dx, dy) in [(-1, -1), (0, -1), (1, -1)] else None, crown_c=(128, 140, 104))

if __name__ == "__main__":
    for s in ["open", "wet", "frozen", "scorched", "cosmic"]:
        today_state(s).save(OUT + f"state-today-{s}.png")
        (proposed(POPPY) if s == "open" else prop_state(s)).save(OUT + f"state-prop-{s}.png")
    glow(prop_state("cosmic"), 10, (90, 110, 200), 9, 0.9).save(OUT + "state-prop-cosmic-glow.png")
    plant(TULIP_CUP, tulip_cup, crown_c=(96, 120, 70)).save(OUT + "reshape-tulip.png")
    plant(BLUEBELL_NOD, bluebell_nod, crown_c=(70, 124, 84)).save(OUT + "reshape-bluebell.png")
    for n in ["bud", "opening", "open", "pollen", "fading", "seedhead"]:
        stage(n).save(OUT + f"life-prop-{n}.png")
    # today, straight from the game: daisy bud, poppy open, cosmos shedding, daisy spent
    crop(6, x0=-2, x1=2).save(OUT + "life-today-bud.png")
    crop(12 + 8 * POPPY).save(OUT + "life-today-open.png")
    crop(68).save(OUT + "life-today-shedding.png")
    crop(2, x0=-2, x1=2).save(OUT + "life-today-spent.png")
    # a contact sheet to look at
    names = ["state-today-open", "state-today-wet", "state-today-frozen", "state-today-scorched", "state-today-cosmic"]
    a = row([Image.open(OUT + n + ".png") for n in names])
    b = row([Image.open(OUT + n.replace("today", "prop") + ".png") for n in names])
    c = row([Image.open(OUT + f"life-prop-{n}.png") for n in ["bud", "opening", "open", "pollen", "fading", "seedhead"]])
    d = row([Image.open(OUT + n) for n in ["today-4.png", "reshape-tulip.png", "today-6.png", "reshape-bluebell.png",
                                           "life-today-bud.png", "life-today-open.png", "life-today-shedding.png", "life-today-spent.png"]])
    W = max(x.width for x in (a, b, c, d))
    sheet = Image.new("RGB", (W, 14 * 4 + 6), (40, 40, 40))
    for i, r in enumerate((a, b, c, d)): sheet.paste(r, (0, i * 16))
    sheet.resize((sheet.width * 10, sheet.height * 10), Image.NEAREST).save(OUT + "sheet2-10x.png")
