import { asId, type Item, type ItemId, type SkillId } from "@learnly/shared";
import { describe, expect, it } from "vitest";
import { courseBySlug, items, itemsByCourse, skills } from "./content";
import {
  DEMO_STUDENT_ID,
  MockHttpError,
  correctResponseOf,
  courseMastery,
  evaluate,
  issueTokens,
  nextItem,
  progressSummary,
  recordAttempt,
  rotateRefreshToken,
  startSession,
  toPublicItem,
} from "./db";

const common = { id: asId<ItemId>("item"), skillId: asId<SkillId>("skill"), prompt: "?", difficulty: 0, hints: [], explanation: "Because." };

const numeric: Item = { ...common, kind: "numeric", answer: 12, tolerance: 0 };
const fraction: Item = { ...common, kind: "short_text", acceptedAnswers: ["2/3"] };
const word: Item = { ...common, kind: "short_text", acceptedAnswers: ["photosynthesis"] };
const ordering: Item = {
  ...common,
  kind: "ordering",
  entries: ["a", "b", "c", "d"].map((id) => ({ id, text: id.toUpperCase() })),
  answer: ["a", "b", "c", "d"],
};
const choice: Item = { ...common, kind: "multiple_choice", choices: [{ id: "a", text: "1/2" }, { id: "b", text: "3/4" }], answer: "b" };

describe("evaluate", () => {
  it("scores multiple choice and rejects mismatched response kinds", () => {
    expect(evaluate(choice, { kind: "multiple_choice", choiceId: "b" })).toEqual({ correct: true, close: false });
    expect(evaluate(choice, { kind: "multiple_choice", choiceId: "a" })).toEqual({ correct: false, close: false });
    expect(evaluate(choice, { kind: "numeric", value: 1 })).toEqual({ correct: false, close: false });
  });

  it("treats numeric answers within 10% as close", () => {
    expect(evaluate(numeric, { kind: "numeric", value: 12 }).correct).toBe(true);
    expect(evaluate(numeric, { kind: "numeric", value: 13 })).toEqual({ correct: false, close: true });
    expect(evaluate(numeric, { kind: "numeric", value: 20 })).toEqual({ correct: false, close: false });
  });

  it("normalizes short text and spots equivalent fractions as close", () => {
    expect(evaluate(fraction, { kind: "short_text", text: " 2 / 3. " }).correct).toBe(true);
    expect(evaluate(fraction, { kind: "short_text", text: "4/6" })).toEqual({ correct: false, close: true });
    expect(evaluate(fraction, { kind: "short_text", text: "3/4" })).toEqual({ correct: false, close: false });
    expect(evaluate(word, { kind: "short_text", text: "Photosynthesis" }).correct).toBe(true);
    expect(evaluate(word, { kind: "short_text", text: "photosynthesys" })).toEqual({ correct: false, close: true });
  });

  it("calls an ordering with one swap close", () => {
    expect(evaluate(ordering, { kind: "ordering", order: ["a", "b", "c", "d"] }).correct).toBe(true);
    expect(evaluate(ordering, { kind: "ordering", order: ["a", "c", "b", "d"] })).toEqual({ correct: false, close: true });
    expect(evaluate(ordering, { kind: "ordering", order: ["d", "c", "b", "a"] })).toEqual({ correct: false, close: false });
  });
});

describe("toPublicItem", () => {
  it("never leaks answer keys or explanations", () => {
    for (const item of items.values()) {
      const json = JSON.stringify(toPublicItem(item));
      for (const key of ['"answer"', '"acceptedAnswers"', '"tolerance"', '"explanation"']) expect(json).not.toContain(key);
    }
  });
});

const fractions = courseBySlug("fractions-foundations")!;

function answerCorrectly(sessionId: string, itemId: string, clientAttemptId?: string) {
  const item = items.get(itemId)!;
  return recordAttempt(DEMO_STUDENT_ID, {
    itemId,
    sessionId,
    response: correctResponseOf(item),
    hintsUsed: 0,
    durationMs: 12_000,
    ...(clientAttemptId ? { clientAttemptId } : {}),
  });
}

