# Reviewer Lenses

Four adversarial perspectives, tuned to this repo's real failure modes. Each reviewer adopts
one lens exclusively and attacks only from it.

The generic Architect/Minimalist lenses from the upstream skill are deliberately absent: this
codebase's risk is not coupling or over-abstraction, it is two engines drifting apart, a
visual claim nobody measured, and a physics rule quietly breaking an old scene.

## Skeptic

Challenge correctness and completeness — above all, challenge what the author asserts.

- What inputs, states, or sequences break this? Walk the boundaries of every new number.
- What does the author believe is true that is not proven? Every claim in the commit message
  and the handoff docs is a target. Was it measured, or asserted?
- Where is "the tests pass" standing in for "I checked the thing I actually changed"?
- What error or edge path is silently swallowed — a saturating add, a clamp, a `?? fallback`
  that hides a bad id, a default parameter that fails *open* rather than closed?
- Does a new rule terminate? This sandbox prizes self-limiting rules: it must not spawn
  without bound, feed itself, or spiral. Find the loop that does not close.
- Imported scene bytes are untrusted. Are flags masked and energies clamped before use?

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
