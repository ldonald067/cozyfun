# Agent guide

**Read `CLAUDE.md` in this directory first — it is the operating guide for this repo and
applies to every coding agent, not only Claude.** It covers the commands, the Rust/JS parity
invariant that governs the whole simulation, the gotchas that have already cost time here,
and the working rules.

This file exists separately because Codex reads `AGENTS.md` rather than `CLAUDE.md`, and
Codex is the reviewer that `/adversarial-review` spawns. It is deliberately a pointer rather
than a copy: two guides drift, and a stale guide is worse than none.

That is not a hypothetical here. Two copies of the adversarial-review skill once existed at
the same time — one tracked in `.claude/skills/`, one in the operator's `~/.claude/skills/`
— drifted 175 lines apart, and the tracked one, which looked authoritative and was better
tailored to this repo, never executed once. The two were merged and the repo now carries the
single complete copy; nothing should be added to `~/.claude/skills/` for this project, or the
shadow comes back with the roles reversed.

If you are reviewing rather than building, `docs/CODE_REVIEW.md` is the bar.
