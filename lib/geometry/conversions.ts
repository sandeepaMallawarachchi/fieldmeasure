import { AREA_UNIT_DISPLAY, LENGTH_DISPLAY } from "@/config/units";
import type { AreaUnit } from "@/types/measurement";

export const AREA_CONVERSIONS = {
  squareMetersPerAcre: 4046.8564224,
  squareMetersPerHectare: 10000,
  squareMetersPerSquareKilometer: 1000000,
  squareMetersPerPerch: 25.29285264,
  squareFeetPerSquareMeter: 10.7639104167,
} as const;

export function convertArea(squareMeters: number, unit: AreaUnit): number {
  switch (unit) {
    case "squareMeters":
      return squareMeters;
    case "acres":
      return squareMeters / AREA_CONVERSIONS.squareMetersPerAcre;
    case "hectares":
      return squareMeters / AREA_CONVERSIONS.squareMetersPerHectare;
    case "squareKilometers":
      return squareMeters / AREA_CONVERSIONS.squareMetersPerSquareKilometer;
    case "perches":
      return squareMeters / AREA_CONVERSIONS.squareMetersPerPerch;
    case "squareFeet":
      return squareMeters * AREA_CONVERSIONS.squareFeetPerSquareMeter;
  }
}

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatArea(squareMeters: number, unit: AreaUnit): string {
  return formatNumber(convertArea(squareMeters, unit), AREA_UNIT_DISPLAY[unit].decimals);
}

export function formatMeters(meters: number): string {
  return formatNumber(meters, LENGTH_DISPLAY.meters.decimals);
}

export function formatKilometers(meters: number): string {
  return formatNumber(meters / 1000, LENGTH_DISPLAY.kilometers.decimals);
}
