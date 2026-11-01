"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_CONFIG } from "@/config/app";
import { t } from "@/lib/i18n";
import { DEFAULT_MAP_STYLE, isStyleAvailable } from "@/lib/map/mapStyles";
import {
  clearSession,
  loadPreferences,
  loadSession,
  savePreferences,
  saveSession,
  type PersistedSession,
} from "@/lib/storage/measurementSession";
import { showToast } from "@/lib/toast";
import { measurementStore } from "@/store/measurementStore";
import type { MeasurementState } from "@/types/measurement";

export interface SessionRecovery {
  session: PersistedSession | null;
  accept: () => void;
  discard: () => void;
}

/**
 * Saves immediately on meaningful changes, and at most every few seconds while
 * GPS fixes are arriving, because serialising a long walk on every fix would
 * block the main thread. Pagehide flushes the latest state where browsers allow.
 */
export function useSessionPersistence(): SessionRecovery {
  const [session, setSession] = useState<PersistedSession | null>(null);

  useEffect(() => {
    const preferences = loadPreferences();
    measurementStore.dispatch({
      type: "SET_MAP_STYLE",
      style:
        preferences && isStyleAvailable(preferences.mapStyle)
          ? preferences.mapStyle
          : DEFAULT_MAP_STYLE,
    });
    if (preferences) {
      measurementStore.dispatch({ type: "SET_AREA_UNIT", unit: preferences.areaUnit });
    }

    const restored = loadSession();
    if (restored && restored.acceptedPoints.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists on the client, after hydration
      setSession(restored);
    } else if (restored) {
      clearSession();
    }

    let storageFailureShown = false;
    let lastSavedAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const save = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      lastSavedAt = Date.now();
      const state = measurementStore.getState();
      if (saveSession(state) === "failed" && !storageFailureShown) {
        storageFailureShown = true;
        measurementStore.dispatch({ type: "ADD_WARNING", code: "storage-unavailable" });
        showToast({ message: t.storageFailed, tone: "warning", persistent: true });
      }
    };

    const handleChange = (state: MeasurementState, previous: MeasurementState) => {
      if (state.areaUnit !== previous.areaUnit || state.mapStyle !== previous.mapStyle) {
        savePreferences({ areaUnit: state.areaUnit, mapStyle: state.mapStyle });
      }
      if (previous.sessionId && !state.sessionId) {
        clearSession();
        return;
      }
      if (!state.sessionId) return;

      const isMeaningful =
        state.status !== previous.status ||
        state.editedPoints !== previous.editedPoints ||
        state.exported !== previous.exported;
      if (isMeaningful) {
        save();
        return;
      }
      if (
        state.acceptedPoints === previous.acceptedPoints &&
        state.warnings === previous.warnings
      ) {
        return;
      }
      if (timer === null) {
        const wait = Math.max(0, lastSavedAt + APP_CONFIG.sessionCheckpointMs - Date.now());
        timer = setTimeout(save, wait);
      }
    };

    const handleHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    const unsubscribe = measurementStore.subscribe(handleChange);
    document.addEventListener("visibilitychange", handleHide);
    window.addEventListener("pagehide", save);
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleHide);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  const accept = useCallback(() => {
    setSession((current) => {
      if (current) {
        measurementStore.dispatch({ type: "RESTORE", session: current });
        if (current.status === "recording" || current.status === "paused") {
          showToast({ message: t.recovery.restoredPaused, tone: "info" });
        }
      }
      return null;
    });
  }, []);

  const discard = useCallback(() => setSession(null), []);

  return { session, accept, discard };
}
