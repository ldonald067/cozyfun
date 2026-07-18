# Cozy Pixel Sandbox

A browser-playable cozy falling-sand sandbox built with React, Vite, and a Rust/WASM simulation core.

The project is a small interactive toy rather than a traditional game. You paint materials, watch soft reactions, save scenes locally, and export/import JSON worlds. The current style direction is a rainy night desk terrarium with original cosmic materials.

## Quick start

Requirements:

- Node.js with npm
- Rust stable
- Rust target: `wasm32-unknown-unknown`

After cloning, on macOS/Linux:

```sh
rustup target add wasm32-unknown-unknown
npm --prefix app ci
npm run build
npm run dev
```

On Windows, prefer the checked-in PowerShell wrappers (they work around known Windows path issues):

```powershell
rustup target add wasm32-unknown-unknown
npm --prefix app ci
.\scripts\build.ps1
.\scripts\dev.ps1
```

Open the local URL printed by Vite. The default dev URL is usually:

```txt
http://127.0.0.1:5173/
```

To see exactly what the current production build looks like, rebuild and serve `app/dist` without Vite dev/preview:

```powershell
.\scripts\preview-current.ps1
```

That command prints a local URL and the exact built JS/CSS assets it is serving, usually:

```txt
http://127.0.0.1:4173/
```

If you have already built and only need to reopen the preview server, run:

```powershell
.\scripts\preview-built.cmd
```

Both preview commands accept a port when you want a brand-new URL:

```powershell
.\scripts\preview-current.ps1 -Port 4181
.\scripts\preview-built.cmd 4181
```

Preview and QA URLs that include `?fresh=...`, `?chromeQa=...`, or `?firefoxQa=...` show a small top-center badge with the active JS and CSS bundle names. If that badge does not show the expected label or bundle hashes, the browser is still looking at an older page.

If the WASM file has not been built yet, you can still run the React app with the JavaScript fallback engine:

```powershell
npm --prefix app run dev -- --host 127.0.0.1
```

## Controls

- Pick a material from the left toolbar.
- Paint directly on the sandbox tray.
- Use the brush slider to change brush size.
- Pause/play the simulation from the control panel.
- Change the room backdrop without replacing your sandbox, including rainy, moonlit, hearth, fireplace, forest, and snow scenes.
- Enable optional local audio, pick a sound mood for rain, cat purr, or fireplace crackle, choose native ambience or a visible YouTube Desk Radio, and tune master and ambience volume.
- Clear, save/load in the browser, download/import a scene JSON file, export a postcard PNG, export a short WebM clip, or copy a share note from the right controls.

Native ambience is local: credited recordings provide the rain, cat purr, and fireplace crackle beds. Short material cues still use Web Audio, but long-running ambience is recorded audio only. Desk Radio is user-controlled: paste a YouTube video, playlist, timestamped URL, or raw video ID and the visible player embeds that source when YouTube allows embedded playback. If YouTube blocks a link from playing in the sandbox, the app returns to native ambience, keeps the URL available to edit, and asks for another embeddable link. The app does not search YouTube, pick playlists, use an API key, or play hidden audio.

Saves and scene JSON files preserve the selected room backdrop, sound mood, and safe sound source metadata. Desk Radio sources are preserved only when they came from a validated user-provided YouTube video or playlist link that loaded as an embeddable player.

Save/load is browser-local for quick return visits. Scene JSON is the portable format for sharing or backing up a world. Postcards are polished still images with room, sound, sim source, tick, and date context.

## Materials

Current toolbar materials:

```txt
Eraser, Wall, Sand, Water, Soil, Fire, Wood, Lava, Stone,
Moss, Seed, Fungus, Oil, Ice, Stardust, Meteor, Moonwater, Rocket, Wellspring
```

Generated outcomes (created by play, not painted directly):

```txt
Flower, Smoke, Steam, Glass, Ember, Pollen, Stem, Spark
```

Some key reactions:

