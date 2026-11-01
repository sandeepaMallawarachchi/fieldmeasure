import { formatArea, formatKilometers, formatMeters } from "@/lib/geometry/conversions";
import { t } from "@/lib/i18n";
import { selectBoundaryMetrics, selectGpsSummary, selectMethod } from "@/lib/measurement/selectors";
import type { LngLat, MeasurementState, MeasurementWarning } from "@/types/measurement";

export interface ReportRow {
  label: string;
  value: string;
}

export interface ReportData {
  positions: LngLat[];
  mapStyle: MeasurementState["mapStyle"];
  measuredAt: Date;
  acres: string;
  areaRows: ReportRow[];
  perimeterRows: ReportRow[];
  metadataRows: ReportRow[];
  notes: string[];
}

export function describeWarning(warning: MeasurementWarning): string {
  const meters = warning.meters === null ? null : formatMeters(warning.meters);
  return t.warnings[warning.code](meters, warning.count);
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Everything printed on the report comes from here, so it can only show the real measurement. */
export function buildReportData(state: MeasurementState): ReportData {
  const { positions, areaM2, perimeterM } = selectBoundaryMetrics(state);
  const summary = selectGpsSummary(state);
  const method = t.result.methods[selectMethod(state)];
  const measuredAt = new Date(state.completedAt ?? state.startedAt ?? Date.now());
  return {
    positions,
    mapStyle: state.mapStyle,
    measuredAt,
    acres: formatArea(areaM2, "acres"),
    areaRows: [
      { label: t.units.squareMeters.label, value: `${formatArea(areaM2, "squareMeters")} m²` },
      { label: t.units.hectares.label, value: `${formatArea(areaM2, "hectares")} ha` },
      { label: t.units.perches.label, value: `${formatArea(areaM2, "perches")} P` },
    ],
    perimeterRows: [
      { label: t.report.meters, value: `${formatMeters(perimeterM)} m` },
      { label: t.report.kilometers, value: `${formatKilometers(perimeterM)} km` },
    ],
    metadataRows: [
      {
        label: t.report.method,
        value: state.editedPoints ? `${method}, ${t.result.edited.toLowerCase()}` : method,
      },
      {
        label: t.report.gpsConditions,
        value:
          summary.medianAccuracyM === null
            ? t.gps.quality[summary.quality]
            : `${t.gps.quality[summary.quality]} (±${summary.medianAccuracyM.toFixed(1)} m reported)`,
      },
    ],
    notes: state.warnings.map(describeWarning),
  };
}

export function buildReportFilename(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("-");
  return `fieldmeasure-${stamp}.png`;
}
