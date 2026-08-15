# Cozy Pixel Sandbox Architecture

This project is a static browser toy: React owns the interface, Rust/WASM owns the primary simulation, and Canvas owns the rendered sandbox. The codebase should stay small, direct, and easy to reshape while the feel of the toy is still evolving.

## Core Flow

1. `app/src/App.tsx` creates the engine, owns UI state, and forwards pointer input to `engine.paint`.
2. `app/src/engine.ts` loads the Rust/WASM simulation when available and falls back to a JavaScript simulation if the WASM file is missing.
3. `sim` contains the Rust cellular automata rules.
4. `app/src/renderer.ts` converts the engine cell bytes into the base, glow, and motes canvas layers.
5. `app/src/storage.ts` handles browser-local saves and JSON scene import/export. The manual Save/Load pair and the 30-second autosave use separate localStorage keys on purpose: a shared key would let the autosave overwrite a deliberate checkpoint with a cleared board. On boot the app restores the autosave (falling back to the manual save), takes any slow steps the absence earned, and then grows the scene by one tick per second away, capped at 4000 — stopping early once a bloom is open, so you arrive while the garden is in flower rather than after it. See `slowWorld.ts` below; a terrarium lives between visits, and you get to watch the last of it happen.

   **That order is the trick, not an implementation detail.** A slow step only changes conditions — cold char becomes plantable ground, a spent seed head sows into the carpet — and the ordinary sim then plays those conditions forward, so the player arrives to a garden rather than to a diff. Running the slow world after the catch-up would leave bare seeds sitting on soil.
6. `app/src/audio.ts` exposes the optional local native audio controller.
7. `app/src/deskRadio.ts` validates user-provided YouTube Desk Radio sources and builds the visible watch URL and display label; the embedded player itself is constructed in `DeskRadioPanel.tsx`.
8. `app/src/sceneEnvironments.ts` provides non-destructive room/backdrop definitions and their local image metadata.
9. `app/src/fieldNotes.ts` detects first-ever generated outcomes from cheap periodic cell-count samples and issues one mystical field note per discovery. Its constraints are the design: one note at a time, an 8s linger in its own UI line, a 45s cooldown so chaos yields one note rather than five, once-ever persistence in localStorage, and only unpaintable kinds (with a recently-painted guard for the two exceptions) so a note is never about the player's own brushwork.
10. `app/src/weather.ts` is Phase 12D: with the window open, the room backdrop drops real cells into the tray (drizzle, settling snow, rare meteors) through the same `engine.paint` API as the brush. Weather is date-seeded input, never a simulation rule — the engines stay byte-identical by construction — and every drop type has a cell-count ceiling so it cannot flood a scene.
11. `app/src/slowWorld.ts` owns the **absence policy**: how many slow steps an absence earns, how many catch-up ticks it earns, the order the two are applied in (`wakeTerrarium`), and **where the catch-up stops** (`catchUpRemaining`) — an absence ends on the rising action, so the invisible fast-forward halts once a head is open and leaves a short tail to play on screen. The rules themselves are engine-side (`Universe::slow_step`, mirrored in `engine.ts`); what lives here is everything `App.tsx` and `scripts/slow-world-audit.mjs` must agree about, so the gate cannot certify a return path production does not perform. Like `engine.ts` and `materials.ts` it MUST stay free of `import.meta` and of React.
12. `app/src/windowOwnership.ts` decides which open window may tend the terrarium. Two surfaces can be open on one save, both running live engines against one localStorage key, so exactly one may write. Claims carry a timestamp and are totally ordered — demoting on *any* incoming claim leaves two windows that started together both standing up, with nobody owning or saving the scene. Departure is announced with a release, or closing the newest window strands the older one demoted forever. It prefers `BroadcastChannel` and falls back to a `storage` event, since without a cross-window signal two windows both write.
13. `app/src/assetUrl.ts` prefixes runtime-fetched asset URLs with the deploy base. It uses `import.meta`, so it MUST NOT be reachable from `engine.ts` or `materials.ts` — the parity harness compiles those two to CommonJS, where that is a compile error.

