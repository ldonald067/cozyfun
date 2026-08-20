# Element Design Rubric

Six axes: 1-4 are the look lens, 5-6 the interaction lens. Score each **weak / adequate /
strong**, and attach the evidence that decided it. An axis you did not look at is scored
"not examined", never assumed adequate.

---

## 1. Silhouette — is it recognisable with colour removed?

The strongest test in this project, because it is the one palette work cannot fake.

Desaturate the crop and look again:

```bash
sips -m /System/Library/ColorSync/Profiles/Generic\ Gray\ Profile.icc .tmp/crop-8x.png --out .tmp/crop-gray.png
```

- Does the shape alone say what it is?
- Is the outline doing work, or is it a rectangle wearing a colour?
- At five cells across, are there enough pixels for a shape at all? Three cells can only
  be a block or a cross — anything more ambitious needs five.

**Precedent:** a filled 5x2 poppy read as a red bar until its top corners came off. A
notch at the crest split the head into two blocks, because the dark eye already cut the
row below. Both were only visible in a crop.

## 2. Separation — is it distinct from what it sits beside?

Uniqueness is a claim about neighbours, so test it against neighbours:

- The elements it shares a palette family with (all greens, all blues, all powders).
- The elements it physically touches in ordinary play — moss on soil, oil on water,
  char in a hearth.
- Its own states: does wet-X read differently from dry-X, and from Y?

`npm run material:contrast` gives the closest averaged-palette pair and its distance.
Treat it as a floor. Two materials passing it can still be indistinguishable at the seam
where they actually meet, which is the only place it matters.

**Ask:** could a player name this without the tooltip, in a scene with six other things
going on?

## 3. Motion — does behaviour carry identity?

Half of a falling-sand element's identity is how it moves. A still capture cannot show
this; watch it or step it.

- Dry sand pours two cells a tick; wet sand clumps and slows. Is that visible, or just true?
- Does the element move in a way no other element does?
- Gas, liquid, powder, static — is its class obvious within a second of appearing?

**Precedent:** stone falling and wall never moving is what finally separated two
materials that had been near-duplicates for months. The split was behavioural, not visual.

## 4. State — are flags visible before the kind changes?

Wet, rooted, frozen, scorched, cosmic. The design intent is that a player sees the state
change *coming*.

- Is each flag visible on this element at play zoom?
- Is it visible without being noisy — a carpet must not strobe, a dead hearth must not
  read as lit?
- Do two different flags on the same element read differently from each other?

**Precedent:** a cosmic-charge cue on fungus was painted *before* the cap/gill/spore
mixes that overwrote it. It moved two points on the measured score once reordered — the
cue was correct and invisible for its whole life.

## 5. Role — does it do a job nothing else does?

The uniqueness question at the product level rather than the pixel level.

- Name its job in one sentence without using another element's name.
- If two elements need the same sentence, one of them should merge, specialise, or become
  a generated-only outcome.
- Does it have interactions a player can set up, watch, and learn from?

**Precedent:** Smoke and Steam left the toolbar because they shared gas movement and had
one or two interactions each. They remain full sim materials — demotion to
generated-only is a real option, not a euphemism for deletion.

The documented caps in `docs/MATERIAL_AUDIT.md` are the bar: 4-6 interaction roles for a
toolbar material, 1-3 for a generated-only outcome.

---

## 6. Connection — do its interactions reach the rest of the game?

Axis 5 asks whether the element has a distinct job. This one asks whether that job is
*findable*, whether it *combines*, and whether its roles *cohere*. All three are outside
what `npm run interaction:audit` can judge — that gate proves each documented interaction
fires from painted materials and is visible at play zoom, which is a different claim.

### Discoverable

- Would a player meet this by playing, or only by reading the matrix?
- What is the shortest plausible path to it: a single brush stroke, a two-material contact,
  or a setup nobody assembles by accident?
- Does the game *hint* at it? A field note, a state cue, a visual that invites the try.

