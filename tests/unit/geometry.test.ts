import turfArea from "@turf/area";
import { describe, expect, it } from "vitest";
import { calculateAreaSquareMeters } from "@/lib/geometry/calculateArea";
import {
  calculatePathLengthMeters,
  calculatePerimeterMeters,
} from "@/lib/geometry/calculatePerimeter";
import { removeCrossingLoops } from "@/lib/geometry/removeCrossingLoops";
import {
  closeRing,
  findSelfIntersections,
  openRing,
  removeConsecutiveDuplicates,
  validatePolygon,
} from "@/lib/geometry/validatePolygon";
import type { LngLat } from "@/types/measurement";
import { COLOMBO, metersPerDegree, offset, square } from "../helpers";

const EQUATOR: LngLat = [80, 0];
const HIGH_LATITUDE: LngLat = [24.9, 60.2];

describe("geodesic area", () => {
  it.each([
    ["the equator", EQUATOR],
    ["Colombo", COLOMBO],
    ["high latitude", HIGH_LATITUDE],
  ])("matches a 100 m square built from WGS84 radii at %s", (_name, origin) => {
    expect(calculateAreaSquareMeters(square(origin, 100))).toBeCloseTo(10_000, 0);
  });

  it("matches the analytic area of a small equatorial cell on the ellipsoid", () => {
    // Authalic band area between latitudes on WGS84 (independent closed form).
    const a = 6378137;
    const e2 = 0.00669437999014;
    const e = Math.sqrt(e2);
    const q = (phi: number) => {
      const s = Math.sin(phi);
      return s / (1 - e2 * s * s) + Math.atanh(e * s) / e;
    };
    const degree = Math.PI / 180;
    const size = 0.01;
    const expected = ((a * a * (1 - e2)) / 2) * (q(size * degree) - q(0)) * (size * degree);
    const area = calculateAreaSquareMeters([
      [80, 0],
      [80 + size, 0],
      [80 + size, size],
      [80, size],
    ]);
    expect(Math.abs(area - expected) / expected).toBeLessThan(1e-5);
  });

  it("matches an exact large polygon: one octant of the WGS84 ellipsoid", () => {
    // By symmetry this equator-to-pole triangle is 1/8 of the ellipsoid's
    // surface, which is 510065621724088.5 m².
    const area = calculateAreaSquareMeters([
      [0, 0],
      [90, 0],
      [0, 90],
    ]);
    expect(area / (510065621724088.5 / 8)).toBeCloseTo(1, 9);
  });

  it("is reasonably close to Turf's spherical value, and lower near the equator", () => {
    // An independent implementation: agreement within the expected 0.3-0.7%.
    const ring = square(COLOMBO, 200);
    const spherical = turfArea({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [closeRing(ring)] },
    });
    const ratio = calculateAreaSquareMeters(ring) / spherical;
    expect(ratio).toBeGreaterThan(0.993);
    expect(ratio).toBeLessThan(0.997);
  });

  it("doesn't depend on walking direction or starting vertex", () => {
    // Regression: GeographicLib's unsigned mode returns the rest of the Earth for clockwise rings.
    const ring = square(COLOMBO, 100);
    const reversed = [...ring].reverse();
    const rotated = [ring[2], ring[3], ring[0], ring[1]];
    const area = calculateAreaSquareMeters(ring);
    expect(calculateAreaSquareMeters(reversed)).toBeCloseTo(area, 6);
    expect(calculateAreaSquareMeters(rotated)).toBeCloseTo(area, 6);
  });

  it("gives the same result for open and closed rings", () => {
    const ring = square(COLOMBO, 100);
    expect(calculateAreaSquareMeters(closeRing(ring))).toBeCloseTo(
      calculateAreaSquareMeters(ring),
      6,
    );
  });

  it("uses longitude-first coordinates", () => {
    // Swapped coordinates would put this near lat 80, shrinking a degree of longitude.
    const cell: LngLat[] = [
      [79.86, 6.92],
      [79.87, 6.92],
      [79.87, 6.93],
      [79.86, 6.93],
    ];
    const scale = metersPerDegree(6.925);
    const expected = 0.01 * scale.longitude * 0.01 * scale.latitude;
    expect(Math.abs(calculateAreaSquareMeters(cell) - expected) / expected).toBeLessThan(1e-4);
  });

  it("returns 0 with fewer than 3 points", () => {
    expect(calculateAreaSquareMeters([])).toBe(0);
    expect(calculateAreaSquareMeters(square(COLOMBO, 10).slice(0, 2))).toBe(0);
  });
});

