# Harness Engineering

Harness engineering means improving the feedback loops around the sandbox so good changes become easier to make and bad patterns become harder to repeat. For this repo, the harness is the combination of scripts, deterministic scenes, browser captures, docs, and review rules that make agent work legible.

## Current Harnesses

The root npm scripts are the entrypoints. Each has a Windows `.ps1` wrapper in `scripts/` that adds repo-local tool paths; the wrappers run the same underlying steps.

- `npm run build`: builds Rust/WASM, copies the WASM into `app/public/sim`, and builds the Vite app.
- `npm run check`: the full local gate, in order — material identity audit, material contrast floor, site-icon freshness, Rust sim tests, production build, WASM smoke, JS fallback smoke, cross-engine parity, interaction reachability, slow-world visibility, subpath build, audio reactions, browser smoke, audio QA, and visual QA. If you are listing the stages anywhere, take the list from `package.json` rather than from memory.
- `npm run test:parity`: drives its scenarios through the Rust/WASM sim and the JS fallback together and asserts every cell byte matches on every tick. This is the only gate that can see the two engines diverge — the single-engine smokes below can both pass while behaviour has drifted.

  Building a scenario is fixture work, and the brush is blunter than it looks: **every
  radius stamps the same five-cell plus**, so nothing can be placed one cell at a time and
  paint ORDER is what gives a layout its shape (paint the target first, let the masonry
  overwrite it). **Nothing stays where you put it, either** — liquids side-hop up to two
  cells, gases rise, powders and stone fall, so a scenario that leaves cells floating
  diverges for a reason that has nothing to do with the rule under test. Seal enclosures
  with Wall. Print the board rather than reasoning about it — the chimney-breast scenario
  needed a firebox floor, because lava drains out of an open box inside 30 ticks, and a wall
  between the pour and the fire, because water quenches it just as fast. Neither was visible
  from the code.

  A scenario may also declare `slowSteps: [{ at, count }]` to take between-session slow steps at the end of a given tick. The slow world draws on the same RNG stream as `tick()`, so an unmirrored roll in it desynchronises the engines exactly as one in a movement rule would, and it has to be gated here for the same reason.

  **Byte-equality cannot tell coverage from vacuity.** Delete a rule from *both* engines and every scenario still passes. A scenario may therefore carry `observe`/`expect` callbacks that assert what it actually witnessed, and it fails with `scenario is VACUOUS` when it stops witnessing it. The "germinating garden" scenario is the cautionary tale: it passed for months while its soil bed greened into moss inside 100 ticks, so no seed in it ever germinated and it proved nothing about growth. Prose in a comment claiming a scenario is non-vacuous is not a check — if you verify a scenario by hand, encode what you counted.
- `npm run interaction:audit`: for every documented interaction, paints a plausible scene and asserts the outcome actually appears. **This is the only gate that asks whether a rule is REACHABLE**, as opposed to correct. The two are not the same, and the difference has shipped a broken feature: `rooted_seed_grows_a_stalk_that_blooms` passed for months while no player had ever seen a flower, because the test hand-placed a wet rooted seed on soil — the one state the game could not reach on its own.

  Checks start from painted materials and never set flags or energy directly; that shortcut is exactly what hid the flower bug. Each check also runs its predicate *before* the first tick and fails as `VACUOUS` if it is already true, because a predicate like `count(Moss) > 3` happily passes by counting the moss you painted. `absent: true` inverts a check for rules that PREVENT something, like oil smothering hydration.

  **It also asserts a visible footprint**, because firing and being seen are different things — the second half of what went wrong with flowers. A check returns the *cell indices* that are the outcome, and the gate measures three things about them: how many cells the outcome ever occupies, how many ticks it is on screen, and its median colour distance from what it replaced, computed by compiling the **real renderer** and asking it for the pixels. Floors are 4 cells, 30 ticks (0.5s at 60fps), and 24 contrast. Reimplementing the colour rules in the harness would only prove the harness agrees with itself.

  **Coverage is enforced clause by clause, not trusted.** Every role in `docs/MATERIAL_AUDIT.md` carries a stable `[material.slug]` id, and every check names the id it covers. The gate fails on a clause with no check, a check naming an id the matrix no longer has, a check bound to another material's clause, a duplicate id, or a clause with no id at all.

  Ids rather than prose on purpose: identity survives rewording, so fixing a typo in a clause does not break the build. The cost is the flip side of the same coin — **a clause reworded into a genuinely different promise while keeping its id will pass**, and only a human reading the diff will catch that. Binding on the clause text instead would catch it, at the price of breaking on every wording tweak.

  Two lessons are baked into the metrics. Size is the union over the outcome's whole life, not the peak at one instant, or a gradual rule like a fungus mat reverting to soil scores as invisible while being perfectly obvious. And an outcome that is a *transition* ("was glass, is sand now") must be made sticky, or it scores 2 ticks no matter how permanent its result is.

