# Chill Zone is changing: the Greenhouse is being replaced by Pixelfun

Upload this into the album-club session. It is self-contained — it assumes no knowledge of
the game's repo, and the game's repo needs nothing from you.

---

## What changed outside this repo

The Chill Zone panel currently embeds **jsmonzani's "The Greenhouse"** from itch.io. It is
being replaced by **Pixelfun** (a cozy pixel sandbox, "Night Desk Terrarium"), which is
LaTanya's own game.

The game now runs at **`https://pixelfun.littlealbumclub.net`** — a separate Railway service
in the same Railway project as `album-club`, deploying from a different GitHub repo
(`ldonald067/cozyfun`) on its `main` branch.

**Consequences for this repo, in full:**

- You never build, test, or deploy the game. It deploys itself when its own repo is pushed.
- Your only dependency on it is one URL in one iframe. That is the entire contract.
- The game is already live and verified. Nothing is blocking the change below.
- Do not add the game as a dependency, submodule, or build step. It is a separate service.

---

## The change to make

Two files. Both edits were applied to a clone of this repo at `874a941` and verified there:
`npm run build` passed, all 13 tests passed, and the rendered panel was checked in a browser.
The code below is copied verbatim from that working tree, so this is transcription rather
than design.

### 1. `app/ForumPage.js` (~line 4355)

Find the panel commented `{/* Greenhouse game */}` and replace it — from that comment through
its closing `</div>` — with:

```jsx
        {/* Pixelfun sandbox */}
        <div className="panel">
          <div className="panel-header">
            <span>
              <i className="hn hn-play" aria-hidden="true" /> CHILL ZONE —
              PIXELFUN
            </span>
          </div>
          <div className="panel-body pixelfun-body">
            <p className="activity-prompt" style={{ textAlign: "center" }}>
              Take a break between albums. Pour sand and water, light a hearth,
              grow moss and moonlit flowers — no score to chase, no timer
              breathing down your neck, just a little room to exhale.
            </p>
            <div className="pixelfun-widget">
              {/* Loads a poster first and pulls in the sandbox itself only on click,
                  so scrolling past this panel costs a few KB instead of ~9 MB. */}
              <iframe
                src="https://pixelfun.littlealbumclub.net/embed.html"
                title="Night Desk Terrarium — a cozy pixel sandbox"
                allow="autoplay; fullscreen"
                loading="lazy"
              />
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <a
                href="https://pixelfun.littlealbumclub.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="listen-btn"
                style={{ fontSize: 11, padding: "8px 16px" }}
              >
                <i className="hn hn-play" aria-hidden="true" /> Play in New Tab
              </a>
            </div>
          </div>
        </div>
```

### 2. `app/globals.css` (~line 2375)

Replace the `/* ─── Greenhouse Game ─── */` block with:

```css
/* ─── Pixelfun Sandbox ─── */
.pixelfun-body {
  padding: 15px;
}

.pixelfun-widget {
  max-width: 720px;
  margin: 0 auto;
}

/* Taller than the old itch card: this embed is the game itself, and its controls
   sit under the canvas, so a short frame would clip them. */
.pixelfun-widget iframe {
  width: 100%;
  height: 620px;
  border: none;
  border-radius: 6px;
  display: block;
}

@media (max-width: 640px) {
  .pixelfun-widget iframe {
    height: 520px;
  }
}
```

---

## Four things that will look wrong and are not

Each of these is deliberate. They look like oversights and will be "tidied up" by a future
reader unless the reasoning is on record.

1. **The `by jsmonzani` byline is gone, not relocated.** The panel no longer hosts their game,
   so their name must not stay attached to it. If both games should appear, do not edit this
   panel — add a second one and restore theirs intact.

2. **`src` points at `embed.html`, not the site root.** That page is a ~5 KB poster that loads
   nothing until clicked. Pointing it at `/` instead would make every visitor who scrolls past
   the Chill Zone download roughly 9 MB of game and audio.

3. **`allow="autoplay; fullscreen"` is load-bearing.** Without it the ambience audio and the
   in-game Desk Radio fail — silently, with no console error.

4. **There is deliberately no `sandbox` attribute.** Adding one without `allow-same-origin`
   cuts the game off from browser storage, which silently breaks saved scenes. Its absence is
   the reason saving works.

The old CSS was `max-width: 552px` / `height: 167px`, sized for itch.io's small card. At 167px
the game's controls sit below the visible area entirely.

---

## Verify, then ship

```bash
npm run build     # required before committing, per CLAUDE.md
npm test          # 13 tests
npm run dev
```

On the dev server, confirm:

- Header reads **CHILL ZONE — PIXELFUN**.
- The dark poster renders inside the panel, uncropped.
- Clicking it loads the sandbox and it is playable in place.
- `grep -rn "greenhouse\|jsmonzani" app/` returns nothing.

Then merge to `master`, which auto-deploys.

---

## If it misbehaves after deploy

**Empty box instead of the game** — check `https://pixelfun.littlealbumclub.net/embed.html`
loads directly. If it does, the problem is in the iframe attributes above, not the game.

**Game runs but feels sluggish** — open it standalone and look at the status line under the
canvas. It should read "wasm sim online". If it reads "js fallback", that is the game's
hosting, not this repo; report it rather than changing anything here.

**Saved scenes vanish on reload** — browser storage is being blocked. Confirm the iframe has
no `sandbox` attribute. This should not otherwise happen, because the game's hostname and the
site share a registrable domain and so are not treated as third-party.

Everything else about the game — its content, size, audio, updates — is handled in its own
repo and needs no change here, ever.
