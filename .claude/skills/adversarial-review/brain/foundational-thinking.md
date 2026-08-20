# foundational-thinking

**Solve the problem one level below the symptom** — at the layer where the decision that
caused it was made.

## Why

Responsive behavior in this codebase is decided in four unrelated places: global CSS calls
480px the phone boundary, modal positioning switches at `min-width:640px and
min-height:700px`, the sidebar holds until Tailwind's `lg`, and filter columns switch at
`md`/`xl`. Every threshold was locally reasonable. Together they mean a 430pt iPhone Pro Max
sits above the 480px "phone" rules and below every `sm:` — receiving neither treatment on
several surfaces.

You cannot fix that with a breakpoint. Each new one adds a fifth opinion about what "phone"
means. The foundation is missing: there is no shared definition of the viewport tiers the
app supports, so every component invents one.

Same for typography. A goal of "labels fit on one line" and a goal of "respect Dynamic
Type" are in genuine tension. With no type scale, that tension is resolved incidentally,
differently, in every component.

## How to apply

- When you find yourself adding the fourth special case, stop and ask what the three
  existing ones failed to express. That is the missing foundation.
- Magic numbers scattered across files are a foundation that was never written down.
  Consolidating them into a named scale is usually the whole fix.
- Distinguish _the system is missing_ from _the system is wrong_. Missing is a bigger, more
  valuable finding, and it is the one authors reliably don't see from inside.
- A foundation is only worth building when it has real second and third users. One call
  site does not need a system — see [[subtract-before-you-add]].

## Filing against it

File when independent thresholds, scales, or vocabularies for the same concept coexist and
their gaps produce user-visible wrongness. Name the concept that should have been shared.

Do not file "this should be more abstract" without a concrete failure the missing
abstraction causes. Architecture findings need a victim.
