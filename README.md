# Cozy Pixel Sandbox

A browser-playable cozy falling-sand sandbox built with React, Vite, and a Rust/WASM simulation core.

The project is a small interactive toy rather than a traditional game. You paint materials, watch soft reactions, save scenes locally, and export/import JSON worlds. The current style direction is a rainy night desk terrarium with original cosmic materials.

## Quick start

Requirements:

- Node.js with npm
- Rust stable
- Rust target: `wasm32-unknown-unknown`

After cloning:

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

If the WASM file has not been built yet, you can still run the React app with the JavaScript fallback engine:

```powershell
npm --prefix app run dev -- --host 127.0.0.1
```

## Controls

- Pick a material from the left toolbar.
- Paint directly on the sandbox tray.
- Use the brush slider to change brush size.
- Pause/play the simulation from the control panel.
- Enable optional procedural audio and tune master, ambience, music, and effects volume.
- Clear, save, load, export, import, or export a postcard from the right controls.

Saves are local to the browser unless you export a scene JSON file.

## Materials

Current V0 materials:

```txt
Eraser, Wall, Sand, Water, Smoke, Soil, Fire, Wood, Lava, Stone,
Moss, Seed, Fungus, Oil, Ice, Steam, Stardust, Meteor, Moonwater
```

Some key reactions:

- Water and moonwater soften fire into glowing steam instead of instantly deleting it.
- Lava cools near water and moonwater.
- Fire can burn wood, moss, seed, fungus, and oil.
- Seeds can become moss near soil, moss, or moonwater.
- Stardust, meteor, and moonwater add the cozy/cosmic identity.

## Architecture

- `app` contains the React/Vite UI, renderer, procedural audio, input handling, local saves, and JS fallback engine.
- `sim` contains the Rust simulation compiled to WASM.
- `scripts/build.ps1` builds the Rust sim, copies the generated WASM into `app/public/sim`, then builds the Vite app.
- `scripts/dev.ps1` builds the sim first, then starts Vite.

The app is static after build. There is no backend, account system, database, cloud save, streaming dependency, or paid API dependency.

See `docs/ARCHITECTURE.md` for module boundaries and `docs/VISUAL_PIPELINE.md` for renderer and shape-language notes.

## Scene format

Scene export files are JSON snapshots with:

- format/version marker
- world width and height
- simulation tick
- source engine label
- base64-encoded cell bytes
- save timestamp

Imports are validated before loading. A scene must match the current world size.

## Deployment

For Cloudflare Pages or another static host:

- Build command: `rustup target add wasm32-unknown-unknown && npm --prefix app ci && npm run build`
- Output directory: `app/dist`

The generated WASM file is created during the build and is not committed.

## Checks

Useful local commands:

```powershell
.\scripts\build.ps1
.\scripts\test-wasm.ps1
.\scripts\test-browser.ps1
npm --prefix app audit --audit-level=moderate
```

CI runs on pushes and pull requests to `main`. Browser smoke checks use an installed Chrome or Edge browser; set `BROWSER_BINARY` if your browser is in a custom location.

## Roadmap

See `ROADMAP.md` for the current phase plan, including the planned material shape-language renderer.

## License

MIT. See `LICENSE`.

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

If `npm run check` fails on Windows with `link.exe not found`, install Visual Studio Build Tools with the Visual C++ build tools workload. The browser build and WASM smoke test can still pass without the native Windows Rust linker.

If Vite reports `Access is denied` while loading `vite.config.ts` on Windows, use the checked-in scripts. The app dev and build commands use Vite's runner config loader to avoid that Windows path-walking issue.

If a scene import fails, confirm it was exported from this app version and has the same world size.

## Repository status

This is an early V0 prototype. The code is intentionally small and direct so the simulation feel, visuals, and interactions can evolve quickly.
