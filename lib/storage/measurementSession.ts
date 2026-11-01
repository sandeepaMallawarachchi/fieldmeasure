import { z } from "zod";
import type { MeasurementState } from "@/types/measurement";

export const SESSION_SCHEMA_VERSION = 1;
export const SESSION_STORAGE_KEY = "fieldmeasure.session";
export const PREFERENCES_STORAGE_KEY = "fieldmeasure.preferences";

const lngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const observationSchema = z.object({
  id: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number(),
  timestamp: z.number(),
  altitude: z.number().nullable(),
  altitudeAccuracy: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
});

const boundaryPointSchema = z.object({
  id: z.string(),
  position: lngLatSchema,
  source: z.enum(["gps-auto", "gps-corner", "map-tap", "edit"]),
  accuracy: z.number().nullable(),
  timestamp: z.number().nullable(),
});

const areaUnitSchema = z.enum([
  "acres",
  "squareMeters",
  "hectares",
  "squareKilometers",
  "perches",
  "squareFeet",
]);
const mapStyleSchema = z.enum(["satellite", "street", "plain"]);

const sessionSchema = z.object({
  schemaVersion: z.literal(SESSION_SCHEMA_VERSION),
  sessionId: z.string(),
  status: z.enum(["recording", "paused", "reviewing", "completed"]),
  mode: z.enum(["walk", "manual"]),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  rawObservations: z.array(observationSchema),
  rejectionCounts: z.partialRecord(
    z.enum([
      "invalid",
      "duplicate",
      "out-of-order",
      "stale",
      "low-accuracy",
      "implausible-speed",
      "unconfirmed-jump",
      "stationary-jitter",
    ]),
    z.number(),
  ),
  acceptedPoints: z.array(boundaryPointSchema),
  editedPoints: z.array(boundaryPointSchema).nullable(),
  walkedMeters: z.number(),
  closingGapMeters: z.number().nullable(),
  warnings: z.array(
    z.object({
      code: z.enum([
        "weak-start",
        "long-gap",
        "background",
        "closing-gap",
        "paused-gap",
        "poor-corner",
        "storage-unavailable",
      ]),
      count: z.number(),
      meters: z.number().nullable(),
    }),
  ),
  exported: z.boolean(),
  areaUnit: areaUnitSchema,
  mapStyle: mapStyleSchema,
});

export type PersistedSession = z.infer<typeof sessionSchema>;

const preferencesSchema = z.object({
  areaUnit: areaUnitSchema,
  mapStyle: mapStyleSchema,
});

export type Preferences = z.infer<typeof preferencesSchema>;

export type SaveResult = "saved" | "skipped" | "failed";

export function hasPersistableStatus(
  status: MeasurementState["status"],
): status is PersistedSession["status"] {
  return (
    status === "recording" ||
    status === "paused" ||
    status === "reviewing" ||
    status === "completed"
  );
}

export function serializeSession(state: MeasurementState): string | null {
  if (!state.sessionId || !hasPersistableStatus(state.status)) return null;
  const session: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: state.sessionId,
    status: state.status,
    mode: state.mode,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    rawObservations: state.rawObservations,
    rejectionCounts: state.rejectionCounts,
    acceptedPoints: state.acceptedPoints,
    editedPoints: state.editedPoints,
    walkedMeters: state.walkedMeters,
    closingGapMeters: state.closingGapMeters,
    warnings: state.warnings,
    exported: state.exported,
    areaUnit: state.areaUnit,
    mapStyle: state.mapStyle,
  };
  return JSON.stringify(session);
}

export function deserializeSession(serialized: string): PersistedSession | null {
  try {
    const result = sessionSchema.safeParse(JSON.parse(serialized));
    return result.success ? result.data : null;
  } catch {
    return null; // Corrupt JSON is an expected recovery case, handled as "nothing to restore".
  }
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // Access itself throws when site data is blocked.
  }
}

export function saveSession(state: MeasurementState, storage = getStorage()): SaveResult {
  const serialized = serializeSession(state);
  if (!serialized) return "skipped";
  if (!storage) return "failed";
  try {
    storage.setItem(SESSION_STORAGE_KEY, serialized);
    return "saved";
  } catch {
    return "failed"; // Quota exceeded or storage disabled; the caller warns the user.
  }
}

/** Removes a session that fails validation, so a corrupt copy cannot block later starts. */
export function loadSession(storage = getStorage()): PersistedSession | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(SESSION_STORAGE_KEY);
    if (!serialized) return null;
    const session = deserializeSession(serialized);
    if (!session) storage.removeItem(SESSION_STORAGE_KEY);
    return session;
  } catch {
    return null;
  }
}

export function clearSession(storage = getStorage()): void {
  try {
    storage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing further can be done if storage is unavailable; memory state is reset separately.
  }
}

export function savePreferences(preferences: Preferences, storage = getStorage()): void {
  try {
    storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are a convenience; losing them does not affect any measurement.
  }
}

export function loadPreferences(storage = getStorage()): Preferences | null {
  try {
    const serialized = storage?.getItem(PREFERENCES_STORAGE_KEY);
    if (!serialized) return null;
    const result = preferencesSchema.safeParse(JSON.parse(serialized));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
