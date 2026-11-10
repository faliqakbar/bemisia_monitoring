/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from "virtual:pwa-register/react";

// Phones keep the app open for days, so the waiting version is never picked up on its own.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });
  // Ask instead of reloading by itself: a reload would drop an unsaved analysis.
  if (!needRefresh) return null;
  return (
    <div className="toast update-toast" role="status">
      Versi baru aplikasi tersedia. Simpan hasil yang sedang dikerjakan, lalu
      muat ulang.
      <button
        className="update-reload"
        onClick={() => void updateServiceWorker(true)}
      >
        Muat ulang
      </button>
      <button onClick={() => setNeedRefresh(false)} aria-label="Nanti saja">
        ×
      </button>
    </div>
  );
}