- `npm run slow-world:audit`: plays a scene in — a watered garden, a hearth burned to char, and a sand pile that must not move — then leaves for an hour, half a day, a day, two days and a week, and measures what came back. It is the only gate that asks whether **absence is worth anything**, which cargo tests and parity cannot: both pass happily while the slow world changes four cells nobody would see.

  It asserts four things, each a way the feature could be a lie. A day away must visibly change the scene (cell count and colour distance, judged by compiling the real renderer rather than restating its rules). A day must change **more than an hour**, or the curve has flattened and "come back tomorrow" means nothing. The garden must stand in **new columns** — a scattered seed that never comes up is clutter, not spread. And the inert zone must be untouched, compared **byte for byte** against the board that went in, since a rendered-difference check could never see age, energy or flag changes.

  It drives the same `wakeTerrarium` the app does rather than a local copy, so it cannot certify an order or a tick cap that production does not perform. It runs the JS engine; parity is what carries the result across to wasm.

  Its baseline is honest rather than perfect: a slow step consumes engine RNG, so the two branches enter catch-up with slightly different trajectories. That noise floor is measured, not assumed — deleting both slow-world writes while keeping every `chance()` roll leaves 5 changed cells and 0 new plant columns, against floors of 20 and 1.

  It also asserts you arrive **in flower** — a crown ringed by petals, using the app's own
  `aHeadIsOpen` rather than a restatement of it. Every other assertion here passed happily
  while a player arrived after the bloom: the scene had changed, in new columns, by plenty
  of cells; it had just changed into stalks.

  Two measurements shaped the rule itself and are worth not rediscovering. Seeds sown onto a mature bed landed on **moss**, which does not root them, so the scatter arm read as inert specks until the landing displaced that one patch of carpet back to soil. And the scene must be watered before the absence: a dry bed cannot sprout anything, which is the intended shape of the rule but understates it to the point of looking broken if the fixture forgets.

- `npm run icons:check`: fails when the committed site icons no longer match `scripts/make-favicon.mjs`. The generator colours the cornflower from `SPECIES[0]` and the Stem entry — **imported, not copied** — so a renderer or materials palette edit changes the icon, and this is what says so. Regenerate with `npm run icons`. Without it the generator and its committed output are simply two sources of truth wearing one coat.
- `npm run material:contrast`: fails when any two material palettes fall below the averaged-colour distance floor. It cannot see per-variant, interaction-state, glow, shape or animation differences, so it is a floor and not a verdict.

  **Two traps when measuring a rendered capture by hand**, both of which have produced a wrong verdict here. Sample the CELL, not a box around it: a 10x10px box around one 4px cell is mostly night sky, and it reported a bud and a spent seed head as 5-8 redmean apart when the cells themselves were 52-66. And measure a material in the SHAPE IT TAKES: an equal-bodies board is the right way to compare identities, but oil scored 78 from the background as a 10x10 block and 182 as the one-cell film it actually forms in play, so the block reading alone would have sent someone off to fix a material that was fine.

  **A mean is the wrong statistic when the neighbour is mottled.** Stone's own cells span luminance 45-136, so "the wellspring sits 39 from stone's mean" said nothing: every cell of a dormant spring landed *inside the band stone already occupies*, and it was invisible in a stone wall while scoring a comfortable distance. Ask whether the cell falls outside the neighbour's p10-p90, not how far it is from the middle.

  **Mean cell-to-cell step cannot tell a clump from a grain.** It is a mean of absolute differences, so a blocky mat with strong contrast between blocks scores about the same as per-cell confetti — which is how a fungus lattice change that made the mat measurably *less* clumpy first read as an improvement. The instrument that sees it is the share of adjacent cell pairs that repeat their neighbour's value: fine speckle almost never repeats, a genuinely clumped mat repeats about half. Quote that alongside the step, never the step alone.
