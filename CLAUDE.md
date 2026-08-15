# Cozy Pixel Sandbox

A falling-sand sandbox. Rust compiled to wasm is the simulation; a JavaScript engine mirrors
it exactly as a fallback. Deployed at `pixelfun.littlealbumclub.net`, embedded in the Cozy
Vibes tab on `littlealbumclub.net`.

## Commands

```bash
source "$HOME/.cargo/env"   # cargo is not on PATH by default
npm run check               # the full gate; read the stage list from package.json, not memory
npm run test:parity         # strictest single gate: both engines must agree byte-for-byte
npm run interaction:audit   # does each documented interaction actually HAPPEN in play
npm run slow-world:audit    # is an absence visible when you come back to it
npm run deploy:verify       # is the DEPLOYMENT the commit you think it is
npm run build               # cargo -> wasm32, then Vite
```

Use the root npm scripts. The `.ps1` wrappers in `scripts/` are Windows-only; ignore them
here.

## The invariant

**Every user-visible sim rule MUST exist in both `sim/src/lib.rs` and `app/src/engine.ts`,
and behave byte-for-byte identically.** When you add a rule:

1. Write it in `sim/src/lib.rs` (source of truth) and mirror it in `app/src/engine.ts`.
2. Add a cargo test and a parity scenario in `scripts/smoke-parity.mjs`.
3. Give the scenario `observe`/`expect` callbacks that assert what it actually witnessed.

RNG consumption is the classic divergence: a `chance()` call on one side but not the other,
or in a different order, desynchronises both engines permanently. This covers
`slow_step` too — the between-sessions rules draw on the same stream as `tick`.

## A passing test does not mean a reachable feature

This is the most expensive mistake this repo has made, twice. A test that hand-places ideal
state proves a rule is correct; nothing about it proves a player can ever get there.

- `rooted_seed_grows_a_stalk_that_blooms` passed for months while **no player had ever seen
  a flower**: it placed a wet, rooted seed on soil, and painting seeds could not produce
  that state.
- A parity scenario named "germinating garden" never germinated. Byte-equality cannot tell
  coverage from vacuity — delete a rule from *both* engines and every scenario still passes.

So: when you add player-visible behaviour, add a check to `npm run interaction:audit` that
starts from **painted materials only**. Never set flags or energy directly in it — that
shortcut is exactly what hid the flower bug. Assert what a scene witnessed, and make the
check fail when it stops witnessing it.

## Gotchas that have already cost time

- **A missing wasm does not throw.** It silently drops to the slower JS engine, so a broken
  deploy looks fine. `npm run deploy:verify` checks that mechanically, along with the
  question that had no answer at all until 2026-08: whether the running deployment is the
  commit you think it is. Do not verify a deploy by eye.
- **A rule that only runs between sessions still needs a visibility gate.** The slow world
  ships correct-and-pointless very easily: cargo tests and parity both pass while the
  effect is four cells nobody would notice. `npm run slow-world:audit` is what asks
  whether being away was worth anything, and it is where the two measurements that
  shaped the rules live.
- **`engine.ts`, `materials.ts` and `slowWorld.ts` MUST NOT use `import.meta`**, directly
  or through an import. `scripts/smoke-parity.mjs` compiles them to CommonJS, where it is a compile error.
  Engine-side URLs are passed in from the app layer instead.
- **`material:contrast` only checks averaged palettes.** It cannot see per-variant colours,
  interaction states, glow, shape or animation, so it is a floor and not a verdict.
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

Directory rules load themselves: `sim/CLAUDE.md` and `app/src/rendering/CLAUDE.md` are
pulled in when you read a file there. Read these when the task touches them, not by default:

- Architecture and module boundaries: @docs/ARCHITECTURE.md
- Review bar: @docs/CODE_REVIEW.md
- Renderer layers and shape language: @docs/VISUAL_PIPELINE.md
- Audio design and constraints: @docs/AUDIO.md
- The gates and what each proves: @docs/HARNESS.md
- Material roster and interaction matrix: @docs/MATERIAL_AUDIT.md
- Deploy and embedding: @docs/EMBEDDING.md
- Asset provenance and licences: @ASSET_CREDITS.md

`/adversarial-review` spawns Codex reviewers against the current diff. It has caught real
bugs — an unseamed rain loop, a crash-on-read-error, a silently-wrong gate, and a shipped
feature no player could reach — so it is worth running before committing anything
substantial.
