import { describe, expect, it } from "vitest";
import {
  canDispatch,
  createInitialState,
  measurementReducer,
  type MeasurementAction,
} from "@/lib/measurement/machine";
import {
  assessClosure,
  selectBoundaryMetrics,
  selectBoundaryPoints,
  selectMethod,
} from "@/lib/measurement/selectors";
import type { LngLat, MeasurementState } from "@/types/measurement";
import { BASE_TIME, COLOMBO, observationAt, offset, square, walkPath } from "../helpers";

function run(state: MeasurementState, ...actions: MeasurementAction[]): MeasurementState {
  return actions.reduce(measurementReducer, state);
}

function readyState(now = BASE_TIME): MeasurementState {
  return run(
    createInitialState(),
    { type: "REQUEST_GPS" },
    { type: "GPS_FIX", observation: observationAt(COLOMBO, now), now },
  );
}

function recordWalk(corners: LngLat[], stepMeters = 5) {
  let now = BASE_TIME;
  let state = run(readyState(now), { type: "START", mode: "walk", sessionId: "s1", now });
  for (const position of [...walkPath(corners, stepMeters, COLOMBO).slice(1), corners[0]]) {
    now += 4000;
    state = run(state, { type: "GPS_FIX", observation: observationAt(position, now), now });
  }
  return { state, now };
}

describe("state transitions", () => {
  it("follows the normal measurement flow", () => {
    let state = createInitialState();
    expect(state.status).toBe("idle");
    state = run(state, { type: "REQUEST_GPS" });
    expect(state.status).toBe("acquiring-gps");
    state = run(state, {
      type: "GPS_FIX",
      observation: observationAt(COLOMBO, BASE_TIME),
      now: BASE_TIME,
    });
    expect(state.status).toBe("ready");
    state = run(state, { type: "START", mode: "walk", sessionId: "s", now: BASE_TIME });
    expect(state.status).toBe("recording");
    state = run(state, { type: "PAUSE" });
    expect(state.status).toBe("paused");
    state = run(state, { type: "RESUME" });
    expect(state.status).toBe("recording");
  });

  it("stays in acquiring-gps until the fix is good enough to start from", () => {
    const state = run(
      createInitialState(),
      { type: "REQUEST_GPS" },
      {
        type: "GPS_FIX",
        observation: observationAt(COLOMBO, BASE_TIME, { accuracy: 40 }),
        now: BASE_TIME,
      },
    );
    expect(state.status).toBe("acquiring-gps");
    expect(state.signal).toBe("poor");
  });

  it("ignores invalid transitions", () => {
    const idle = createInitialState();
    for (const action of [
      { type: "PAUSE" },
      { type: "RESUME" },
      { type: "CONFIRM", now: 1 },
      { type: "EDIT_UNDO" },
      { type: "MARK_EXPORTED" },
      { type: "BEGIN_REVIEW", closingGapMeters: 0, gapConfirmed: false },
    ] as MeasurementAction[]) {
      expect(measurementReducer(idle, action)).toBe(idle);
    }
    expect(canDispatch("completed", "PAUSE")).toBe(false);
    expect(canDispatch("recording", "CONFIRM")).toBe(false);
    expect(canDispatch("paused", "RESUME")).toBe(true);
  });

  it("can't confirm an invalid boundary", () => {
    const [a, b, c, d] = square(COLOMBO, 100);
    const { state } = recordWalk([a, c, b, d]); // A bow-tie.
    const reviewing = run(state, {
      type: "BEGIN_REVIEW",
      closingGapMeters: 0,
      gapConfirmed: false,
    });
    expect(run(reviewing, { type: "CONFIRM", now: 1 }).status).toBe("reviewing");
  });

  it("goes to the error state when permission is denied before recording", () => {
    const state = run(
      createInitialState(),
      { type: "REQUEST_GPS" },
      {
        type: "GPS_ERROR",
        error: "permission-denied",
      },
    );
    expect(state.status).toBe("error");
    expect(state.signal).toBe("denied");
    expect(run(state, { type: "REQUEST_GPS" }).status).toBe("acquiring-gps");
  });

  it("treats timeouts as routine, and never ends a recording", () => {
    const recording = run(readyState(), {
      type: "START",
      mode: "walk",
      sessionId: "s",
      now: BASE_TIME,
    });
    expect(run(recording, { type: "GPS_ERROR", error: "timeout" }).status).toBe("recording");
    const acquiring = run(createInitialState(), { type: "REQUEST_GPS" });
    expect(run(acquiring, { type: "GPS_ERROR", error: "timeout" }).status).toBe("acquiring-gps");
  });

  it("pauses without data loss if permission is revoked mid-walk", () => {
    const { state } = recordWalk(square(COLOMBO, 50));
    const next = run(state, { type: "GPS_ERROR", error: "permission-denied" });
    expect(next.status).toBe("paused");
    expect(next.acceptedPoints).toBe(state.acceptedPoints);
  });
});

