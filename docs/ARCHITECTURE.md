# Cozy Pixel Sandbox Architecture

This project is a static browser toy: React owns the interface, Rust/WASM owns the primary simulation, and Canvas owns the rendered sandbox. The codebase should stay small, direct, and easy to reshape while the feel of the toy is still evolving.

## Core Flow

1. `app/src/App.tsx` creates the engine, owns UI state, and forwards pointer input to `engine.paint`.
2. `app/src/engine.ts` loads the Rust/WASM simulation when available and falls back to a JavaScript simulation if the WASM file is missing.
3. `sim` contains the Rust cellular automata rules.
4. `app/src/renderer.ts` converts the engine cell bytes into base, glow, and atmosphere canvas layers.
5. `app/src/storage.ts` handles browser-local saves and JSON scene import/export.
6. `app/src/audio.ts` exposes the optional local native audio controller.
7. `app/src/deskRadio.ts` validates user-provided YouTube Desk Radio sources and creates visible watch/embed URLs.
8. `app/src/sceneEnvironments.ts` provides non-destructive room/backdrop definitions and their local image metadata.

The built app is static. There is no server, account system, database, cloud save, hidden streaming dependency, or paid API in the current architecture. Native ambience is the default sound path; Desk Radio is an optional browser-side YouTube player selected by the user.

## Simulation Boundary

The simulation stores each cell in an 8-byte record:

- kind/material id
- visual variant
- age
- energy
- state flags (wet, rooted, cosmic, frozen, scorched) shared by sim, fallback, and renderer

Rendering is allowed to inspect these bytes, but it should not mutate them. Visual polish belongs in the renderer unless a real behavior change is needed.

## Rendering Boundary

`app/src/renderer.ts` should stay orchestration-focused:

- size the canvases
- read cell bytes
- write base pixels
- write glow pixels
- draw global atmospheric motes
- export postcards
- export short clips when `MediaRecorder` is available

Material-specific color and texture decisions live under `app/src/rendering`:

- `color.ts`: RGB helpers and clamping.
- `cells.ts`: read-only cell, edge, and neighbor-contact helpers.
- `hash.ts`: deterministic visual noise.
- `materialColor.ts`: base material color, animation, fade, and glow.
- `shapeLanguage.ts`: neighbor-aware material texture and silhouette cues.

This split keeps visual work expandable without turning the renderer into a pile of unrelated rules. Renderer-level interaction cues, such as moonwater tinting nearby fungus or lava darkening near water, may inspect neighbors but must remain presentation only. Any change that moves, creates, destroys, or transforms cells belongs in the simulation boundary.

## Audio Boundary

`app/src/audio.ts` should stay a public entrypoint. Audio implementation belongs under `app/src/audio`:

- `controller.ts`: lifecycle, user-gesture initialization, and app-facing methods.
- `mixer.ts`: channel graph and gain changes.
- `preferences.ts`: persistent audio settings.
- `moods.ts`: native ambience mood definitions.
- `providers.ts`: native/Desk Radio source definitions.
- `assets.ts`: local ambience recording metadata and decode cache.
- `ambience.ts`: long-running native rain, cat purr, and fire layers with in-memory loop extension.
- `cues.ts` and `reactions.ts`: short material and reaction feedback.

This keeps sound work reusable without burying lifecycle, room balance, and cue logic in one file.

External playback enters only through Desk Radio. Desk Radio parsing is isolated in `deskRadio.ts` and playback is shown as a visible mini-player, while ambience stays native and local.

## UI Boundary

Keep reusable controls in `app/src/components` when they remove real top-level UI weight. `SegmentedControl` is shared by sound moods, sound source selection, and room backdrops. `SharePanel` and `DeskRadioPanel` keep Phase 5 controls out of the main app orchestration without inventing a larger UI framework.

The app should favor compact controls over explanatory panels. Tooltips and titles are acceptable for details like channel meaning; the first screen should remain the toy itself.

## Room Backdrops

Visible room controls change CSS atmosphere, local backdrop images, and the default audio mood without mutating the simulation. The selected room is persisted in localStorage and included as metadata in `CXS2` scene JSON so shared scenes can restore their atmosphere without replacing the user's pixels with a preset.

Room images are served from `app/public/rooms` and referenced through scene metadata, then softened by CSS lighting, weather, and darkening layers. This keeps the source of truth in one small data file and prevents image paths from spreading across the UI. Third-party sources belong in `ASSET_CREDITS.md` and should be updated in the same change as any asset replacement.

## Sharing Boundary

`app/src/storage.ts` owns scene snapshots. `CXS2` files include validated share metadata for room, sound mood, native/external source marker, and an optional Desk Radio source. Imports still accept legacy `CXS1` files, but only `CXS2` can restore atmosphere and Desk Radio context. The metadata field is still named `musicProvider` so existing exported scenes stay compatible; app code maps its legacy `"generated"` value to the internal native audio provider.

Sharing state belongs in `App.tsx`, the visible controls live in `SharePanel`, and image/clip generation stays in `renderer.ts`. This keeps export buttons thin and keeps canvas capture details out of React state.

Desk Radio is user-controlled. It plays only a pasted YouTube video or playlist source through the visible YouTube player; it does not search, auto-pick playlists, use an API key, or hide playback. If YouTube reports that a link cannot be embedded, `App.tsx` switches back to native ambience and keeps the drawer open for another link.

## Adding A Material

1. Add the material id to `MATERIAL` in `app/src/materials.ts`.
2. Add its label, slug, palette, group, two identity traits, and optional glow color to `MATERIALS`.
3. Add simulation behavior in Rust, and mirror only necessary fallback behavior in `app/src/engine.ts`.
4. Add a toolbar icon in `app/src/App.tsx` when users should be able to paint it directly. Generated-only outcomes can stay in `MATERIALS` with `userSelectable: false`.
5. Add rendering rules in `app/src/rendering/shapeLanguage.ts` only if palette variation is not enough.
6. Extend `docs/MATERIAL_AUDIT.md` and run `npm run material:audit`.
7. Extend smoke tests if the material changes common workflows.

## Testing

Local checks (macOS/Linux; Windows uses the matching `scripts\*.ps1` wrappers):

```sh
npm run build
npm run test:wasm
npm run test:browser
```

CI runs the same full `npm run check` gate expected locally on every push and pull request to `main`.

## Design Rules

- Prefer deterministic procedural visuals for the sandbox itself; use local image assets only for room atmosphere when they strengthen the scene.
- Keep simulation behavior and visual polish separate.
- Keep audio optional and user-initiated.
- Keep exported scene data stable, backward-compatible, and validated.
- Keep third-party asset credits near the repo root for simple publishing audits.
- Add small abstractions only when they make the next material or test easier.
