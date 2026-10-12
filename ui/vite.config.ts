/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { officialSecMiddleware } from "../scripts/official_sec.mjs";

// FR-007 — SPA served by the FastAPI api service in production (ui/dist).
// The GitHub Pages demo builds with VITE_BASE=/crible/ VITE_DATA_MODE=static.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? "/",
  // literal replacement so the unused mode's client (and duckdb-wasm's ~77 MB
  // of assets) is dead-branch-eliminated from the build entirely
  define: {
    "import.meta.env.VITE_DATA_MODE": JSON.stringify(process.env.VITE_DATA_MODE ?? (mode === "test" ? "api" : "static")),
    "import.meta.env.VITE_DATA_BASE": JSON.stringify(process.env.VITE_DATA_BASE ?? process.env.VITE_BASE ?? "/"),
  },
  plugins: [react(), {
    name: "official-sec-local",
    configureServer(server) { server.middlewares.use(officialSecMiddleware); },
    configurePreviewServer(server) { server.middlewares.use(officialSecMiddleware); },
  }],
  server: {
    watch: { ignored: ["**/public/data/*.parquet"] },
    proxy: {
      "/api": "http://localhost:8000",
      "/healthz": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    experimental: { fsModuleCache: true, fsModuleCachePath: "./.vitest-cache" },
  },
}));
