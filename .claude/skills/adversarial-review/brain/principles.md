# Engineering Principles

The principles adversarial reviewers judge against. These are opinionated on purpose — a
reviewer working from generic "best practices" produces generic findings. Every principle
here is grounded in a failure this codebase actually had.

Reviewers: read the linked file for each principle in your lens before you file anything.
Cite the principle by slug in your findings.

## Correctness

- [[prove-it-works]] — a claim of "working" requires evidence from the surface the user
  touches, not from the surface that was convenient to test.
- [[fix-root-causes]] — treat the mechanism, not the symptom; a fix that leaves the
  mechanism intact is a delay, not a repair.
- [[serialize-shared-state-mutations]] — when several writers touch one piece of state,
  exactly one of them owns it.

## Structure

- [[boundary-discipline]] — every responsibility has one owner, and the owner is named.
- [[foundational-thinking]] — solve the problem one level below the symptom, where the
  decision that caused it lives.
- [[redesign-from-first-principles]] — when a design has accumulated enough patches that
  nobody can predict its behavior, replacing it beats patching it again.

## Economy

- [[subtract-before-you-add]] — deletion is the first tool reached for, not the last.
- [[outcome-oriented-execution]] — ship the outcome the user asked for, not the artifact
  that demonstrates thoroughness.
- [[cost-aware-delegation]] — every mechanism carries an ongoing cost that someone pays
  forever; on a solo project that someone is the operator.

## Reviewer conduct

These govern how findings are filed, not what the code should do.

1. **Verify before filing.** Read the code that would fail. If you cannot construct the
   failure by reading, either say the finding is unverified or drop it. A confidently
   wrong finding costs more than a missed one — it sends the author to break working code.
   A real example: a reviewer read `StatusBar.setStyle({ style: Style.Dark })` on dark
   themes and filed it as inverted. Capacitor documents `Style.Dark` as "light text for
   dark backgrounds" — the enum names the background. Following the recommendation would
   have created the bug the reviewer described.
2. **Do not challenge the intent.** You challenge whether the work achieves the stated
   intent. "This feature shouldn't exist" is out of scope unless the author asked.
3. **Style is not substance.** Naming preferences, formatting, and "I'd have done it
   differently" are not findings.
4. **Severity means something.** `high` blocks ship — a user hits it on a normal path.
   `medium` should fix. `low` is worth noting. Inflating severity destroys the signal.
5. **Ten sharp findings beat thirty padded ones.** If a focus area is genuinely clean,
   say so. Padding a list is the failure mode you exist to catch in others.
