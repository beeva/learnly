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

describe("qualityFromAttempt", () => {
  it("grades clean, hinted and slow answers differently", () => {
    expect(qualityFromAttempt(true, 0, 20_000)).toBe(5);
    expect(qualityFromAttempt(true, 1, 20_000)).toBe(4);
    expect(qualityFromAttempt(true, 0, 120_000)).toBe(4);
    expect(qualityFromAttempt(false, 0, 20_000)).toBe(2);
  });
});

describe("dueForReview", () => {
  const make = (id: string, dueAt: string | null, pKnown: number): SkillMastery => ({
    skillId: id as SkillId,
    pKnown,
    ability: 0,
    band: "practicing",
    attempts: 6,
    lastPracticedAt: "2025-06-01T00:00:00Z",
    dueAt,
  });

  it("returns only due skills, most overdue first", () => {
    const due = dueForReview(
      [
        make("later", "2025-07-01T00:00:00Z", 0.5),
        make("old", "2025-06-02T00:00:00Z", 0.9),
        make("recent", "2025-06-09T00:00:00Z", 0.6),
        make("never", null, 0.2),
      ],
      new Date("2025-06-10T00:00:00Z"),
    );
    expect(due.map((m) => m.skillId)).toEqual(["old", "recent"]);
  });
});
