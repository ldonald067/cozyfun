# outcome-oriented-execution

**Ship the outcome the user asked for, not the artifact that demonstrates thoroughness.**

Thoroughness that does not change the outcome is cost with no benefit — and it reliably
crowds out the work that would have.

## Why

The composer collapsed to zero height on iOS while the repo contained 239 passing tests,
eight documented skills, a virtualized feed, and per-modal focus trapping. The
infrastructure was extensive. The outcome — "a person can write a journal entry on their
phone" — was broken. Effort had gone into artifacts that looked like quality rather than
into the one surface where quality is observable.

The same inversion in miniature: the feed runs TanStack virtualization, an
`IntersectionObserver`, a `ResizeObserver`, `visualViewport` listeners, and manual height
measurement — for a solo blog that already paginates. The measured outcome (a scrollable
list of the fetched page) did not require any of it, and the machinery is what produced the
nested-scroll and minimum-height defects.

## How to apply

- State the outcome in the user's terms before starting. Not "add keyboard handling" —
  "the person can see what they are typing with the keyboard up."
- When work grows, check whether the growth serves that sentence. Usually it serves a
  proxy: coverage, symmetry, completeness, defensiveness.
- Finish the whole ask. Partial delivery dressed up with infrastructure is worse than a
  small complete thing, because it hides what is missing.
- Copy is part of the outcome. `ERROR_MESSAGES` is written in a careful 2005 voice, and
  then the crash screen says "Oops! 😵 Something went wrong rendering this page" — generic
  filler sitting three files from the authored version. The user sees the filler.

## Filing against it

File when effort is concentrated away from the surface the stated outcome lives on, when a
mechanism exists without a demonstrated requirement, or when user-facing copy is
placeholder-grade while the surrounding work is careful.

Do not file "this is over-engineered" as a bare assertion. Name the outcome, then show what
the mechanism adds to it — nothing.
