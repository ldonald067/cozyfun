# Resuming after a break

The project was paused on 2026-11-03 at `bde2e81`, green in CI and live. This page is for the
first hour after picking it up again, possibly on a new machine, possibly with a different
assistant or none. Everything here was true on that date; check each step rather than trusting it.

## 1. Read these, in this order

1. `CLAUDE.md` — the operating guide for any coding agent (Codex reads `AGENTS.md`, which points
   here). The commands, the Rust/JS parity invariant, and the gotchas that have cost time.
2. `docs/HANDOFF.md` — what to do next. It was rewritten at the pause: the first task is walls in
   weather, and the phone timing is deliberately left open.
3. This page's section 5, for how the owner likes the work done.

## 2. Set up a machine

What the project last ran on, on macOS (Apple silicon): Node 24.18, npm 11.16, Rust stable 1.97
with the `wasm32-unknown-unknown` target, Codex CLI 0.156 for reviews. CI uses Node 24 and
whatever Rust stable is current, so newer versions should work; if `test:parity` or the sim
tests break after a toolchain jump, suspect the toolchain before the code.

```bash
rustup target add wasm32-unknown-unknown
```

```bash
npm --prefix app ci
```

```bash
source "$HOME/.cargo/env" && npm run check
```

The gate takes about 15 minutes. If it passes, the machine is ready. On macOS, git and clang can
stop working after an Xcode update until the licence is accepted again: run
`sudo xcodebuild -license accept` yourself, since it needs your password.

The `.ps1` scripts in `scripts/` are for Windows only; on a Mac or Linux, use the npm scripts.

## 3. If the site is down

The game was served at `pixelfun.littlealbumclub.net` by a Railway service, building from `main`,
and `littlealbumclub.net` shows it in an iframe that points to `pixelfun.littlealbumclub.net/embed.html`.
If the Railway service or domain was let go, the main site's iframe shows an error until it
is either pointed somewhere else or removed. That change lives in the site's own repository, not
here.

To bring the game back, follow `docs/EMBEDDING.md`, "How this one is deployed". Three things
there are easy to get wrong. Railway only shows the custom-domain button after a service has
deployed once. The domain needs two DNS records: the CNAME and a `_railway-verify` TXT record.
And `.railway/railway.ts` is not applied by a push: run `railway config plan`, read every line,
then `railway config apply`. Leave `COZY_BASE` unset for a domain root.

Any static host works too, as long as it serves `.wasm` as `application/wasm`
(`scripts/serve-static.mjs` does). The same section explains why the site that embeds the game
should be on the same registrable domain.

Never judge a deploy by eye: a missing wasm silently falls back to the slower JS engine. Run
`npm run deploy:verify` against the live URL, then add `COZY_QA_URL=<url> npm run qa:live`.

## 4. What lived outside this repo, and where it went

- **The scratch tools.** `.tmp/` is untracked. On the pause, the hand-written tools from every
  visual batch (film, sheet, sabotage, perf and measuring scripts) were pushed to the
  `scratch-tools` branch, which is never merged or deployed. Its `README.md` explains how to
  copy them back. The newest batch template is `.tmp/solids/`.
- **The design canvas** "Flowers and Interactions" lived on claude.ai. Its source, the text of
  all seven boards, is on the `scratch-tools` branch under `design-canvas/`. Its pictures were
  claude.ai uploads and were not kept. It was already out of date: see the handoff.
- **The phone timer** was a claude.ai page. Its source is `.tmp/phoneperf/` on that branch:
  `node .tmp/phoneperf/build.mjs` builds `phone-timer.html`, which can be opened on a phone from
  any host. The handoff says what it has and has not proven.
- **Assistant memory.** Claude kept notes about how the owner works, outside the repo. What
  still matters is folded into section 5.
- **Reviews.** `/adversarial-review` (in `.claude/skills/`) uses Codex as the reviewer of
  Claude's work. Without Claude, the same discipline still applies: have a different model or a
  person review a diff with `docs/CODE_REVIEW.md` as the bar before landing anything substantial.

## 5. How the owner likes the work done

These come from months of working together. Each was learned the hard way.

- **Decisions come from pictures, not numbers.** Show a rendered before/after, and a moving
  side-by-side for anything that animates, explained plainly. Lead with what a player would see,
  and with what the tray's own copy promises.
- **Measure every claim before making it,** including claims in the handoff. Several confident
  statements ("the seam is invisible", "plants are mostly leafless") were false when measured.
  When a new measurement undercuts a choice already made, stop and ask again with the new number.
- **No cheap fixes.** Go for the change that moves the player's experience, and say what was
  deliberately not done and why. Never lower a gate's floor or tune a fixture until it passes.
- **Keep the interface minimal.** A discovery journal was built and removed the next day as
  "not worth it". Payoffs land in the pixels or in sound, not in new panels. Hidden
  two-material discoveries are welcome, as long as a player can stumble on them in ordinary play.
- **Work in batches:** build, run `npm run check`, commit, push, then check CI with
  `gh run list`. A red CI run makes Railway skip that commit for good; it takes a new push.
- **The visual direction** since 2026-10-30 is "a mix of realism but still pixel art", one
  batch of materials at a time, keeping what makes each material itself.
- **Usage was always tight.** Keep sessions lean: search long docs with `grep -n` and read only
  the range needed, run the full gate once per batch, do not run long checks side by side, and
  say up front how long a run will take.
- **The sim runs at about 20 ticks a second** at 60 Hz (`TICKS_PER_SECOND`), not 60. Divide
  ticks by 20 when talking in seconds.
- **The Claude in Chrome extension never connected on the owner's Mac.** Do not spend time on
  it; `COZY_QA_URL=<url> npm run test:browser` drives a real headless Chrome instead.
