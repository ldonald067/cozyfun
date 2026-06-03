# Harness Engineering

Harness engineering means improving the feedback loops around the sandbox so good changes become easier to make and bad patterns become harder to repeat. For this repo, the harness is the combination of scripts, deterministic scenes, browser captures, docs, and review rules that make Codex work legible.

## Current Harnesses

- `.\scripts\build.ps1`: builds Rust/WASM, copies WASM, and builds the Vite app with the repo-local Windows-safe tool path.
- `.\scripts\check.ps1`: runs the full local gate: material identity audit, Rust sim tests, WASM smoke, JS fallback smoke, production build, browser smoke, audio QA renders, and visual QA.
- `npm run material:audit`: validates that every material definition has two concrete identity traits before a new element can pass review.
- `.\scripts\test-sim.ps1`: validates Rust simulation behavior.
- `.\scripts\test-wasm.ps1`: validates the WASM bridge and key sim outcomes from JavaScript.
- `.\scripts\test-js-fallback.ps1`: validates JS fallback parity for user-visible sim behavior.
- `.\scripts\test-browser.ps1`: drives the built app through core UI, sharing, import/export, and Desk Radio paths.
- `.\scripts\visual-qa.ps1`: captures deterministic material scenes, room backdrops, and responsive layout metrics.
- `.\scripts\audio-qa.ps1`: renders deterministic WAV references for generated sound review into `.tmp/audio-qa`.
- `.\scripts\test-chrome.ps1 -AppPort 4181`: verifies the current preview in Chrome or Edge when an actual browser path matters.
- `.\scripts\test-firefox.ps1 -AppPort 4181`: verifies Firefox when supported by the local environment.
- `.\scripts\preview-current.ps1 -Port 4181`: rebuilds and serves `app/dist` directly with bundle badges so stale browser sessions are obvious.

## Golden Principles

- Keep `AGENTS.md` as a map, not a manual. Put deeper source-of-truth detail in `docs/`.
- Turn repeated review feedback into a script, smoke test, deterministic scene, checklist item, or architecture doc update.
- Prefer deterministic QA scenes over ad hoc visual judgment when a material or interaction changes.
- Treat material identity as a checked contract: a toolbar element should have a clear role before it ships.
- Make stale state visible. Preview and QA pages should expose the served bundle badge or capture path.
- Keep sim behavior mechanically legible: Rust, WASM smoke, and JS fallback checks should agree on user-visible rules.
- Keep renderer rules mechanically separate from sim rules. Renderer tests can judge readability, but not encode behavior.
- Validate data at boundaries. Scene imports, shared metadata, and external music sources should be parsed before trusted.
- Clean small drifts continuously. Dead exports, stale phase labels, duplicated QA helpers, and speculative abstractions should not wait for a giant cleanup phase.

## When To Add Harness

Add or improve harness when one of these happens:

- A bug required manual browser reproduction.
- The user had to ask whether screenshots or previews were current.
- A sim rule changed in Rust but needed a separate reminder to update the JS fallback.
- A review comment caught the same category of issue twice.
- A visual improvement cannot be checked without staring at a hand-painted scene.
- A generated sound change cannot be evaluated from code shape alone.
- A script failure message does not tell the next agent what to fix.
- A docs rule is important enough that violating it should be caught mechanically.

## Harness Shape

A good harness improvement should include:

- Signal: what problem it catches.
- Command: how to run it locally.
- Artifact: screenshot, JSON metrics, console output, or failing assertion.
- Source of truth: the doc or module boundary it enforces.
- Failure message: enough context for the next agent to fix the issue without guessing.
- Closeout rule: where the command belongs in `docs/CODE_REVIEW.md` or phase closeout.

## Material Identity Targets

- Keep `docs/MATERIAL_AUDIT.md` aligned with `app/src/materials.ts` when adding, removing, or specializing a material.
- Extend `scripts/material-showcase.mjs` when renderer changes affect material readability.
- Run `npm run material:audit` before broader checks when editing material definitions.

## Cleanup Targets

- Shared browser QA helpers should keep Chrome, Firefox, smoke, and visual scripts from drifting.
- Material readability changes should extend the deterministic showcase instead of creating one-off scenes.
- `App.tsx` should get lighter over time by moving feature surfaces into focused components or hooks.
- Review passes should scan for stale phase labels, dead helpers, duplicate QA logic, unmirrored sim rules, and stale visual captures.
- If Desk Radio or sharing behavior changes, the browser harness should cover both success and blocked/fallback paths.
