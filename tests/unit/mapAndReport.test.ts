import { describe, expect, it } from "vitest";
import { buildReportData, buildReportFilename } from "@/lib/export/reportData";
import { createPlainProjection } from "@/lib/export/renderMapImage";
import {
  circlePolygon,
  findNearestSegment,
  findNearestVertex,
  polygonCollection,
} from "@/lib/map/mapHelpers";
import { buildStyleOptions, pickDefaultStyle } from "@/lib/map/mapStyles";
import { detectInstallPlatform } from "@/lib/pwa/install";
import { createInitialState, measurementReducer } from "@/lib/measurement/machine";
import type { LngLat, MeasurementState } from "@/types/measurement";
import { COLOMBO, offset, square } from "../helpers";

describe("map style configuration", () => {
  it("offers street and plain without configuration, and no invented satellite", () => {
    const ids = buildStyleOptions({}).map((option) => option.id);
    expect(ids).toEqual(["street", "plain"]);
  });

  it("adds satellite when configured and substitutes the key", () => {
    const [satellite] = buildStyleOptions({
      satelliteUrl: "https://example.test/style.json?key={key}",
      apiKey: "abc",
    });
    expect(satellite.id).toBe("satellite");
    expect(satellite.url).toBe("https://example.test/style.json?key=abc");
  });

  it("omits satellite if its key is missing, and doesn't allow export unless opted in", () => {
    expect(
      buildStyleOptions({ satelliteUrl: "https://example.test/s.json?key={key}" }).map(
        (option) => option.id,
      ),
    ).not.toContain("satellite");
    const [satellite] = buildStyleOptions({ satelliteUrl: "https://example.test/s.json" });
    expect(satellite.allowExport).toBe(false);
  });

  it("opens on the street map even when satellite is configured", () => {
    const options = buildStyleOptions({ satelliteUrl: "https://example.test/s.json" });
    expect(options.map((option) => option.id)).toContain("satellite");
    expect(pickDefaultStyle(options)).toBe("street");
  });

  it("opens on satellite only if the street map is turned off", () => {
    const options = buildStyleOptions({
      streetUrl: "none",
      satelliteUrl: "https://example.test/s.json",
    });
    expect(pickDefaultStyle(options)).toBe("satellite");
    expect(pickDefaultStyle(buildStyleOptions({ streetUrl: "none" }))).toBe("plain");
  });

  it("can disable network maps entirely", () => {
    expect(buildStyleOptions({ streetUrl: "none" }).map((option) => option.id)).toEqual(["plain"]);
  });
});

describe("install guide platform", () => {
  it.each([
    [
      "Android phone",
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile",
      "Linux armv8l",
      5,
      "android",
    ],
    [
      "Android tablet",
      "Mozilla/5.0 (Linux; Android 14; SM-X710) Safari",
      "Linux armv8l",
      5,
      "android",
    ],
    ["iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5, "ios"],
    ["iPad (older)", "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)", "iPad", 5, "ios"],
    [
      "iPad (reports as a Mac)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "MacIntel",
      5,
      "ios",
    ],
    ["Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0, null],
    ["Windows touch laptop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 10, null],
  ])("%s", (_name, userAgent, platform, touchPoints, expected) => {
    expect(detectInstallPlatform(userAgent, platform, touchPoints)).toBe(expected);
  });
});

describe("map helpers", () => {
  const project = ([x, y]: LngLat) => ({ x, y });

  it("finds the nearest vertex within the radius only", () => {
    const points: LngLat[] = [
      [0, 0],
      [100, 0],
      [100, 100],
    ];
    expect(findNearestVertex(points, project, { x: 95, y: 3 }, 24)).toBe(1);
    expect(findNearestVertex(points, project, { x: 50, y: 50 }, 24)).toBeNull();
  });

  it("finds the nearest segment, including the closing one", () => {
    const points: LngLat[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    expect(findNearestSegment(points, project, { x: 50, y: 4 })).toMatchObject({
      afterIndex: 0,
      t: 0.5,
    });
    expect(findNearestSegment(points, project, { x: 3, y: 50 })?.afterIndex).toBe(3);
  });

  it("builds a closed accuracy circle of the right size", () => {
    const circle = circlePolygon(COLOMBO, 10);
    const geometry = circle.features[0].geometry;
    if (geometry.type !== "Polygon") throw new Error("Expected a polygon");
    const ring = geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const eastEdge = ring[0][0] - COLOMBO[0];
    expect(eastEdge * 111_320 * Math.cos((COLOMBO[1] * Math.PI) / 180)).toBeCloseTo(10, 6);
  });

  it("writes GeoJSON longitude-first", () => {
    const collection = polygonCollection(square(COLOMBO, 10));
    const geometry = collection.features[0].geometry;
    if (geometry.type !== "Polygon") throw new Error("Expected a polygon");
    expect(geometry.coordinates[0][0]).toEqual(COLOMBO);
  });
});

describe("report", () => {
  function completedState(): MeasurementState {
    let state = createInitialState();
    state = measurementReducer(state, { type: "START", mode: "manual", sessionId: "s", now: 1000 });
    square(COLOMBO, 100).forEach((position, index) => {
      state = measurementReducer(state, {
        type: "ADD_MAP_POINT",
        id: `p${index}`,
        position,
        now: 1000 + index,
      });
    });
    state = measurementReducer(state, {
      type: "BEGIN_REVIEW",
      closingGapMeters: 100,
      gapConfirmed: true,
    });
    return measurementReducer(state, { type: "CONFIRM", now: Date.UTC(2026, 0, 26, 4, 59) });
  }

  it("prints the computed values, not anything else", () => {
    const data = buildReportData(completedState());
    expect(data.acres).toBe("2.471");
    expect(data.areaRows.map((row) => row.value)).toEqual(["10,000 m²", "1.000 ha", "395.4 P"]);
    expect(data.perimeterRows.map((row) => row.value)).toEqual(["400 m", "0.400 km"]);
    expect(data.metadataRows[0].value).toBe("Placed on map");
    expect(data.metadataRows[1].value).toBe("GPS not used");
    expect(data.notes.join(" ")).toContain("100 m straight line");
  });

  it("states when the boundary was manually corrected", () => {
    let state = completedState();
    state = measurementReducer(state, { type: "EDIT_AGAIN" });
    state = measurementReducer(state, {
      type: "EDIT_MOVE_VERTEX",
      index: 2,
      position: offset(COLOMBO, 110, 110),
      id: "e",
    });
    expect(buildReportData(state).metadataRows[0].value).toContain("manually corrected");
  });

  it("names the file as specified", () => {
    expect(buildReportFilename(new Date(2026, 0, 6, 9, 5))).toBe(
      "fieldmeasure-2026-01-06-09-05.png",
    );
  });

  it("fits the boundary inside the map with no cropping, preserving shape", () => {
    const positions = square(COLOMBO, 300);
    const { project, metersPerPixel } = createPlainProjection(positions, 980, 880, 90);
    const screen = positions.map(project);
    for (const { x, y } of screen) {
      expect(x).toBeGreaterThanOrEqual(89.9);
      expect(x).toBeLessThanOrEqual(890.1);
      expect(y).toBeGreaterThanOrEqual(89.9);
      expect(y).toBeLessThanOrEqual(790.1);
    }
    const width = Math.abs(screen[1].x - screen[0].x);
    const height = Math.abs(screen[3].y - screen[0].y);
    // Within Web Mercator's small north-south distortion on WGS84 (under 1%).
    expect(Math.abs(width / height - 1)).toBeLessThan(0.01);
    expect(width * metersPerPixel).toBeCloseTo(300, -1);
  });
});
