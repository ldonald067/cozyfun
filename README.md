# Cozy Pixel Sandbox

A browser-playable cozy falling-sand sandbox built as a React/Vite app with a Rust/WASM simulation core.

The first version focuses on manual creation: paint materials, watch soft reactions, save scenes locally, and export/import JSON worlds. The style direction is a rainy night desk terrarium with a few original cosmic materials.

## Structure

- `app` - React/Vite UI, renderer, input, local saves.
- `sim` - Rust/WASM deterministic cell simulation.

## Tooling

Required for the full build:

- Node.js with npm
- Rust stable
- Rust target: `wasm32-unknown-unknown`

Useful commands:

```powershell
.\scripts\dev.ps1
.\scripts\build.ps1
```

If WASM is not built yet, the app can still run with the JS fallback engine:

```powershell
npm --prefix app run dev -- --host 127.0.0.1
```

## Fresh Setup

After cloning:

```powershell
rustup target add wasm32-unknown-unknown
npm --prefix app ci
.\scripts\build.ps1
.\scripts\dev.ps1
```

The app is static after build and does not require a backend. The Rust sim compiles to `app/public/sim/cozy_sandbox_sim.wasm` during `npm run build`.

## Deploy Notes

For Cloudflare Pages or another static host:

- Build command: `rustup target add wasm32-unknown-unknown && npm --prefix app ci && npm run build`
- Output directory: `app/dist`

## GitHub Notes

Recommended first repository setup:

```powershell
git init
git add .
git commit -m "Initial cozy pixel sandbox prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cozyfun.git
git push -u origin main
```

License is intentionally not chosen yet.
