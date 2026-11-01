"use client";

import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppCredit } from "@/components/common/AppCredit";
import { Toaster } from "@/components/common/Toaster";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { InstallGuideDialog } from "@/components/dialogs/InstallGuideDialog";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import { AppHeader, SubHeader } from "@/components/layout/AppHeader";
import { RecordingHeader } from "@/components/layout/RecordingHeader";
import { MapControls } from "@/components/map/MapControls";
import { GPSStatusChip } from "@/components/measurement/GPSStatus";
import { ReadyPanel } from "@/components/measurement/ReadyPanel";
import { RecordingPanel } from "@/components/measurement/RecordingPanel";
import { ResultPanel } from "@/components/measurement/ResultPanel";
import { ReviewPanel } from "@/components/measurement/ReviewPanel";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRecordingGuards } from "@/hooks/useRecordingGuards";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { getLocale, initLocale, subscribeToLocale, t } from "@/lib/i18n";
import type { MapController } from "@/lib/map/mapController";
import { clearSession } from "@/lib/storage/measurementSession";
import { cn } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";

const LandMap = dynamic(() => import("@/components/map/LandMap"), { ssr: false });

const dispatch = measurementStore.dispatch;

/** Publishes how much of the map the bottom sheet covers, for map attribution placement. */
function usePanelOffset(panelRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const update = () => {
      const rect = panel.getBoundingClientRect();
      const isBottomSheet = rect.width > window.innerWidth * 0.7;
      document.documentElement.style.setProperty(
        "--map-panel-offset",
        isBottomSheet ? `${Math.max(0, window.innerHeight - rect.top)}px` : "0px",
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [panelRef]);
}

/** Softens the instant swap of text when the language changes. */
function useLocaleFade(locale: string) {
  const previous = useRef(locale);
  useEffect(() => {
    if (previous.current === locale) return;
    previous.current = locale;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    for (const element of document.querySelectorAll("[data-locale-fade]")) {
      element.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
    }
  }, [locale]);
}

export function AppShell() {
  const status = useMeasurement((state) => state.status);
  const hasEdits = useMeasurement((state) => state.editedPoints !== null);
  const [controller, setController] = useState<MapController | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingBack, setConfirmingBack] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Everything below reads text from `t`, so a language change re-renders from here.
  const locale = useSyncExternalStore(subscribeToLocale, getLocale, () => "en");
  useEffect(() => initLocale(), []);
  useLocaleFade(locale);

  const recovery = useSessionPersistence();
  useGeolocation();
  useRecordingGuards();
  useServiceWorker();
  usePanelOffset(panelRef);

  const handleMapReady = useCallback((next: MapController | null) => setController(next), []);

  const isCompleted = status === "completed";
  const isReviewing = status === "reviewing";
  const isRecording = status === "recording" || status === "paused";
  const isReadyPhase = !isCompleted && !isReviewing && !isRecording;

  return (
    <main className="fixed inset-0 overflow-hidden bg-background" data-status={status}>
      <h1 className="sr-only">FieldMeasure</h1>

      {/*
        One stable map instance throughout. On phones the result screen shows it as
        an inset preview; everywhere else it fills the screen behind the panels.
      */}
      <div
        className={cn(
          "absolute z-0 overflow-hidden",
          isCompleted
            ? "inset-x-4 top-[calc(var(--safe-top)+72px)] h-[30dvh] rounded-2xl md:inset-0 md:h-auto md:rounded-none"
            : "inset-0",
        )}
      >
        <LandMap onReady={handleMapReady} />
      </div>

      <div
        data-map-topbar
        className="absolute inset-x-0 top-0 z-20 pt-[var(--safe-top)] md:pointer-events-none"
      >
        <div className="bg-surface md:pointer-events-auto md:mx-auto md:max-w-none">
          {isReadyPhase && <AppHeader onOpenSettings={() => setSettingsOpen(true)} />}
          {isRecording && <RecordingHeader />}
          {isReviewing && (
            <SubHeader
              title={t.review.title}
              onBack={() =>
                hasEdits ? setConfirmingBack(true) : dispatch({ type: "BACK_TO_RECORDING" })
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasEdits}
                  onClick={() => dispatch({ type: "EDIT_RESET" })}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  {t.common.reset}
                </Button>
              }
            />
          )}
          {isCompleted && (
            <SubHeader title={t.result.title} onBack={() => dispatch({ type: "EDIT_AGAIN" })} />
          )}
        </div>
      </div>

      {isReadyPhase && (
        <GPSStatusChip className="absolute top-[calc(var(--safe-top)+76px)] left-3 z-10 md:top-[calc(var(--safe-top)+80px)] md:left-[408px]" />
      )}

      {!isCompleted && (
        <MapControls
          controller={controller}
          className={cn(
            "absolute right-3 z-10",
            isRecording ? "top-[calc(var(--safe-top)+132px)]" : "top-[calc(var(--safe-top)+76px)]",
          )}
        />
      )}

      <div
        ref={panelRef}
        data-map-panel
        className={cn(
          "absolute z-10 overflow-y-auto bg-surface",
          isCompleted
            ? "inset-x-0 top-[calc(var(--safe-top)+72px+30dvh+12px)] bottom-0 px-4 pb-[calc(var(--safe-bottom)+16px)] md:top-[calc(var(--safe-top)+80px)] md:right-4 md:bottom-4 md:left-auto md:w-[420px] md:rounded-3xl md:p-5 md:shadow-panel"
            : "inset-x-0 bottom-0 max-h-[62dvh] rounded-t-3xl p-4 pb-[calc(var(--safe-bottom)+16px)] shadow-panel md:top-[calc(var(--safe-top)+80px)] md:right-auto md:bottom-auto md:left-4 md:max-h-[calc(100dvh-var(--safe-top)-100px)] md:w-[380px] md:rounded-3xl md:p-5",
          isRecording && "md:top-[calc(var(--safe-top)+136px)]",
        )}
      >
        {isReadyPhase && (
          <div data-locale-fade>
            <ReadyPanel />
            <AppCredit className="mt-3" />
          </div>
        )}
        {isRecording && <RecordingPanel />}
        {isReviewing && <ReviewPanel />}
        {isCompleted && <ResultPanel />}
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <ConfirmDialog
        open={confirmingBack}
        destructive
        title={t.review.discardEditsTitle}
        description={t.review.discardEditsBody}
        confirmLabel={t.review.discardEdits}
        cancelLabel={t.common.cancel}
        onCancel={() => setConfirmingBack(false)}
        onConfirm={() => {
          setConfirmingBack(false);
          dispatch({ type: "BACK_TO_RECORDING" });
        }}
      />

      <ConfirmDialog
        open={recovery.session !== null}
        title={t.recovery.title}
        description={t.recovery.body(recovery.session?.acceptedPoints.length ?? 0)}
        confirmLabel={t.recovery.resume}
        cancelLabel={t.recovery.discard}
        onConfirm={recovery.accept}
        onCancel={() => {
          clearSession();
          recovery.discard();
        }}
      />

      <InstallGuideDialog blocked={recovery.session !== null} />

      <Toaster />
    </main>
  );
}
