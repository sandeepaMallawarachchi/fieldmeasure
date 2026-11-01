import { GPS_FILTER_CONFIG } from "@/config/gps";
import type { GPSObservation, ObservationRejection } from "@/types/gps";

/** Plain-data checks that need only the observation and the one before it. */
export function validateObservation(
  observation: GPSObservation,
  previous: GPSObservation | null,
  now: number,
  maxAgeMs: number = GPS_FILTER_CONFIG.maxObservationAgeMs,
): ObservationRejection | null {
  const { latitude, longitude, accuracy, timestamp } = observation;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy <= 0 ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return "invalid";
  }
  if (now - timestamp > maxAgeMs) return "stale";
  if (previous) {
    if (timestamp === previous.timestamp) return "duplicate";
    if (timestamp < previous.timestamp) return "out-of-order";
  }
  return null;
}

export function positionToObservation(position: GeolocationPosition, id: string): GPSObservation {
  const { coords, timestamp } = position;
  return {
    id,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    timestamp,
    altitude: coords.altitude,
    altitudeAccuracy: coords.altitudeAccuracy,
    speed: coords.speed,
    heading: coords.heading,
  };
}
