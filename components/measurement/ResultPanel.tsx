"use client";

import {
  AlertTriangle,
  CalendarDays,
  Crosshair,
  Download,
  Hexagon,
  Loader2,
  Pencil,
  Plus,
  Route,
  Ruler,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatArea, formatKilometers, formatMeters } from "@/lib/geometry/conversions";
import { describeWarning, formatDateTime } from "@/lib/export/reportData";
import { t } from "@/lib/i18n";
import { selectBoundaryMetrics, selectGpsSummary, selectMethod } from "@/lib/measurement/selectors";
import { clearSession } from "@/lib/storage/measurementSession";
import { showToast } from "@/lib/toast";
import { measurementStore, useMeasurement } from "@/store/measurementStore";
import type { AreaUnit } from "@/types/measurement";

const dispatch = measurementStore.dispatch;

/** Secondary units beneath the main figure, excluding whichever unit is the main one. */
const SECONDARY_UNITS: readonly AreaUnit[] = [
  "acres",
  "squareMeters",
  "hectares",
  "squareKilometers",
  "perches",
  "squareFeet",
];

async function exportReport(): Promise<void> {
  const [{ createReportImage }, { downloadImage }, { buildReportData, buildReportFilename }] =
    await Promise.all([
      import("@/lib/export/createReportImage"),
      import("@/lib/export/downloadImage"),
      import("@/lib/export/reportData"),
    ]);
  const data = buildReportData(measurementStore.getState());
  const blob = await createReportImage(data);
  const outcome = await downloadImage(blob, buildReportFilename(data.measuredAt));
  if (outcome === "cancelled") return;
  dispatch({ type: "MARK_EXPORTED" });
  showToast({
    message: outcome === "shared" ? t.result.shared : t.result.downloaded,
    tone: "success",
  });
}

function InfoItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Crosshair;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-[13px] leading-snug font-medium">{children}</p>
      </div>
    </div>
  );
}

export function ResultPanel() {
  const metrics = useMeasurement(selectBoundaryMetrics);
  const areaUnit = useMeasurement((state) => state.areaUnit);
  const completedAt = useMeasurement((state) => state.completedAt);
  const edited = useMeasurement((state) => state.editedPoints !== null);
  const method = useMeasurement(selectMethod);
  const gpsQuality = useMeasurement((state) => selectGpsSummary(state).quality);
  const medianAccuracy = useMeasurement((state) => selectGpsSummary(state).medianAccuracyM);
  const rawCount = useMeasurement((state) => state.rawObservations.length);
  const warnings = useMeasurement((state) => state.warnings);
  const exported = useMeasurement((state) => state.exported);

  const [exporting, setExporting] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);

  async function handleDownload() {
    setExporting(true);
    try {
      await exportReport();
    } catch {
      showToast({ message: t.result.exportFailed, tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  const { areaM2, perimeterM, positions } = metrics;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border p-4">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Hexagon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted">{t.common.area}</p>
            <p
              className="text-[34px] leading-tight font-bold text-primary tabular-nums"
              data-testid="result-area"
            >
              {formatArea(areaM2, areaUnit)} {t.units[areaUnit].long}
            </p>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECONDARY_UNITS.filter((unit) => unit !== areaUnit).map((unit) => (
            <li key={unit} className="whitespace-nowrap" title={t.units[unit].label}>
              <span className="font-semibold tabular-nums" data-testid={`area-${unit}`}>
                {formatArea(areaM2, unit)}
              </span>{" "}
              <span className="text-muted">{t.units[unit].long}</span>
            </li>
          ))}
        </ul>

        <div className="my-3 h-px bg-border" />

        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center text-primary">
            <Ruler className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm text-muted">{t.common.perimeter}</p>
            <p className="text-xl font-bold tabular-nums" data-testid="result-perimeter">
              {formatMeters(perimeterM)} {t.length.meters}{" "}
              <span className="text-sm font-normal text-muted">
                ({formatKilometers(perimeterM)} {t.length.kilometers})
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-3 gap-y-3 px-1">
        <InfoItem icon={CalendarDays} label={t.result.measuredOn}>
          {completedAt ? formatDateTime(new Date(completedAt)) : "—"}
        </InfoItem>
        <InfoItem icon={Crosshair} label={t.result.gpsQuality}>
          {t.gps.quality[gpsQuality]}
          {medianAccuracy !== null && (
            <span className="block font-normal text-muted">
              {t.result.medianAccuracy(medianAccuracy.toFixed(1))}
            </span>
          )}
        </InfoItem>
        <InfoItem icon={Route} label={t.result.method}>
          {t.result.methods[method]}
          {edited && <span className="block font-normal text-muted">{t.result.edited}</span>}
        </InfoItem>
        <InfoItem icon={Hexagon} label={t.result.points}>
          {positions.length.toLocaleString("en-US")}
          {rawCount > 0 && (
            <span className="block font-normal text-muted">{t.result.recordedFixes(rawCount)}</span>
          )}
        </InfoItem>
      </section>

      {warnings.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-snug text-amber-950">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {t.result.notes}
          </h3>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning.code}>{describeWarning(warning)}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">{t.result.disclaimer}</p>

      {/* Stays on screen while the details scroll: it's the one action that saves the work. */}
      <div className="sticky bottom-0 z-10 -my-2 bg-surface py-2">
        <Button
          className="w-full"
          onClick={handleDownload}
          disabled={exporting}
          aria-busy={exporting}
        >
          {exporting ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Download className="size-5" aria-hidden />
          )}
          {exporting ? t.result.downloading : t.result.download}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="md" onClick={() => dispatch({ type: "EDIT_AGAIN" })}>
            <Pencil className="size-4" aria-hidden />
            {t.result.editBoundary}
          </Button>
          <Button variant="outline" size="md" onClick={() => setConfirmingNew(true)}>
            <Plus className="size-4.5" aria-hidden />
            {t.result.newMeasurement}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingNew}
        destructive={!exported}
        title={t.newMeasurement.title}
        description={exported ? t.newMeasurement.bodyDownloaded : t.newMeasurement.body}
        confirmLabel={t.newMeasurement.confirm}
        cancelLabel={t.common.cancel}
        onCancel={() => setConfirmingNew(false)}
        onConfirm={() => {
          setConfirmingNew(false);
          clearSession();
          dispatch({ type: "RESET" });
        }}
      />
    </div>
  );
}
