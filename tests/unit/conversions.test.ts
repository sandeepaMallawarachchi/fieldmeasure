import { describe, expect, it } from "vitest";
import {
  AREA_CONVERSIONS,
  convertArea,
  formatArea,
  formatKilometers,
  formatMeters,
} from "@/lib/geometry/conversions";

describe("area conversions", () => {
  it("uses the exact international definitions", () => {
    // International acre = 66 x 660 ft, and 1 ft = 0.3048 m exactly.
    expect(AREA_CONVERSIONS.squareMetersPerAcre).toBeCloseTo(66 * 660 * 0.3048 ** 2, 7);
    // A perch is 1/160 of an acre.
    expect(AREA_CONVERSIONS.squareMetersPerPerch).toBeCloseTo(
      AREA_CONVERSIONS.squareMetersPerAcre / 160,
      8,
    );
    expect(AREA_CONVERSIONS.squareFeetPerSquareMeter).toBeCloseTo(1 / 0.3048 ** 2, 7);
  });

  it("converts each supported unit", () => {
    expect(convertArea(4046.8564224, "acres")).toBeCloseTo(1, 10);
    expect(convertArea(10_000, "hectares")).toBe(1);
    expect(convertArea(1_000_000, "squareKilometers")).toBe(1);
    expect(convertArea(25.29285264, "perches")).toBeCloseTo(1, 10);
    expect(convertArea(1, "squareFeet")).toBeCloseTo(10.7639104167, 10);
    expect(convertArea(123.4, "squareMeters")).toBe(123.4);
  });

  it("agrees across units: 1 acre is 160 perches", () => {
    const oneAcre = AREA_CONVERSIONS.squareMetersPerAcre;
    expect(convertArea(oneAcre, "perches")).toBeCloseTo(160, 8);
    expect(convertArea(oneAcre, "hectares")).toBeCloseTo(0.40468564224, 10);
  });
});

describe("presentation", () => {
  it("rounds only for display, with restrained precision", () => {
    expect(formatArea(5124.6, "acres")).toBe("1.266");
    expect(formatArea(5124.6, "squareMeters")).toBe("5,125");
    expect(formatArea(5124.6, "hectares")).toBe("0.512");
    expect(formatArea(5124.6, "squareKilometers")).toBe("0.0051");
    expect(formatMeters(312.8)).toBe("313");
    expect(formatKilometers(312.8)).toBe("0.313");
  });
});
