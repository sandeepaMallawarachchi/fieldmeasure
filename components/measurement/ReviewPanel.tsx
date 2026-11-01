"use client";

import { AlertTriangle, Check, Hand, Plus, Scissors, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatArea, formatKilometers, formatMeters } from "@/lib/geometry/conversions";
import { removeCrossingLoops } from "@/lib/geometry/removeCrossingLoops";
import { t } from "@/lib/i18n";
import { selectBoundaryMetrics } from "@/lib/measurement/selectors";
import { showToast } from "@/lib/toast";
import { cn, createId } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";
import type { BoundaryPoint } from "@/types/measurement";

const dispatch = measurementStore.dispatch;

function removeLoops() {
  const state = measurementStore.getState();
  const { positions } = selectBoundaryMetrics(state);
  const points = removeCrossingLoops(positions).points.map((position): BoundaryPoint => ({
    id: createId("pt"),
    position,
    source: "edit",
    accuracy: null,
    timestamp: null,
  }));
  dispatch({ type: "EDIT_REPLACE", points });
  const next = measurementStore.getState();
  showToast({
    message: t.review.fixedCrossings(
      `${formatArea(selectBoundaryMetrics(next).areaM2, next.areaUnit)} ${t.units[next.areaUnit].long}`,
    ),
    tone: "info",
  });
}

function MetricCard({
  label,
  primary,
  secondary,
  testId,
}: {
  label: string;
  primary: string;
  secondary: string;
  testId: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-xl font-bold tabular-nums" data-testid={testId}>
        {primary}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted tabular-nums">{secondary}</p>
    </div>
  );
}

export function ReviewPanel() {
  const metrics = useMeasurement(selectBoundaryMetrics);
  const areaUnit = useMeasurement((state) => state.areaUnit);
  const canUndo = useMeasurement((state) => state.editHistory.length > 0);
  const selectedVertex = useMeasurement((state) => state.selectedVertex);
  const addPointMode = useMeasurement((state) => state.addPointMode);

  const { valid, issues } = metrics.validation;
  const canRemoveVertex = selectedVertex !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Hand className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">{t.review.fineTune}</h2>
          <p className="text-[13px] leading-snug text-muted">{t.review.fineTuneDetail}</p>
        </div>
      </div>

      {!valid && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          {issues.map((issue) => (
            <p key={issue} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.review.issues[issue]}
            </p>
          ))}
          {issues.includes("self-intersection") && (
            <Button variant="outline" size="sm" onClick={removeLoops}>
              <Scissors className="size-4" aria-hidden />
              {t.review.fixCrossings}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label={t.common.area}
          primary={`${formatArea(metrics.areaM2, areaUnit)} ${t.units[areaUnit].long}`}
          secondary={`${formatArea(metrics.areaM2, "squareMeters")} m²`}
          testId="review-area"
        />
        <MetricCard
          label={t.common.perimeter}
          primary={`${formatMeters(metrics.perimeterM)} ${t.length.meters}`}
          secondary={`${formatKilometers(metrics.perimeterM)} ${t.length.kilometers}`}
          testId="review-perimeter"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="sm"
          aria-pressed={addPointMode}
          className={cn(addPointMode && "border-primary bg-primary-soft text-primary")}
          onClick={() => dispatch({ type: "SET_ADD_POINT_MODE", enabled: !addPointMode })}
        >
          <Plus className="size-4" aria-hidden />
          {addPointMode ? t.review.addPointActive : t.review.addPoint}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canRemoveVertex}
          onClick={() =>
            selectedVertex !== null &&
            dispatch({ type: "EDIT_REMOVE_VERTEX", index: selectedVertex })
          }
        >
          <Trash2 className="size-4" aria-hidden />
          {t.review.removePoint}
        </Button>
      </div>

      <div className="grid grid-cols-[2fr_3fr] gap-3">
        <Button
          variant="secondary"
          disabled={!canUndo}
          onClick={() => dispatch({ type: "EDIT_UNDO" })}
        >
          <Undo2 className="size-5" aria-hidden />
          {t.common.undo}
        </Button>
        <Button disabled={!valid} onClick={() => dispatch({ type: "CONFIRM", now: Date.now() })}>
          <Check className="size-5" aria-hidden />
          {t.review.confirm}
        </Button>
      </div>
    </div>
  );
}
