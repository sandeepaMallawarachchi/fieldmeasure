import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ReadyPanel } from "@/components/measurement/ReadyPanel";
import { RecordingPanel } from "@/components/measurement/RecordingPanel";
import { ResultPanel } from "@/components/measurement/ResultPanel";
import { ReviewPanel } from "@/components/measurement/ReviewPanel";
import { t } from "@/lib/i18n";
import { loadSession, saveSession } from "@/lib/storage/measurementSession";
import { measurementStore, useMeasurement } from "@/store/measurementStore";
import type { LngLat } from "@/types/measurement";
import { COLOMBO, observationAt, offset, square, walkPath } from "../helpers";

function Panels() {
  const status = useMeasurement((state) => state.status);
  if (status === "recording" || status === "paused") return <RecordingPanel />;
  if (status === "reviewing") return <ReviewPanel />;
  if (status === "completed") return <ResultPanel />;
  return <ReadyPanel />;
}

function sendFix(position: LngLat, timestamp: number, accuracy = 4) {
  act(() => {
    measurementStore.dispatch({
      type: "GPS_FIX",
      observation: observationAt(position, timestamp, { accuracy }),
      now: timestamp,
    });
  });
}

function walk(corners: LngLat[], startTime: number, stepMeters = 5): number {
  let time = startTime;
  for (const position of [...walkPath(corners, stepMeters, COLOMBO).slice(1), corners[0]]) {
    time += 4000;
    sendFix(position, time);
  }
  return time;
}

function button(name: string) {
  return screen.getByRole<HTMLButtonElement>("button", { name });
}

beforeEach(() => {
  sessionStorage.clear();
  act(() => measurementStore.dispatch({ type: "RESET" }));
});

