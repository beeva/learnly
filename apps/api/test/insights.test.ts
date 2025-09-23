import { describe, expect, it } from "vitest";
import type { Item, ItemId, SkillId, SkillMastery, UserId } from "@learnly/shared";
import { csvCell, toCsv } from "../src/lib/csv.js";
import {
  attentionReasons,
  commonMisconception,
  masteryDistribution,
  skillHotspots,
  type InsightAttempt,
} from "../src/modules/insights/compute.js";

const skillA = "a0000000-0000-4000-8000-000000000001" as SkillId;
const skillB = "b0000000-0000-4000-8000-000000000001" as SkillId;
const itemA = "a0000000-0000-4000-8000-0000000000aa" as ItemId;
const user = (n: number) => `00000000-0000-4000-8000-00000000000${n}` as UserId;

const item: Item = {
  id: itemA,
  skillId: skillA,
  kind: "multiple_choice",
  prompt: "What is 1/4 + 1/4?",
  difficulty: 0,
  hints: ["Same-size pieces"],
  explanation: "Fourths plus fourths are fourths.",
  choices: [
    { id: "a", text: "2/4" },
    { id: "b", text: "2/8" },
    { id: "c", text: "1/8" },
  ],
  answer: "a",
};

const items = new Map([[itemA, item]]);

let minute = 0;
function attempt(userId: UserId, correct: boolean, choiceId = correct ? "a" : "b", skillId = skillA, durationMs = 20_000): InsightAttempt {
  minute += 1;
  return {
    userId,
    itemId: itemA,
    skillId,
    correct,
    response: { kind: "multiple_choice", choiceId },
    hintsUsed: 0,
    durationMs,
    answeredAt: new Date(Date.UTC(2025, 8, 1, 9, minute)).toISOString(),
  };
}

describe("commonMisconception", () => {
  it("names a wrong answer that clearly dominates", () => {
    const wrong = [attempt(user(1), false), attempt(user(2), false), attempt(user(3), false, "c")];
    expect(commonMisconception(wrong, items)).toBe("“2/8” for “What is 1/4 + 1/4?”");
  });

  it("stays quiet when mistakes are scattered", () => {
    const scattered = [attempt(user(1), false, "b"), attempt(user(2), false, "c")];
    expect(commonMisconception(scattered, items)).toBeNull();
    expect(commonMisconception([], items)).toBeNull();
  });
});

describe("skillHotspots", () => {
  it("ranks skills by error rate and counts struggling students", () => {
    const attempts = [
      // Skill A: 4 of 6 wrong; user 1 misses 3 of 3.
      attempt(user(1), false),
      attempt(user(1), false),
      attempt(user(1), false),
      attempt(user(2), true),
      attempt(user(2), false),
      attempt(user(3), true),
      // Skill B: 1 of 5 wrong.
      ...[true, true, true, true, false].map((correct) => attempt(user(2), correct, correct ? "a" : "b", skillB)),
    ];
    const hotspots = skillHotspots(
      attempts,
      [
        { id: skillA, name: "Adding fractions", unitTitle: "Unit 3" },
        { id: skillB, name: "Equivalent fractions", unitTitle: "Unit 2" },
      ],
      items,
    );
    expect(hotspots.map((h) => h.skillId)).toEqual([skillA, skillB]);
    expect(hotspots[0]).toMatchObject({ errorRate: 4 / 6, studentsStruggling: 1 });
    expect(hotspots[0]?.commonMisconception).toContain("2/8");
  });

  it("ignores skills without enough evidence", () => {
    const hotspots = skillHotspots([attempt(user(1), false), attempt(user(1), false)], [{ id: skillA, name: "A", unitTitle: "U" }], items);
    expect(hotspots).toEqual([]);
  });
});

describe("attentionReasons", () => {
  const now = new Date("2025-09-03T12:00:00Z");
  const learning = (attempts: number): SkillMastery => ({
    skillId: skillA,
    pKnown: 0.3,
    ability: -0.5,
    band: "learning",
    attempts,
    lastPracticedAt: null,
    dueAt: null,
  });

  it("flags learners who have gone quiet", () => {
    expect(attentionReasons({ attempts: [], lastActiveAt: null, mastery: [], now })).toEqual(["inactive"]);
    expect(attentionReasons({ attempts: [], lastActiveAt: "2025-09-02T12:00:00Z", mastery: [], now })).toEqual([]);
  });

  it("flags low accuracy, rapid guessing and being stuck", () => {
    const misses = Array.from({ length: 8 }, () => attempt(user(1), false, "b", skillA, 2_000));
    const reasons = attentionReasons({
      attempts: misses,
      lastActiveAt: "2025-09-03T09:00:00Z",
      mastery: [learning(7), { ...learning(9), skillId: skillB }],
      now,
    });
    expect(reasons).toEqual(["low_accuracy", "rapid_guessing", "stuck"]);
  });
});

describe("masteryDistribution", () => {
  it("counts untouched skills as new", () => {
    const rows: SkillMastery[] = [
      { skillId: skillA, pKnown: 0.9, ability: 2, band: "mastered", attempts: 6, lastPracticedAt: null, dueAt: null },
      { skillId: skillB, pKnown: 0.4, ability: 0, band: "learning", attempts: 2, lastPracticedAt: null, dueAt: null },
    ];
    expect(masteryDistribution(2, 3, rows)).toEqual({ new: 4, learning: 1, practicing: 0, mastered: 1 });
  });
});

describe("csv export helpers", () => {
  it("quotes per RFC 4180 and defuses formulas", () => {
    expect(csvCell('Say "hi", Ada')).toBe('"Say ""hi"", Ada"');
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a,b\r\n1,x\r\n");
  });
});