describe("recording", () => {
  it("records a walked square and calculates its area and perimeter", () => {
    const { state } = recordWalk(square(COLOMBO, 100));
    const metrics = selectBoundaryMetrics(state);
    expect(metrics.areaM2 / 10_000).toBeCloseTo(1, 2);
    expect(metrics.perimeterM / 400).toBeCloseTo(1, 2);
    expect(state.walkedMeters / 400).toBeCloseTo(1, 2);
    expect(metrics.validation.valid).toBe(true);
  });

  it("uses the ready fix as the start of the boundary", () => {
    const state = run(readyState(), {
      type: "START",
      mode: "walk",
      sessionId: "s",
      now: BASE_TIME,
    });
    expect(state.acceptedPoints).toHaveLength(1);
    expect(state.acceptedPoints[0].position).toEqual(COLOMBO);
    expect(state.warnings).toEqual([]);
  });

  it("flags a weak start", () => {
    const state = run(
      createInitialState(),
      { type: "REQUEST_GPS" },
      {
        type: "GPS_FIX",
        observation: observationAt(COLOMBO, BASE_TIME, { accuracy: 25 }),
        now: BASE_TIME,
      },
      { type: "START", mode: "walk", sessionId: "s", now: BASE_TIME },
    );
    expect(state.warnings.map((warning) => warning.code)).toEqual(["weak-start"]);
  });

  it("keeps every raw observation, including rejected ones", () => {
    let state = run(readyState(), { type: "START", mode: "walk", sessionId: "s", now: BASE_TIME });
    const inaccurate = observationAt(offset(COLOMBO, 10, 0), BASE_TIME + 5000, { accuracy: 90 });
    state = run(state, { type: "GPS_FIX", observation: inaccurate, now: BASE_TIME + 5000 });
    expect(state.acceptedPoints).toHaveLength(1);
    expect(state.rawObservations).toContain(inaccurate);
    expect(state.rejectionCounts["low-accuracy"]).toBe(1);
  });

  it("doesn't record while paused, and keeps prior points", () => {
    const { state, now } = recordWalk(square(COLOMBO, 50));
    const paused = run(state, { type: "PAUSE" });
    const next = run(paused, {
      type: "GPS_FIX",
      observation: observationAt(offset(COLOMBO, 200, 200), now + 3000),
      now: now + 3000,
    });
    expect(next.acceptedPoints).toBe(state.acceptedPoints);
    expect(next.rawObservations).toBe(state.rawObservations);
  });

  it("warns about movement during a pause on resume", () => {
    const { state, now } = recordWalk(square(COLOMBO, 50));
    const next = run(
      state,
      { type: "PAUSE" },
      {
        type: "GPS_FIX",
        observation: observationAt(offset(COLOMBO, 200, 200), now + 3000),
        now: now + 3000,
      },
      { type: "RESUME" },
    );
    expect(next.warnings.map((warning) => warning.code)).toContain("paused-gap");
  });

  it("records a long gap as a warning", () => {
    let now = BASE_TIME;
    let state = run(readyState(now), { type: "START", mode: "walk", sessionId: "s", now });
    now += 45_000;
    state = run(state, {
      type: "GPS_FIX",
      observation: observationAt(offset(COLOMBO, 20, 0), now),
      now,
    });
    expect(state.warnings.map((warning) => warning.code)).toContain("long-gap");
  });

  it("marks a corner at the current position without duplicating a kept fix", () => {
    const now = BASE_TIME;
    let state = run(readyState(now), { type: "START", mode: "walk", sessionId: "s", now });
    state = run(state, { type: "MARK_CORNER", id: "c1", now });
    expect(state.acceptedPoints).toHaveLength(1);
    expect(state.acceptedPoints[0].source).toBe("gps-corner");
  });

  it("won't mark a corner from an old fix", () => {
    const state = run(readyState(), {
      type: "START",
      mode: "walk",
      sessionId: "s",
      now: BASE_TIME,
    });
    const later = run(state, { type: "MARK_CORNER", id: "c1", now: BASE_TIME + 60_000 });
    expect(later).toBe(state);
  });

  it("supports manual map points in manual mode only", () => {
    const manual = run(createInitialState(), {
      type: "START",
      mode: "manual",
      sessionId: "m",
      now: 1,
    });
    const position = offset(COLOMBO, 1, 1);
    const withPoint = run(manual, { type: "ADD_MAP_POINT", id: "p", position, now: 2 });
    expect(withPoint.acceptedPoints[0]).toMatchObject({ source: "map-tap", accuracy: null });
    expect(selectMethod(withPoint)).toBe("map-placed");
    expect(run(withPoint, { type: "REMOVE_LAST_POINT" }).acceptedPoints).toEqual([]);

    const walk = run(readyState(), { type: "START", mode: "walk", sessionId: "s", now: BASE_TIME });
    expect(run(walk, { type: "ADD_MAP_POINT", id: "p", position, now: 2 })).toBe(walk);
  });
});