- `npm run test:audio-reactions`: asserts the post-tick reaction detector emits the right cues for each material transition.
- `npm run test:subpath`: builds at a non-root base and asserts no root-absolute asset path survives, so embedding the sandbox under a path on another site cannot silently regress into the JS fallback engine.
- `npm run material:audit`: validates that every material definition has two concrete identity traits and the right number of documented interaction roles — **4-6 for toolbar materials, 1-3 for generated-only outcomes and the Eraser** — before a new element can pass review. It also asserts the visual review board renders every material and every cell-state flag.
- `npm run test:sim`: validates Rust simulation behavior.
- `npm run test:wasm`: validates the WASM bridge and key sim outcomes from JavaScript.
- `npm run test:js-fallback`: validates JS fallback parity for user-visible sim behavior.
- `npm run test:browser`: drives the built app through core UI, local ambience asset decoding, sharing, import/export, and Desk Radio paths. It starts its own static server.

  One of its checks plants a garden **through the tray, with the brush**, and asserts a real bloom opens. That is deliberately not a duplicate of the interaction audit's `flower.opens`: the audit drives the engine compiled straight out of the repo, and this drives the shipped bundle in a real browser — with `COZY_QA_URL`, the deployed one. "No player has ever seen a flower" is a mistake this repo has already made, and it was invisible to every check that did not start from the brush. It reaches bloom in seconds rather than the ~2.5 real minutes it would take from bare seed, by ageing the scene and reloading, which makes it also the check that proves an absence *grows* something rather than only changing a status line. The absence it stages is 2,000 seconds and that number is load-bearing — see the argument at the `stageAgedAutosave` call, and the sprinkle/nondeterminism section below. It used to stage two days, which is precisely why it failed against the deployment.

  **`COZY_QA_URL` points it at a deployment instead**, which is how to answer "does it work in production" rather than "does this build pass":

  ```sh
  COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run test:browser
  COZY_QA_URL=https://pixelfun.littlealbumclub.net npm run visual:qa
  ```

  Both scripts drive a real headless Chrome over CDP, so unlike an embedded preview pane they never get `requestAnimationFrame` throttled — the simulation actually runs while a check waits on it. The app has no backend, so a run only touches the throwaway browser profile's own localStorage.

  It earned itself on the first run: it caught `/favicon.ico` 404ing in production, which the local path **cannot** see, because `startStaticServer` answers `/favicon.ico` with a 204. That is the classic shape of a verification gap — the QA surface and the user surface differed at exactly the point where the bug lived.
- `npm run deploy:verify`: asks whether the DEPLOYMENT is the commit you think it is, which
  nothing could answer until 2026-08-15. The app carried no build identity — the preview
  badge reports asset filenames and only behind a QA query parameter — so a suspicion that
  live differed from local could be held for months and never checked. It cost an afternoon:
  a browser check failed against production and passed locally, and before the real cause
  could be looked for, "is the deployed binary even the same code" had to be answered by
  hand, by running a scenario through the downloaded wasm.

  Vite stamps `__COZY_COMMIT__` from `COZY_COMMIT`, the Dockerfile feeds it Railway's
  `RAILWAY_GIT_COMMIT_SHA` (via `ARG` — the only way a Dockerfile sees a build variable), and
  the app carries it as `data-cozy-commit`. Four assertions, each a way a deploy is wrong
  while looking normal: the page boots and reports a commit, that commit is the expected one,
  the wasm arrives as `application/wasm`, and the app says "wasm sim online" rather than
  "js fallback". The last two are separate on purpose — one reads the header, the other the
  outcome, and they can disagree. A build with no commit stamps `dev`, which the gate fails
  on rather than passing over.

- `npm run qa:live`: `deploy:verify`, then browser and visual QA against `COZY_QA_URL`. This
  is the whole "does production work" question in one command; the local gate structurally
  cannot answer it.

- `npm run visual:qa`: captures deterministic material scenes, room backdrops, and responsive layout metrics into `.tmp/visual-qa`.
- `npm run audio:qa`: writes a native ambience manifest for local audio asset size, target loop length, and mood/room balance review into `.tmp/audio-qa`.
- `node scripts/preview-dist.mjs 4181`: serves the built `app/dist` with bundle badges so stale browser sessions are obvious. Build first. (Windows: `.\scripts\preview-current.ps1 -Port 4181` rebuilds and serves in one step.)
- `npm run test:chrome` / `npm run test:firefox`: **Windows-only** — they shell out to PowerShell. They drive a *visible* browser against a preview server you started yourself, which is how to watch a QA run rather than read its result. Port via `CHROME_QA_APP_PORT` / `FIREFOX_QA_APP_PORT`, default 4173.

