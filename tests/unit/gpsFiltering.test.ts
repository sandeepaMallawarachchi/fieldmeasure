import { describe, expect, it } from "vitest";
import { filterObservation, type FilterContext } from "@/lib/gps/gpsFiltering";
import { classifyAccuracy, median, summarizeGps } from "@/lib/gps/gpsQuality";
import { validateObservation } from "@/lib/gps/gpsValidation";
import { GeolocationService } from "@/lib/gps/geolocationService";
import type { GPSObservation } from "@/types/gps";
import { BASE_TIME, COLOMBO, observationAt, offset } from "../helpers";

const NOW = BASE_TIME;

function context(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    lastObservation: null,
    lastAccepted: null,
    previousAccepted: null,
    pendingJump: null,
    ...overrides,
  };
}

function fixAt(east: number, north: number, secondsAgo: number, accuracy = 4) {
  return {
    position: offset(COLOMBO, east, north),
    accuracy,
    timestamp: NOW - secondsAgo * 1000,
  };
}

describe("validateObservation", () => {
  const good = observationAt(COLOMBO, NOW);

  it("accepts a normal fix", () => {
    expect(validateObservation(good, null, NOW)).toBeNull();
  });

  it.each([
    ["latitude out of range", { latitude: 91 }],
    ["longitude out of range", { longitude: -181 }],
    ["NaN latitude", { latitude: Number.NaN }],
    ["infinite longitude", { longitude: Number.POSITIVE_INFINITY }],
    ["missing accuracy", { accuracy: Number.NaN }],
    ["zero accuracy", { accuracy: 0 }],
    ["invalid timestamp", { timestamp: Number.NaN }],
  ] as [string, Partial<GPSObservation>][])("rejects %s", (_name, overrides) => {
    expect(validateObservation({ ...good, ...overrides }, null, NOW)).toBe("invalid");
  });

  it("rejects stale, repeated and out-of-order fixes", () => {
    expect(validateObservation(observationAt(COLOMBO, NOW - 60_000), null, NOW)).toBe("stale");
    expect(validateObservation(good, good, NOW)).toBe("duplicate");
    expect(validateObservation(observationAt(COLOMBO, NOW - 2000), good, NOW)).toBe("out-of-order");
  });
});

