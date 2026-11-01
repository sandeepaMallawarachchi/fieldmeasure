import type { LngLat } from "@/types/measurement";
import { geodesicDistanceMeters } from "./geodesy";

/**
 * Boundary length of the polygon, including the closing segment. This differs
 * from the distance walked, which follows every accepted GPS step and has no
 * closing segment unless the user walked it.
 */
export function calculatePerimeterMeters(points: readonly LngLat[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    total += geodesicDistanceMeters(points[i], points[(i + 1) % points.length]);
  }
  return total;
}

export function calculatePathLengthMeters(points: readonly LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += geodesicDistanceMeters(points[i - 1], points[i]);
  }
  return total;
}
