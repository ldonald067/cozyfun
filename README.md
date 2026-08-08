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

To see exactly what the current production build looks like, serve `app/dist` without Vite dev/preview. Build first, then:

```sh
node scripts/preview-dist.mjs
```

That command prints a local URL and the exact built JS/CSS assets it is serving, usually `http://127.0.0.1:4173/`. Pass a port to get a brand-new URL when a browser is caching the old one:

```sh
node scripts/preview-dist.mjs 4181
```

On Windows, `.\scripts\preview-current.ps1` rebuilds and previews in one step, and `.\scripts\preview-built.cmd` reopens the preview for an existing build; both accept `-Port` / a trailing port argument.

Preview and QA URLs that include `?fresh=...`, `?chromeQa=...`, or `?firefoxQa=...` show a small top-center badge with the active JS and CSS bundle names. If that badge does not show the expected label or bundle hashes, the browser is still looking at an older page.

If the WASM file has not been built yet, you can still run the React app with the JavaScript fallback engine:

```sh
npm run dev:fallback
```

## Controls

- Pick a material from the left toolbar.
- Paint directly on the sandbox tray.
- Use the brush slider to change brush size.
- Pause/play the simulation from the control panel.
- Change the room backdrop without replacing your sandbox, including rainy, moonlit, hearth, fireplace, forest, and snow scenes.
- Enable optional local audio, pick a sound mood for rain, cat purr, or fireplace crackle, choose native ambience or a visible YouTube Desk Radio, and tune master and ambience volume.
- The terrarium autosaves and resumes on its own, growing a little while you are away. Clear, save/load a deliberate checkpoint, download/import a scene JSON file, export a postcard PNG, or export a short WebM clip from the right controls.

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
- Wall and stone are intentionally separate: stone is natural, weatherable, easier for moss/condensation to affect, and falls when nothing supports it; wall is sealed construction that stains but resists casual moss, and is the only material that never moves. Build scaffolds and test fixtures out of wall.
- Rocket powder lies inert until any flame lights it; a lit grain whooshes skyward trailing glitter and bursts into a multicolor firework shell of sparks that droop, twinkle, and fade, chain-lighting neighboring powder.
- Wellspring blocks drink the identity of the first material to touch them (water, lava, sand, stardust, and more), then pour it back out from open faces forever. Nearby ice stills the spring and also reopens it: a chilled spring re-drinks whatever touches it next, so a misattuned block can be re-taught instead of being ruined.
- Stardust, meteor, and moonwater add the cozy/cosmic identity.

## Architecture

- `sim` contains the Rust simulation compiled to WASM. It is the source of truth for every material rule.
- `app` contains the React/Vite UI, renderer, local audio, input handling, local saves, and the JavaScript fallback engine in `app/src/engine.ts`, which mirrors the Rust sim rule for rule.
- `app/src/assetUrl.ts` applies Vite's base path to assets fetched by URL string (room images, ambience audio, the WASM file) — Vite cannot rewrite those, so a subpath build depends on it.
- `app/src/sceneEnvironments.ts` contains non-destructive room/backdrop definitions.
- `app/src/deskRadio.ts` validates user-provided YouTube Desk Radio sources and keeps native ambience as the default fallback when a link cannot embed.
- `app/public/rooms` contains local room backdrop images used by those scene definitions.
- `app/public/embed.html` is the click-to-load poster used when the sandbox is iframed into another site.
- `scripts/*.mjs` are the cross-platform build, test, and QA steps invoked by the root npm scripts; `scripts/*.ps1` are Windows wrappers around them.
- `scripts/serve-static.mjs` is the production server used by the container deploy.
- `Dockerfile` and `railway.json` define the standalone deploy.

The app is static after build. There is no account system, database, cloud save, hidden streaming dependency, or paid API dependency; the only server is `serve-static.mjs`, which serves files and nothing else. Desk Radio is an optional visible YouTube player supplied by the user.

The Rust sim and the JavaScript fallback must stay byte-for-byte identical. `npm run test:parity` drives 17 scenarios through both engines and compares every cell each tick. Changing a rule in one engine and not the other is the single easiest way to break this project.

