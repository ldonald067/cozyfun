# Code Review Checklist

This checklist is the repo's "no slop" bar. Use it for `/review`, audit passes, and phase closeouts.

## Scope

- Does the change solve the stated task without dragging in unrelated refactors?
- Are names specific to behavior instead of vague helpers, old phase labels, or temporary experiment language?
- Did the change avoid new dependencies unless they clearly reduce risk or complexity?
- Are generated files, screenshots, logs, and exports kept out of tracked source unless explicitly requested?

## Simulation

- If Rust sim behavior changed, is the JavaScript fallback mirrored deliberately?
- Are imported scene bytes masked and validated before reaching sim state?
- Do tests cover the new rule in Rust, WASM smoke, and JS fallback when user-visible behavior can differ?
- Does each material keep a distinct role? For example, moss should read as damp carpet growth, fungus as decay pressure, seed as potential, oil as coating/smothering, and water as hydration/cooling.
- If a material was added or specialized, did `npm run material:audit` pass and does `docs/MATERIAL_AUDIT.md` still match the source traits?
- Are ordinary material reactions grounded while cosmic materials keep the special cases?

## Rendering

- Does renderer code stay presentational? Movement, creation, deletion, and transformation rules belong in the sim.
- Can the material be recognized at normal play zoom, not only in close inspection?
- Do wet, frozen, scorched, rooted, and cosmic states have visible but not noisy cues?
- Does the deterministic visual QA showcase cover any new visual rule?
- Are canvas captures fresh when the user is checking current visuals?

## UX

- Does the first screen remain the sandbox experience instead of a documentation panel?
- Do controls fit on desktop and mobile without overlap or hidden essential actions?
- Do save, import, export, postcard, and clip flows leave the user with clear success or failure feedback?
- Does Desk Radio stay visible, user-provided, and editable when YouTube blocks embedding?
- Does native ambience remain the default and fallback path?
- If native sound changed, did `npm run audio:qa` produce fresh `.tmp/audio-qa` references for listening review?

## Security And Privacy

- No hidden YouTube playback, scraping, automatic playlist picking, API keys, backend playback proxy, or account dependency.
- Scene import rejects malformed, oversized, wrong-version, or wrong-size input before loading.
- Export metadata stores only safe room, sound, sim, and validated user-provided source details.
- Third-party visual or audio asset changes update `ASSET_CREDITS.md` in the same change.

## Maintainability

- Is large React state being isolated into existing or focused components instead of making `App.tsx` heavier?
- Are common QA helpers shared instead of copy-pasted across Chrome, Firefox, smoke, and visual scripts?
- Are docs updated only where they are the source of truth?
- Does the roadmap status match the actual phase state?
- Did any repeated review finding get promoted into harness guidance, a script, a smoke assertion, or a deterministic visual scene?
- Does the final answer list checks run and any remaining risk plainly?

## Closeout Checks

Use the smallest honest gate for the change:

- Docs only: `git diff --check`.
- Sim behavior: `npm run test:sim`, `npm run test:wasm`, and `npm run test:js-fallback`.
- Native audio direction: `npm run audio:qa`.
- UI, browser, visual, audio, export, or cross-boundary work: `npm run check`.
- Stale-preview or visual concern: `.\scripts\preview-current.ps1 -Port 4181` on Windows (or rebuild and serve `app/dist` with `node scripts/preview-dist.mjs`), then browser or script-based visual QA against that URL.

See `docs/HARNESS.md` when a missing check, stale preview, duplicated QA helper, or repeated cleanup issue should become part of the repo's feedback loop.