- Water and moonwater soften fire into glowing steam instead of instantly deleting it.
- Water and moonwater hydrate seeds, moss, fungus, flowers, and soil so watering life produces faster sprouting and green-up.
- Water can also dampen sand, wall, stone, and wood; damp sand clumps and damp hard surfaces can take moss.
- Ice freezes nearby water, frosts steam, and can put seeds, moss, fungus, flowers, soil, wood, and oil into a dormant frozen state.
- Ice frost-stresses damp stone and wall so cold hard surfaces read differently from heat-scorched ones.
- Plain water flashes into steam against lava and meteor, cooling low-energy lava or water-shocked meteor into scorched stone.
- Moonwater keeps the special cosmic path: it can clean oil into stardust and make meteor contact burst into stardust.
- Fire thaws frozen cells and dries wet life or wood into a scorched state before it can burn them; wet wood vents steam while drying.
- Oil smothers nearby hydrated cells and blocks plain water from feeding life through it.
- Steam condenses on stone and wall; smoke leaves dry soot/scorch marks instead of acting like wet vapor.
- Stardust can charge ordinary water into moonwater, energize life, soil, and fungus, snuff fire into sparkle bursts, and etch constellation marks onto stone and wall.
- Strong heat fuses dry sand into translucent glass panes; wet sand dries and scorches first.
- Burning wood leaves glowing embers that cool into relightable char instead of vanishing, and water quenches embers with a steam hiss.
- Repeated freeze-thaw cycles crack sealed walls until they crumble into natural stone.
- Seeds are now potential: wet rooted seeds can bloom into flowers, moss beds can overtake them, and nearby fungus can rot them.
- Moss is carpet growth: it spreads over damp soil and wood but does not bloom.
- Wall and stone are intentionally separate: wall is sealed construction, while stone is natural, weatherable, and easier for moss/condensation to affect.
- Rocket powder lies inert until any flame lights it; a lit grain whooshes skyward trailing glitter and bursts into a multicolor firework shell of sparks that droop, twinkle, and fade, chain-lighting neighboring powder.
- Wellspring blocks drink the identity of the first material to touch them (water, lava, sand, stardust, and more), then pour it back out from open faces forever; nearby ice stills the spring.
- Stardust, meteor, and moonwater add the cozy/cosmic identity.

## Architecture

- `app` contains the React/Vite UI, renderer, local audio, input handling, local saves, and JS fallback engine.
- `sim` contains the Rust simulation compiled to WASM.
- `app/src/sceneEnvironments.ts` contains non-destructive room/backdrop definitions.
- `app/src/deskRadio.ts` validates user-provided YouTube Desk Radio sources and keeps native ambience as the default fallback when a link cannot embed.
- `app/public/rooms` contains local room backdrop images used by those scene definitions.
- `scripts/build.ps1` builds the Rust sim, copies the generated WASM into `app/public/sim`, then builds the Vite app.
- `scripts/dev.ps1` builds the sim first, then starts Vite.
- `scripts/preview-current.ps1` rebuilds and serves `app/dist` directly so local previews cannot show a stale dev bundle.
- `scripts/preview-built.cmd` serves the existing `app/dist` build, accepts an optional port, and keeps a visible window open while the preview is running.
- `scripts/test-sim.ps1` runs the Rust simulation tests with the checked-in local tool paths.
- `scripts/audio-qa.ps1` writes a native ambience asset manifest into `.tmp/audio-qa`.
- `scripts/visual-qa.ps1` captures the current controlled material scene, room backdrops, and responsive layout metrics into `.tmp/visual-qa`.
- `scripts/check.ps1` runs the full local gate with the checked-in local tool paths.

The app is static after build. There is no backend, account system, database, cloud save, hidden streaming dependency, or paid API dependency. Desk Radio is an optional visible YouTube player supplied by the user.

See `AGENTS.md` for repo-level agent guidance, `docs/CODE_REVIEW.md` for the review checklist, `docs/HARNESS.md` for build/test/visual feedback loops, `docs/ARCHITECTURE.md` for module boundaries, `docs/VISUAL_PIPELINE.md` for renderer and shape-language notes, `docs/AUDIO.md` for the sound foundation, and `ASSET_CREDITS.md` for third-party room and audio sources.

## Scene format

Scene export files are JSON snapshots with:

- format/version marker
- world width and height
- simulation tick
- source engine label
- base64-encoded cell bytes
- share metadata for room, sound mood, safe sound source, and optional user-provided Desk Radio source
- save timestamp

Imports are validated before loading. A scene must match the current world size. Older `CXS1` scene files still import, but they do not carry room or sound metadata. Current `CXS2` metadata keeps the field name `musicProvider` for compatibility; the app maps its legacy `"generated"` value to native ambience internally.

## Deployment

For Cloudflare Pages or another static host:

- Build command: `rustup target add wasm32-unknown-unknown && npm --prefix app ci && npm run build`
- Output directory: `app/dist`

The generated WASM file is created during the build and is not committed.

## Checks

On macOS/Linux the root npm scripts run everything directly:

```sh
npm run check
npm run test:sim
npm run test:wasm
npm run test:js-fallback
npm run test:browser
npm run material:audit
npm run audio:qa
npm run visual:qa
```

On Windows, the equivalent PowerShell wrappers:

```powershell
.\scripts\build.ps1
.\scripts\preview-current.ps1
.\scripts\test-sim.ps1
.\scripts\test-wasm.ps1
.\scripts\test-js-fallback.ps1
.\scripts\test-browser.ps1
.\scripts\test-chrome.ps1 -AppPort 4181
.\scripts\test-firefox.ps1
.\scripts\audio-qa.ps1
.\scripts\visual-qa.ps1
.\scripts\check.ps1
.\scripts\app-npm.ps1 run build
.\scripts\app-npm.ps1 audit --audit-level=moderate
```

CI runs the full `npm run check` gate on pushes and pull requests to `main`: material audit, Rust sim tests, build, WASM smoke, JS fallback smoke, audio reaction smoke, browser smoke, audio QA, and visual QA. Browser and visual checks use an installed Chrome or Edge browser; set `BROWSER_BINARY` if your browser is in a custom location.

Firefox QA expects a running preview server. If the preview is on a non-default port, pass it explicitly:

```powershell
.\scripts\test-chrome.ps1 -AppPort 4181
.\scripts\test-firefox.ps1 -AppPort 4181
```

Add `-KeepOpen` to leave the Chrome QA window open after it finishes.

On Windows, native simulation tests use the local GNU Rust test toolchain instead of Visual Studio Build Tools. If that toolchain is missing, run:

```powershell
$env:RUSTUP_HOME = "$PWD\.tools\rustup"
$env:CARGO_HOME = "$PWD\.tools\cargo"
$env:Path = "$PWD\.tools\cargo\bin;$PWD\.tools\node;$env:Path"
rustup toolchain install stable-x86_64-pc-windows-gnu
```

## Roadmap

See `ROADMAP.md` for the completed phase history and upcoming product polish notes.

## License

MIT. See `LICENSE`. Third-party room images and ambience recordings are credited in `ASSET_CREDITS.md`.

## Troubleshooting

If the app says `js fallback online`, the WASM file was not found or failed to load. Run:

```powershell
.\scripts\build.ps1
.\scripts\dev.ps1
```

If Rust cannot find the WASM target, run:

```powershell
rustup target add wasm32-unknown-unknown
```

If `npm run check` fails on Windows with `link.exe not found`, make sure you are on the latest scripts and run `.\scripts\check.ps1`. The local check wrapper uses the GNU Rust test toolchain so it does not need the native MSVC linker.

If npm app scripts report `Access is denied` on Windows, use `.\scripts\app-npm.ps1 run build` or the other checked-in scripts. The wrapper puts the repo-local Node runtime before the blocked WindowsApps Node shim that npm package scripts may otherwise resolve.

If Vite reports `Access is denied` while loading `vite.config.ts` on Windows, use the checked-in scripts. The app build command uses Vite's runner config loader to avoid that Windows path-walking issue. To inspect the current built UI without Vite dev or preview, run `.\scripts\preview-current.ps1`.

If a scene import fails, confirm it was exported from this app version and has the same world size.

## Repository status

This is an early V0 prototype. The code is intentionally small and direct so the simulation feel, visuals, and interactions can evolve quickly.
