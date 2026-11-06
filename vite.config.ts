import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => ({
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
            // Network first keeps a replaced model and its model-info.json in step.
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
