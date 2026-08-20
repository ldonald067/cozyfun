# boundary-discipline

**Every responsibility has exactly one owner, and the owner is named.**
A responsibility applied "wherever it seemed needed" is a responsibility with no owner.

## Why

The safe-area inset is the cleanest example. `<header>` carries `safe-area-top`, which pads
it by the notch inset. Then the gradient banner _inside_ the header independently sets
`paddingTop: max(0.5rem, env(safe-area-inset-top))`. Both authors were solving "content
must clear the Dynamic Island." Neither was wrong locally. The result is ~59pt of empty
gradient on a notched iPhone — dead space in a layout whose stated goal is density.

Same shape, different resource: modal dimensions are owned by `ModalOverlay`/`ModalFrame`,
but modal _lifecycle_ — body-scroll locking, focus containment, keyboard inset, cleanup —
is owned by nobody, so it is re-implemented, partially, per dialog.

Boundary violations do not announce themselves as bugs. They announce themselves as
layouts that are subtly wrong in ways nobody can attribute.

## How to apply

- For any cross-cutting concern — safe areas, keyboard, scroll lock, focus, theme, status
  bar — write down which component owns it. One. Descendants use ordinary spacing.
- Apply an environment inset at the boundary where the environment meets the app: the page
  or shell edge. Never again below it.
- If a concern is genuinely needed at two levels, that is a design decision requiring a
  named invariant, not a coincidence of two developers reaching for the same `env()`.
- Native-platform awareness belongs behind `src/lib/capacitor.ts`. A component importing
  `@capacitor/*` directly is a leak.

## Filing against it

File when the same environmental quantity is applied at multiple nesting levels, when a
concern is implemented per-caller because no shared owner exists, or when a leaf reaches
past its boundary to mutate a global.

Do not file for ordinary composition. A parent setting padding and a child setting padding
is normal; the finding requires that they apply the _same_ quantity for the _same_ reason.
