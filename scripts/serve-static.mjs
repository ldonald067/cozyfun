// Production static server for the standalone deploy (Railway).
//
// A hand-written server rather than a generic one for a specific reason: `.wasm` must be
// served as `application/wasm` or `WebAssembly.instantiateStreaming` refuses it, and the
// app does not surface that as an error — it silently falls back to the slower JS engine.
// Several static hosts default unknown extensions to application/octet-stream, so the MIME
// table here is the guarantee rather than a hope.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "app", "dist");
const port = Number(process.env.PORT ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// Vite fingerprints everything under /assets, so those are safe to cache hard. Everything
// else — index.html, embed.html, the wasm, audio, room art — keeps a stable filename across
// releases and must revalidate, or a returning visitor gets a stale mix of old and new.
// Revalidation is only cheap if the response carries a validator: without one the browser
// cannot ask "still current?" and re-downloads in full, which for the ambience beds means
// several MB on every return visit. Size and mtime are enough to build that validator.
function cacheControl(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=0, must-revalidate";
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    // normalize() collapses any ../ before it can escape the served directory.
    const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
    const file = join(root, relative);
    if (!file.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      // No SPA rewrite: the app is a single page and every real asset exists on disk, so a
      // catch-all would turn a mistyped asset path into a 200 of HTML and mask the very
      // 404s worth seeing (a missing wasm above all).
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
      return;
    }

    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": cacheControl(pathname),
      "x-content-type-options": "nosniff",
      etag,
    };
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers).end();
      return;
    }

    res.writeHead(200, { ...headers, "content-length": info.size });
    if (req.method === "HEAD") {
      res.end();
      return;
    }

    // A stream error is emitted asynchronously, so the try/catch around this handler cannot
    // see it — unhandled, it takes the whole process down and the service with it. A file
    // can vanish between stat and open, and disks do fail.
    const stream = createReadStream(file);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" }).end("read error");
      else res.destroy();
    });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("server error");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`serving ${root} on :${port}`);
});
