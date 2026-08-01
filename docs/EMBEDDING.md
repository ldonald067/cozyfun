# Embedding the sandbox in another site

The sandbox is a static build with no backend, so it can be dropped onto any host that
serves files. The two things that actually decide whether an embed works are **where it is
served from** and **what path it is served under**.

## How this one is deployed

`pixelfun.littlealbumclub.net` is live: a Railway service named `cozyfun`, sharing a project
with the `album-club` service, building from this repo on `main`. A push to `main` redeploys
the game and the site repo is never touched — `littlealbumclub.net` simply iframes it.

Two things that were not obvious while setting this up, recorded so they are not rediscovered
the hard way. Railway only offers the **Custom Domain** button on a service that has deployed
at least once, so a brand-new service appears to be missing the feature entirely — deploy
first, then attach the domain. And attaching it needs **two** DNS records, not one: the CNAME
plus a `_railway-verify.<sub>` TXT record, and the domain stays inactive until both resolve.

The pieces: `Dockerfile` builds both toolchains (cargo compiles the sim to wasm32, then Vite
bundles the app around it) and `scripts/serve-static.mjs` serves the result.
`railway.json` pins the Dockerfile builder so Railway does not try to guess.

That server is hand-written for one reason: `.wasm` must be served as `application/wasm` or
`instantiateStreaming` refuses it, and the app does not report that — it quietly falls back
to the JS engine. Several hosts default unknown extensions to `application/octet-stream`, so
the MIME table there is the guarantee. It also caches fingerprinted `/assets/*` immutably
while making everything else revalidate, and deliberately has no SPA catch-all: a missing
asset should 404 loudly rather than return a page of HTML.

Because the service owns its whole hostname, the app sits at that host's root and
`COZY_BASE` stays unset. Set it only to mount the build under a path on a larger site.

### Verified live

Checked against the running host on 2026-07-30: `/embed.html` and `/` return 200; clicking
through reports **wasm sim online** at 60 fps rather than the JS fallback; `.wasm` arrives as
`application/wasm`; `localStorage` inside the frame is readable and writable; fingerprinted
`/assets/*` carry `immutable` while `embed.html`, the wasm, and the audio revalidate; a
missing file returns a real 404 as `text/plain`; TLS valid over HTTP/2.

## Serve it from your own origin

Host the build on the same origin as the page that embeds it, or on a subdomain of the same
registrable domain. Do not embed it from a third-party host such as itch.io.

A subdomain is enough: Chrome partitions storage by registrable domain and Safari's ITP
treats third-party by registrable domain too, so `pixelfun.example.net` inside a page on
`example.net` is not a third party and keeps its storage. A wholly different domain is.

The sandbox keeps everything in `localStorage`: saved scenes, the chosen room, audio
preferences, Desk Radio settings. In a cross-origin iframe that storage is either blocked
outright (Safari's ITP) or partitioned per embedding site (Chrome), so a visitor's saved
terrarium quietly disappears. Same-origin embedding avoids the problem entirely, and it
also avoids nesting a YouTube iframe (Desk Radio) three levels deep, where `allow`
permissions have to be threaded through every layer.

Publishing to itch.io as a standalone page is still worth doing for reach — it just should
not be the thing your own site iframes. One build serves both.

## Build for the path it will live at

Asset URLs are resolved from Vite's `base`, which comes from `COZY_BASE`:

```bash
COZY_BASE=/pixelfun/ npm run build
```

Leave `COZY_BASE` unset for a domain root. Include both slashes on a subpath.

This matters beyond `index.html`. Room images, ambience audio, and the wasm sim are fetched
by URL string rather than imported, so Vite cannot rewrite them — `assetUrl()` in
`app/src/assetUrl.ts` applies the base at runtime instead. The wasm case is the one to
watch: if that request 404s the app does not error, it silently falls back to the slower JS
engine, so a subpath build with the wrong base looks fine and runs wrong. After deploying,
confirm the status line reads **"wasm sim online"**.

## Server requirements

- Serve `.wasm` as `application/wasm`. Some static hosts default to `application/octet-stream`,
  which makes `instantiateStreaming` fail and drops the app to the JS engine.
- Nothing else is special: no SPA rewrite rules, no backend, no environment variables.

## The embed snippet

`embed.html` ships next to `index.html`. It is an ~18 KB poster that loads nothing until the
visitor clicks, then swaps itself for the app. Point the iframe at it rather than at
`index.html` directly — the full build is roughly 9 MB, and without the poster every visitor
who scrolls past pays for it.

For the deploy described above, where the game owns its own hostname:

```html
<iframe
  src="https://pixelfun.littlealbumclub.net/embed.html"
  title="Night Desk Terrarium"
  width="100%"
  height="620"
  style="border:0;border-radius:12px;max-width:960px;display:block;margin:0 auto"
  allow="autoplay; fullscreen"
  loading="lazy"
></iframe>
```

If the build is instead mounted under a path on the same site, the only change is a relative
`src` — `src="/pixelfun/embed.html"` — and a matching `COZY_BASE` at build time.

`allow="autoplay; fullscreen"` is needed for ambience and Desk Radio. Do not add a `sandbox`
attribute unless you know what you are re-granting: the default omission is what lets the
app keep same-origin storage access, and `sandbox` without `allow-same-origin` reintroduces
exactly the storage problem described above.

Height is a judgment call — the layout is responsive and the controls sit under the canvas,
so around 620px reads comfortably on desktop while staying reasonable on mobile. The
`loading="lazy"` attribute defers even the poster until it scrolls into view.

### What the poster draws

Rain falling in three sheets, condensation beaded on the glass in front of it, distant
lightning, and warm lamplight below — all of it CSS gradients and inline SVG, with no image
files and no sub-resource requests. The technique is borrowed from a CodePen that reaches a
similar look with about 440 KB of hotlinked PNGs; the notes in `embed.html` record what was
taken, what was deliberately not, and the two costs accepted along with it. Motion drops out
under `prefers-reduced-motion`, leaving the beads, which never moved.

## What the gate covers

`npm run test:subpath` (part of `npm run check`) builds at a test base into its own output
directory and fails if any root-absolute `/audio`, `/rooms`, or `/sim` path survives in the
bundle, if the base was never applied, if it was applied twice, or if `embed.html` stops
being relative. It exists because the rest of the gate only ever builds and serves at `/`,
so a subpath regression — especially the silent wasm one — would otherwise ship green.

## Checking a deploy

1. Open the embed page. The poster should appear without any large network requests.
2. Click through. The status line should say **"wasm sim online"**, not "js fallback".
3. Paint something, reload the page, and confirm the scene is still there — that proves
   storage is not being blocked or partitioned.
4. Turn on sound and confirm ambience plays.
