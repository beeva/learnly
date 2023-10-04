import { describe, expect, it } from "vitest";
import type { SkillId } from "@learnly/shared";
import { applyAttempt, bandFor, initialMastery } from "../src/mastery.js";

const skill = "skill-fractions-equivalent" as SkillId;

describe("bandFor", () => {
  it("labels unseen skills as new", () => {
    expect(bandFor(0.99, 0)).toBe("new");
  });

  it("requires a few attempts before calling something mastered", () => {
    expect(bandFor(0.9, 2)).toBe("practicing");
    expect(bandFor(0.9, 4)).toBe("mastered");
  });
});

describe("applyAttempt", () => {
  it("reaches mastered after consistent success on grade-level items", () => {
    let state = initialMastery(skill);
    for (let i = 0; i < 12; i++) {
      state = applyAttempt(state, { difficulty: 1.5, correct: true, hintsUsed: 0, answeredAt: "2023-07-01T10:00:00Z" });
    }
    expect(state.band).toBe("mastered");
    expect(state.attempts).toBe(12);
    expect(state.lastPracticedAt).toBe("2023-07-01T10:00:00Z");
  });

  it("stays in learning after repeated misses", () => {
    let state = initialMastery(skill);
    for (let i = 0; i < 5; i++) {
      state = applyAttempt(state, { difficulty: -0.5, correct: false, hintsUsed: 1, answeredAt: "2023-07-01T10:00:00Z" });
    }
    expect(state.band).toBe("learning");
  });
});
