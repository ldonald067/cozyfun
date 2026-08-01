# Harness Engineering

Harness engineering means improving the feedback loops around the sandbox so good changes become easier to make and bad patterns become harder to repeat. For this repo, the harness is the combination of scripts, deterministic scenes, browser captures, docs, and review rules that make agent work legible.

## Current Harnesses

The root npm scripts are the entrypoints. Each has a Windows `.ps1` wrapper in `scripts/` that adds repo-local tool paths; the wrappers run the same underlying steps.

- `npm run build`: builds Rust/WASM, copies the WASM into `app/public/sim`, and builds the Vite app.
- `npm run check`: the full local gate, in order — material identity audit, material contrast floor, Rust sim tests, production build, WASM smoke, JS fallback smoke, cross-engine parity, subpath build, audio reactions, browser smoke, audio QA, and visual QA. Twelve stages; if you are listing them anywhere, take the list from `package.json` rather than from memory.
- `npm run test:parity`: drives 17 scenarios through the Rust/WASM sim and the JS fallback together and asserts every cell byte matches on every tick. This is the only gate that can see the two engines diverge — the single-engine smokes below can both pass while behaviour has drifted.
- `npm run material:contrast`: fails when any two material palettes fall below the averaged-colour distance floor. It cannot see per-variant, interaction-state, glow, shape or animation differences, so it is a floor and not a verdict.
- `npm run test:audio-reactions`: asserts the post-tick reaction detector emits the right cues for each material transition.
- `npm run test:subpath`: builds at a non-root base and asserts no root-absolute asset path survives, so embedding the sandbox under a path on another site cannot silently regress into the JS fallback engine.
- `npm run material:audit`: validates that every material definition has two concrete identity traits and the right number of documented interaction roles — **4-6 for toolbar materials, 1-3 for generated-only outcomes and the Eraser** — before a new element can pass review. It also asserts the visual review board renders every material and every cell-state flag.
- `npm run test:sim`: validates Rust simulation behavior.
- `npm run test:wasm`: validates the WASM bridge and key sim outcomes from JavaScript.
- `npm run test:js-fallback`: validates JS fallback parity for user-visible sim behavior.
- `npm run test:browser`: drives the built app through core UI, local ambience asset decoding, sharing, import/export, and Desk Radio paths. It starts its own static server.
- `npm run visual:qa`: captures deterministic material scenes, room backdrops, and responsive layout metrics into `.tmp/visual-qa`.
- `npm run audio:qa`: writes a native ambience manifest for local audio asset size, target loop length, and mood/room balance review into `.tmp/audio-qa`.
- `node scripts/preview-dist.mjs 4181`: serves the built `app/dist` with bundle badges so stale browser sessions are obvious. Build first. (Windows: `.\scripts\preview-current.ps1 -Port 4181` rebuilds and serves in one step.)
- `npm run test:chrome` / `npm run test:firefox`: **Windows-only** — they shell out to PowerShell. They drive a *visible* browser against a preview server you started yourself, which is how to watch a QA run rather than read its result. Port via `CHROME_QA_APP_PORT` / `FIREFOX_QA_APP_PORT`, default 4173.

## Golden Principles

- Keep `CLAUDE.md` a map, not a manual: it is loaded every session, so it earns its length only by preventing mistakes. Deeper source-of-truth detail belongs in `docs/`, reached by reference. `AGENTS.md` stays a pointer to it rather than a second copy.
- Turn repeated review feedback into a script, smoke test, deterministic scene, checklist item, or architecture doc update.
- Prefer deterministic QA scenes over ad hoc visual judgment when a material or interaction changes.
- Treat material identity as a checked contract: a toolbar element should have a clear role before it ships.
- Make stale state visible. Preview and QA pages should expose the served bundle badge or capture path.
- Keep sim behavior mechanically legible: Rust, WASM smoke, and JS fallback checks should agree on user-visible rules.
- Keep renderer rules mechanically separate from sim rules. Renderer tests can judge readability, but not encode behavior.
- Validate data at boundaries. Scene imports, shared metadata, and external playback sources should be parsed before trusted.
- Clean small drifts continuously. Dead exports, stale phase labels, duplicated QA helpers, and speculative abstractions should not wait for a giant cleanup phase.

## When To Add Harness

Add or improve harness when one of these happens:

- A bug required manual browser reproduction.
- The user had to ask whether screenshots or previews were current.
- A sim rule changed in Rust but needed a separate reminder to update the JS fallback.
- A review comment caught the same category of issue twice.
- A visual improvement cannot be checked without staring at a hand-painted scene.
- A native sound change cannot be evaluated from code shape alone.
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

- Keep `docs/MATERIAL_AUDIT.md` aligned with `app/src/materials.ts` when adding, removing, or specializing a material. A toolbar material documents 4-6 concrete interaction roles; a generated-only outcome documents 1-3. Both bounds are enforced, so a material that outgrows its cap needs a row edit in the same change.
- Extend `scripts/material-showcase.mjs` when renderer changes affect material readability.
- Run `npm run material:audit` before broader checks when editing material definitions.

## Cleanup Targets

- Shared browser QA helpers should keep Chrome, Firefox, smoke, and visual scripts from drifting.
- Material readability changes should extend the deterministic showcase instead of creating one-off scenes.
- `App.tsx` should get lighter over time by moving feature surfaces into focused components or hooks.
- Review passes should scan for stale phase labels, dead helpers, duplicate QA logic, unmirrored sim rules, and stale visual captures.
- If Desk Radio or sharing behavior changes, the browser harness should cover both success and blocked/fallback paths.
