# Agent guide

**Read `CLAUDE.md` in this directory first — it is the operating guide for this repo and
applies to every coding agent, not only Claude.** It covers the commands, the Rust/JS parity
invariant that governs the whole simulation, the gotchas that have already cost time here,
and the working rules.

This file exists separately because Codex reads `AGENTS.md` rather than `CLAUDE.md`, and
Codex is the reviewer that `.claude/skills/adversarial-review/` spawns. It is deliberately
a pointer rather than a copy: two guides drift, and a stale guide is worse than none.

If you are reviewing rather than building, `docs/CODE_REVIEW.md` is the bar.
