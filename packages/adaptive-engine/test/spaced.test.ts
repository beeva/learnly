import { describe, expect, it } from "vitest";
import type { SkillId, SkillMastery } from "@learnly/shared";
import { dueForReview, INITIAL_REVIEW, nextReview, qualityFromAttempt } from "../src/spaced.js";

describe("nextReview", () => {
  it("expands 1 → 3 → ~7 days on clean recalls", () => {
    const one = nextReview(INITIAL_REVIEW, 5);
    const two = nextReview(one, 5);
    const three = nextReview(two, 5);
    expect([one.intervalDays, two.intervalDays]).toEqual([1, 3]);
    expect(three.intervalDays).toBeGreaterThanOrEqual(7);
  });

  it("brings a missed skill back tomorrow", () => {
    const state = { intervalDays: 20, ease: 2.5, repetitions: 5 };
    expect(nextReview(state, 1)).toMatchObject({ intervalDays: 1, repetitions: 0 });
  });
});

