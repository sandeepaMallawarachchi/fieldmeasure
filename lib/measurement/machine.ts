import { APP_CONFIG } from "@/config/app";
import { GPS_FILTER_CONFIG, MEASUREMENT_CONFIG } from "@/config/gps";
import { fastDistanceMeters, geodesicDistanceMeters } from "@/lib/geometry/geodesy";
import { validatePolygon } from "@/lib/geometry/validatePolygon";
import { filterObservation, type LngLatFix } from "@/lib/gps/gpsFiltering";
import { classifyAccuracy } from "@/lib/gps/gpsQuality";
import type { GPSErrorKind, GPSObservation, GPSSignal } from "@/types/gps";
import type { MapStyleId } from "@/types/map";
import type {
  AreaUnit,
  BoundaryPoint,
  LngLat,
  MeasurementMode,
  MeasurementState,
  MeasurementStatus,
  MeasurementWarning,
  WarningCode,
} from "@/types/measurement";
import type { PersistedSession } from "@/lib/storage/measurementSession";

export type MeasurementAction =
  | { type: "REQUEST_GPS" }
  | { type: "GPS_FIX"; observation: GPSObservation; now: number }
  | { type: "GPS_ERROR"; error: GPSErrorKind }
  | { type: "GPS_STALE" }
  | { type: "START"; mode: MeasurementMode; sessionId: string; now: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "MARK_CORNER"; id: string; now: number }
  | { type: "ADD_MAP_POINT"; id: string; position: LngLat; now: number }
  | { type: "REMOVE_LAST_POINT" }
  | { type: "BEGIN_REVIEW"; closingGapMeters: number; gapConfirmed: boolean }
  | { type: "BACK_TO_RECORDING" }
  | { type: "EDIT_MOVE_VERTEX"; index: number; position: LngLat; id: string }
  | { type: "EDIT_INSERT_VERTEX"; afterIndex: number; position: LngLat; id: string }
  | { type: "EDIT_REMOVE_VERTEX"; index: number }
  | { type: "EDIT_REPLACE"; points: BoundaryPoint[] }
  | { type: "EDIT_UNDO" }
  | { type: "EDIT_RESET" }
  | { type: "SELECT_VERTEX"; index: number | null }
  | { type: "SET_ADD_POINT_MODE"; enabled: boolean }
  | { type: "CONFIRM"; now: number }
  | { type: "EDIT_AGAIN" }
  | { type: "MARK_EXPORTED" }
  | { type: "RESET" }
  | { type: "RESTORE"; session: PersistedSession }
  | { type: "ADD_WARNING"; code: WarningCode; meters?: number }
  | { type: "SET_AREA_UNIT"; unit: AreaUnit }
  | { type: "SET_MAP_STYLE"; style: MapStyleId };

/** Lifecycle actions and the statuses they may run from. Anything else is ignored. */
const ALLOWED_FROM: Partial<Record<MeasurementAction["type"], readonly MeasurementStatus[]>> = {
  REQUEST_GPS: ["idle", "error"],
  START: ["idle", "acquiring-gps", "ready", "error"],
  PAUSE: ["recording"],
  RESUME: ["paused"],
  MARK_CORNER: ["recording"],
  ADD_MAP_POINT: ["recording"],
  REMOVE_LAST_POINT: ["recording", "paused"],
  BEGIN_REVIEW: ["recording", "paused"],
  BACK_TO_RECORDING: ["reviewing"],
  EDIT_MOVE_VERTEX: ["reviewing"],
  EDIT_INSERT_VERTEX: ["reviewing"],
  EDIT_REMOVE_VERTEX: ["reviewing"],
  EDIT_REPLACE: ["reviewing"],
  EDIT_UNDO: ["reviewing"],
  EDIT_RESET: ["reviewing"],
  SELECT_VERTEX: ["reviewing"],
  SET_ADD_POINT_MODE: ["reviewing"],
  CONFIRM: ["reviewing"],
  EDIT_AGAIN: ["completed"],
  MARK_EXPORTED: ["completed"],
};

export function canDispatch(status: MeasurementStatus, type: MeasurementAction["type"]): boolean {
  const allowed = ALLOWED_FROM[type];
  return !allowed || allowed.includes(status);
}

export function createInitialState(
  preferences: { areaUnit?: AreaUnit; mapStyle?: MapStyleId } = {},
): MeasurementState {
  return {
    sessionId: null,
    status: "idle",
    mode: "walk",
    startedAt: null,
    completedAt: null,
    rawObservations: [],
    rejectionCounts: {},
    pendingJump: null,
    lastObservation: null,
    acceptedPoints: [],
    editedPoints: null,
    editHistory: [],
    walkedMeters: 0,
    closingGapMeters: null,
    warnings: [],
    exported: false,
    signal: "off",
    currentFix: null,
    gpsError: null,
    areaUnit: preferences.areaUnit ?? "acres",
    mapStyle: preferences.mapStyle ?? "street",
    selectedVertex: null,
    addPointMode: false,
  };
}