The built app is static. There is no account system, database, cloud save, hidden streaming dependency, or paid API. The one server is `scripts/serve-static.mjs`, which only hands out the built files for the standalone deploy — it holds no state and knows nothing about the game. Native ambience is the default sound path; Desk Radio is an optional browser-side YouTube player selected by the user.

## Simulation Boundary

The simulation stores each cell in an 8-byte record:

- kind/material id
- visual variant (also a spark's flight direction)
- age
- energy (dual-purposed per material: water temperature, stem growth budget, stone dampness, wall freeze-thaw stress, rocket fuse, wellspring's remembered material id)
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

Keep reusable controls in `app/src/components` when they remove real top-level UI weight. `SegmentedControl` is shared by sound moods, sound source selection, and room backdrops. `SharePanel` and `DeskRadioPanel` keep sharing and radio controls out of the main app orchestration without inventing a larger UI framework.

The app should favor compact controls over explanatory panels. Tooltips and titles are acceptable for details like channel meaning; the first screen should remain the toy itself.

## Room Backdrops

Visible room controls change CSS atmosphere, local backdrop images, and the default audio mood without mutating the simulation. The one deliberate exception is the open-window weather above: it feeds the sim real cells, but only as ordinary paint input, and the toggle shuts it off entirely. The selected room is persisted in localStorage and included as metadata in `CXS2` scene JSON so shared scenes can restore their atmosphere without replacing the user's pixels with a preset.

Room images are served from `app/public/rooms` and referenced through scene metadata, then softened by CSS lighting, weather, and darkening layers. This keeps the source of truth in one small data file and prevents image paths from spreading across the UI. Third-party sources belong in `ASSET_CREDITS.md` and should be updated in the same change as any asset replacement.

## Sharing Boundary

`app/src/storage.ts` owns scene snapshots. `CXS2` files include validated share metadata for room, sound mood, native/external source marker, and an optional Desk Radio source. Imports still accept legacy `CXS1` files, but only `CXS2` can restore atmosphere and Desk Radio context. The metadata field is still named `musicProvider` so existing exported scenes stay compatible; app code maps its legacy `"generated"` value to the internal native audio provider.

Sharing state belongs in `App.tsx`, the visible controls live in `SharePanel`, and image/clip generation stays in `renderer.ts`. This keeps export buttons thin and keeps canvas capture details out of React state.

Desk Radio is user-controlled. It plays only a pasted YouTube video or playlist source through the visible YouTube player; it does not search, auto-pick playlists, use an API key, or hide playback. If YouTube reports that a link cannot be embedded, `App.tsx` switches back to native ambience and keeps the drawer open for another link.

## Adding A Material

1. Add the material id to `MATERIAL` in `app/src/materials.ts`.
2. Add its label, slug, description, color, palette, group, two identity traits, and optional glow color to `MATERIALS`. `description` and `color` are required by `MaterialDef` and the description is user-visible in the toolbar.
3. Add simulation behavior in Rust, and mirror only necessary fallback behavior in `app/src/engine.ts`.
4. Add a toolbar icon to `MATERIAL_ICONS` in `app/src/components/MaterialPanel.tsx` when users should be able to paint it directly. Generated-only outcomes can stay in `MATERIALS` with `userSelectable: false`.
5. Add rendering rules in `app/src/rendering/shapeLanguage.ts` only if palette variation is not enough.
6. Extend `docs/MATERIAL_AUDIT.md` and run `npm run material:audit`.
7. Extend smoke tests if the material changes common workflows.

## Testing

Local checks (macOS/Linux; Windows uses the matching `scripts\*.ps1` wrappers):

```sh
npm run check
```

CI runs the same full `npm run check` gate expected locally on every push and pull request to `main`.

## Design Rules

- Prefer deterministic procedural visuals for the sandbox itself; use local image assets only for room atmosphere when they strengthen the scene.
- Keep simulation behavior and visual polish separate.
- Keep audio optional and user-initiated.
- Keep exported scene data stable, backward-compatible, and validated.
- Keep third-party asset credits near the repo root for simple publishing audits.
- Add small abstractions only when they make the next material or test easier.
