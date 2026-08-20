# Reviewer Lenses

Three distinct adversarial perspectives. Each reviewer adopts one lens exclusively.

## Architect

Challenge structural fitness. Ask:

- Does the design actually serve the stated goal, or does it serve a goal the author assumed?
- Where are the coupling points that will hurt when requirements shift?
- What boundary violations exist? Where does responsibility leak between components?
- What implicit assumptions about scale, concurrency, or ordering will break first?

Map findings to: boundary-discipline, foundational-thinking, redesign-from-first-principles.

## Skeptic

Challenge correctness and completeness. Ask:

- What inputs, states, or sequences will break this?
- What error paths are unhandled or silently swallowed?
- What race conditions or ordering dependencies exist?
- What does the author believe is true that isn't proven?
- Where is "it works on my machine" masquerading as verification?

Map findings to: prove-it-works, fix-root-causes, serialize-shared-state-mutations.

## Minimalist

Challenge necessity and complexity. Ask:

- What can be deleted without losing the stated goal?
- Where is the author solving problems they don't have yet?
- What abstractions exist for a single call site?
- Where is configuration or flexibility added without a concrete second use case?
- Is this the simplest possible path to the outcome, or is it the path that felt most thorough?

Map findings to: subtract-before-you-add, outcome-oriented-execution, cost-aware-delegation.

---

# Repo-specific lenses (cozyfun)

These three were written for this repository's actual failure modes and lived in a second,
shadowed copy of this skill under `.claude/skills/` that never ran. Pick them by what the
diff touches; they compose with the three general lenses above.

## Parity

Challenge whether the Rust source of truth and the JS fallback still agree, byte for byte.

`sim/src/lib.rs` and `app/src/engine.ts` implement the same simulation twice. `npm run
test:parity` runs scenarios through both and asserts every cell byte matches on every tick.
That harness only proves the paths it exercises — your job is the paths it does not.

- Read the two implementations of the changed rule side by side. Do they differ in *any*
  observable way: iteration order, RNG call count and ordering, saturation, clamp bounds,
  integer width, tick-parity gating, the order flags are applied?
- **RNG consumption is the classic divergence.** A `chance()` call on one side but not the
  other, or in a different order, desynchronizes both engines forever after. Count them.
- Does the new rule read `old` where the mirror reads `next`, or vice versa?
- Was a parity scenario added for this rule, and is it non-vacuous — does the scene actually
  reach the new code path, or does it pass because nothing ever triggers it? Prove it fires.
- Cells that float in a test scene drift: liquids side-hop ±2, gases rise, stone falls.
  Does a new scenario diverge for an unintended reason?

## Drift

Challenge what the change breaks that nobody looked at.

A new physics rule applies everywhere, not only where the author was thinking.

- Enumerate the existing scenes, fixtures, and tests the new rule now also acts on: cargo
  tests in `sim/src/lib.rs`, `scripts/smoke-*.mjs`, `scripts/material-showcase.mjs`, the
  room scenes. Which of them silently changes behavior?
- Fixtures are usually written assuming the *old* physics. A scene built as scenery — a
  floor, a frame, a display stand — may now move, fall, ignite, or decay.
- Does an existing test still assert what its name claims, or does it now pass for a
  different reason than the one it was written for? A test that passes vacuously is worse
  than one that fails.
- Does the change alter a documented interaction role in `docs/MATERIAL_AUDIT.md` without
  updating it, or push a row past the clause caps (toolbar 4-6, generated-only 1-3)?

## Perceptual

Challenge visual claims that were asserted rather than measured.

"It reads better now" is not evidence. Renderer code is pure functions over cell state, and
the QA harness writes real captures — so every visual claim in this repo is measurable, and
an unmeasured one is an opinion.

- For each visual claim, demand a number. Contrast against the `#091018` night background,
  luminance distribution, alpha envelope across the state's full reachable range.
- Compute the range, not one sample. Sweep `time` for the full pulse phase, and sweep energy
  and age across what the sim can actually produce — then check the endpoints and any
  branch boundary for a discontinuity that pops between frames.
- Is a state *distinguishable*? Two states that are individually visible but similar to each
  other still fail. Compute the distance between them at the smallest placement, at the
  worst phase, not the best.
- Does a fix hold at one cell, not just across a large block? Small placements are where
  identity treatments break.
- Is the claim reviewable at all — does anything in `scripts/material-showcase.mjs` actually
  show this state? A fix nobody can see on the board is a fix nobody will keep.
- Distrust the capture pipeline itself. `saveSandboxComposite` in `scripts/visual-qa.mjs`
  once drew the glow layer *underneath* the opaque base canvas, so every capture reviewed
  the night lights as if they did not exist, and several renderer bugs hid behind it for
  months. If a finding looks impossible, verify the harness before the renderer.
