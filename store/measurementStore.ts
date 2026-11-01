"use client";

import { useSyncExternalStore } from "react";
import {
  createInitialState,
  measurementReducer,
  type MeasurementAction,
} from "@/lib/measurement/machine";
import type { MeasurementState } from "@/types/measurement";

export type StoreListener = (state: MeasurementState, previous: MeasurementState) => void;

export interface MeasurementStore {
  getState: () => MeasurementState;
  dispatch: (action: MeasurementAction) => void;
  subscribe: (listener: StoreListener) => () => void;
}

/**
 * A small store rather than React state, because GPS fixes arrive constantly:
 * the map subscribes directly and redraws without any React render, and each
 * panel re-renders only when the values it selects change.
 */
export function createMeasurementStore(
  initial: MeasurementState = createInitialState(),
): MeasurementStore {
  let state = initial;
  const listeners = new Set<StoreListener>();
  return {
    getState: () => state,
    dispatch(action) {
      const previous = state;
      state = measurementReducer(state, action);
      if (state !== previous) for (const listener of listeners) listener(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const measurementStore = createMeasurementStore();

const serverState = createInitialState();

/** `selector` must return a primitive or a memoised value. */
export function useMeasurement<T>(selector: (state: MeasurementState) => T): T {
  return useSyncExternalStore(
    measurementStore.subscribe,
    () => selector(measurementStore.getState()),
    () => selector(serverState),
  );
}
