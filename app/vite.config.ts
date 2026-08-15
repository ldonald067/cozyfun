import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This config runs in Node, but the app's tsconfig only covers `src`, so Node globals are
// not typed here. Declaring the single global we use avoids pulling @types/node into the
// app for one env lookup.
declare const process: { env: Record<string, string | undefined> };

// COZY_BASE lets one build serve from anywhere: "/" for a domain root, "/pixelfun/"
// when the sandbox is embedded under a path on a larger site. Vite rewrites index.html
// and imports from this, and `assetUrl()` covers the assets fetched by URL string.
const base = process.env.COZY_BASE ?? "/";

// Stamped into the bundle so a running page can say which commit it is. The Dockerfile
// passes Railway's RAILWAY_GIT_COMMIT_SHA in as COZY_COMMIT; a local build leaves it unset
// and the app reports "dev" rather than claiming a commit it cannot vouch for.
const commit = process.env.COZY_COMMIT ?? "";

export default defineConfig({
  base,
  define: {
    __COZY_COMMIT__: JSON.stringify(commit)
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    target: "es2022"
  }
});