### Painting is a sprinkle, so a painted scene is not a fixture

`PAINT_DENSITY` leaves powders at 55, so every brush stroke draws on engine RNG, and how far
that RNG has advanced depends on how many ticks ran before the stroke landed. A check that
paints and then asserts on what GREW is therefore scene-nondeterministic, and it will be
quietly more nondeterministic against a slower host: measured on the same five clicks,
138 soil / 26 seed locally against 107 / 35 on the deployment.

Two rules follow, both learned from "a garden planted in the app actually blooms" passing
locally on every run and failing against production:

- **Paint a bed, not a plot.** One row of five strokes grew one to three plants, and a lone
  bloom is a transient — 14 flower cells at its peak, 1 nine seconds later — so whether the
  check passed was luck. Twelve strokes over two rows bloom in staggered order and hold the
  outcome open for the whole window.
- **Never certify such a check on one local run.** The bar is several consecutive runs
  against BOTH the local build and the deployment. That check was fixed on 5 and 5.

The same file holds a related trap. `catchUpTicks` is `min(secondsAway, 4000)` and a bloom
runs about 4,000 ticks end to end, so staging a two-day absence spends the ENTIRE flowering
inside the catch-up — whose first 3,400 ticks run 250 to a frame, a quarter-second of wall
clock nobody can sample. If a check needs to watch something the wake produces, stage an
absence that lands BEFORE it, not after.

## Golden Principles

- Keep `CLAUDE.md` a map, not a manual: it is loaded every session, so it earns its length only by preventing mistakes. Deeper source-of-truth detail belongs in `docs/`, reached by reference. `AGENTS.md` stays a pointer to it rather than a second copy.
- Turn repeated review feedback into a script, smoke test, deterministic scene, checklist item, or architecture doc update.
- Prefer deterministic QA scenes over ad hoc visual judgment when a material or interaction changes.
- Treat material identity as a checked contract: a toolbar element should have a clear role before it ships.
- Make stale state visible. Preview and QA pages should expose the served bundle badge or capture path.
- Keep sim behavior mechanically legible: Rust, WASM smoke, and JS fallback checks should agree on user-visible rules.
- Keep renderer rules mechanically separate from sim rules. Renderer tests can judge readability, but not encode behavior.
- Validate data at boundaries. Scene imports, shared metadata, and external playback sources should be parsed before trusted.
- Clean small drifts continuously. Dead exports, stale phase labels, duplicated QA helpers, and speculative abstractions should not wait for a giant cleanup phase.

## When To Add Harness

Add or improve harness when one of these happens:

- A bug required manual browser reproduction.
- The user had to ask whether screenshots or previews were current.
- A sim rule changed in Rust but needed a separate reminder to update the JS fallback.
- A review comment caught the same category of issue twice.
- A visual improvement cannot be checked without staring at a hand-painted scene.
- A native sound change cannot be evaluated from code shape alone.
- A script failure message does not tell the next agent what to fix.
- A docs rule is important enough that violating it should be caught mechanically.

## Harness Shape

A good harness improvement should include:

- Signal: what problem it catches.
- Command: how to run it locally.
- Artifact: screenshot, JSON metrics, console output, or failing assertion.
- Source of truth: the doc or module boundary it enforces.
- Failure message: enough context for the next agent to fix the issue without guessing.
- Closeout rule: where the command belongs in `docs/CODE_REVIEW.md` or phase closeout.

## Material Identity Targets

- Keep `docs/MATERIAL_AUDIT.md` aligned with `app/src/materials.ts` when adding, removing, or specializing a material. A toolbar material documents 4-6 concrete interaction roles; a generated-only outcome documents 1-3. Both bounds are enforced, so a material that outgrows its cap needs a row edit in the same change.
- Extend `scripts/material-showcase.mjs` when renderer changes affect material readability.
- Run `npm run material:audit` before broader checks when editing material definitions.

## Cleanup Targets

- Shared browser QA helpers should keep Chrome, Firefox, smoke, and visual scripts from drifting.
- Material readability changes should extend the deterministic showcase instead of creating one-off scenes.
- `App.tsx` should get lighter over time by moving feature surfaces into focused components or hooks.
- Review passes should scan for stale phase labels, dead helpers, duplicate QA logic, unmirrored sim rules, and stale visual captures.
- If Desk Radio or sharing behavior changes, the browser harness should cover both success and blocked/fallback paths.
