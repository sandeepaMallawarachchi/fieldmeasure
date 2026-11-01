import { MEASUREMENT_CONFIG } from "@/config/gps";
import { calculateAreaSquareMeters } from "@/lib/geometry/calculateArea";
import { calculatePerimeterMeters } from "@/lib/geometry/calculatePerimeter";
import { geodesicDistanceMeters } from "@/lib/geometry/geodesy";
import { validatePolygon, type PolygonValidation } from "@/lib/geometry/validatePolygon";
import { median, summarizeGps, type GPSSummary } from "@/lib/gps/gpsQuality";
import type { BoundaryPoint, LngLat, MeasurementState } from "@/types/measurement";
import { selectBoundaryPoints } from "./machine";

export { selectBoundaryPoints };

export interface BoundaryMetrics {
  positions: LngLat[];
  areaM2: number;
  perimeterM: number;
  validation: PolygonValidation;
}

let lastPoints: BoundaryPoint[] | null = null;
let lastMetrics: BoundaryMetrics | null = null;

/** Memoised on array identity: the reducer replaces the array only when points change. */
export function selectBoundaryMetrics(state: MeasurementState): BoundaryMetrics {
  const points = selectBoundaryPoints(state);
  if (points === lastPoints && lastMetrics) return lastMetrics;
  const positions = points.map((point) => point.position);
  lastPoints = points;
  lastMetrics = {
    positions,
    areaM2: calculateAreaSquareMeters(positions),
    perimeterM: calculatePerimeterMeters(positions),
    validation: validatePolygon(positions),
  };
  return lastMetrics;
}

export interface ClosureAssessment {
  gapMeters: number;
  thresholdMeters: number;
  needsConfirmation: boolean;
}

/** A gap larger than GPS noise would be an unmeasured straight line, so the user must agree to it. */
export function assessClosure(points: readonly BoundaryPoint[]): ClosureAssessment {
  if (points.length < 2) return { gapMeters: 0, thresholdMeters: 0, needsConfirmation: false };
  const gapMeters = geodesicDistanceMeters(points[0].position, points[points.length - 1].position);
  const accuracies = points.flatMap((point) => (point.accuracy === null ? [] : [point.accuracy]));
  const thresholdMeters = Math.max(
    MEASUREMENT_CONFIG.closingGapMinM,
    (median(accuracies) ?? 0) * MEASUREMENT_CONFIG.closingGapAccuracyFactor,
  );
  return { gapMeters, thresholdMeters, needsConfirmation: gapMeters > thresholdMeters };
}

export type MeasurementMethod = "gps-walk" | "gps-corners" | "map-placed" | "mixed-manual";

export function selectMethod(state: MeasurementState): MeasurementMethod {
  if (state.mode === "walk") return "gps-walk";
  const sources = new Set(state.acceptedPoints.map((point) => point.source));
  if (sources.has("gps-corner") && sources.has("map-tap")) return "mixed-manual";
  return sources.has("map-tap") ? "map-placed" : "gps-corners";
}

export function selectGpsSummary(state: MeasurementState): GPSSummary {
  const accuracies = state.acceptedPoints.flatMap((point) =>
    point.accuracy === null ? [] : [point.accuracy],
  );
  return summarizeGps(accuracies, state.rawObservations);
}

export function selectHasUnsavedWork(state: MeasurementState): boolean {
  return state.acceptedPoints.length > 0 && !state.exported;
}
