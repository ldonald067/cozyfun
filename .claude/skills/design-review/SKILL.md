---
name: design-review
description: >-
  Pure design review of game elements — how an element reads on screen, whether it is
  distinguishable from every other element, how its interactions connect to the rest of the
  roster, and the cheapest change that would improve any of it. Looks at pixels and at play,
  not at code. Triggers: "design review", "how does X look", "is X unique", "review the
  elements", "visual review", "how do X and Y interact", "what combos are there", "would a
  player ever find this", "do the interactions connect".
---

# Design Review

A design lens, and only a design lens. Four questions per element:

1. **Does it show?** Can a player see it, at real play zoom, in a busy scene?
2. **Is it unique?** Could they tell it apart from every other element without a tooltip?
3. **Does it connect?** Would a player ever *find* its interactions, do they combine with
   anything, and do they add up to one character rather than a bag of rules?
4. **What would improve it?** The cheapest change with the largest gain.

Questions 1-2 are the **look lens**, question 3 is the **interaction lens**. Both run by
default. `/design-review interactions` runs only the interaction lens, `/design-review look`
only the visual one — worth scoping when the roster is large, because a full pass over both
across nineteen materials produces more findings than anyone will act on.

Correctness, tests, and code quality belong to `/code-review` and `/adversarial-review`.
Do not file bugs here. If a design finding turns out to be a bug, say so in one line and
hand it off.

## The one rule

**Look at the pixels. Never review from source.**

Reading `shapeLanguage.ts` tells you what was intended. It does not tell you what a
player sees, and this project has been wrong about that difference repeatedly: a bloom
that "opened into a multi-cell head" rendered as a red bar, a fungus cosmic cue was
painted over by the very next line, and a flower nobody could grow passed every test.

Every claim in the report is either **Measured** (a number or a crop) or **Judged**
(taste, labelled as such). No third category. "It reads better now" without a crop
beside it is not a finding.

## Workflow

### 1. Scope it

One element, a group that competes (all the greens; all the liquids; all the cosmic
powders), or the full roster. Groups are usually more revealing than singles, because
uniqueness is a claim about *neighbours*.

### 2. Get fresh pixels

```bash
npm run visual:qa
```

Writes `.tmp/visual-qa/material-identity-showcase.png` and room captures. Never review a
capture you did not just generate — a stale one has produced wrong verdicts here.

For the deployed build instead of the local one:

```bash
COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run visual:qa
```

### 3. Crop, and look twice

Look at each element **twice**: once at true size, once magnified. They disagree more
often than you would expect, and the true-size view is the one that counts.

```bash
# the garden row in the showcase, then a 4x blow-up of the same crop
sips -c 80 260 --cropOffset 470 30 .tmp/visual-qa/material-identity-showcase.png --out .tmp/crop.png
sips -Z 1040 .tmp/crop.png --out .tmp/crop-8x.png
```

Two `sips` gotchas, both verified rather than assumed: `-c` takes **height then width**,
and `--cropOffset` takes **y then x** as the absolute top-left. Without an offset `-c`
crops from the *centre*, which silently lands in empty margin and hands you a blank
image that looks like a broken element rather than a bad crop. The showcase is 880x560;
`sips -g pixelWidth -g pixelHeight <file>` when it changes.

Then read both with the Read tool. A cell is ~3.2 screen px at the shipped 220x140 grid,
so a five-cell flower head is 16px wide — about the size of a favicon. Judge it there.

For a live scene rather than the showcase, magnify inside the page and screenshot:
see `references/rubric.md` for the canvas-overlay recipe.

### 4. For the interaction lens: play it, then read the gate

The mechanical half of interactions is already gated, and re-deriving it here wastes the
pass. **Read the existing evidence first:**

```bash
npm run interaction:audit    # per interaction: first tick, cells, ticks on screen, contrast
npm run material:audit       # clause counts against the 4-6 / 1-3 caps
```

Its four columns are **first tick / cells touched / ticks visible / colour distance**. The
first column is the one this lens cares about most and the gate does not check at all: an
interaction that first fires at tick 1 is something a player meets immediately, while one
that takes 1,400 ticks is nearly a minute of play away — both pass, and they are not the
same experience.