describe("closing the boundary", () => {
  const points = (positions: LngLat[], accuracy = 4) =>
    positions.map((position, index) => ({
      id: String(index),
      position,
      source: "gps-auto" as const,
      accuracy,
      timestamp: index,
    }));

  it("doesn't ask when the walk ends near the start", () => {
    const closure = assessClosure(
      points([COLOMBO, offset(COLOMBO, 100, 0), offset(COLOMBO, 3, 2)]),
    );
    expect(closure.needsConfirmation).toBe(false);
  });

  it("asks when the gap is larger than GPS noise", () => {
    const closure = assessClosure(
      points([COLOMBO, offset(COLOMBO, 100, 0), offset(COLOMBO, 60, 0)]),
    );
    expect(closure.needsConfirmation).toBe(true);
    expect(closure.gapMeters).toBeCloseTo(60, 0);
  });

  it("allows a larger gap when GPS is noisier", () => {
    const end = offset(COLOMBO, 15, 0);
    expect(
      assessClosure(points([COLOMBO, offset(COLOMBO, 100, 0), end], 4)).needsConfirmation,
    ).toBe(true);
    expect(
      assessClosure(points([COLOMBO, offset(COLOMBO, 100, 0), end], 15)).needsConfirmation,
    ).toBe(false);
  });

  it("records a confirmed gap as a warning on the measurement", () => {
    const { state } = recordWalk(square(COLOMBO, 50));
    const reviewing = run(state, {
      type: "BEGIN_REVIEW",
      closingGapMeters: 42,
      gapConfirmed: true,
    });
    expect(reviewing.warnings).toContainEqual({ code: "closing-gap", count: 1, meters: 42 });
    const back = run(reviewing, { type: "BACK_TO_RECORDING" });
    expect(back.warnings.map((warning) => warning.code)).not.toContain("closing-gap");
  });
});

describe("editing", () => {
  function reviewing() {
    const { state } = recordWalk(square(COLOMBO, 100), 25);
    return run(state, { type: "BEGIN_REVIEW", closingGapMeters: 0, gapConfirmed: false });
  }

  it("moves, inserts and removes vertices and recalculates", () => {
    const state = reviewing();
    const before = selectBoundaryMetrics(state).areaM2;
    const count = selectBoundaryPoints(state).length;
    const corner = selectBoundaryPoints(state)[4].position; // The far corner along the first edge.

    const moved = run(state, {
      type: "EDIT_MOVE_VERTEX",
      index: 4,
      position: [corner[0] + 0.0002, corner[1]],
      id: "m",
    });
    expect(selectBoundaryMetrics(moved).areaM2).toBeGreaterThan(before);

    const inserted = run(state, {
      type: "EDIT_INSERT_VERTEX",
      afterIndex: 0,
      position: offset(COLOMBO, 10, -5),
      id: "i",
    });
    expect(selectBoundaryPoints(inserted)).toHaveLength(count + 1);

    const removed = run(state, { type: "EDIT_REMOVE_VERTEX", index: 1 });
    expect(selectBoundaryPoints(removed)).toHaveLength(count - 1);
  });

  it("never touches raw GPS data or the accepted boundary", () => {
    const state = reviewing();
    const edited = run(state, {
      type: "EDIT_MOVE_VERTEX",
      index: 2,
      position: offset(COLOMBO, -30, -30),
      id: "m",
    });
    expect(edited.rawObservations).toBe(state.rawObservations);
    expect(edited.acceptedPoints).toBe(state.acceptedPoints);
    expect(edited.editedPoints).not.toBeNull();
  });

  it("undoes step by step and resets to the recorded boundary", () => {
    const state = reviewing();
    const first = run(state, {
      type: "EDIT_MOVE_VERTEX",
      index: 2,
      position: offset(COLOMBO, 50, -10),
      id: "a",
    });
    const second = run(first, { type: "EDIT_REMOVE_VERTEX", index: 3 });
    expect(selectBoundaryPoints(run(second, { type: "EDIT_UNDO" }))).toBe(first.editedPoints);

    const undoneTwice = run(second, { type: "EDIT_UNDO" }, { type: "EDIT_UNDO" });
    expect(undoneTwice.editedPoints).toBeNull();
    expect(selectBoundaryPoints(undoneTwice)).toBe(state.acceptedPoints);

    const reset = run(second, { type: "EDIT_RESET" });
    expect(reset.editedPoints).toBeNull();
    expect(selectBoundaryPoints(reset)).toBe(state.acceptedPoints);
    expect(selectBoundaryPoints(run(reset, { type: "EDIT_UNDO" }))).toBe(second.editedPoints);
  });

  it("invalidates a previous download after an edit", () => {
    const completed = run(reviewing(), { type: "CONFIRM", now: 1 }, { type: "MARK_EXPORTED" });
    expect(completed.exported).toBe(true);
    const edited = run(completed, { type: "EDIT_AGAIN" }, { type: "EDIT_REMOVE_VERTEX", index: 1 });
    expect(edited.exported).toBe(false);
  });

  it("keeps preferences when resetting", () => {
    const state = run(reviewing(), { type: "SET_AREA_UNIT", unit: "perches" }, { type: "RESET" });
    expect(state.status).toBe("idle");
    expect(state.areaUnit).toBe("perches");
    expect(state.acceptedPoints).toEqual([]);
  });
});
