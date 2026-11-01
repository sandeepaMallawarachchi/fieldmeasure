import { describe, expect, it } from "vitest";
import { createInitialState, measurementReducer } from "@/lib/measurement/machine";
import { selectBoundaryMetrics } from "@/lib/measurement/selectors";
import {
  SESSION_STORAGE_KEY,
  clearSession,
  deserializeSession,
  loadSession,
  saveSession,
  serializeSession,
} from "@/lib/storage/measurementSession";
import type { MeasurementState } from "@/types/measurement";
import { BASE_TIME, COLOMBO, observationAt, offset } from "../helpers";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function recordingState(): MeasurementState {
  const now = BASE_TIME;
  let state = createInitialState();
  state = measurementReducer(state, { type: "REQUEST_GPS" });
  state = measurementReducer(state, {
    type: "GPS_FIX",
    observation: observationAt(COLOMBO, now),
    now,
  });
  state = measurementReducer(state, { type: "START", mode: "walk", sessionId: "s1", now });
  [
    [40, 0],
    [40, 40],
    [0, 40],
  ].forEach(([east, north], index) => {
    const time = now + (index + 1) * 20_000;
    state = measurementReducer(state, {
      type: "GPS_FIX",
      observation: observationAt(offset(COLOMBO, east, north), time),
      now: time,
    });
  });
  return state;
}

describe("session persistence", () => {
  it("round-trips a measurement exactly, at full precision", () => {
    const state = recordingState();
    const restored = deserializeSession(serializeSession(state) ?? "");
    expect(restored).not.toBeNull();
    expect(restored?.acceptedPoints).toEqual(state.acceptedPoints);
    expect(restored?.rawObservations).toEqual(state.rawObservations);
    expect(restored?.walkedMeters).toBe(state.walkedMeters);
  });

  it("restores a recording as paused, since GPS wasn't running across the reload", () => {
    const state = recordingState();
    const session = deserializeSession(serializeSession(state) ?? "");
    if (!session) throw new Error("Expected a session");
    const restored = measurementReducer(createInitialState(), { type: "RESTORE", session });
    expect(restored.status).toBe("paused");
    expect(selectBoundaryMetrics(restored).areaM2).toBeCloseTo(
      selectBoundaryMetrics(state).areaM2,
      8,
    );
  });

  it("doesn't save idle state", () => {
    const storage = memoryStorage();
    expect(saveSession(createInitialState(), storage)).toBe("skipped");
    expect(storage.length).toBe(0);
  });

  it("saves, loads and clears", () => {
    const storage = memoryStorage();
    expect(saveSession(recordingState(), storage)).toBe("saved");
    expect(loadSession(storage)?.sessionId).toBe("s1");
    clearSession(storage);
    expect(loadSession(storage)).toBeNull();
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["the wrong shape", JSON.stringify({ hello: "world" })],
    ["a future schema", null],
    ["reversed coordinates out of range", null],
  ])("rejects %s and removes it", (name, value) => {
    const storage = memoryStorage();
    let serialized = value;
    if (name === "a future schema") {
      const session = JSON.parse(serializeSession(recordingState()) ?? "{}");
      serialized = JSON.stringify({ ...session, schemaVersion: 999 });
    }
    if (name === "reversed coordinates out of range") {
      const session = JSON.parse(serializeSession(recordingState()) ?? "{}");
      session.acceptedPoints[0].position = [7, 95];
      serialized = JSON.stringify(session);
    }
    storage.setItem(SESSION_STORAGE_KEY, serialized ?? "");
    expect(loadSession(storage)).toBeNull();
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("reports a full or blocked storage instead of throwing", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(saveSession(recordingState(), storage)).toBe("failed");
  });
});
