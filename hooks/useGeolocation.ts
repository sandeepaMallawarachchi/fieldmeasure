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

  // Asks for location as soon as the app opens. Starting the watch shows the
  // browser's prompt if access hasn't been decided, and reports an error straight
  // away if it was blocked, which the Ready panel then explains.
  useEffect(() => {
    if (status === "idle") measurementStore.dispatch({ type: "REQUEST_GPS" });
  }, [status]);
}
