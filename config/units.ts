import type { AreaUnit } from "@/types/measurement";

/**
 * Display precision is deliberately limited. Consumer GPS is metres-level, so
 * showing centimetres or fractions of a square metre would imply accuracy the
 * measurement does not have. Full precision is kept internally.
 */
export const AREA_UNIT_DISPLAY: Record<AreaUnit, { decimals: number }> = {
  acres: { decimals: 3 },
  squareMeters: { decimals: 0 },
  hectares: { decimals: 3 },
  squareKilometers: { decimals: 4 },
  perches: { decimals: 1 },
  squareFeet: { decimals: 0 },
};

export const LENGTH_DISPLAY = {
  meters: { decimals: 0 },
  kilometers: { decimals: 3 },
} as const;

export const AREA_UNIT_ORDER: readonly AreaUnit[] = [
  "acres",
  "perches",
  "hectares",
  "squareMeters",
  "squareFeet",
  "squareKilometers",
];
