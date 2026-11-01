"use client";

import { useEffect } from "react";
import { GPS_QUALITY_CONFIG } from "@/config/gps";
import { geolocationService } from "@/lib/gps/geolocationService";
import { measurementStore, useMeasurement } from "@/store/measurementStore";
import type { MeasurementStatus } from "@/types/measurement";

const WATCHING_STATUSES: readonly MeasurementStatus[] = [
  "acquiring-gps",
  "ready",
  "recording",
  "paused",
];

function startWatching() {
  geolocationService.start({
    onObservation: (observation) =>
      measurementStore.dispatch({ type: "GPS_FIX", observation, now: Date.now() }),
    onError: (error) => measurementStore.dispatch({ type: "GPS_ERROR", error }),
  });
}

/**
 * Runs GPS exactly while a measurement can use it. There is no background
 * tracking: the watch stops on review and result screens.
 */
export function useGeolocation(): void {
  const status = useMeasurement((state) => state.status);
  const shouldWatch = WATCHING_STATUSES.includes(status);

  useEffect(() => {
    if (!shouldWatch) return;
    startWatching();

    const stale = setInterval(() => {
      const { currentFix } = measurementStore.getState();
      if (currentFix && Date.now() - currentFix.timestamp > GPS_QUALITY_CONFIG.staleAfterMs) {
        measurementStore.dispatch({ type: "GPS_STALE" });
      }
    }, GPS_QUALITY_CONFIG.staleCheckIntervalMs);

    // Some mobile browsers silently end a watch while hidden, so restart it on return.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      geolocationService.stop();
      startWatching();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(stale);
      document.removeEventListener("visibilitychange", handleVisibility);
      geolocationService.stop();
    };
  }, [shouldWatch]);

  // Only skips the prompt for people who already granted access. First-time
  // users are asked after they tap "Find My Location", never on page load.
  useEffect(() => {
    if (status !== "idle" || !navigator.permissions) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (!cancelled && permission.state === "granted") {
          measurementStore.dispatch({ type: "REQUEST_GPS" });
        }
      })
      .catch(() => {
        // Safari may reject this query; the user simply taps the button instead.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);
}
