import type { GPSObservation } from "@/types/gps";
import type { LngLat } from "@/types/measurement";

/**
 * Deterministic local offsets using WGS84 radii of curvature, independent of the
 * code under test. Accurate to well under 1 mm over the field-sized shapes here.
 */
const WGS84_A = 6378137;
const WGS84_E2 = 0.00669437999014;

export function metersPerDegree(latitude: number) {
  const phi = (latitude * Math.PI) / 180;
  const w = 1 - WGS84_E2 * Math.sin(phi) ** 2;
  const meridional = (WGS84_A * (1 - WGS84_E2)) / w ** 1.5;
  const prime = WGS84_A / Math.sqrt(w);
  return {
    latitude: (meridional * Math.PI) / 180,
    longitude: (prime * Math.cos(phi) * Math.PI) / 180,
  };
}

export function offset(origin: LngLat, eastMeters: number, northMeters: number): LngLat {
  const scale = metersPerDegree(origin[1]);
  return [origin[0] + eastMeters / scale.longitude, origin[1] + northMeters / scale.latitude];
}

export function square(origin: LngLat, sizeMeters: number): LngLat[] {
  return [
    origin,
    offset(origin, sizeMeters, 0),
    offset(origin, sizeMeters, sizeMeters),
    offset(origin, 0, sizeMeters),
  ];
}

export const COLOMBO: LngLat = [79.8612, 6.9271];
export const BASE_TIME = 1_700_000_000_000;

let sequence = 0;

export function observationAt(
  position: LngLat,
  timestamp: number,
  overrides: Partial<GPSObservation> = {},
): GPSObservation {
  sequence += 1;
  return {
    id: `test-${sequence}`,
    longitude: position[0],
    latitude: position[1],
    accuracy: 4,
    timestamp,
    altitude: null,
    altitudeAccuracy: null,
    speed: null,
    heading: null,
    ...overrides,
  };
}

/** Evenly spaced points along a closed walk, walking at a realistic pace. */
export function walkPath(corners: readonly LngLat[], stepMeters: number, origin: LngLat): LngLat[] {
  const scale = metersPerDegree(origin[1]);
  const path: LngLat[] = [];
  corners.forEach((start, index) => {
    const end = corners[(index + 1) % corners.length];
    const east = (end[0] - start[0]) * scale.longitude;
    const north = (end[1] - start[1]) * scale.latitude;
    const length = Math.hypot(east, north);
    const steps = Math.max(1, Math.round(length / stepMeters));
    for (let i = 0; i < steps; i += 1) {
      path.push(offset(start, (east * i) / steps, (north * i) / steps));
    }
  });
  return path;
}