`CLAUDE.md` is the operating guide for coding agents (and a fast orientation for people). Beyond it: `docs/ARCHITECTURE.md` for module boundaries, `docs/CODE_REVIEW.md` for the review checklist, `docs/HARNESS.md` for build/test/visual feedback loops, `docs/VISUAL_PIPELINE.md` for renderer and shape-language notes, `docs/AUDIO.md` for the sound foundation, `docs/MATERIAL_AUDIT.md` for the per-material interaction matrix, `docs/EMBEDDING.md` for deploying and embedding, `docs/PHASE_18_HANDOFF.md` for the living-world batch record, and `ASSET_CREDITS.md` for third-party room and audio sources.

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

The live deploy is a container: `Dockerfile` builds both toolchains and `scripts/serve-static.mjs` serves the result, with `railway.json` pinning the Dockerfile builder. Pushing `main` redeploys `pixelfun.littlealbumclub.net`, which `littlealbumclub.net` iframes.

For a plain static host (Cloudflare Pages and similar) instead:

- Build command: `rustup target add wasm32-unknown-unknown && npm --prefix app ci && npm run build`
- Output directory: `app/dist`

Either way the host **must** serve `.wasm` as `application/wasm`. If it does not, `WebAssembly.instantiateStreaming` refuses the file and the app silently drops to the slower JavaScript engine with no error — check the status line under the canvas reads `wasm sim online`. That requirement is why the deploy uses a hand-written server rather than a generic one.

Set `COZY_BASE=/subpath/` at build time only when mounting the build under a path on a larger site; leave it unset for a domain root. See `docs/EMBEDDING.md` for the iframe snippet, the same-site storage constraint, and what to verify after deploying.

The generated WASM file is created during the build and is not committed.

## Checks

`npm run check` is the full gate, and CI runs exactly it on pushes and pull requests to `main`. It runs twelve steps in order:

```txt
material:audit          material identity matrix
material:contrast       palette contrast floor
test:sim                Rust simulation tests
build                   production build
smoke-wasm.mjs          WASM engine smoke
test:js-fallback        JavaScript engine smoke
test:parity             Rust/JS byte-for-byte comparison
test:subpath            COZY_BASE build gate
test:audio-reactions    post-tick reaction cue smoke
test:browser            Chrome + Firefox smoke
audio:qa                ambience manifest
visual:qa               deterministic visual captures
```

Any of those can be run on its own — `npm run test:parity`, `npm run visual:qa`, and so on. `npm run test:wasm` builds the sim and runs just the WASM smoke.

`test:browser` and `visual:qa` drive an installed Chrome or Edge; set `BROWSER_BINARY` if yours is in a custom location. Both start their own static server, so they need nothing running first.

`npm run test:chrome` and `npm run test:firefox` are **Windows-only** — they shell out to PowerShell. Unlike the gate's headless smoke they drive a visible browser against a preview server you started yourself, which is the way to watch a QA run rather than just read its result. They expect the preview on port 4173; override with `CHROME_QA_APP_PORT` / `FIREFOX_QA_APP_PORT`, and add `-KeepOpen` to `.\scripts\test-chrome.ps1` to leave the window up afterwards.

The rest of the steps have Windows wrappers too (`.\scripts\check.ps1`, `.\scripts\test-sim.ps1`, `.\scripts\visual-qa.ps1`, and so on), plus `.\scripts\app-npm.ps1` for running app-level npm commands through the repo-local Node.

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

If the app says `js fallback online`, the WASM file was not found or failed to load. Locally that usually means the sim has not been built; `npm run dev` builds it first, so:

```sh
npm run dev
```

On a deployed host it usually means the server is sending the wrong content type — see Deployment above.

If Rust cannot find the WASM target, run:

```powershell
rustup target add wasm32-unknown-unknown
```

If `npm run check` fails on Windows with `link.exe not found`, make sure you are on the latest scripts and run `.\scripts\check.ps1`. The local check wrapper uses the GNU Rust test toolchain so it does not need the native MSVC linker.

If npm app scripts report `Access is denied` on Windows, use `.\scripts\app-npm.ps1 run build` or the other checked-in scripts. The wrapper puts the repo-local Node runtime before the blocked WindowsApps Node shim that npm package scripts may otherwise resolve.

If Vite reports `Access is denied` while loading `vite.config.ts` on Windows, use the checked-in scripts. The app build command uses Vite's runner config loader to avoid that Windows path-walking issue. To inspect the current built UI without Vite dev or preview, build and run `node scripts/preview-dist.mjs`.

If a scene import fails, confirm it was exported from this app version and has the same world size.

## Repository status

Playable and deployed, still evolving. The code is intentionally small and direct so the simulation feel, visuals, and interactions can keep moving quickly; the gate in `npm run check` is what keeps that speed from costing correctness.
