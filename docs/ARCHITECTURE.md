# Cozy Pixel Sandbox Architecture

This project is a static browser toy: React owns the interface, Rust/WASM owns the primary simulation, and Canvas owns the rendered sandbox. The codebase should stay small, direct, and easy to reshape while the feel of the toy is still evolving.

## Core Flow

1. `app/src/App.tsx` creates the engine, owns UI state, and forwards pointer input to `engine.paint`.
2. `app/src/engine.ts` loads the Rust/WASM simulation when available and falls back to a JavaScript simulation if the WASM file is missing.
3. `sim` contains the Rust cellular automata rules.
4. `app/src/renderer.ts` converts the engine cell bytes into base, glow, and atmosphere canvas layers.
5. `app/src/storage.ts` handles browser-local saves and JSON scene import/export.
6. `app/src/audio.ts` exposes the optional procedural Web Audio controller.

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
- `ambience.ts`: long-running environment layers.
- `music.ts`: procedural rainy lo-fi bed.
- `effects.ts`: material and UI one-shots.

This keeps Phase 3 music work reusable without burying composition, mixer state, and sound effects in one file.

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

- Prefer deterministic procedural visuals over asset files for V0.
- Keep simulation behavior and visual polish separate.
- Keep audio optional and user-initiated.
- Keep exported scene data stable and validated.
- Add small abstractions only when they make the next material or test easier.