describe("recordAttempt", () => {
  it("is idempotent on clientAttemptId", () => {
    const itemId = itemsByCourse.get(fractions.course.id)![0]!;
    const before = progressSummary(DEMO_STUDENT_ID).totalXp;
    const input = { itemId, sessionId: null, response: correctResponseOf(items.get(itemId)!), hintsUsed: 0, durationMs: 5000, clientAttemptId: crypto.randomUUID() };
    const first = recordAttempt(DEMO_STUDENT_ID, input);
    const second = recordAttempt(DEMO_STUDENT_ID, input);
    expect(second).toBe(first);
    expect(first.correct).toBe(true);
    expect(progressSummary(DEMO_STUDENT_ID).totalXp).toBe(before + first.xpEarned);
  });

  it("rejects responses of the wrong kind", () => {
    const mcId = [...items.values()].find((item) => item.kind === "multiple_choice")!.id;
    expect(() => recordAttempt(DEMO_STUDENT_ID, { itemId: mcId, sessionId: null, response: { kind: "numeric", value: 1 }, hintsUsed: 0, durationMs: 1 })).toThrow(MockHttpError);
  });

  it("updates mastery for the item's skill", () => {
    const itemId = itemsByCourse.get(fractions.course.id)!.at(-1)!;
    const result = recordAttempt(DEMO_STUDENT_ID, { itemId, sessionId: null, response: correctResponseOf(items.get(itemId)!), hintsUsed: 0, durationMs: 9000 });
    expect(result.mastery.skillId).toBe(items.get(itemId)!.skillId);
    expect(result.mastery.attempts).toBeGreaterThan(0);
    expect(courseMastery(DEMO_STUDENT_ID, fractions.course.id).find((m) => m.skillId === result.mastery.skillId)?.attempts).toBe(result.mastery.attempts);
  });
});

describe("sessions", () => {
  it("never serves the same item twice and ends at the target", () => {
    let response = startSession(DEMO_STUDENT_ID, { courseId: fractions.course.id, kind: "practice", targetItems: 8 });
    const sessionId = response.session.id;
    const served: string[] = [];
    while (response.item) {
      // Asking again before answering returns the same item rather than a new one.
      expect(nextItem(DEMO_STUDENT_ID, sessionId).item?.id).toBe(response.item.id);
      served.push(response.item.id);
      answerCorrectly(sessionId, response.item.id);
      response = nextItem(DEMO_STUDENT_ID, sessionId);
    }
    expect(served).toHaveLength(8);
    expect(new Set(served).size).toBe(8);
    expect(response.progress).toEqual({ answered: 8, target: 8 });
  });

  it("probes every skill once before repeating one in a diagnostic", () => {
    const skillCount = fractions.units.flatMap((unit) => unit.skills).length;
    let response = startSession(DEMO_STUDENT_ID, { courseId: fractions.course.id, kind: "diagnostic", targetItems: skillCount });
    expect(response.rationale).toMatch(/starting point/);
    const probed: string[] = [];
    while (response.item) {
      probed.push(skills.get(response.item.skillId)!.code);
      answerCorrectly(response.session.id, response.item.id);
      response = nextItem(DEMO_STUDENT_ID, response.session.id);
    }
    expect(new Set(probed).size).toBe(skillCount);
  });

  it("hides other learners' sessions", () => {
    const response = startSession(DEMO_STUDENT_ID, { courseId: fractions.course.id, kind: "practice" });
    expect(() => nextItem(crypto.randomUUID(), response.session.id)).toThrow(MockHttpError);
  });
});

describe("refresh token rotation", () => {
  it("rotates once and revokes the whole family when an old token is reused", () => {
    const first = issueTokens(DEMO_STUDENT_ID);
    const second = rotateRefreshToken(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    expect(() => rotateRefreshToken(first.refreshToken)).toThrow(MockHttpError);
    // The reuse revoked the family, so the newest token is dead too.
    expect(() => rotateRefreshToken(second.refreshToken)).toThrow(MockHttpError);
  });
});
