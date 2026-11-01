"use client";

import { useEffect } from "react";
import { t } from "@/lib/i18n";
import { selectHasUnsavedWork } from "@/lib/measurement/selectors";
import { showToast } from "@/lib/toast";
import { measurementStore, useMeasurement } from "@/store/measurementStore";

/**
 * Protects a recording from the things a web page can't prevent outright:
 * the screen sleeping, the app going to the background, and the tab closing.
 */
export function useRecordingGuards(): void {
  const isRecording = useMeasurement((state) => state.status === "recording");

  useEffect(() => {
    if (!isRecording) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    let wasHidden = false;

    const acquireLock = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {
          // Unsupported or refused (low battery). Recording still works if the screen stays on.
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        return;
      }
      acquireLock(); // The browser releases wake locks whenever the page is hidden.
      if (wasHidden) {
        wasHidden = false;
        measurementStore.dispatch({ type: "ADD_WARNING", code: "background" });
        showToast({ message: t.recording.hiddenWarning, tone: "warning" });
      }
    };

    acquireLock();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void lock?.release();
    };
  }, [isRecording]);

  useEffect(() => {
    // Best effort: browsers decide whether to show this, particularly on mobile.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (selectHasUnsavedWork(measurementStore.getState())) event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}
