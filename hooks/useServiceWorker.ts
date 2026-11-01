"use client";

import { useEffect } from "react";
import { t } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import { measurementStore } from "@/store/measurementStore";

/** Same-origin assets this page already loaded; the worker wasn't active yet to cache them. */
function cacheLoadedAssets(worker: ServiceWorker | null | undefined) {
  if (!worker) return;
  const urls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => url.startsWith(`${location.origin}/_next/static/`));
  worker.postMessage({ type: "CACHE_URLS", urls });
}

function preloadOfflineModules() {
  // Lazily loaded code has to reach the cache while online, or exporting a
  // report would fail the first time it is tried without a connection.
  void import("@/lib/export/createReportImage");
  void import("@/lib/export/downloadImage");
  void import("@/lib/export/reportData");
}

function offerUpdate(waiting: ServiceWorker) {
  const apply = () => {
    showToast({
      message: t.update.available,
      tone: "info",
      persistent: true,
      action: {
        label: t.update.action,
        onClick: () => waiting.postMessage({ type: "SKIP_WAITING" }),
      },
    });
  };
  // Reloading mid-walk would interrupt GPS, so the offer waits until recording stops.
  const status = measurementStore.getState().status;
  if (status !== "recording" && status !== "paused") {
    apply();
    return;
  }
  const unsubscribe = measurementStore.subscribe((state) => {
    if (state.status !== "recording" && state.status !== "paused") {
      unsubscribe();
      apply();
    }
  });
}

export function useServiceWorker(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        if (registration.waiting && hadController) offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(installing);
            }
          });
        });
        // Only an update replacing a running worker should reload the page.
        if (hadController) {
          navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        }
        const ready = await navigator.serviceWorker.ready;
        preloadOfflineModules();
        // Wait a moment for the preloaded modules to appear in the resource list.
        setTimeout(() => cacheLoadedAssets(ready.active), 2_000);
      })
      .catch(() => {
        // The app works fully online without a service worker; only offline loading is lost.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);
}
