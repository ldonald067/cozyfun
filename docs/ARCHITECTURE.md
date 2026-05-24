# Cozy Pixel Sandbox Architecture

This project is a static browser toy: React owns the interface, Rust/WASM owns the primary simulation, and Canvas owns the rendered sandbox. The codebase should stay small, direct, and easy to reshape while the feel of the toy is still evolving.

## Core Flow

1. `app/src/App.tsx` creates the engine, owns UI state, and forwards pointer input to `engine.paint`.
2. `app/src/engine.ts` loads the Rust/WASM simulation when available and falls back to a JavaScript simulation if the WASM file is missing.
3. `sim` contains the Rust cellular automata rules.
4. `app/src/renderer.ts` converts the engine cell bytes into base, glow, and atmosphere canvas layers.
5. `app/src/storage.ts` handles browser-local saves and JSON scene import/export.
6. `app/src/audio.ts` exposes the optional procedural Web Audio controller.
7. `app/src/sceneEnvironments.ts` provides non-destructive room/backdrop definitions and their local image metadata.
8. `app/src/reactions.ts` detects coarse visual/audio reaction events from before/after cell snapshots.

The built app is static. There is no server, account system, database, cloud save, streaming dependency, or paid API in the current architecture.

## Simulation Boundary

The simulation stores each cell in an 8-byte record:

- kind/material id
- visual variant
- age
- energy
- reserved bytes for future state

Rendering is allowed to inspect these bytes, but it should not mutate them. Visual polish belongs in the renderer unless a real behavior change is needed.

## Rendering Boundary

`app/src/renderer.ts` should stay orchestration-focused:

- size the canvases
- read cell bytes
- write base pixels
- write glow pixels
- draw global atmospheric motes
- export postcards

Material-specific color and texture decisions live under `app/src/rendering`:

- `color.ts`: RGB helpers and clamping.
- `cells.ts`: read-only cell and neighbor helpers.
- `hash.ts`: deterministic visual noise.
- `materialColor.ts`: base material color, animation, fade, and glow.
- `shapeLanguage.ts`: neighbor-aware material texture and silhouette cues.

This split keeps Phase 2 visuals expandable without turning the renderer into a pile of unrelated rules.

## Audio Boundary

`app/src/audio.ts` should stay a public entrypoint. Audio implementation belongs under `app/src/audio`:

- `controller.ts`: lifecycle, user-gesture initialization, and app-facing methods.
- `mixer.ts`: channel graph and gain changes.
- `preferences.ts`: persistent audio settings.
- `moods.ts`: reusable sound mood definitions.
- `providers.ts`: generated/external music provider definitions.
- `ambience.ts`: long-running environment layers.
- `music.ts`: procedural rainy lo-fi bed.
- `effects.ts`: material and UI one-shots.

This keeps Phase 3 music work reusable without burying composition, mixer state, and sound effects in one file.

Future external music should enter through a provider boundary rather than replacing this audio system. Generated music remains the default. YouTube or any other third-party player should be isolated behind an external provider and shown as a visible mini-player, while ambience and effects continue to use the native procedural mixer.

## UI Boundary

Keep reusable controls in `app/src/components` when the same interaction pattern appears in more than one place. `SegmentedControl` is the first shared control and is used for sound moods, music source selection, and room backdrops.

The app should favor compact controls over explanatory panels. Tooltips and titles are acceptable for details like channel meaning; the first screen should remain the toy itself.

## Room Backdrops And Reactions

Visible room controls change CSS atmosphere, local backdrop images, and the default audio mood without mutating the simulation. The selected room is persisted in localStorage, separate from scene JSON. This keeps the sandbox personal: user-created pixels are not replaced by a preset.

Room images are served from `app/public/rooms` and referenced through scene metadata, then softened by CSS lighting, weather, and darkening layers. This keeps the source of truth in one small data file and prevents image paths from spreading across the UI. Third-party sources belong in `ASSET_CREDITS.md` and should be updated in the same change as any asset replacement.

`app/src/devSceneSeeds.ts` keeps painted starter worlds for internal QA and future experiments. They are not part of the main UI until the visuals are strong enough to justify replacing a user's canvas.

Reaction detection compares before/after cell bytes after a tick and emits a small set of event types for audio feedback. It should stay coarse and throttled; high-volume per-cell sound would make the sandbox noisy and expensive.

## Adding A Material

1. Add the material id to `MATERIAL` in `app/src/materials.ts`.
2. Add its label, slug, palette, group, and optional glow color to `MATERIALS`.
3. Add simulation behavior in Rust, and mirror only necessary fallback behavior in `app/src/engine.ts`.
4. Add a toolbar icon in `app/src/App.tsx`.
5. Add rendering rules in `app/src/rendering/shapeLanguage.ts` only if palette variation is not enough.
6. Extend smoke tests if the material changes common workflows.

## Testing

Local checks:

```powershell
.\scripts\build.ps1
.\scripts\test-wasm.ps1
.\scripts\test-browser.ps1
```

CI runs Rust tests, the production build, and browser smoke checks on every push and pull request to `main`.

## Design Rules

- Prefer deterministic procedural visuals for the sandbox itself; use local image assets only for room atmosphere when they strengthen the scene.
- Keep simulation behavior and visual polish separate.
- Keep audio optional and user-initiated.
- Keep exported scene data stable and validated.
- Keep third-party asset credits near the repo root for simple publishing audits.
- Add small abstractions only when they make the next material or test easier.
