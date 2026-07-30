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

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    target: "es2022"
  }
});

