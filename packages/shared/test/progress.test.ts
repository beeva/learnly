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

