"use client";

import { AlertTriangle, Footprints, Loader2, MapPin, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { createId } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";
import type { MeasurementMode } from "@/types/measurement";

function start(mode: MeasurementMode) {
  measurementStore.dispatch({
    type: "START",
    mode,
    sessionId: createId("session"),
    now: Date.now(),
  });
}

function requestGps() {
  measurementStore.dispatch({ type: "REQUEST_GPS" });
}

export function ReadyPanel() {
  const status = useMeasurement((state) => state.status);
  const hasFix = useMeasurement((state) => state.currentFix !== null);
  const gpsError = useMeasurement((state) => state.gpsError);

  if (status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-3" role="alert">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-danger">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t.ready.errorTitle}</h2>
            <p className="mt-0.5 text-sm leading-snug text-muted">
              {gpsError ? t.gps.errors[gpsError] : t.gps.errors["position-unavailable"]}
            </p>
          </div>
        </div>
        <Button onClick={requestGps}>{t.ready.tryAgain}</Button>
        <Button variant="outline" size="md" onClick={() => start("manual")}>
          <MapPin className="size-4.5" aria-hidden />
          {t.ready.markOnMap}
        </Button>
      </div>
    );
  }

  const searching = status === "acquiring-gps";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Footprints className="size-8" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{t.ready.title}</h2>
          <p className="mt-0.5 text-sm leading-snug text-muted">
            {searching ? t.ready.searchingDetail : t.ready.description}
          </p>
        </div>
      </div>

      {status === "idle" && (
        <Button onClick={requestGps}>
          <MapPin className="size-5" aria-hidden />
          {t.ready.findLocation}
        </Button>
      )}
      {status === "ready" && (
        <Button onClick={() => start("walk")}>
          <Play className="size-5 fill-current" aria-hidden />
          {t.ready.start}
        </Button>
      )}
      {searching &&
        (hasFix ? (
          <Button onClick={() => start("walk")}>
            <Play className="size-5 fill-current" aria-hidden />
            {t.ready.startWeak}
          </Button>
        ) : (
          <Button disabled>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {t.ready.searching}
          </Button>
        ))}

      <Button variant="outline" size="md" onClick={() => start("manual")}>
        <MapPin className="size-4.5" aria-hidden />
        {t.ready.manual}
      </Button>

      <p className="text-xs leading-snug text-muted text-center">{t.ready.tempWarning}</p>
    </div>
  );
}
