import { GPS_WATCH_OPTIONS } from "@/config/gps";
import { createId } from "@/lib/utils";
import type { GPSErrorKind, GPSObservation } from "@/types/gps";
import { positionToObservation } from "./gpsValidation";

export interface GeolocationHandlers {
  onObservation: (observation: GPSObservation) => void;
  onError: (error: GPSErrorKind) => void;
}

function mapErrorCode(error: GeolocationPositionError): GPSErrorKind {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "permission-denied";
    case error.POSITION_UNAVAILABLE:
      return "position-unavailable";
    default:
      return "timeout";
  }
}

/**
 * Owns the single watchPosition call. Starting is idempotent so React Strict
 * Mode and repeated effects can never leave two watchers delivering fixes.
 *
 * The browser only promises callbacks while the page is in the foreground, and
 * at irregular intervals. Nothing downstream assumes a particular update rate.
 */
export class GeolocationService {
  private watchId: number | null = null;

  constructor(private readonly geolocation: () => Geolocation | undefined = browserGeolocation) {}

  get isWatching(): boolean {
    return this.watchId !== null;
  }

  start({ onObservation, onError }: GeolocationHandlers): void {
    if (this.watchId !== null) return;
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      onError("insecure-context");
      return;
    }
    const geolocation = this.geolocation();
    if (!geolocation) {
      onError("unsupported");
      return;
    }
    this.watchId = geolocation.watchPosition(
      (position) => onObservation(positionToObservation(position, createId("obs"))),
      (error) => onError(mapErrorCode(error)),
      GPS_WATCH_OPTIONS,
    );
  }

  stop(): void {
    if (this.watchId === null) return;
    this.geolocation()?.clearWatch(this.watchId);
    this.watchId = null;
  }
}

function browserGeolocation(): Geolocation | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.geolocation;
}

export const geolocationService = new GeolocationService();
