/**
 * Every GPS threshold lives here so the behaviour can be tuned from field
 * testing and covered by tests. These are starting values for consumer phones
 * walking outdoors, not guarantees about the accuracy any device will achieve.
 */
export const GPS_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

export const GPS_FILTER_CONFIG = {
  /** Fixes reporting worse horizontal accuracy than this are never used for the boundary. */
  maxAcceptableAccuracyM: 30,
  /** Older fixes are cached positions rather than the place the user is standing. */
  maxObservationAgeMs: 30_000,
  /** A brisk jog. Faster movement, after allowing for reported accuracy, is treated as a spike. */
  maxPlausibleSpeedMps: 7,
  /** Steps longer than this plus reported accuracy need a second agreeing fix before being used. */
  jumpSuspectMinM: 25,
  /** Normal movement step: scales with accuracy, so a noisier fix must move further to count. */
  minStepM: 2,
  maxStepM: 6,
  stepAccuracyFactor: 0.6,
  /** Shorter step that is still kept when the direction changes, so corners are not cut. */
  minTurnStepM: 1,
  maxTurnStepM: 3,
  turnAccuracyFactor: 0.3,
  turnAngleDeg: 35,
  /** Device-reported speed below this means standing still, so a "turn" is only jitter. */
  stationarySpeedMps: 0.3,
  /** Accepted points further apart in time than this are joined by an unobserved straight line. */
  longGapMs: 30_000,
} as const;

export type GPSFilterConfig = typeof GPS_FILTER_CONFIG;

export const GPS_QUALITY_CONFIG = {
  goodMaxAccuracyM: 8,
  moderateMaxAccuracyM: 20,
  /** With no new fix for this long, the last reading no longer describes the current signal. */
  staleAfterMs: 20_000,
  staleCheckIntervalMs: 3_000,
} as const;

export const MEASUREMENT_CONFIG = {
  /** Accuracy needed to report "ready"; weaker starts are allowed but flagged on the result. */
  startMaxAccuracyM: 15,
  /** A corner marked with a fix older than this would not be where the user is standing. */
  cornerMaxFixAgeMs: 10_000,
  /** Closing gaps below max(minGap, factor x median accuracy) are within GPS noise. */
  closingGapMinM: 10,
  closingGapAccuracyFactor: 2,
  /** Walking this far while paused is reported, since it becomes one straight segment. */
  pausedGapWarnM: 10,
} as const;

export const GEOMETRY_CONFIG = {
  minUniqueVertices: 3,
  /** Vertices closer than this are the same place. */
  duplicateToleranceM: 0.01,
  /** Smaller polygons cannot be told apart from GPS noise. */
  minAreaM2: 1,
  /** Isoperimetric ratio below which a polygon is effectively a line. */
  minCompactness: 0.002,
} as const;
