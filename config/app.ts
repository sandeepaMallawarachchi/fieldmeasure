export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "FieldMeasure";

export const APP_CONFIG = {
  /** Worst-case interval between recovery checkpoints while recording. */
  sessionCheckpointMs: 10_000,
  /** Undo depth for boundary edits. */
  maxEditHistory: 50,
  toastDurationMs: 5_000,
  exportSize: { width: 1600, height: 1200 },
  /** How long the export waits for map tiles before using the plain report map. */
  exportMapTimeoutMs: 12_000,
} as const;