**Precedent:** wellspring re-attunement — a spring held under ice re-drinks whatever
touches it next — is a genuinely lovely rule that almost nothing points a player toward.
Contrast pollen: it drifts visibly off a bloom, so its "settles and seeds damp soil"
outcome is something you watch happen rather than something you have to be told.

**The trap:** reachable is not discoverable. `rooted_seed_grows_a_stalk_that_blooms` passed
for months while no player had ever seen a flower. Reachability now has a gate;
discoverability has only this axis.

### Combines

The audit tests clauses one at a time. Nothing tests pairs, and pairs are where a sandbox
gets its depth.

- Does A + B produce something neither does alone?
- Is the result *legible* — can a player tell which two things made it?
- Does the combination survive in a busy scene, or only in a clean fixture?

**Precedent:** meteor into moonwater bursts to stardust; a falling meteor's spark trail
lights rocket fuses it passes; stardust charges water into moonwater, which then cleans oil
back into stardust — a loop a player can run. Those are the shape to look for.

**Ask of a proposed new interaction:** does it open a combination, or is it a third way to
do something two elements already do?

### Coheres

- Name the element's character in one sentence. Do its documented roles all serve it?
- Or is it a bag of rules that reached the cap? The caps in `docs/MATERIAL_AUDIT.md` are
  counted mechanically, so four sentences describing one idea passes.
- Conversely: does an element carry more depth than its row admits?

**Precedent both ways.** Smoke and Steam left the toolbar because each had one or two
interactions and shared gas movement — thin, and honestly demoted. Ember is the inverse:
capped at 3 documented roles because generated-only outcomes are, while carrying five
distinct felt beats (glow-spread, cool-to-char, relight, quench, char-wash), and the matrix
says so in a note rather than pretending otherwise.

**Scoring note:** a `weak` here is rarely "delete this". It is usually one of — surface it
(a field note, a state cue), connect it (give it a pair), or merge it.

---

## Magnifying a live scene

The showcase capture is a fixed scene. To look at something in actual play, magnify
inside the page and screenshot it. Composite base + glow the way the live page stacks
them, or night lights disappear:

```js
const [x0, y0, w, h] = [59, 116, 101, 20];   // cells
const SCALE = 12;
const out = document.createElement('canvas');
out.width = w * SCALE; out.height = h * SCALE;
const g = out.getContext('2d');
g.imageSmoothingEnabled = false;
g.fillStyle = '#080d18'; g.fillRect(0, 0, out.width, out.height);
g.drawImage(document.querySelector('.base-canvas'), x0, y0, w, h, 0, 0, out.width, out.height);
g.globalCompositeOperation = 'screen';
g.globalAlpha = 0.9;
g.filter = 'blur(6px) saturate(1.35)';
g.drawImage(document.querySelector('.glow-canvas'), x0, y0, w, h, 0, 0, out.width, out.height);

const box = document.createElement('div');
box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#05080f;display:flex;align-items:center;justify-content:center';
out.style.cssText = 'max-width:98vw;max-height:92vh;image-rendering:pixelated';
box.appendChild(out); document.body.appendChild(box);
```

Screenshot, then remove the overlay. The `screen` blend, the blur and the 0.9 alpha must
match `.glow-canvas` in `styles.css` — reviewing with the glow underneath the opaque base
is a mistake this project has already made.

## Counting what is actually on screen

To judge presence rather than guess at it, read cell counts off a scene snapshot instead
of sampling pixels — a green-ish pixel could be moss:

```js
const bytes = atob(JSON.parse(localStorage.getItem("cozy-pixel-sandbox:scene:v1")).cells);
const counts = {};
for (let i = 0; i < bytes.length; i += 8) {
  const kind = bytes.charCodeAt(i);
  if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
}
counts;   // keyed by MATERIAL id from app/src/materials.ts
```

## Calibration

- Three sharp findings beat nineteen adjectives.
- "This one is fine" is a valid and useful verdict. Say it.
- Rank by what the player loses, not by what is easy to change.
- Separate the cheapest fix from the best fix, and name both when they differ.
- On the interaction lens especially: quote the gate's numbers rather than re-deriving
  them, and spend the pass on the judgment no gate can make.
