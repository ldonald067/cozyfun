# serialize-shared-state-mutations

**When several writers touch one piece of state, exactly one of them owns it.**
Everyone else asks the owner.

The classic reading is concurrency — two threads, one variable. In a React + Capacitor app
the shared state is rarely a lock; it is global mutable surface: the `<html>` element, the
`document.body` class list, CSS custom properties, the scroll position, the status bar.
These have no type system and no compiler warning. The failure mode is identical.

## Why

- **Theme.** `applyTheme()` mutates `document.documentElement` globally. `useAuth` writes
  it on session load, `ProfileModal` writes it on preview, `PublicProfileView` writes it on
  mount — and on unmount wrote `DEFAULT_THEME`, an unconditional guess about what was there
  before. A signed-in user on `emo-dark` who viewed a public page came back to Classic
  Xanga. The writer restored a value it never read.
- **Keyboard inset.** `--keyboard-inset` is written by one function and read by four CSS
  rules that each independently decided what to do about it. No owner, no invariant.
- **Modal scroll.** Every modal manages its own overflow; nothing owns `document.body`
  scroll locking, so a background scroll container stays live under an open composer.

## How to apply

- Name the owner in code, not in your head. An app-level provider, a single hook, a single
  CSS rule. If you cannot point at the owner, there isn't one.
- **Restore what you saved, never what you assumed.** A cleanup that writes a constant is a
  bug waiting for a second writer. Read the prior value on mount, restore that value.
- Global mutations belong behind the boundary that owns the resource. A leaf component
  reaching for `document.documentElement` is the smell.
- Order matters and is invisible. Two effects writing the same property will interleave
  differently under StrictMode, Suspense, and route changes than they do in your head.

## Filing against it

File when two or more components mutate the same global surface with no designated owner,
when a cleanup restores a hardcoded default rather than the captured previous value, or
when correctness depends on effects running in an order nothing enforces.

Do not file for state that is genuinely local, or for a single writer that happens to touch
a global — one writer is an owner.