`interaction:audit` already proves each documented interaction HAPPENS from painted
materials and is VISIBLE at play zoom. Do not file "does this fire" or "can you see it" —
those have floors and a gate. Quote its numbers as evidence and spend the pass on what it
cannot judge: whether anyone would find the interaction, whether it combines with anything,
and whether an element's roles cohere.

Then actually play the pair. Paint element A into element B in a live scene and watch —
in the shipped app, not the showcase:

```bash
COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run visual:qa
```

`docs/MATERIAL_AUDIT.md` is the roster of what is *documented*. It is the starting list,
not the finding list — an interaction missing from it may be an omission or may be
deliberate (the slow world is deliberately absent, and that doc says why).

### 5. Score against the rubric

`references/rubric.md` has the full checklist. The short form, per element:

- **Silhouette** — recognisable from shape alone, with colour removed?
- **Separation** — distinct from what it sits next to *in play*, not on a swatch board?
- **Motion** — does how it moves say what it is?
- **State** — are wet / frozen / scorched / rooted / cosmic visible *before* the kind changes?
- **Role** — does it do a job no other element does?
- **Connection** — is that job findable, does it combine with anything, and do its roles
  add up to one character?

### 6. Attach numbers where numbers exist

```bash
npm run material:contrast   # closest palette pair, with the distance
npm run interaction:audit   # per-interaction cells / ticks / colour distance
```

`material:contrast` compares **averaged palettes only**. It cannot see per-variant
colour, interaction states, glow, shape or animation, so a passing score is a floor and
never a verdict. Say which it is when you quote it.

### 7. Report

Ranked by how much a player loses to the problem, not by how easy it is to fix.

```
## <element or group>

**Measured**
- <number or crop, with what it means>

**Judged**
- <taste call, said plainly as taste>

**Finding N — <one line>**
  Evidence: <crop path / number>
  Cost of leaving it: <what the player misses>
  Cheapest fix: <specific change, and whether it is renderer-only or needs the sim>
```

End with the single change you would make first if you could only make one.

## Traps that have produced wrong verdicts here

- **The showcase is a live scene.** It loads into the running app and is captured a beat
  later, so an exhibit painted in a state the sim immediately leaves is gone before the
  shutter. If an exhibit looks wrong, check it still exists before redesigning it.
- **Display stands must be Wall.** Stone falls. So does soil — a planter with nothing
  under it drops and takes the plant with it.
- **Glow must composite over base.** Visual QA once drew the glow layer *underneath* the
  opaque base canvas, silently reviewing every night light as though it did not exist.
- **Contrast on a swatch board is not contrast in play.** Two materials can score fine
  against each other and still be indistinguishable where they actually touch.
- **Per-cell randomness reads as noise, not texture.** Deriving a bloom's hue from a
  per-cell hash turned one flower into confetti; hue belongs to the plant, not the pixel.
- **Renderer-only vs sim.** A fix that needs a cell to exist that the sim did not create
  is a sim change and must be mirrored in both engines. Say which kind you are proposing.
  This bites hardest on the interaction lens: several *contact cues* are presentation only
  — water brightening near heat, lava darkening beside water, moonwater pearling near life.
  Proposing to change one of those is cheap; proposing a new reaction is not.
- **Reachable is not discoverable.** The interaction audit proves a player CAN get there
  from painted materials. Whether they ever would is the question this lens exists for, and
  the two have been confused before: a flower nobody could grow passed every test for
  months because the test hand-placed the one state the game could not reach.
- **A cap met is not depth earned.** The clause caps are counted mechanically, so an
  element can hit 4-6 roles by splitting one idea into four sentences. Ember is the
  opposite case worth knowing: 3 documented roles, five distinct felt beats, and the matrix
  says so out loud.

## What good output looks like

Specific, evidenced, and willing to say "this is fine". A review that finds something
wrong with all nineteen materials is not thorough, it is uncalibrated. Three sharp
findings with crops beat a table of adjectives.

Design taste is welcome — this is a design skill, and "the palette feels muddy beside
the moss" is a legitimate thing to say. Just never let it wear the costume of a
measurement.
