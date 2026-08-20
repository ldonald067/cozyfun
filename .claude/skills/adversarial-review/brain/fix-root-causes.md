# fix-root-causes

**Treat the mechanism, not the symptom.** A change that leaves the mechanism intact has
bought time, not correctness — and it has usually made the next occurrence harder to find.

## Why

Symptomatic fixes accumulate into designs nobody can reason about. The keyboard-inset bug
is the archetype: each of the four rules that applied `--keyboard-inset` was individually
a reasonable response to "content is hidden behind the keyboard." Nobody was wrong locally.
The bug was that four places each fixed the same symptom, and their sum collapsed the
composer. A fifth patch — a `min-height` on the body, say — would have hidden the collapse
and left the arithmetic broken.

The tell is a fix that adds a compensating term rather than removing the cause of the
imbalance.

## How to apply

- Before changing a value, find every place that already changes it. Grep the variable,
  the class, the CSS custom property. If the answer is more than one, the fix is
  consolidation, not another term.
- Prefer removing a cause over adding a correction. `max-height` that already excludes the
  keyboard needs no descendant padding; deleting the padding beats adding a clamp.
- When a failure is silent, fixing the silence is part of fixing the bug. `nativeOnly()`
  swallows every plugin failure, which is right for optional flourishes like haptics and
  wrong for the keyboard listeners the layout depends on.
- Ask what made the bug reachable, not just what made it happen. The keyboard collapse was
  reachable because no verification surface exercised native keyboard behavior.

## Filing against it

File when a change compensates for a defect that another line of the same system created,
when the same quantity is adjusted in multiple independent places, or when an error path
is swallowed so that the root cause cannot be observed.

Do not file when a local fix genuinely is the root fix. Not every bug has a deeper story,
and inventing one is its own failure.