describe("perimeter", () => {
  it("includes the closing segment", () => {
    expect(calculatePerimeterMeters(square(COLOMBO, 100))).toBeCloseTo(400, 2);
  });

  it("differs from the open path length by the closing segment", () => {
    const ring = square(COLOMBO, 100);
    expect(calculatePathLengthMeters(ring)).toBeCloseTo(300, 2);
  });

  it("matches a known meridian distance", () => {
    // 1 degree of latitude centred near 0: about 110,574 m on WGS84.
    const result = calculatePathLengthMeters([
      [80, -0.5],
      [80, 0.5],
    ]);
    expect(result).toBeCloseTo(110_574.4, 0);
  });
});

describe("rings", () => {
  it("closes and opens rings without losing points", () => {
    const ring = square(COLOMBO, 10);
    const closed = closeRing(ring);
    expect(closed).toHaveLength(5);
    expect(closed[4]).toEqual(closed[0]);
    expect(closeRing(closed)).toHaveLength(5);
    expect(openRing(closed)).toEqual(ring);
  });

  it("removes consecutive duplicates only", () => {
    const [a, b, c] = square(COLOMBO, 10);
    expect(removeConsecutiveDuplicates([a, a, b, b, c, a])).toEqual([a, b, c]);
  });
});

describe("polygon validation", () => {
  it("accepts a simple polygon, including a concave one", () => {
    expect(validatePolygon(square(COLOMBO, 50)).valid).toBe(true);
    const concave = [
      COLOMBO,
      offset(COLOMBO, 100, 0),
      offset(COLOMBO, 100, 100),
      offset(COLOMBO, 50, 30),
      offset(COLOMBO, 0, 100),
    ];
    expect(validatePolygon(concave).valid).toBe(true);
  });

  it("rejects too few distinct points", () => {
    const [a, b] = square(COLOMBO, 50);
    const result = validatePolygon([a, b, a, b]);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("too-few-points");
    expect(validatePolygon([]).issues).toContain("too-few-points");
  });

  it("rejects invalid coordinates", () => {
    const ring = square(COLOMBO, 50);
    for (const bad of [
      [Number.NaN, 7],
      [80, Number.POSITIVE_INFINITY],
      [80, 91],
      [181, 7],
    ] as LngLat[]) {
      expect(validatePolygon([...ring, bad]).issues).toContain("invalid-coordinate");
    }
  });

  it("detects a bow-tie and locates the crossing", () => {
    const bowTie = [
      COLOMBO,
      offset(COLOMBO, 100, 100),
      offset(COLOMBO, 100, 0),
      offset(COLOMBO, 0, 100),
    ];
    const result = validatePolygon(bowTie);
    expect(result.issues).toContain("self-intersection");
    expect(result.crossings).toHaveLength(1);
    const expected = offset(COLOMBO, 50, 50);
    expect(result.crossings[0].position[0]).toBeCloseTo(expected[0], 6);
    expect(result.crossings[0].position[1]).toBeCloseTo(expected[1], 6);
  });

  it("detects walking back along part of the same line", () => {
    const overlap = [
      COLOMBO,
      offset(COLOMBO, 100, 0),
      offset(COLOMBO, 100, 100),
      offset(COLOMBO, 50, 0),
      offset(COLOMBO, 0, 50),
    ];
    expect(findSelfIntersections(overlap).length).toBeGreaterThan(0);
  });

  it("rejects collinear and near-zero shapes as degenerate", () => {
    const line = [COLOMBO, offset(COLOMBO, 50, 0), offset(COLOMBO, 100, 0)];
    expect(validatePolygon(line).issues).toContain("degenerate");
    const sliver = [COLOMBO, offset(COLOMBO, 200, 0), offset(COLOMBO, 200, 0.01)];
    expect(validatePolygon(sliver).issues).toContain("degenerate");
  });

  it("never changes the geometry it validates", () => {
    const ring = square(COLOMBO, 50);
    const copy = ring.map((point) => [...point]);
    validatePolygon(ring);
    expect(ring).toEqual(copy);
  });
});

describe("removeCrossingLoops", () => {
  it("removes an overshoot past the start and keeps the main field", () => {
    // A 100 m square, then walking 10 m past the starting corner's edge.
    const walk = [
      offset(COLOMBO, 0, 0),
      offset(COLOMBO, 100, 0),
      offset(COLOMBO, 100, 100),
      offset(COLOMBO, 0, 100),
      offset(COLOMBO, 0, -10),
      offset(COLOMBO, 10, -10),
    ];
    expect(validatePolygon(walk).valid).toBe(false);
    const { points, removedCrossings } = removeCrossingLoops(walk);
    expect(removedCrossings).toBeGreaterThan(0);
    expect(validatePolygon(points).valid).toBe(true);
    expect(calculateAreaSquareMeters(points)).toBeCloseTo(10_000, -1);
  });

  it("leaves a valid polygon untouched", () => {
    const ring = square(COLOMBO, 50);
    const { points, removedCrossings } = removeCrossingLoops(ring);
    expect(removedCrossings).toBe(0);
    expect(points).toEqual(ring);
  });
});
