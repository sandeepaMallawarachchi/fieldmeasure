import { GEOMETRY_CONFIG } from "@/config/gps";
import type { LngLat } from "@/types/measurement";
import { fastDistanceMeters, measureGeodesicPolygon } from "./geodesy";

export type PolygonIssue =
  "invalid-coordinate" | "too-few-points" | "self-intersection" | "degenerate";

export interface SegmentCrossing {
  /** Crossing segments, where segment i runs from point i to point i + 1 on the closed ring. */
  segmentA: number;
  segmentB: number;
  position: LngLat;
}

export interface PolygonValidation {
  valid: boolean;
  issues: PolygonIssue[];
  uniqueVertexCount: number;
  crossings: SegmentCrossing[];
}

export function isValidCoordinate([longitude, latitude]: LngLat): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** Drops a trailing vertex that repeats the first, so rings can be handled as open. */
export function openRing(points: readonly LngLat[]): LngLat[] {
  if (points.length < 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : [...points];
}

/** GeoJSON Polygon ring: closed, with the first position repeated at the end. */
export function closeRing(points: readonly LngLat[]): LngLat[] {
  const open = openRing(points);
  return open.length === 0 ? [] : [...open, open[0]];
}

export function removeConsecutiveDuplicates(points: readonly LngLat[]): LngLat[] {
  const result: LngLat[] = [];
  for (const point of openRing(points)) {
    const previous = result[result.length - 1];
    if (!previous || fastDistanceMeters(previous, point) > GEOMETRY_CONFIG.duplicateToleranceM) {
      result.push(point);
    }
  }
  while (
    result.length > 1 &&
    fastDistanceMeters(result[0], result[result.length - 1]) <= GEOMETRY_CONFIG.duplicateToleranceM
  ) {
    result.pop();
  }
  return result;
}

function countUniqueVertices(points: readonly LngLat[]): number {
  const unique: LngLat[] = [];
  for (const point of points) {
    const isRepeat = unique.some(
      (other) => fastDistanceMeters(other, point) <= GEOMETRY_CONFIG.duplicateToleranceM,
    );
    if (!isRepeat) unique.push(point);
  }
  return unique.length;
}

type Plane = readonly [x: number, y: number];

/**
 * Crossing tests only need topology, so a local plane is enough; it is never
 * used for measurement. Metres rather than degrees keep tolerances meaningful.
 */
function toLocalPlane(points: readonly LngLat[]): Plane[] {
  const origin = points[0];
  const metersPerDegreeLat = 110_574;
  const metersPerDegreeLng = 111_320 * Math.cos((origin[1] * Math.PI) / 180);
  return points.map(([longitude, latitude]) => [
    (longitude - origin[0]) * metersPerDegreeLng,
    (latitude - origin[1]) * metersPerDegreeLat,
  ]);
}

function cross(o: Plane, a: Plane, b: Plane): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Returns the parameter along a1->a2 where the segments meet, or null if they do not. */
function intersectSegments(a1: Plane, a2: Plane, b1: Plane, b2: Plane): number | null {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return d1 / (d1 - d2);
  }

  // Touching or overlapping cases, such as walking back along the same line.
  const dx = a2[0] - a1[0];
  const dy = a2[1] - a1[1];
  const lengthSquared = dx * dx + dy * dy;
  const onSegment = (o: Plane, a: Plane, p: Plane) =>
    Math.min(o[0], a[0]) <= p[0] &&
    p[0] <= Math.max(o[0], a[0]) &&
    Math.min(o[1], a[1]) <= p[1] &&
    p[1] <= Math.max(o[1], a[1]);
  const along = (p: Plane) =>
    lengthSquared === 0 ? 0 : ((p[0] - a1[0]) * dx + (p[1] - a1[1]) * dy) / lengthSquared;

  if (d3 === 0 && onSegment(a1, a2, b1)) return along(b1);
  if (d4 === 0 && onSegment(a1, a2, b2)) return along(b2);
  if (d1 === 0 && onSegment(b1, b2, a1)) return 0;
  if (d2 === 0 && onSegment(b1, b2, a2)) return 1;
  return null;
}

export function findSelfIntersections(points: readonly LngLat[]): SegmentCrossing[] {
  const ring = openRing(points);
  const count = ring.length;
  if (count < 4) return [];
  const plane = toLocalPlane(ring);
  const crossings: SegmentCrossing[] = [];

  for (let i = 0; i < count; i += 1) {
    const a1 = plane[i];
    const a2 = plane[(i + 1) % count];
    const minX = Math.min(a1[0], a2[0]);
    const maxX = Math.max(a1[0], a2[0]);
    const minY = Math.min(a1[1], a2[1]);
    const maxY = Math.max(a1[1], a2[1]);

    for (let j = i + 2; j < count; j += 1) {
      if (i === 0 && j === count - 1) continue; // Neighbours across the closing vertex.
      const b1 = plane[j];
      const b2 = plane[(j + 1) % count];
      if (
        Math.max(b1[0], b2[0]) < minX ||
        Math.min(b1[0], b2[0]) > maxX ||
        Math.max(b1[1], b2[1]) < minY ||
        Math.min(b1[1], b2[1]) > maxY
      ) {
        continue;
      }
      const t = intersectSegments(a1, a2, b1, b2);
      if (t === null) continue;
      const start = ring[i];
      const end = ring[(i + 1) % count];
      crossings.push({
        segmentA: i,
        segmentB: j,
        position: [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t],
      });
    }
  }
  return crossings;
}

/**
 * Reports problems rather than repairing them: quietly changing the geometry
 * would change the measured area without the user knowing.
 */
export function validatePolygon(points: readonly LngLat[]): PolygonValidation {
  if (points.some((point) => !isValidCoordinate(point))) {
    return { valid: false, issues: ["invalid-coordinate"], uniqueVertexCount: 0, crossings: [] };
  }

  const ring = removeConsecutiveDuplicates(points);
  const uniqueVertexCount = countUniqueVertices(ring);
  if (uniqueVertexCount < GEOMETRY_CONFIG.minUniqueVertices) {
    return { valid: false, issues: ["too-few-points"], uniqueVertexCount, crossings: [] };
  }

  const issues: PolygonIssue[] = [];
  const crossings = findSelfIntersections(ring);
  if (crossings.length > 0) issues.push("self-intersection");

  const { areaM2, perimeterM } = measureGeodesicPolygon(ring);
  const compactness = perimeterM > 0 ? (4 * Math.PI * areaM2) / (perimeterM * perimeterM) : 0;
  if (areaM2 < GEOMETRY_CONFIG.minAreaM2 || compactness < GEOMETRY_CONFIG.minCompactness) {
    issues.push("degenerate");
  }

  return { valid: issues.length === 0, issues, uniqueVertexCount, crossings };
}