describe("filterObservation", () => {
  it("accepts the first good fix", () => {
    const observation = observationAt(COLOMBO, NOW);
    expect(filterObservation(observation, context(), NOW).accepted).toEqual([observation]);
  });

  it("rejects fixes with poor reported accuracy", () => {
    const result = filterObservation(observationAt(COLOMBO, NOW, { accuracy: 80 }), context(), NOW);
    expect(result.accepted).toEqual([]);
    expect(result.rejections).toEqual(["low-accuracy"]);
  });

  it("accepts normal walking steps and never moves the position", () => {
    const position = offset(COLOMBO, 5, 0);
    const observation = observationAt(position, NOW);
    const { accepted } = filterObservation(
      observation,
      context({ lastAccepted: fixAt(0, 0, 4) }),
      NOW,
    );
    expect(accepted).toEqual([observation]);
    expect(accepted[0].longitude).toBe(position[0]);
    expect(accepted[0].latitude).toBe(position[1]);
  });

  it("ignores stationary drift, regardless of how long it goes on", () => {
    const lastAccepted = fixAt(0, 0, 60);
    const drift: [number, number][] = [
      [0.5, 0.3],
      [-0.4, 0.6],
      [0.7, -0.5],
      [-0.6, -0.4],
      [0.3, 0.8],
    ];
    const accepted = drift.flatMap(([east, north], index) => {
      const observation = observationAt(
        offset(COLOMBO, east, north),
        NOW - (50 - index * 5) * 1000,
      );
      return filterObservation(observation, context({ lastAccepted }), NOW).accepted;
    });
    expect(accepted).toEqual([]);
  });

  it("keeps a short step when the walker turns a corner", () => {
    const observation = observationAt(offset(COLOMBO, 10, 1.6), NOW);
    const result = filterObservation(
      observation,
      context({ previousAccepted: fixAt(5, 0, 8), lastAccepted: fixAt(10, 0, 4) }),
      NOW,
    );
    expect(result.accepted).toEqual([observation]);
  });

  it("drops the same short step when continuing straight", () => {
    const observation = observationAt(offset(COLOMBO, 11.6, 0), NOW);
    const result = filterObservation(
      observation,
      context({ previousAccepted: fixAt(5, 0, 8), lastAccepted: fixAt(10, 0, 4) }),
      NOW,
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejections).toEqual(["stationary-jitter"]);
  });

  it("doesn't treat direction jitter as a turn if the device reports standing still", () => {
    const observation = observationAt(offset(COLOMBO, 10, 1.6), NOW, { speed: 0 });
    const result = filterObservation(
      observation,
      context({ previousAccepted: fixAt(5, 0, 8), lastAccepted: fixAt(10, 0, 4) }),
      NOW,
    );
    expect(result.accepted).toEqual([]);
  });

  it("requires more movement from a noisier fix", () => {
    const step = observationAt(offset(COLOMBO, 4, 0), NOW, { accuracy: 15 });
    const noisy = filterObservation(step, context({ lastAccepted: fixAt(0, 0, 4) }), NOW);
    expect(noisy.accepted).toEqual([]);
    const clean = observationAt(offset(COLOMBO, 4, 0), NOW, { accuracy: 4 });
    expect(
      filterObservation(clean, context({ lastAccepted: fixAt(0, 0, 4) }), NOW).accepted,
    ).toEqual([clean]);
  });

  it("rejects an implausible spike", () => {
    const spike = observationAt(offset(COLOMBO, 300, 0), NOW);
    const result = filterObservation(spike, context({ lastAccepted: fixAt(0, 0, 2) }), NOW);
    expect(result.accepted).toEqual([]);
    expect(result.rejections).toEqual(["implausible-speed"]);
    expect(result.pendingJump).toBeNull();
  });

  it("holds a long jump until a second fix agrees, then keeps both", () => {
    const first = observationAt(offset(COLOMBO, 60, 0), NOW - 1000);
    const held = filterObservation(first, context({ lastAccepted: fixAt(0, 0, 30) }), NOW);
    expect(held.accepted).toEqual([]);
    expect(held.pendingJump).toBe(first);

    const second = observationAt(offset(COLOMBO, 66, 0), NOW);
    const confirmed = filterObservation(
      second,
      context({ lastAccepted: fixAt(0, 0, 30), pendingJump: first, lastObservation: first }),
      NOW,
    );
    expect(confirmed.accepted).toEqual([first, second]);
    expect(confirmed.pendingJump).toBeNull();
  });

  it("discards a held jump the next fix contradicts", () => {
    const outlier = observationAt(offset(COLOMBO, 60, 0), NOW - 1000);
    const next = observationAt(offset(COLOMBO, 3, 0), NOW);
    const result = filterObservation(
      next,
      context({ lastAccepted: fixAt(0, 0, 30), pendingJump: outlier, lastObservation: outlier }),
      NOW,
    );
    expect(result.accepted).toEqual([next]);
    expect(result.rejections).toContain("unconfirmed-jump");
  });

  it("recovers from real relocation as time passes rather than locking up", () => {
    const moved = offset(COLOMBO, 200, 0);
    const soon = filterObservation(
      observationAt(moved, NOW),
      context({ lastAccepted: fixAt(0, 0, 3) }),
      NOW,
    );
    expect(soon.rejections).toEqual(["implausible-speed"]);
    const later = filterObservation(
      observationAt(moved, NOW),
      context({ lastAccepted: fixAt(0, 0, 60) }),
      NOW,
    );
    expect(later.pendingJump).not.toBeNull();
  });

  it.each([0.5, 1, 7, 25])("accepts a step %s seconds after the last fix", (secondsAgo) => {
    const observation = observationAt(offset(COLOMBO, 6, 0), NOW);
    const { accepted } = filterObservation(
      observation,
      context({ lastAccepted: fixAt(0, 0, secondsAgo) }),
      NOW,
    );
    expect(accepted).toEqual([observation]);
  });
});

describe("GPS quality", () => {
  it("classifies by explicit thresholds", () => {
    expect(classifyAccuracy(3)).toBe("good");
    expect(classifyAccuracy(8)).toBe("good");
    expect(classifyAccuracy(8.1)).toBe("moderate");
    expect(classifyAccuracy(20)).toBe("moderate");
    expect(classifyAccuracy(20.1)).toBe("poor");
    expect(classifyAccuracy(null)).toBe("unavailable");
    expect(classifyAccuracy(Number.NaN)).toBe("unavailable");
  });

  it("calculates medians", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("summarises without inventing data when GPS wasn't used", () => {
    expect(summarizeGps([], [])).toEqual({
      quality: "unavailable",
      medianAccuracyM: null,
      observationCount: 0,
    });
  });
});

describe("GeolocationService", () => {
  function fakeGeolocation() {
    const clearWatch: number[] = [];
    let watches = 0;
    const geolocation = {
      watchPosition: () => {
        watches += 1;
        return watches;
      },
      clearWatch: (id: number) => clearWatch.push(id),
      getCurrentPosition: () => undefined,
    } as unknown as Geolocation;
    return { geolocation, clearWatch, getWatches: () => watches };
  }

  it("never runs two watchers, and stops cleanly", () => {
    const fake = fakeGeolocation();
    const service = new GeolocationService(() => fake.geolocation);
    const handlers = { onObservation: () => undefined, onError: () => undefined };
    service.start(handlers);
    service.start(handlers);
    expect(fake.getWatches()).toBe(1);
    service.stop();
    service.stop();
    expect(fake.clearWatch).toEqual([1]);
    expect(service.isWatching).toBe(false);
  });

  it("reports missing geolocation instead of throwing", () => {
    const errors: string[] = [];
    const service = new GeolocationService(() => undefined);
    service.start({ onObservation: () => undefined, onError: (error) => errors.push(error) });
    expect(errors).toEqual(["unsupported"]);
  });
});
