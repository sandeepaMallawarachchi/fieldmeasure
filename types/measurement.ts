import type { GPSErrorKind, GPSObservation, GPSSignal, ObservationRejection } from "./gps";
import type { MapStyleId } from "./map";

/** GeoJSON order. The labels exist so latitude and longitude are never swapped by accident. */
export type LngLat = [longitude: number, latitude: number];

export type BoundaryPointSource = "gps-auto" | "gps-corner" | "map-tap" | "edit";

export interface BoundaryPoint {
  id: string;
  position: LngLat;
  source: BoundaryPointSource;
  /** Device-reported accuracy in metres; null for points not produced by GPS. */
  accuracy: number | null;
  timestamp: number | null;
}

export type MeasurementStatus =
  "idle" | "acquiring-gps" | "ready" | "recording" | "paused" | "reviewing" | "completed" | "error";

export type MeasurementMode = "walk" | "manual";

export type AreaUnit =
  "acres" | "squareMeters" | "hectares" | "squareKilometers" | "perches" | "squareFeet";

export type WarningCode =
  | "weak-start"
  | "long-gap"
  | "background"
  | "closing-gap"
  | "paused-gap"
  | "poor-corner"
  | "storage-unavailable";

export interface MeasurementWarning {
  code: WarningCode;
  count: number;
  /** Largest associated distance in metres, when the warning has one. */
  meters: number | null;
}

export interface MeasurementState {
  sessionId: string | null;
  status: MeasurementStatus;
  mode: MeasurementMode;
  startedAt: number | null;
  completedAt: number | null;

  /** Everything the device reported while recording. Editing never touches this. */
  rawObservations: GPSObservation[];
  rejectionCounts: Partial<Record<ObservationRejection, number>>;
  /** Fix held back until a second fix confirms a suspicious jump. */
  pendingJump: GPSObservation | null;
  lastObservation: GPSObservation | null;
  /** The boundary as recorded: the target of "Reset". */
  acceptedPoints: BoundaryPoint[];
  /** The user's corrected boundary; null until the first edit. */
  editedPoints: BoundaryPoint[] | null;
  editHistory: (BoundaryPoint[] | null)[];
  walkedMeters: number;
  closingGapMeters: number | null;

  warnings: MeasurementWarning[];
  exported: boolean;

  signal: GPSSignal;
  currentFix: GPSObservation | null;
  gpsError: GPSErrorKind | null;

  areaUnit: AreaUnit;
  mapStyle: MapStyleId;

  selectedVertex: number | null;
  addPointMode: boolean;
}
