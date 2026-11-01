"use client";

import { Pause, Play } from "lucide-react";
import { GPSStatusLine } from "@/components/measurement/GPSStatus";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";

export function RecordingHeader() {
  const paused = useMeasurement((state) => state.status === "paused");
  return (
    <header className="rounded-b-3xl bg-surface px-3 py-3 shadow-control">
      <div
        className={cn(
          "flex items-center justify-between rounded-2xl py-1.5 pr-1.5 pl-3 text-white",
          paused ? "bg-slate-600" : "bg-danger",
        )}
      >
        <span className="flex items-center gap-2.5 font-semibold" role="status" aria-live="polite">
          <span
            className="flex size-5 items-center justify-center rounded-full bg-white"
            aria-hidden
          >
            <span
              className={cn(
                "size-2.5 rounded-full",
                paused ? "bg-slate-600" : "animate-pulse bg-danger",
              )}
            />
          </span>
          {paused ? t.recording.paused : t.recording.recording}
        </span>
        <button
          type="button"
          aria-label={paused ? t.recording.resumeLabel : t.recording.pauseLabel}
          className="flex size-11 items-center justify-center rounded-xl hover:bg-white/15"
          onClick={() => measurementStore.dispatch({ type: paused ? "RESUME" : "PAUSE" })}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-white text-foreground">
            {paused ? (
              <Play className="size-4 fill-current" aria-hidden />
            ) : (
              <Pause className="size-4 fill-current" aria-hidden />
            )}
          </span>
        </button>
      </div>
      <div className="mt-2 px-1">
        <GPSStatusLine />
      </div>
    </header>
  );
}