export function selectBoundaryPoints(state: MeasurementState): BoundaryPoint[] {
  return state.editedPoints ?? state.acceptedPoints;
}

function addWarning(
  warnings: MeasurementWarning[],
  code: WarningCode,
  meters: number | null = null,
): MeasurementWarning[] {
  const existing = warnings.find((warning) => warning.code === code);
  if (!existing) return [...warnings, { code, count: 1, meters }];
  return warnings.map((warning) =>
    warning === existing
      ? {
          ...warning,
          count: warning.count + 1,
          meters: meters === null ? warning.meters : Math.max(warning.meters ?? 0, meters),
        }
      : warning,
  );
}

function observationToPoint(observation: GPSObservation): BoundaryPoint {
  return {
    id: observation.id,
    position: [observation.longitude, observation.latitude],
    source: "gps-auto",
    accuracy: observation.accuracy,
    timestamp: observation.timestamp,
  };
}

function pointToFix(point: BoundaryPoint | undefined): LngLatFix | null {
  if (!point) return null;
  return {
    position: point.position,
    // Map-placed points have no reported accuracy; treat them as exact.
    accuracy: point.accuracy ?? 0,
    timestamp: point.timestamp ?? 0,
  };
}

function signalForFix(accuracy: number): GPSSignal {
  return classifyAccuracy(accuracy);
}

function appendPoint(state: MeasurementState, point: BoundaryPoint): MeasurementState {
  const last = state.acceptedPoints[state.acceptedPoints.length - 1];
  return {
    ...state,
    acceptedPoints: [...state.acceptedPoints, point],
    walkedMeters:
      state.walkedMeters + (last ? geodesicDistanceMeters(last.position, point.position) : 0),
  };
}

function handleFix(
  state: MeasurementState,
  observation: GPSObservation,
  now: number,
): MeasurementState {
  const usable =
    Number.isFinite(observation.latitude) &&
    Number.isFinite(observation.longitude) &&
    Number.isFinite(observation.accuracy);
  let next: MeasurementState = usable
    ? {
        ...state,
        currentFix: observation,
        signal: signalForFix(observation.accuracy),
        gpsError: null,
      }
    : state;

  if (
    next.status === "acquiring-gps" &&
    usable &&
    observation.accuracy <= MEASUREMENT_CONFIG.startMaxAccuracyM
  ) {
    next = { ...next, status: "ready" };
  }
  if (next.status === "error" && usable) {
    next = { ...next, status: "acquiring-gps" };
  }
  if (next.status !== "recording") return next;

  // Raw data is preserved whatever the filter decides, except values that
  // cannot be represented or stored at all.
  if (usable) next = { ...next, rawObservations: [...next.rawObservations, observation] };
  if (next.mode === "manual") return { ...next, lastObservation: observation };

  const accepted = next.acceptedPoints;
  const result = filterObservation(
    observation,
    {
      lastObservation: state.lastObservation,
      lastAccepted: pointToFix(accepted[accepted.length - 1]),
      previousAccepted: pointToFix(accepted[accepted.length - 2]),
      pendingJump: next.pendingJump,
    },
    now,
  );

  const rejectionCounts = { ...next.rejectionCounts };
  for (const reason of result.rejections) {
    rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
  }
  next = {
    ...next,
    rejectionCounts,
    pendingJump: result.pendingJump,
    lastObservation: usable ? observation : next.lastObservation,
  };

  for (const acceptedObservation of result.accepted) {
    const last = next.acceptedPoints[next.acceptedPoints.length - 1];
    if (
      last?.timestamp &&
      acceptedObservation.timestamp - last.timestamp > GPS_FILTER_CONFIG.longGapMs
    ) {
      next = {
        ...next,
        warnings: addWarning(
          next.warnings,
          "long-gap",
          geodesicDistanceMeters(last.position, [
            acceptedObservation.longitude,
            acceptedObservation.latitude,
          ]),
        ),
      };
    }
    next = appendPoint(next, observationToPoint(acceptedObservation));
  }
  return next;
}

