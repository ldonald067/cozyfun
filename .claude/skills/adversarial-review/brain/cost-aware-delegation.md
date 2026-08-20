# cost-aware-delegation

**Every mechanism delegates an ongoing cost to someone. Name who pays, and how often.**

On a solo project the answer is always the same person, forever. That makes the bar higher
than on a team, not lower.

## Why

This project's charter is explicit: _if a feature requires ongoing moderation, storage
costs, or maintenance — don't build it._ That is a real constraint, and it is the reason to
check the recurring cost of a mechanism before its build cost.

Costs come in kinds, and the invisible ones dominate:

- **Operational** — an API call per save, a queue someone must watch, a report inbox.
- **Maintenance** — two files that must be edited together; a schema change that must be
  applied by hand in a dashboard because `supabase db push` is blocked here.
- **Cognitive** — a rule whose effect can only be determined by reading four other files.
- **Verification** — a surface that can only be checked by launching a simulator.

The hand-applied migration process is the standing example: the migration history table
holds 1 row of 40+, so every schema claim costs a production query to verify. That cost is
paid on every future task, by one person.

## How to apply

- Before adding a mechanism, state its recurring cost in a sentence. If you can't, you
  don't understand it yet.
- Duplication has a maintenance cost even when nothing is wrong today — the palette in two
  files must be edited twice, correctly, forever.
- Prefer mechanisms whose cost is paid once at build time over ones paid on every change:
  generate the duplicate rather than documenting that it must be kept in sync.
- Distinguish costs the project chose from costs that crept in. A UGC report path is
  mandatory under App Review Guideline 1.2 — that cost was accepted deliberately when the
  app shipped user-generated pages, and re-litigating it is challenging the intent.

## Filing against it

File when a mechanism creates recurring operational, maintenance, or verification burden
disproportionate to its benefit, and say who pays and how often.

Do not file against costs the project has explicitly chosen, or against compliance
requirements. "Delete the feature" is intent-challenging, not review — see the reviewer
conduct rules in [[principles]].
