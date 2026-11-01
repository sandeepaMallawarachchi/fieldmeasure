import type { Feature, FeatureCollection, Geometry } from "geojson";
import { closeRing } from "@/lib/geometry/validatePolygon";
import type { LngLat } from "@/types/measurement";

export interface ScreenPoint {
  x: number;
  y: number;
}

export type Projector = (position: LngLat) => ScreenPoint;

export const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

function collection(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

function feature(geometry: Geometry, properties: Feature["properties"] = {}): Feature {
  return { type: "Feature", geometry, properties };
}

const METERS_PER_DEGREE_LAT = 110_574;
const METERS_PER_DEGREE_LNG = 111_320;

/** Accuracy circle for display only, so a local approximation is sufficient. */
export function circlePolygon(center: LngLat, radiusMeters: number, steps = 48): FeatureCollection {
  const cosLat = Math.max(0.01, Math.cos((center[1] * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      center[0] + (radiusMeters * Math.cos(angle)) / (METERS_PER_DEGREE_LNG * cosLat),
      center[1] + (radiusMeters * Math.sin(angle)) / METERS_PER_DEGREE_LAT,
    ]);
  }
  return collection([feature({ type: "Polygon", coordinates: [closeRing(ring)] })]);
}

export function pointCollection(position: LngLat | null): FeatureCollection {
  return position
    ? collection([feature({ type: "Point", coordinates: position })])
    : EMPTY_COLLECTION;
}

export function pointsCollection(positions: readonly LngLat[]): FeatureCollection {
  return collection(positions.map((position) => feature({ type: "Point", coordinates: position })));
}

export function lineCollection(positions: readonly LngLat[]): FeatureCollection {
  return positions.length < 2
    ? EMPTY_COLLECTION
    : collection([feature({ type: "LineString", coordinates: [...positions] })]);
}

export function polygonCollection(positions: readonly LngLat[]): FeatureCollection {
  return positions.length < 3
    ? EMPTY_COLLECTION
    : collection([feature({ type: "Polygon", coordinates: [closeRing(positions)] })]);
}

export type VertexKind = "start" | "corner" | "normal" | "selected";

export function vertexCollection(
  positions: readonly LngLat[],
  kinds: (index: number) => VertexKind,
): FeatureCollection {
  return collection(
    positions.map((position, index) =>
      feature({ type: "Point", coordinates: position }, { kind: kinds(index), index }),
    ),
  );
}

export function boundsOf(positions: readonly LngLat[]): [LngLat, LngLat] | null {
  if (positions.length === 0) return null;
  let [minLng, minLat] = positions[0];
  let [maxLng, maxLat] = positions[0];
  for (const [lng, lat] of positions) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function centroidOf(positions: readonly LngLat[]): LngLat | null {
  if (positions.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const position of positions) {
    lng += position[0];
    lat += position[1];
  }
  return [lng / positions.length, lat / positions.length];
}

export function findNearestVertex(
  positions: readonly LngLat[],
  project: Projector,
  point: ScreenPoint,
  radiusPx: number,
): number | null {
  let nearest: number | null = null;
  let best = radiusPx * radiusPx;
  positions.forEach((position, index) => {
    const { x, y } = project(position);
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance <= best) {
      best = distance;
      nearest = index;
    }
  });
  return nearest;
}

export interface SegmentHit {
  afterIndex: number;
  /** Position along the segment, 0-1. */
  t: number;
  distancePx: number;
}

export function findNearestSegment(
  positions: readonly LngLat[],
  project: Projector,
  point: ScreenPoint,
): SegmentHit | null {
  if (positions.length < 2) return null;
  let best: SegmentHit | null = null;
  const screen = positions.map(project);
  screen.forEach((a, index) => {
    const b = screen[(index + 1) % screen.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    const distancePx = Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y);
    if (!best || distancePx < best.distancePx) best = { afterIndex: index, t, distancePx };
  });
  return best;
}

export function interpolate(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
