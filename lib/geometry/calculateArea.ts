import type { LngLat } from "@/types/measurement";
import { measureGeodesicPolygon } from "./geodesy";

/** Geodesic area on WGS84 in square metres. `points` is an open or closed ring. */
export function calculateAreaSquareMeters(points: readonly LngLat[]): number {
  return measureGeodesicPolygon(points).areaM2;
}
