# Cozy Pixel Sandbox Agent Guide

Use this file as the repo-level operating guide for Codex or any other coding agent. Keep it short, accurate, and tied to real friction in this project.

## Project Shape

- `app/src/App.tsx` owns the main UI shell and state orchestration. Keep new feature UI in focused components when it removes real top-level weight.
- `app/src/engine.ts` loads the Rust/WASM sim and provides the JavaScript fallback. Any user-visible sim rule must stay in parity between Rust and fallback code.
- `sim/src/lib.rs` is the primary simulation source of truth.
- `app/src/rendering/*` is renderer-only material color, shape, neighbor, and glow logic. It may inspect sim cells, but it must not encode movement, creation, deletion, or transformation rules.
- `app/src/storage.ts` owns save/export/import validation and `CXS2` scene metadata.
- `app/src/audio/*`, `app/src/audio.ts`, `app/src/deskRadio.ts`, and `app/src/components/DeskRadioPanel.tsx` own generated audio and visible user-provided Desk Radio behavior.
- `scripts/*` contains the supported Windows-friendly build, test, preview, and visual QA entrypoints.
- `docs/ARCHITECTURE.md`, `docs/VISUAL_PIPELINE.md`, `docs/AUDIO.md`, `docs/HARNESS.md`, and `docs/CODE_REVIEW.md` are the source-of-truth project docs.

## Commands

On macOS/Linux, use the root npm scripts directly: `npm run check`, `npm run build`, `npm run test:sim`, `npm run test:wasm`, `npm run test:js-fallback`, `npm run test:browser`, `npm run material:audit`, `npm run audio:qa`, `npm run visual:qa`. Rust lives in `~/.cargo` (run `source "$HOME/.cargo/env"` if cargo is not on PATH).

On Windows, prefer the checked-in PowerShell wrappers. Direct `npm --prefix app run build` can still hit the known Windows/Vite access-denied path issue.

```powershell
.\scripts\build.ps1
.\scripts\check.ps1
.\scripts\test-sim.ps1
.\scripts\test-wasm.ps1
.\scripts\test-js-fallback.ps1
.\scripts\test-browser.ps1
.\scripts\audio-qa.ps1
.\scripts\visual-qa.ps1
.\scripts\preview-current.ps1 -Port 4181
.\scripts\test-chrome.ps1 -AppPort 4181
.\scripts\test-firefox.ps1 -AppPort 4181
```

Use `.\scripts\app-npm.ps1` for app-level npm commands when needed:

```powershell
.\scripts\app-npm.ps1 run build
.\scripts\app-npm.ps1 audit --audit-level=moderate
```

## Engineering Rules

- Keep changes scoped to the active phase or bug. Do not slip in broad refactors or cosmetic churn.
- Preserve user work in a dirty tree. Never reset, checkout, or revert unrelated files unless explicitly asked.
- Treat each coherent implementation batch as an atomic pass: implement, run the required browser/check path, commit, and push before starting the next pass.
- Prefer existing module boundaries over new abstractions. Add an abstraction only when it removes real duplication or makes a risky path easier to test.
- Use concrete names that describe behavior, not phase labels or vague helper names.
- Keep generated screenshots, browser captures, and temporary exports under `.tmp/` unless the user explicitly asks to commit them.
- Do not add a backend, account system, API key, scraper, hidden music playback, or automatic YouTube search/playlist selection. Desk Radio stays visible and user-controlled.
- If adding or changing a material interaction, update Rust sim behavior, JS fallback behavior, tests, and visual QA coverage together.
- If changing renderer visuals, keep behavior out of the renderer and capture a fresh visual QA scene.
- Colors are reviewed on pixels, not numbers. `material:contrast` only enforces a floor on each material's averaged palette; it cannot see per-variant or interaction-state colors, or the glow/shape/animation cues that also separate materials. So any change to `app/src/materials.ts` palettes/glows, `app/src/rendering/`, or the reaction rules must regenerate `npm run visual:qa` and confirm on `.tmp/visual-qa/material-identity-showcase.png` that every material and cell state reads distinctly — including the newest ones and their interaction outcomes. `material:audit` guarantees that board renders every material and every state, so nothing can be silently absent from what you review.
- If changing scene format, keep import validation strict and preserve legacy compatibility unless the user agrees to a breaking change.
- When the same issue appears twice in review or QA, promote it into a harness: a script, deterministic scene, smoke assertion, checklist item, or source-of-truth doc.

## Done Criteria

- Simulation changes: run `npm run test:sim`, `npm run test:wasm`, and `npm run test:js-fallback`, or the full `npm run check` (Windows: the matching `.ps1` wrappers).
- UI, export, audio, rendering, workflow, QA, or preview-related changes must include browser testing. Minimum browser gate is `npm run test:browser`; use `npm run check` for full closure.
- Documentation-only changes: run `git diff --check`; also run browser testing when the doc change affects workflow, QA, UI, audio, rendering, or preview expectations.
- After browser QA, report the exact local URL or capture path and the served JS/CSS bundle badge if the task involved stale-preview risk.
- If a check cannot run, say which check failed or was skipped and why.

## Code Review Bar

Use `docs/CODE_REVIEW.md` for review passes. The short version:

- Behavior is correct and covered by the right tests.
- Rust/WASM and JS fallback cannot silently drift.
- Renderer polish improves readability without becoming hidden sim logic.
- UX is tested in an actual browser path when visuals, layout, export, or Desk Radio changed.
- The diff is lean: no stale phase labels, dead helpers, speculative abstractions, or unexplained duplication.
- Repeated problems are captured in `docs/HARNESS.md` or tooling so future runs do not depend on memory.
