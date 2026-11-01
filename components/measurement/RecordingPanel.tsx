"use client";

import { Flag, Footprints, Hexagon, MapPin, Pause, Play, Square, Undo2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatArea, formatMeters } from "@/lib/geometry/conversions";
import { t } from "@/lib/i18n";
import { assessClosure, selectBoundaryMetrics } from "@/lib/measurement/selectors";
import { clearSession } from "@/lib/storage/measurementSession";
import { showToast } from "@/lib/toast";
import { createId } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";

const dispatch = measurementStore.dispatch;

function markCorner() {
  const now = Date.now();
  const before = measurementStore.getState().acceptedPoints.length;
  const hadCorner = measurementStore.getState().acceptedPoints.at(-1)?.source;
  dispatch({ type: "MARK_CORNER", id: createId("pt"), now });
  const after = measurementStore.getState().acceptedPoints;
  const marked = after.length > before || after.at(-1)?.source !== hadCorner;
  showToast(
    marked
      ? { message: t.recording.cornerMarked, tone: "success" }
      : { message: t.recording.cornerNoFix, tone: "warning" },
  );
}

export function RecordingPanel() {
  const status = useMeasurement((state) => state.status);
  const mode = useMeasurement((state) => state.mode);
  const areaUnit = useMeasurement((state) => state.areaUnit);
  const areaM2 = useMeasurement((state) => selectBoundaryMetrics(state).areaM2);
  const walked = useMeasurement((state) => state.walkedMeters);
  const pointCount = useMeasurement((state) => state.acceptedPoints.length);

  const [closureGap, setClosureGap] = useState<number | null>(null);
  const [tooFewPoints, setTooFewPoints] = useState(false);

  function handleFinish() {
    const state = measurementStore.getState();
    if (selectBoundaryMetrics(state).validation.uniqueVertexCount < 3) {
      setTooFewPoints(true);
      return;
    }
    const closure = assessClosure(state.acceptedPoints);
    if (closure.needsConfirmation) {
      setClosureGap(closure.gapMeters);
      return;
    }
    dispatch({ type: "BEGIN_REVIEW", closingGapMeters: closure.gapMeters, gapConfirmed: false });
  }

  const paused = status === "paused";
  const manual = mode === "manual";

  return (
    <div className="flex flex-col gap-3">
      {paused && <p className="text-sm leading-snug text-muted">{t.recording.pausedHint}</p>}
      {!paused && manual && (
        <p className="text-sm leading-snug text-muted">{t.recording.manualHint}</p>
      )}

      <div className="flex items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Hexagon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">{t.recording.liveArea}</p>
            <p
              className="truncate text-[26px] leading-tight font-bold tabular-nums"
              data-testid="live-area"
            >
              {formatArea(areaM2, areaUnit)}{" "}
              <span className="text-lg font-semibold">{t.units[areaUnit].long}</span>
            </p>
            {areaUnit !== "squareMeters" && (
              <p className="text-xs text-muted tabular-nums">
                {formatArea(areaM2, "squareMeters")} m²
              </p>
            )}
          </div>
        </div>
        <div className="ml-3 flex shrink-0 flex-col justify-center border-l border-border pl-3">
          {manual ? (
            <>
              <p className="flex items-center gap-1 text-xs text-muted">
                <MapPin className="size-3.5" aria-hidden />
                {t.recording.points}
              </p>
              <p className="text-xl font-bold tabular-nums" data-testid="point-count">
                {pointCount}
              </p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1 text-xs text-muted">
                <Footprints className="size-3.5" aria-hidden />
                {t.recording.walked}
              </p>
              <p className="text-xl font-bold tabular-nums" data-testid="walked">
                {formatMeters(walked)} {t.length.meters}
              </p>
            </>
          )}
        </div>
      </div>

      {!paused && (
        <Button variant="outline" size="md" onClick={markCorner}>
          <Flag className="size-4.5" aria-hidden />
          {t.recording.markCorner}
        </Button>
      )}
      {manual && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pointCount === 0}
          onClick={() => dispatch({ type: "REMOVE_LAST_POINT" })}
        >
          <Undo2 className="size-4" aria-hidden />
          {t.recording.undoPoint}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {paused ? (
          <Button variant="primary" onClick={() => dispatch({ type: "RESUME" })}>
            <Play className="size-5 fill-current" aria-hidden />
            {t.recording.resume}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => dispatch({ type: "PAUSE" })}>
            <Pause className="size-5 fill-current" aria-hidden />
            {t.recording.pause}
          </Button>
        )}
        <Button variant="danger" onClick={handleFinish}>
          <Square className="size-4.5 fill-current" aria-hidden />
          {t.recording.finish}
        </Button>
      </div>

      <ConfirmDialog
        open={closureGap !== null}
        title={t.closure.title}
        description={t.closure.body(formatMeters(closureGap ?? 0))}
        confirmLabel={t.closure.connect}
        cancelLabel={t.closure.keepWalking}
        onCancel={() => setClosureGap(null)}
        onConfirm={() => {
          dispatch({
            type: "BEGIN_REVIEW",
            closingGapMeters: closureGap ?? 0,
            gapConfirmed: true,
          });
          setClosureGap(null);
        }}
      />
      <ConfirmDialog
        open={tooFewPoints}
        destructive
        title={t.tooFewPoints.title}
        description={t.tooFewPoints.body}
        confirmLabel={t.tooFewPoints.discard}
        cancelLabel={t.tooFewPoints.keepMeasuring}
        onCancel={() => setTooFewPoints(false)}
        onConfirm={() => {
          setTooFewPoints(false);
          clearSession();
          dispatch({ type: "RESET" });
        }}
      />
    </div>
  );
}
