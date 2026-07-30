// Room images, ambience audio, and the wasm sim are fetched by URL string rather than
// imported, so Vite cannot rewrite them at build time the way it rewrites index.html and
// real imports. A bare "/audio/rain.mp3" therefore 404s the moment the app is served from
// a subpath instead of a domain root — and the wasm case fails silently, dropping the
// sandbox to the JS fallback engine with no error. Prefixing with the configured base
// keeps one build working at "/" and at "/pixelfun/" alike.
//
// Note this module uses `import.meta`, so it must never be imported by `engine.ts` or
// `materials.ts`: the parity harness compiles those two to CommonJS, where `import.meta`
// is a compile error. Engine-side URLs are passed in from the app layer instead.
export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
