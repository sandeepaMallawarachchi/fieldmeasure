import bearing from "@turf/bearing";
import distance from "@turf/distance";
import { Geodesic } from "geographiclib-geodesic";
import type { LngLat } from "@/types/measurement";

/**
 * Earth models used by FieldMeasure:
 *
 * - Reported area and perimeter use geodesics on the WGS84 ellipsoid
 *   (GeographicLib, Karney 2013). GPS coordinates are WGS84, so this is the
 *   matching model. Turf's area is spherical (R = 6371008.8 m), which reads
 *   about 0.4% high around Sri Lanka's latitude.
 * - The GPS filter uses Turf's spherical distance and bearing. It runs on every
 *   fix and compares steps of a few metres against thresholds, where the
 *   spherical difference is far below GPS noise.
 *
 * Heights are ignored throughout: area is measured on the ellipsoid surface,
 * so sloping land reads as its horizontal projection.
 */
export interface GeodesicPolygonResult {
  areaM2: number;
  perimeterM: number;
}

export function measureGeodesicPolygon(points: readonly LngLat[]): GeodesicPolygonResult {
  if (points.length < 3) return { areaM2: 0, perimeterM: 0 };
  const polygon = Geodesic.WGS84.Polygon(false);
  for (const [longitude, latitude] of points) polygon.AddPoint(latitude, longitude);
  // sign must be true: with false, GeographicLib answers a clockwise ring with
  // the area of the rest of the Earth. Walking direction must not affect the result.
  const { area, perimeter } = polygon.Compute(false, true);
  return { areaM2: Math.abs(area ?? 0), perimeterM: perimeter };
}

export function geodesicDistanceMeters(a: LngLat, b: LngLat): number {
  return Geodesic.WGS84.Inverse(a[1], a[0], b[1], b[0]).s12 ?? 0;
}

export function fastDistanceMeters(a: LngLat, b: LngLat): number {
  return distance(a, b, { units: "meters" });
}

export function bearingDegrees(a: LngLat, b: LngLat): number {
  return bearing(a, b);
}

/** Smallest angle between two bearings, 0-180 degrees. */
export function angleBetweenBearings(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return difference > 180 ? 360 - difference : difference;
}
