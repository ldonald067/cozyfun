# Integrating the sandbox into Album Of The Day Club

Handoff for whoever works in the `ldonald067/album-club` repo. Everything below has been
built and tested against that repo at commit `874a941` (branch `master`); the build passed
and all 13 tests passed with these edits applied.

**The game itself needs no changes.** It already ships an embed-ready page. This is only
about the site side, plus one deploy step that has to happen first.

---

## Step 0 — Deploy the game before touching the site

**Do this first, and confirm it before merging anything into `master`.** The panel below
points at `https://pixelfun.littlealbumclub.net`. Until that host answers, the panel renders
as an empty box on the live site — `master` auto-deploys, so a premature merge ships a
visibly broken section.

In Railway:

1. New service → deploy from GitHub repo `ldonald067/cozyfun`.
2. It picks up the `Dockerfile` at the repo root automatically (`railway.json` pins the
   Dockerfile builder). The first build compiles Rust to wasm and is slow — a few minutes.
   Later builds reuse cached layers.
3. Add the custom domain `pixelfun.littlealbumclub.net` and create the CNAME Railway shows
   you.

Then verify, in a browser, before going further:

- `https://pixelfun.littlealbumclub.net/embed.html` shows a dark poster reading
  "Night Desk Terrarium".
- Clicking it loads the sandbox, and the status line reads **"wasm sim online"**. If it says
  "js fallback", the `.wasm` is being served with the wrong MIME type — that is the one
  failure this project trips over repeatedly, and it does not throw an error.
- Paint something, reload, and confirm the scene is still there. That proves browser storage
  is not being blocked.

From then on, pushing to `cozyfun`'s `main` redeploys the game by itself. The site repo
never needs to change again.

---

## Step 1 — Replace the Chill Zone panel

In `app/ForumPage.js`, around line 4355, there is a panel commented `{/* Greenhouse game */}`.
It currently embeds **jsmonzani's "The Greenhouse"** from itch.io, credited to them in the
header and linked twice.

Replace that whole panel — from the `{/* Greenhouse game */}` comment through its closing
`</div>` — with this:

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

Notes on the choices, so they are not undone by accident:

- **The `by jsmonzani` byline is deliberately gone.** This panel no longer hosts their game,
  so keeping their name on it would miscredit someone else's work. If you would rather keep
  the Greenhouse *as well*, do not edit this panel — add a second one instead.
- **`src` points at `embed.html`, not the site root.** That page is a ~5 KB poster that loads
  nothing until clicked. Pointing at `/` instead would make every visitor who scrolls past
  the panel download roughly 9 MB.
- **`allow="autoplay; fullscreen"` is required** for the ambience audio and the in-game
  Desk Radio. Without it they fail silently.
- **Do not add a `sandbox` attribute.** Without `allow-same-origin` it would cut the game off
  from browser storage, which silently breaks saved scenes. Its absence is intentional.

---

## Step 2 — Update the styles

In `app/globals.css`, around line 2375, replace the `/* ─── Greenhouse Game ─── */` block
with:

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

The old rules were `max-width: 552px` and `height: 167px` — sized for itch.io's small card,
not for a playable canvas. At 167px the game's controls would be cut off entirely.

---

## Step 3 — Verify

```bash
npm run build     # required before committing, per CLAUDE.md
npm test          # 13 tests
npm run dev       # then look at the Chill Zone panel
```

On the dev server, confirm:

- The header reads **CHILL ZONE — PIXELFUN**.
- The poster appears inside the panel and the panel is not clipped.
- Clicking the poster loads the sandbox and it is playable in place.
- No `jsmonzani` or `greenhouse` strings remain: `grep -rn "greenhouse\|jsmonzani" app/`
  should return nothing.

Then merge to `master`, which deploys.

---

## If something looks wrong

**Empty box where the game should be** — `pixelfun.littlealbumclub.net` is not up yet, or the
DNS has not propagated. Step 0 is not finished.

**Game loads but feels sluggish** — check the status line. If it reads "js fallback" rather
than "wasm sim online", the host is serving `.wasm` with the wrong content type. The game's
own server (`scripts/serve-static.mjs` in the cozyfun repo) sets `application/wasm`
explicitly, so this should not happen on the Railway service, but it is the first thing to
check if the sandbox is slow.

**Scenes do not survive a reload** — browser storage is being partitioned or blocked. That
should not occur here, because `pixelfun.littlealbumclub.net` and `littlealbumclub.net` share
a registrable domain and so are not treated as third-party. If it does happen, the fallback
is to serve the build from a path on the main site instead: build it with
`COZY_BASE=/pixelfun/ npm run build`, drop the output in `public/pixelfun/`, and change the
iframe `src` to `/pixelfun/embed.html`. See `docs/EMBEDDING.md` in the cozyfun repo.

**Panel too tall or too short on some screen** — adjust the two heights in Step 2. Nothing
else depends on them.
