import { describe, expect, it } from "vitest";
import type { SkillId } from "@learnly/shared";
import { initialMastery } from "../src/mastery.js";
import { INITIAL_REVIEW } from "../src/spaced.js";
import { applyAttemptV2, type V2State } from "../src/v2.js";

const fresh = (): V2State => ({ mastery: initialMastery("skill-ratios" as SkillId), review: INITIAL_REVIEW });
const evidence = (correct: boolean, hintsUsed = 0) => ({
  difficulty: 0.5,
  correct,
  hintsUsed,
  durationMs: 25_000,
  answeredAt: "2025-09-01T15:00:00.000Z",
});

describe("applyAttemptV2", () => {
  it("stamps a due date one day out after the first correct answer", () => {
    const next = applyAttemptV2(fresh(), evidence(true));
    expect(next.mastery.dueAt).toBe("2025-09-02T15:00:00.000Z");
    expect(next.mastery.pKnown).toBeGreaterThan(fresh().mastery.pKnown);
  });
});
describe("applyAttemptV2 with hints", () => {
  it("gives less credit to hinted correct answers", () => {
    const clean = applyAttemptV2(fresh(), evidence(true, 0));
    const hinted = applyAttemptV2(fresh(), evidence(true, 2));
    expect(hinted.mastery.pKnown).toBeLessThan(clean.mastery.pKnown);
  });
});
