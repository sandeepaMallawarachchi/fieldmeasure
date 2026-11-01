import { GPS_QUALITY_CONFIG } from "@/config/gps";
import type { GPSObservation, GPSQuality } from "@/types/gps";

/**
 * Levels describe the conditions the device reports. The reported figure is
 * the browser's estimate, not a guaranteed maximum error.
 */
export function classifyAccuracy(accuracy: number | null | undefined): GPSQuality {
  if (accuracy === null || accuracy === undefined || !Number.isFinite(accuracy) || accuracy <= 0) {
    return "unavailable";
  }
  if (accuracy <= GPS_QUALITY_CONFIG.goodMaxAccuracyM) return "good";
  if (accuracy <= GPS_QUALITY_CONFIG.moderateMaxAccuracyM) return "moderate";
  return "poor";
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export interface GPSSummary {
  quality: GPSQuality;
  medianAccuracyM: number | null;
  observationCount: number;
}

export function summarizeGps(
  acceptedAccuracies: readonly number[],
  rawObservations: readonly GPSObservation[],
): GPSSummary {
  const medianAccuracyM = median(acceptedAccuracies);
  return {
    quality: classifyAccuracy(medianAccuracyM),
    medianAccuracyM,
    observationCount: rawObservations.length,
  };
}
