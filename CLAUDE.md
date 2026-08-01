# Cozy Pixel Sandbox

A falling-sand sandbox. Rust compiled to wasm is the simulation; a JavaScript engine mirrors
it exactly as a fallback. Deployed at `pixelfun.littlealbumclub.net`, embedded in the Cozy
Vibes tab on `littlealbumclub.net`.

## Commands

```bash
source "$HOME/.cargo/env"   # cargo is not on PATH by default
npm run check               # the gate: audit, contrast, 80 cargo tests, both engine
                            # smokes, parity, subpath, audio, browser, visual QA
npm run test:parity         # the strictest gate on its own
npm run build               # cargo -> wasm32, then Vite
```

Use the root npm scripts. The `.ps1` wrappers in `scripts/` are Windows-only; ignore them
here.

## The invariant

**Every user-visible sim rule MUST exist in both `sim/src/lib.rs` and `app/src/engine.ts`,
and behave byte-for-byte identically.** `npm run test:parity` drives 17 scenarios through
both engines and compares every cell byte on every tick. When you add a rule:

1. Write it in `sim/src/lib.rs` (source of truth) and mirror it in `app/src/engine.ts`.
2. Add a cargo test and a parity scenario.
3. **Prove the scenario is not vacuous** — that it actually reaches the new code path.
   A scenario that passes because nothing ever triggers is worse than none.

RNG consumption is the classic divergence: a `chance()` call on one side but not the other,
or in a different order, desynchronises both engines permanently.

## Gotchas that have already cost time

- **`Universe::new` clamps width and height to ≥16.** Shrinking a test grid below 16 is a
  silent no-op.
- **Wall is the only immovable scaffold.** Stone falls when unsupported. Test frames, floors,
  ceilings and showcase display stands MUST be Wall, never Stone.
- **`engine.ts` and `materials.ts` MUST NOT use `import.meta`**, directly or through an
  import. `scripts/smoke-parity.mjs` compiles them to CommonJS, where it is a compile error.
  Engine-side URLs are passed in from the app layer instead.
- **A missing wasm does not throw.** It silently drops to the slower JS engine, so a broken
  deploy looks fine. After deploying, confirm the status line reads "wasm sim online".
- **Renderer code must not encode sim rules.** `app/src/rendering/*` may read cells; it must
  never move, create, destroy or transform them.
- **Visual claims are measurable, so measure them.** The renderer is pure functions and QA
  writes real captures — asserting "it reads better now" has produced wrong results here more
  than once.
- **`material:contrast` only checks averaged palettes.** It cannot see per-variant colours,
  interaction states, glow, shape or animation. Any change to `materials.ts`, `rendering/`,
  or reaction rules MUST regenerate `npm run visual:qa` and be judged on
  `.tmp/visual-qa/material-identity-showcase.png`.
- **`docs/MATERIAL_AUDIT.md` clause caps are enforced**: toolbar materials document 4-6
  interaction roles, generated-only materials 1-3. Exceeding them fails `material:audit`.

## Working rules

- Keep changes scoped to the task. No drive-by refactors or cosmetic churn.
- Never reset, checkout or revert files the user did not ask you to touch.
- Treat each coherent batch as atomic: implement, run the gate, commit, push.
- Keep captures, exports and scratch under `.tmp/`.
- **Never add** a backend, accounts, API keys, scrapers, hidden playback, or automatic
  YouTube search. Desk Radio stays visible and user-controlled.
- When the same problem appears twice, promote it into a harness — a script, a deterministic
  scene, a smoke assertion — rather than relying on memory.

## Deploy

Pushing to `main` redeploys the game by itself. The site repo is never involved; it holds one
iframe pointing at `pixelfun.littlealbumclub.net/embed.html`.

`COZY_BASE` must stay unset for that deploy — it serves from its own root. Set it only when
handing the build to another server to mount under a path.

## Deeper references

Read these when the task touches them, not by default:

- Architecture and module boundaries: @docs/ARCHITECTURE.md
- Review bar: @docs/CODE_REVIEW.md
- Renderer layers and shape language: @docs/VISUAL_PIPELINE.md
- Audio design and constraints: @docs/AUDIO.md
- The gates and what each proves: @docs/HARNESS.md
- Material roster and interaction matrix: @docs/MATERIAL_AUDIT.md
- Deploy and embedding: @docs/EMBEDDING.md
- Asset provenance and licences: @ASSET_CREDITS.md

`/adversarial-review` spawns Codex reviewers against the current diff. It has caught real
bugs — an unseamed rain loop, a crash-on-read-error, a silently-wrong gate — so it is worth
running before committing anything substantial.
