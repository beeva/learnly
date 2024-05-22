import { describe, expect, it } from "vitest";
import type { ItemId, SkillId } from "@learnly/shared";
import {
  DIAGNOSTIC_LIMITS,
  nextDiagnosticItem,
  recommendedStartSkill,
  recordDiagnosticAnswer,
  startDiagnostic,
  summarizeDiagnostic,
} from "../src/diagnostic.js";
import type { Candidate } from "../src/select.js";

const skills = ["s1", "s2", "s3", "s4", "s5"] as SkillId[];
const bank: Candidate[] = skills.flatMap((s) =>
  [-1.5, -0.5, 0.5, 1.5].map((d, i) => ({ id: `${s}-${i}` as ItemId, skillId: s, difficulty: d })),
);

describe("diagnostic", () => {
  it("never asks more than the total cap", () => {
    let state = startDiagnostic(skills);
    let asked = 0;
    for (let item = nextDiagnosticItem(state, bank); item; item = nextDiagnosticItem(state, bank)) {
      state = recordDiagnosticAnswer(state, item, asked % 3 !== 0, "2024-03-10T09:00:00Z");
      asked++;
    }
    expect(asked).toBeLessThanOrEqual(DIAGNOSTIC_LIMITS.maxTotal);
  });

  it("recommends a skill the learner hasn't shown yet", () => {
    let state = startDiagnostic(skills);
    for (let item = nextDiagnosticItem(state, bank); item; item = nextDiagnosticItem(state, bank)) {
      state = recordDiagnosticAnswer(state, item, item.skillId === "s1", "2024-03-10T09:00:00Z");
    }
    const points = summarizeDiagnostic(state);
    expect(points).toHaveLength(skills.length);
    expect(recommendedStartSkill(points)).not.toBe("s1");
  });
});