describe("measurement flow", () => {
  it("runs from finding GPS through to a confirmed result", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    render(<Panels />);

    await user.click(button(t.ready.findLocation));
    expect(button(t.ready.searching).disabled).toBe(true);

    sendFix(COLOMBO, now);
    await user.click(button(t.ready.start));
    expect(measurementStore.getState().status).toBe("recording");

    const stop = walk(square(COLOMBO, 100), now);
    expect(screen.getByTestId("live-area").textContent).toContain("2.4");

    // A pause in the middle changes nothing that was recorded.
    await user.click(button(t.recording.pause));
    const pointsBefore = measurementStore.getState().acceptedPoints.length;
    sendFix(offset(COLOMBO, 500, 500), stop + 1000);
    expect(measurementStore.getState().acceptedPoints).toHaveLength(pointsBefore);
    sendFix(COLOMBO, stop + 2000);
    await user.click(button(t.recording.resume));

    await user.click(button(t.recording.finish));
    expect(measurementStore.getState().status).toBe("reviewing");
    expect(screen.getByTestId("review-area").textContent).toContain("2.47");

    await user.click(button(t.review.confirm));
    expect(screen.getByTestId("result-area").textContent).toBe("2.471 acres");
    expect(screen.getByTestId("result-perimeter").textContent).toContain("400 m");
    expect(screen.getByTestId("area-perches").textContent).toBe("395.4");
    expect(screen.getByTestId("area-squareFeet").textContent).toBe("107,639");
  });

  it("asks before closing a large gap, and can keep walking instead", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    render(<Panels />);
    await user.click(button(t.ready.findLocation));
    sendFix(COLOMBO, now);
    await user.click(button(t.ready.start));

    let time = now;
    for (const position of [
      offset(COLOMBO, 20, 0),
      offset(COLOMBO, 40, 0),
      offset(COLOMBO, 40, 20),
      offset(COLOMBO, 40, 40),
      offset(COLOMBO, 20, 40),
    ]) {
      time += 8000;
      sendFix(position, time);
    }
    await user.click(button(t.recording.finish));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(measurementStore.getState().status).toBe("recording");

    await user.click(button(t.closure.keepWalking));
    expect(measurementStore.getState().status).toBe("recording");

    await user.click(button(t.recording.finish));
    await user.click(button(t.closure.connect));
    const state = measurementStore.getState();
    expect(state.status).toBe("reviewing");
    expect(state.warnings.map((warning) => warning.code)).toContain("closing-gap");
  });

  it("won't review a boundary with too few points", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    render(<Panels />);
    await user.click(button(t.ready.findLocation));
    sendFix(COLOMBO, now);
    await user.click(button(t.ready.start));
    await user.click(button(t.recording.finish));
    expect(screen.getByText(t.tooFewPoints.title)).toBeTruthy();
    expect(measurementStore.getState().status).toBe("recording");
  });

  it("blocks confirming a crossed boundary, and removes loops only on request", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    render(<Panels />);
    await user.click(button(t.ready.findLocation));
    sendFix(COLOMBO, now);
    await user.click(button(t.ready.start));

    let time = now;
    for (const position of [
      offset(COLOMBO, 100, 0),
      offset(COLOMBO, 100, 100),
      offset(COLOMBO, 0, 100),
      offset(COLOMBO, 0, -10),
      offset(COLOMBO, 10, -10),
    ]) {
      time += 40_000;
      sendFix(position, time);
      time += 1000;
      sendFix(position, time); // The second fix confirms each long jump.
    }
    await user.click(button(t.recording.finish));
    await user.click(button(t.closure.connect));
    expect(measurementStore.getState().status).toBe("reviewing");
    expect(button(t.review.confirm).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(t.review.issues["self-intersection"]);

    await user.click(button(t.review.fixCrossings));
    expect(button(t.review.confirm).disabled).toBe(false);
    expect(measurementStore.getState().editedPoints).not.toBeNull();

    await user.click(button(t.common.undo));
    expect(button(t.review.confirm).disabled).toBe(true);
  });

  it("recovers a session from storage with its points intact", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    render(<Panels />);
    await user.click(button(t.ready.findLocation));
    sendFix(COLOMBO, now);
    await user.click(button(t.ready.start));
    walk(square(COLOMBO, 50), now);

    const before = measurementStore.getState();
    expect(saveSession(before)).toBe("saved");
    act(() => measurementStore.dispatch({ type: "RESET" }));
    expect(measurementStore.getState().acceptedPoints).toEqual([]);

    const session = loadSession();
    if (!session) throw new Error("Expected a stored session");
    act(() => measurementStore.dispatch({ type: "RESTORE", session }));
    expect(measurementStore.getState().status).toBe("paused");
    expect(measurementStore.getState().acceptedPoints).toEqual(before.acceptedPoints);
    expect(button(t.recording.resume)).toBeTruthy();
  });

  it("offers manual marking after GPS is denied", async () => {
    const user = userEvent.setup();
    render(<Panels />);
    await user.click(button(t.ready.findLocation));
    act(() => measurementStore.dispatch({ type: "GPS_ERROR", error: "permission-denied" }));
    expect(screen.getByRole("alert").textContent).toContain(t.gps.errors["permission-denied"]);
    await user.click(button(t.ready.markOnMap));
    const state = measurementStore.getState();
    expect(state.status).toBe("recording");
    expect(state.mode).toBe("manual");
  });

  it("warns before replacing a measurement that hasn't been downloaded", async () => {
    const user = userEvent.setup();
    render(<Panels />);
    await user.click(button(t.ready.manual));
    for (const [index, position] of square(COLOMBO, 100).entries()) {
      act(() =>
        measurementStore.dispatch({
          type: "ADD_MAP_POINT",
          id: `p${index}`,
          position,
          now: index,
        }),
      );
    }
    await user.click(button(t.recording.finish));
    await user.click(button(t.closure.connect));
    await user.click(button(t.review.confirm));
    await user.click(button(t.result.newMeasurement));
    expect(screen.getByText(t.newMeasurement.body)).toBeTruthy();
    await user.click(button(t.common.cancel));
    expect(measurementStore.getState().status).toBe("completed");
    await user.click(button(t.result.newMeasurement));
    await user.click(button(t.newMeasurement.confirm));
    expect(measurementStore.getState().status).toBe("idle");
    expect(loadSession()).toBeNull();
  });
});
