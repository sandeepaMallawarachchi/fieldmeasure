import { GPS_FILTER_CONFIG, type GPSFilterConfig } from "@/config/gps";
import { angleBetweenBearings, bearingDegrees, fastDistanceMeters } from "@/lib/geometry/geodesy";
import type { GPSObservation, ObservationRejection } from "@/types/gps";
import type { LngLat } from "@/types/measurement";
import { validateObservation } from "./gpsValidation";

export interface FilterContext {
  lastObservation: GPSObservation | null;
  lastAccepted: LngLatFix | null;
  previousAccepted: LngLatFix | null;
  pendingJump: GPSObservation | null;
}

export interface LngLatFix {
  position: LngLat;
  accuracy: number;
  timestamp: number;
}

export interface FilterResult {
  /** Observations to add to the boundary, oldest first. */
  accepted: GPSObservation[];
  rejections: ObservationRejection[];
  pendingJump: GPSObservation | null;
}

function toFix(observation: GPSObservation): LngLatFix {
  return {
    position: [observation.longitude, observation.latitude],
    accuracy: observation.accuracy,
    timestamp: observation.timestamp,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** No smoothing or averaging is applied: positions are kept or dropped, never moved. */
function isMeaningfulMovement(
  fix: LngLatFix,
  speed: number | null,
  last: LngLatFix,
  previous: LngLatFix | null,
  config: GPSFilterConfig,
): boolean {
  const step = fastDistanceMeters(last.position, fix.position);
  const stepThreshold = clamp(
    fix.accuracy * config.stepAccuracyFactor,
    config.minStepM,
    config.maxStepM,
  );
  if (step >= stepThreshold) return true;

  // A short step is still kept when the walker is turning, otherwise corners
  // would be rounded off. Standing still produces direction changes too, so
  // the turn must clear a noise floor and the device must not report zero speed.
  if (!previous) return false;
  const turnThreshold = clamp(
    fix.accuracy * config.turnAccuracyFactor,
    config.minTurnStepM,
    config.maxTurnStepM,
  );
  if (step < turnThreshold) return false;
  if (speed !== null && speed < config.stationarySpeedMps) return false;
  const turn = angleBetweenBearings(
    bearingDegrees(previous.position, last.position),
    bearingDegrees(last.position, fix.position),
  );
  return turn >= config.turnAngleDeg;
}

/**
 * Decides what one new fix does to the boundary.
 *
 * 1. Plain validity: coordinates, timestamp, staleness, repeats.
 * 2. Reported accuracy threshold.
 * 3. Plausible speed since the last accepted point, after allowing for the
 *    reported accuracy of both fixes. Because elapsed time keeps growing, a real
 *    relocation becomes plausible again rather than locking the filter forever.
 * 4. Long jumps are held until a second fix agrees. A lone spike after a dropout
 *    can have a plausible speed, and one bad vertex can change the area a lot.
 * 5. Movement threshold, which stops stationary drift adding false vertices.
 */
export function filterObservation(
  observation: GPSObservation,
  context: FilterContext,
  now: number,
  config: GPSFilterConfig = GPS_FILTER_CONFIG,
): FilterResult {
  const rejections: ObservationRejection[] = [];
  const invalid = validateObservation(
    observation,
    context.lastObservation,
    now,
    config.maxObservationAgeMs,
  );
  if (invalid) return { accepted: [], rejections: [invalid], pendingJump: context.pendingJump };
  if (observation.accuracy > config.maxAcceptableAccuracyM) {
    return { accepted: [], rejections: ["low-accuracy"], pendingJump: context.pendingJump };
  }

  const fix = toFix(observation);
  const accepted: GPSObservation[] = [];
  let last = context.lastAccepted;
  let previous = context.previousAccepted;

  if (context.pendingJump) {
    const pending = toFix(context.pendingJump);
    const elapsedSeconds = Math.max(0, fix.timestamp - pending.timestamp) / 1000;
    const reach = fix.accuracy + pending.accuracy + config.maxPlausibleSpeedMps * elapsedSeconds;
    if (fastDistanceMeters(pending.position, fix.position) <= reach) {
      accepted.push(context.pendingJump);
      previous = last;
      last = pending;
    } else {
      rejections.push("unconfirmed-jump");
    }
  }

  if (!last) return { accepted: [observation], rejections, pendingJump: null };

  const step = fastDistanceMeters(last.position, fix.position);
  const allowance = last.accuracy + fix.accuracy;
  const elapsedSeconds = (fix.timestamp - last.timestamp) / 1000;
  if (elapsedSeconds <= 0 || (step - allowance) / elapsedSeconds > config.maxPlausibleSpeedMps) {
    rejections.push("implausible-speed");
    return { accepted, rejections, pendingJump: null };
  }

  if (step > config.jumpSuspectMinM + allowance) {
    return { accepted, rejections, pendingJump: observation };
  }

  if (isMeaningfulMovement(fix, observation.speed, last, previous, config)) {
    accepted.push(observation);
  } else {
    rejections.push("stationary-jitter");
  }
  return { accepted, rejections, pendingJump: null };
}
