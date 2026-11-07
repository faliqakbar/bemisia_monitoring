import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
// Same isolation headers as public/_headers so local preview matches Cloudflare Pages.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};
export default defineConfig(({ mode }) => ({
  server: { headers: isolation },
  preview: { headers: isolation },
  base: loadEnv(mode, process.cwd(), "").VITE_BASE_PATH || "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/@zxing/")) return "qr-scanner";
          if (id.includes("/chart.js/") || id.includes("/@kurkle/"))
            return "charts";
          if (id.includes("/@supabase/")) return "cloud";
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: false,
      includeAssets: ["icons/*.png", "manifest.webmanifest"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 6000000,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/models\//],
        // Model files are too large to precache for every user. They are cached
        // after the first online ONNX run so analysis also works offline.
        runtimeCaching: [
          {
            // Weights requested as bemisia.onnx?v=<sha256> never change, so they
            // are downloaded once; a new model gets a new URL and replaces it.
            urlPattern: ({ url }) =>
              /\/models\/[^/]+\.onnx$/.test(url.pathname) &&
              /^[a-f0-9]{64}$/.test(url.searchParams.get("v") ?? ""),
            handler: "CacheFirst",
            options: {
              cacheName: "bemisia-model-weights",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 1 },
            },
          },
          {
            // Network first keeps model-info.json (and unversioned weights) current.
            urlPattern: ({ url }) =>
              /\/models\/[^/]+\.(onnx|json)$/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "bemisia-model",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 4 },
            },
          },
          {
            // Hashed file name, so the cached copy never goes stale.
            urlPattern: ({ url }) =>
              /\/assets\/[^/]+\.wasm$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "onnx-runtime",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 2 },
            },
          },
        ],
      },
    }),
  ],
}));
