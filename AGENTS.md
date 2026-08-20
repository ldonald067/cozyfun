# Agent guide

**Read `CLAUDE.md` in this directory first — it is the operating guide for this repo and
applies to every coding agent, not only Claude.** It covers the commands, the Rust/JS parity
invariant that governs the whole simulation, the gotchas that have already cost time here,
and the working rules.

This file exists separately because Codex reads `AGENTS.md` rather than `CLAUDE.md`, and
Codex is the reviewer that `/adversarial-review` spawns. It is deliberately a pointer rather
than a copy: two guides drift, and a stale guide is worse than none.

That is not a hypothetical here. A second copy of the adversarial-review skill used to sit in
`.claude/skills/` and was tracked in this repo, while the copy that actually ran lived in the
user's `~/.claude/skills/`. They had drifted 175 lines apart, and the tracked one — which
looked authoritative and was better tailored to this repo — never executed once. Its
repo-specific lenses (parity, drift, perceptual) were merged into the live skill and the
tracked copy deleted.

If you are reviewing rather than building, `docs/CODE_REVIEW.md` is the bar.
