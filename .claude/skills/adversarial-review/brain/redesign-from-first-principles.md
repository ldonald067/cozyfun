# redesign-from-first-principles

**When a design has taken enough patches that nobody can predict its behavior, replacing it
beats patching it again.**

This is the rarest recommendation and the most expensive one. Earn it.

## Why

The keyboard-inset system reached the point where the correct behavior was not derivable by
reading any single file: four rules across two files, each adjusting the same custom
property, in a stack whose net effect depended on which of five classes a given modal
happened to use. Nobody could answer "what is the composer's body height with the keyboard
open?" without building the arithmetic by hand. That is the threshold.

The fix was not a fifth rule. It was a stated invariant — _exactly one element per scroll
context compensates for the keyboard_ — and deleting everything that violated it.

## How to apply

- The trigger is unpredictability, not ugliness. Code that is verbose but whose behavior
  you can state in one sentence does not qualify.
- Redesign means stating the invariant first, then deleting what contradicts it. A rewrite
  with no new invariant is a reshuffle.
- Scope honestly. "Replace this rule set" is a real proposal. "Rearchitect the app" is not
  a finding, it is an opinion with no owner and no cost estimate.
- Weigh it against the project's charter. On a solo, zero-overhead project, a redesign that
  is correct but doubles the surface to maintain is a bad trade — see
  [[cost-aware-delegation]].

## Filing against it

File when you can demonstrate that predicting the current behavior requires assembling
three or more files, _and_ you can state the invariant that would replace them.

Do not file a redesign when a bounded fix exists. If deleting three lines restores the
invariant, that is the finding — recommending a rewrite instead is overreach, and authors
correctly discount reviewers who do it.
