import type { LngLat } from "@/types/measurement";
import { measureGeodesicPolygon } from "./geodesy";
import { findSelfIntersections, openRing } from "./validatePolygon";

export interface LoopRemovalResult {
  points: LngLat[];
  removedCrossings: number;
}

const MAX_ITERATIONS = 100;

/**
 * Cuts the smaller loop off at each crossing. The usual cause is walking past
 * the starting point, which leaves a small overlap at the end of the boundary.
 * This changes the geometry, so it only ever runs when the user asks for it.
 */
export function removeCrossingLoops(points: readonly LngLat[]): LoopRemovalResult {
  let ring = openRing(points);
  let removedCrossings = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const [crossing] = findSelfIntersections(ring);
    if (!crossing) break;
    const { segmentA, segmentB, position } = crossing;
    const inner = ring.slice(segmentA + 1, segmentB + 1);
    const outer = [...ring.slice(segmentB + 1), ...ring.slice(0, segmentA + 1)];
    const innerArea = measureGeodesicPolygon([position, ...inner]).areaM2;
    const outerArea = measureGeodesicPolygon([position, ...outer]).areaM2;
    ring = [position, ...(innerArea > outerArea ? inner : outer)];
    removedCrossings += 1;
  }

  return { points: ring, removedCrossings };
}
