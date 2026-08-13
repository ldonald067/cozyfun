# Renderer rules

## The boundary

**Renderer code MUST NOT encode sim rules.** These modules may read cells; they must never
move, create, destroy or transform them. If a change needs a cell to exist that the sim did
not put there, it belongs in `sim/src/lib.rs`, not here.

Reading neighbours *is* allowed and is how most of the identity work happens — a bloom cell
knows it is a petal because of what surrounds it. The line is between reading state and
inventing it.

## Visual claims are measurable, so measure them

Asserting "it reads better now" has produced wrong answers here more than once. The renderer
is pure functions and QA writes real captures, so there is no excuse for guessing:

```bash
npm run visual:qa   # writes .tmp/visual-qa/material-identity-showcase.png
```

Any change to `materials.ts`, this directory, or reaction rules MUST regenerate that capture
and be judged on it. `material:contrast` only compares averaged palettes — it cannot see
per-variant colour, interaction states, glow, shape or animation.

A palette edit also moves the **site icon**, which imports `SPECIES[0]` and the Stem entry
rather than copying them. `npm run icons:check` fails the gate until `npm run icons`
regenerates the committed files.

Crop and look at the actual pixels rather than the whole board. Two silhouettes in this repo
were redrawn only after a crop showed them reading as coloured rectangles.

## The showcase is a live scene

`scripts/material-showcase.mjs` is loaded into the running app and captured a beat later, so
the sim keeps running on it. Three consequences, each learned from a ruined capture:

- An exhibit painted in a state the sim immediately leaves does not survive to the picture.
- Display stands and planters MUST be Wall; anything else falls.
- Loose material above an exhibit lands on it. Keep exhibits out of any column that a powder
  pile falls down.

Deeper detail — layers, shape language per material, the glow contract: @../../../docs/VISUAL_PIPELINE.md
