import { describe, expect, it } from "vitest";
import { recommendPace, type PaceSignal } from "../src/pacing.js";

const signal = (correct: boolean, durationMs = 30_000, hintsUsed = 0): PaceSignal => ({ correct, durationMs, hintsUsed });

describe("recommendPace", () => {
  it("waits for enough evidence", () => {
    expect(recommendPace([signal(false)]).decision).toBe("steady");
  });

  it("slows down and adds a worked example when accuracy drops", () => {
    const rec = recommendPace([signal(false), signal(false), signal(true), signal(false)]);
    expect(rec).toEqual({ decision: "slow_down", levelDelta: -1, insertWorkedExample: true });
  });

  it("speeds up for quick, accurate, unhinted work", () => {
    const rec = recommendPace(Array.from({ length: 6 }, () => signal(true, 20_000)));
    expect(rec.decision).toBe("speed_up");
  });
});
