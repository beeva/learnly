import { describe, expect, it } from "vitest";
import { advanceStreak, levelForXp, xpForAttempt, xpForLevel, type StreakState } from "../src/progress.js";

describe("levels", () => {
  it("starts everyone at level 1", () => {
    expect(levelForXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 80, progress: 0 });
  });

  it("carries remaining xp into the next level", () => {
    const info = levelForXp(xpForLevel(1) + 10);
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(10);
  });

  it("still rewards effort on a wrong answer", () => {
    expect(xpForAttempt(false, 0, true)).toBe(2);
    expect(xpForAttempt(true, 0, true)).toBe(15);
    expect(xpForAttempt(true, 5, false)).toBe(4);
  });
});

describe("advanceStreak", () => {
  const start: StreakState = { current: 4, longest: 9, lastActiveDay: "2024-04-10", freezesAvailable: 1 };

  it("is idempotent within a day", () => {
    expect(advanceStreak(start, "2024-04-10")).toBe(start);
  });

  it("extends on consecutive days", () => {
    expect(advanceStreak(start, "2024-04-11").current).toBe(5);
  });

  it("spends a freeze to forgive one missed day", () => {
    const next = advanceStreak(start, "2024-04-12");
    expect(next.current).toBe(5);
    expect(next.freezesAvailable).toBe(0);
  });

  it("resets after a longer gap but keeps the record", () => {
    const next = advanceStreak(start, "2024-04-20");
    expect(next.current).toBe(1);
    expect(next.longest).toBe(9);
  });
});
