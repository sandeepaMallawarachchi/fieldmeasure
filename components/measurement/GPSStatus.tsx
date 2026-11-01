"use client";

import { Info, Loader2, MapPinOff, Satellite, SignalLow } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMeasurement } from "@/store/measurementStore";
import type { GPSSignal } from "@/types/gps";

/** Icon plus text as well as colour, so the state is readable without relying on colour. */
const SIGNAL_STYLES: Record<GPSSignal, { dot: string; icon: typeof Info | null }> = {
  off: { dot: "bg-muted", icon: MapPinOff },
  searching: { dot: "bg-warning", icon: Loader2 },
  good: { dot: "bg-success", icon: null },
  moderate: { dot: "bg-warning", icon: null },
  poor: { dot: "bg-danger", icon: SignalLow },
  denied: { dot: "bg-danger", icon: MapPinOff },
  unavailable: { dot: "bg-danger", icon: Satellite },
};

function SignalLabel() {
  const signal = useMeasurement((state) => state.signal);
  const { dot, icon: Icon } = SIGNAL_STYLES[signal];
  return (
    <span className="flex items-center gap-2">
      {Icon ? (
        <Icon
          className={cn(
            "size-4 shrink-0",
            signal === "searching" ? "animate-spin text-warning" : "text-danger",
            signal === "off" && "text-muted",
          )}
          aria-hidden
        />
      ) : (
        <span className={cn("size-3 shrink-0 rounded-full", dot)} aria-hidden />
      )}
      <span
        className={cn(
          "text-sm font-semibold",
          signal === "good" ? "text-primary" : "text-foreground",
        )}
      >
        {t.gps.signal[signal]}
      </span>
    </span>
  );
}

function useAccuracyText(): string | null {
  return useMeasurement((state) => {
    const hasSignal = state.signal !== "off" && state.signal !== "denied";
    return hasSignal && state.currentFix
      ? t.gps.accuracy(state.currentFix.accuracy.toFixed(1))
      : null;
  });
}

/** Floating chip on the Ready screen, with the explanation of what the number means. */
export function GPSStatusChip({ className }: { className?: string }) {
  const accuracy = useAccuracyText();
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className={cn("w-fit max-w-64 rounded-2xl bg-surface shadow-control", className)}>
      <div className="flex items-center gap-2 py-2 pr-1 pl-4">
        <div
          className="min-w-0"
          role="status"
          aria-live="polite"
          data-testid="gps-status"
          data-locale-fade
        >
          <SignalLabel />
          {accuracy && <p className="mt-0.5 text-sm text-muted tabular-nums">{accuracy}</p>}
        </div>
        <button
          type="button"
          aria-label={t.gps.accuracyHelp}
          aria-expanded={showHelp}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted"
          onClick={() => setShowHelp((open) => !open)}
        >
          <Info className="size-4.5" aria-hidden />
        </button>
      </div>
      {showHelp && (
        <p className="border-t border-border px-4 py-2 text-xs leading-relaxed text-muted">
          {t.gps.accuracyHelp}
        </p>
      )}
    </div>
  );
}

/** Compact one-line version for the recording header. */
export function GPSStatusLine() {
  const accuracy = useAccuracyText();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5" data-testid="gps-status">
      <SignalLabel />
      {accuracy && <span className="text-sm text-muted tabular-nums">{accuracy}</span>}
    </div>
  );
}
