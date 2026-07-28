---
name: adversarial-review
description: >-
  Adversarial code review of the working diff using the opposite model. Spawns 1-4 Codex
  reviewers, each attacking from a lens matched to this repo's real failure modes (engine
  parity, perceptual claims, fixture drift, correctness). Produces a synthesized verdict;
  makes no changes. Triggers: "adversarial review".
schedule: "Before committing a batch that changes a sim rule, a renderer path, or 200+ lines"
---

# Adversarial Review

Spawn reviewers on the **opposite model** to attack the current work. The deliverable is a
synthesized verdict — **do NOT make changes**.

**Hard constraint:** reviewers MUST run via `codex exec`. Do NOT use the Agent tool,
subagents, or any internal delegation as a reviewer — those run on your own model and share
your blind spots, which is the entire point of this skill. (Adapted from pedronauck/skills;
the cross-model constraint and the fail-loud/lead-judgment structure are theirs.)

Preflight: `codex login status` must report a logged-in account. If it does not, stop and
tell the user to run `codex login` — do not silently fall back to same-model review.

## Step 1 — Load the bar

Read `docs/CODE_REVIEW.md` (this repo's no-slop checklist). Skim `docs/ARCHITECTURE.md` for
the engine boundary and `docs/VISUAL_PIPELINE.md` when the diff touches rendering. These
govern reviewer judgments; the reviewers get the relevant file contents, not summaries.

## Step 2 — Scope and intent

Identify the diff under review (default: `git diff` plus staged changes; if the branch is
already committed, `git diff main...HEAD`).

State the **intent** explicitly — what the author is trying to achieve. Reviewers challenge
whether the work *achieves the intent well*, not whether the intent is correct. Include any
claim the author has made about the result ("steam no longer out-glows fire", "parity holds"),
because an unproven claim is the single most valuable thing for a reviewer to attack.

## Step 3 — Pick lenses by what the diff touches

Lens selection is content-aware here, not purely size-based — this repo's risks are specific.
Read `references/reviewer-lenses.md` for the full lens text.

| Trigger | Lens | Why |
| --- | --- | --- |
| always | **Skeptic** | correctness, unhandled states, unproven claims |
| `sim/src/lib.rs` or `app/src/engine.ts` | **Parity** | the two engines must stay byte-identical |
| a new or changed sim rule | **Drift** | new physics silently breaks old scenes and fixtures |
| `app/src/rendering/**`, `materials.ts`, `visual-qa.mjs`, `material-showcase.mjs` | **Perceptual** | visual claims get asserted instead of measured |

Cap at 4 reviewers. For a diff under ~50 lines touching one area, Skeptic alone is enough.

## Step 4 — Spawn reviewers in parallel

```sh
REVIEW_DIR=$(mktemp -d /tmp/adversarial-review.XXXXXX)
```

One `codex exec` per lens, all in background, then collect:

```sh
codex exec --skip-git-repo-check -o "$REVIEW_DIR/skeptic.md" "PROMPT" < /dev/null 2>/dev/null
```

**`< /dev/null` is required.** When stdin is not a TTY, `codex exec` treats it as piped input
to append to the prompt and blocks forever waiting on it — the reviewer hangs at "Reading
additional input from stdin..." and never starts. This bites every backgrounded invocation.

Name each output file after its lens (`skeptic.md`, `parity.md`, `drift.md`, `perceptual.md`).

Sandboxing: `codex exec` defaults to a read-only sandbox, which is right for most reviews but
blocks the evidence-gathering this repo rewards (a reviewer cannot bundle the renderer or run
the gate). Pass `-s workspace-write` when a lens needs to compute rather than read — Perceptual
almost always does — and say so in the verdict. Do not use `--profile edit`: `-p/--profile`
layers a *user-defined* config profile that does not exist on a stock install.

Each reviewer prompt contains, in order:

1. The repo path, and that it is a Rust+WASM falling-sand sandbox with a JS fallback engine.
2. The stated intent and any author claims from Step 2.
3. Their assigned lens, in full, from `references/reviewer-lenses.md`.
4. The relevant sections of `docs/CODE_REVIEW.md` (contents, not a summary).
5. The diff.
6. This instruction, verbatim:

   > You are an adversarial reviewer. Your job is to find real problems, not to validate the
   > work. Prefer evidence over opinion: run commands, read the code, compute the numbers.
   > Cite `file:line` and give a concrete failure scenario — the inputs or state that produce
   > the wrong result. Rate each finding high (blocks ship), medium (should fix), or low
   > (worth noting). If you cannot show a way the code actually fails, say so rather than
   > inventing a concern. Write findings as a numbered markdown list to your output file.

Useful evidence-gathering context to hand reviewers (this repo rewards measurement):

- Full gate: `source "$HOME/.cargo/env" && npm run check`. Parity alone: `npm run test:parity`.
- The renderer is pure functions — a reviewer can bundle and drive it directly:
  `esbuild app/src/rendering/materialColor.ts --bundle --format=esm` then call `colorForCell`,
  `hasGlow`, `glowIntensity` over a synthetic cell grid to get real numbers.
- Visual QA writes captures to `.tmp/visual-qa/*.png` at 4px per cell, so cell `(x,y)` is pixel
  `(x*4, y*4)`; python3 with PIL is available for sampling them.

## Step 5 — Verify, then synthesize

Before reading any output, confirm every reviewer actually produced something:

```sh
ls -l "$REVIEW_DIR"/*.md
```

If a file is missing or empty, **say so in the verdict** — never silently drop a reviewer.
A dead reviewer is not a pass. Either re-run that lens or run its checks yourself and mark
the finding as self-reviewed.

Deduplicate overlapping findings, then produce:

```
## Intent
<what the author is trying to achieve>

## Verdict: PASS | CONTESTED | REJECT
<one line>

## Reviewers
<lens -> completed / failed, and the CLI used>

## Findings
For each, ordered high -> low:
- **[severity]** description with file:line
- Lens: which reviewer raised it
- Evidence: the number, command output, or failing case cited
- Recommendation: a concrete action

## What Went Well
<1-3 things reviewers probed and found sound>
```

Verdict logic: **PASS** — no high findings. **CONTESTED** — high findings but reviewers
disagree. **REJECT** — high findings with consensus.

## Step 6 — Lead judgment

Reviewers are adversarial by design and will overreach. Apply your own judgment against the
intent and `docs/CODE_REVIEW.md`, and for every finding state accept or reject with a one-line
reason. Call out false positives, style-as-substance, and findings that misread the codebase.

Two failure modes specific to this repo, worth checking before you accept a finding:

- A Minimalist-flavoured reviewer will call the duplicated Rust/TS engine logic redundant and
  propose deduplicating it. That duplication is the core invariant. Reject it.
- A reviewer without the capture files will judge a visual claim from source alone. That is an
  opinion, not evidence — mark it low unless it comes with numbers.

Append:

```
## Lead Judgment
<finding -> accept | reject, one-line rationale each>
```
