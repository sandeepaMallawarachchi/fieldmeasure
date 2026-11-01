export interface GPSObservation {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  heading: number | null;
}

/** User-facing signal state, including states where no fix exists. */
export type GPSSignal =
  "off" | "searching" | "good" | "moderate" | "poor" | "denied" | "unavailable";

export type GPSQuality = "good" | "moderate" | "poor" | "unavailable";

export type GPSErrorKind =
  "permission-denied" | "position-unavailable" | "timeout" | "unsupported" | "insecure-context";

export type ObservationRejection =
  | "invalid"
  | "duplicate"
  | "out-of-order"
  | "stale"
  | "low-accuracy"
  | "implausible-speed"
  | "unconfirmed-jump"
  | "stationary-jitter";
