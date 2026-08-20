# subtract-before-you-add

**Deletion is the first tool you reach for, not the last.**

Before adding a rule, a component, a prop, or a wrapper, establish that removing something
would not solve the problem better.

## Why

Every added mechanism must be maintained, understood by the next reader, and — worst —
reasoned about in combination with every other mechanism. The keyboard collapse was not
caused by a missing rule. It was caused by three rules too many. The fix was subtraction.

Standing examples in this codebase:

- `OnboardingFlow`, `ui/Button`, and `ui/Card` ship in the bundle graph with zero
  production call sites. `OnboardingFlow` carries four slides, animation variants, focus
  trapping, and its own CSS block.
- The Classic Xanga palette exists twice — ~40 variables in `index.css` and again in
  `themes.ts` — with a comment asserting the two are kept identical by hand.
- `VALIDATION` renames the fields of `PROFILE_LIMITS` into camelCase and adds two fields
  nothing reads.
- `.xanga-link` is defined in two separate blocks, and elements carrying the class also
  carry an inline `min-h-[44px]` that the class already provides.

None of these are bugs. All of them are surface that must be kept correct forever.

## How to apply

- Two sources of truth for one fact is a defect even while they agree. They agree until
  they don't, and the divergence surfaces as a rendering glitch nobody can attribute.
- An abstraction with one call site is not an abstraction. Inline it.
- Dead code is not free — it is read, searched, refactored, and type-checked forever.
- Visual dead space is often deleted rather than restyled: it is usually a redundant
  wrapper or a second element applying padding the parent already applied.
- Ask "what happens if I delete this?" before "what should I add?"

## Filing against it

File duplicated sources of truth, single-call-site abstractions, unreferenced components,
dead props and fields, and redundant declarations. Say concretely what to delete.

Do not file the product itself. On this project the retro flourishes — sparkles, marquee,
garish themes — are the deliverable, not excess.