function handleGpsError(state: MeasurementState, error: GPSErrorKind): MeasurementState {
  const signal: GPSSignal =
    error === "permission-denied"
      ? "denied"
      : error === "timeout"
        ? state.currentFix
          ? state.signal
          : "searching"
        : "unavailable";
  const next: MeasurementState = { ...state, signal, gpsError: error };

  // Timeouts are routine outdoors and the watch keeps running, so they never
  // leave the current screen. Only a hard failure stops the acquire flow.
  if (error === "timeout") return next;
  if (state.status === "acquiring-gps" || state.status === "idle" || state.status === "ready") {
    return { ...next, status: "error" };
  }
  if (state.status === "recording" && state.mode === "walk" && error === "permission-denied") {
    return { ...next, status: "paused" };
  }
  return next;
}

function commitEdit(state: MeasurementState, points: BoundaryPoint[]): MeasurementState {
  return {
    ...state,
    editedPoints: points,
    editHistory: [...state.editHistory, state.editedPoints].slice(-APP_CONFIG.maxEditHistory),
    selectedVertex: null,
    exported: false,
  };
}

export function measurementReducer(
  state: MeasurementState,
  action: MeasurementAction,
): MeasurementState {
  if (!canDispatch(state.status, action.type)) return state;

  switch (action.type) {
    case "REQUEST_GPS":
      return {
        ...state,
        status: state.currentFix ? "ready" : "acquiring-gps",
        signal: state.currentFix ? state.signal : "searching",
        gpsError: null,
      };
    case "GPS_FIX":
      return handleFix(state, action.observation, action.now);
    case "GPS_ERROR":
      return handleGpsError(state, action.error);
    case "GPS_STALE":
      return state.signal === "off" || state.signal === "denied"
        ? state
        : { ...state, signal: "unavailable" };

    case "START": {
      const { currentFix } = state;
      const base: MeasurementState = {
        ...state,
        sessionId: action.sessionId,
        status: "recording",
        mode: action.mode,
        startedAt: action.now,
        completedAt: null,
        rawObservations: [],
        rejectionCounts: {},
        pendingJump: null,
        lastObservation: null,
        acceptedPoints: [],
        editedPoints: null,
        editHistory: [],
        walkedMeters: 0,
        closingGapMeters: null,
        warnings: [],
        exported: false,
        gpsError: state.gpsError,
      };
      if (action.mode === "manual") return base;
      const isWeakStart = !currentFix || currentFix.accuracy > MEASUREMENT_CONFIG.startMaxAccuracyM;
      const started = isWeakStart
        ? { ...base, warnings: addWarning(base.warnings, "weak-start") }
        : base;
      // The fix behind the "ready" state is the start of the boundary. Without
      // this, the first point would be wherever the next update happens to land.
      const canSeed =
        currentFix &&
        currentFix.accuracy <= GPS_FILTER_CONFIG.maxAcceptableAccuracyM &&
        action.now - currentFix.timestamp <= MEASUREMENT_CONFIG.cornerMaxFixAgeMs;
      if (!canSeed) return started;
      return {
        ...appendPoint(started, observationToPoint(currentFix)),
        rawObservations: [currentFix],
        lastObservation: currentFix,
      };
    }
    case "PAUSE":
      return { ...state, status: "paused" };
    case "RESUME": {
      const last = state.acceptedPoints[state.acceptedPoints.length - 1];
      const fix = state.currentFix;
      const gap =
        last && fix ? fastDistanceMeters(last.position, [fix.longitude, fix.latitude]) : 0;
      return {
        ...state,
        status: "recording",
        warnings:
          state.mode === "walk" && gap > MEASUREMENT_CONFIG.pausedGapWarnM
            ? addWarning(state.warnings, "paused-gap", gap)
            : state.warnings,
      };
    }

    case "MARK_CORNER": {
      const fix = state.currentFix;
      if (!fix || action.now - fix.timestamp > MEASUREMENT_CONFIG.cornerMaxFixAgeMs) return state;
      const last = state.acceptedPoints[state.acceptedPoints.length - 1];
      if (last?.position[0] === fix.longitude && last.position[1] === fix.latitude) {
        // The filter already kept this exact fix; record that it is a corner, not a second vertex.
        return {
          ...state,
          acceptedPoints: [...state.acceptedPoints.slice(0, -1), { ...last, source: "gps-corner" }],
        };
      }
      const next = appendPoint(state, {
        id: action.id,
        position: [fix.longitude, fix.latitude],
        source: "gps-corner",
        accuracy: fix.accuracy,
        timestamp: fix.timestamp,
      });
      return fix.accuracy > GPS_FILTER_CONFIG.maxAcceptableAccuracyM
        ? { ...next, warnings: addWarning(next.warnings, "poor-corner") }
        : next;
    }
    case "ADD_MAP_POINT":
      if (state.mode !== "manual") return state;
      return appendPoint(state, {
        id: action.id,
        position: action.position,
        source: "map-tap",
        accuracy: null,
        timestamp: action.now,
      });
    case "REMOVE_LAST_POINT": {
      if (state.acceptedPoints.length === 0 || state.mode !== "manual") return state;
      const points = state.acceptedPoints.slice(0, -1);
      const removed = state.acceptedPoints[state.acceptedPoints.length - 1];
      const previous = points[points.length - 1];
      return {
        ...state,
        acceptedPoints: points,
        walkedMeters: previous
          ? Math.max(
              0,
              state.walkedMeters - geodesicDistanceMeters(previous.position, removed.position),
            )
          : 0,
      };
    }

    case "BEGIN_REVIEW":
      return {
        ...state,
        status: "reviewing",
        closingGapMeters: action.closingGapMeters,
        pendingJump: null,
        selectedVertex: null,
        addPointMode: false,
        warnings: action.gapConfirmed
          ? addWarning(
              state.warnings.filter((warning) => warning.code !== "closing-gap"),
              "closing-gap",
              action.closingGapMeters,
            )
          : state.warnings,
      };
    case "BACK_TO_RECORDING":
      return {
        ...state,
        status: "paused",
        editedPoints: null,
        editHistory: [],
        selectedVertex: null,
        addPointMode: false,
        warnings: state.warnings.filter((warning) => warning.code !== "closing-gap"),
      };

    case "EDIT_MOVE_VERTEX": {
      const points = selectBoundaryPoints(state);
      if (!points[action.index]) return state;
      const edited = [...points];
      edited[action.index] = {
        id: action.id,
        position: action.position,
        source: "edit",
        accuracy: null,
        timestamp: null,
      };
      return { ...commitEdit(state, edited), selectedVertex: action.index };
    }
    case "EDIT_INSERT_VERTEX": {
      const points = selectBoundaryPoints(state);
      const edited = [...points];
      edited.splice(action.afterIndex + 1, 0, {
        id: action.id,
        position: action.position,
        source: "edit",
        accuracy: null,
        timestamp: null,
      });
      return { ...commitEdit(state, edited), selectedVertex: action.afterIndex + 1 };
    }
    case "EDIT_REMOVE_VERTEX": {
      const points = selectBoundaryPoints(state);
      if (!points[action.index]) return state;
      return commitEdit(
        state,
        points.filter((_, index) => index !== action.index),
      );
    }
    case "EDIT_REPLACE":
      return commitEdit(state, action.points);
    case "EDIT_UNDO": {
      if (state.editHistory.length === 0) return state;
      return {
        ...state,
        editedPoints: state.editHistory[state.editHistory.length - 1],
        editHistory: state.editHistory.slice(0, -1),
        selectedVertex: null,
        exported: false,
      };
    }
    case "EDIT_RESET":
      if (state.editedPoints === null) return state;
      return { ...commitEdit(state, state.acceptedPoints), editedPoints: null };
    case "SELECT_VERTEX":
      return state.selectedVertex === action.index
        ? state
        : { ...state, selectedVertex: action.index };
    case "SET_ADD_POINT_MODE":
      return { ...state, addPointMode: action.enabled, selectedVertex: null };

    case "CONFIRM": {
      const positions = selectBoundaryPoints(state).map((point) => point.position);
      if (!validatePolygon(positions).valid) return state;
      return {
        ...state,
        status: "completed",
        completedAt: action.now,
        selectedVertex: null,
        addPointMode: false,
      };
    }
    case "EDIT_AGAIN":
      return { ...state, status: "reviewing", completedAt: null };
    case "MARK_EXPORTED":
      return { ...state, exported: true };

    case "RESET":
      return createInitialState({ areaUnit: state.areaUnit, mapStyle: state.mapStyle });
    case "RESTORE": {
      const { session } = action;
      return {
        ...createInitialState({ areaUnit: session.areaUnit, mapStyle: session.mapStyle }),
        sessionId: session.sessionId,
        // GPS was not running across the reload, so recording never resumes on its own.
        status: session.status === "recording" ? "paused" : session.status,
        mode: session.mode,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        rawObservations: session.rawObservations,
        rejectionCounts: session.rejectionCounts,
        acceptedPoints: session.acceptedPoints,
        editedPoints: session.editedPoints,
        walkedMeters: session.walkedMeters,
        closingGapMeters: session.closingGapMeters,
        warnings: session.warnings,
        exported: session.exported,
      };
    }

    case "ADD_WARNING":
      return { ...state, warnings: addWarning(state.warnings, action.code, action.meters ?? null) };
    case "SET_AREA_UNIT":
      return { ...state, areaUnit: action.unit };
    case "SET_MAP_STYLE":
      return { ...state, mapStyle: action.style };
  }
}
