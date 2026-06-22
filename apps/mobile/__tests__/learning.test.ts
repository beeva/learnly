import { randomUUID } from "node:crypto";
import { initialMastery } from "@learnly/adaptive-engine";
import { asId, type ItemId, type PublicItem, type SkillId, type SkillMastery } from "@learnly/shared";
import type { CachedItem } from "../src/db/repo";
import type { AttemptMeta } from "../src/sync/outbox";
import {
  chooseOfflineItem,
  normalizeText,
  pickEncouragement,
  replayEvidence,
  scoreWithKey,
} from "../src/offline/learning";
import { moveEntry, parseNumericInput } from "../src/components/ItemView";

describe("scoreWithKey", () => {
  it("scores multiple choice by choice id", () => {
    expect(scoreWithKey({ kind: "multiple_choice", choiceId: "b" }, { kind: "multiple_choice", choiceId: "b" })).toEqual({
      correct: true,
      close: false,
    });
    expect(scoreWithKey({ kind: "multiple_choice", choiceId: "a" }, { kind: "multiple_choice", choiceId: "b" }).correct).toBe(false);
  });

  it("accepts numerically equal answers and flags near misses", () => {
    expect(scoreWithKey({ kind: "numeric", value: 0.75 }, { kind: "numeric", value: 0.75 }).correct).toBe(true);
    expect(scoreWithKey({ kind: "numeric", value: 3 / 4 }, { kind: "numeric", value: 0.75 }).correct).toBe(true);
    expect(scoreWithKey({ kind: "numeric", value: 12 }, { kind: "numeric", value: 12.5 })).toEqual({
      correct: false,
      close: true,
    });
    expect(scoreWithKey({ kind: "numeric", value: 40 }, { kind: "numeric", value: 12.5 }).close).toBe(false);
  });

  it("forgives case, accents, punctuation and spacing in short text", () => {
    expect(normalizeText("  Photosynthesis. ")).toBe("photosynthesis");
    expect(normalizeText("Canción")).toBe("cancion");
    expect(scoreWithKey({ kind: "short_text", text: "The  Mitochondria!" }, { kind: "short_text", text: "the mitochondria" }).correct).toBe(true);
    expect(scoreWithKey({ kind: "short_text", text: "evaporatoin" }, { kind: "short_text", text: "evaporation" })).toEqual({
      correct: false,
      close: false,
    });
    expect(scoreWithKey({ kind: "short_text", text: "evaporaton" }, { kind: "short_text", text: "evaporation" }).close).toBe(true);
  });

  it("requires the full order and calls one swap 'close'", () => {
    const key = { kind: "ordering" as const, order: ["a", "b", "c", "d"] };
    expect(scoreWithKey({ kind: "ordering", order: ["a", "b", "c", "d"] }, key).correct).toBe(true);
    expect(scoreWithKey({ kind: "ordering", order: ["a", "b", "d", "c"] }, key)).toEqual({ correct: false, close: true });
    expect(scoreWithKey({ kind: "ordering", order: ["d", "c", "b", "a"] }, key).close).toBe(false);
  });

  it("never matches a response against a key of another kind", () => {
    expect(scoreWithKey({ kind: "numeric", value: 1 }, { kind: "short_text", text: "1" }).correct).toBe(false);
  });
});

describe("parseNumericInput", () => {
  it.each([
    ["0.75", 0.75],
    ["3/4", 0.75],
    ["1 1/2", 1.5],
    ["-2 1/4", -2.25],
    ["2,5", 2.5],
    [".5", 0.5],
  ])("parses %s", (raw, expected) => {
    expect(parseNumericInput(raw)).toBeCloseTo(expected);
  });

  it.each(["", "abc", "3/0", "1e5", "4/"])("rejects %p", (raw) => {
    expect(parseNumericInput(raw)).toBeNull();
  });
});

describe("moveEntry", () => {
  it("moves an entry and clamps out-of-range targets", () => {
    expect(moveEntry(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveEntry(["a", "b", "c"], 2, -4)).toEqual(["c", "a", "b"]);
  });

  it("returns the same array for no-op moves", () => {
    const order = ["a", "b"];
    expect(moveEntry(order, 1, 1)).toBe(order);
    expect(moveEntry(order, 5, 0)).toBe(order);
  });
});

describe("pickEncouragement", () => {
  const base = { close: false, hintsUsed: 0, expectedSuccess: 0.75, correctInRow: 1, missesInRow: 0 };

  it("celebrates mastery first, then streaks, hints and hard items", () => {
    expect(pickEncouragement({ ...base, correct: true, masteredSkillName: "Equivalent fractions" })).toEqual({
      key: "mastered",
      values: { skill: "Equivalent fractions" },
    });
    expect(pickEncouragement({ ...base, correct: true, correctInRow: 4 })).toEqual({
      key: "correct_streak",
      values: { count: 4 },
    });
    expect(pickEncouragement({ ...base, correct: true, hintsUsed: 1 }).key).toBe("correct_after_hint");
    expect(pickEncouragement({ ...base, correct: true, expectedSuccess: 0.4 }).key).toBe("correct_hard");
    expect(pickEncouragement({ ...base, correct: true }).key).toBe("correct");
  });

  it("keeps misses warm and specific", () => {
    expect(pickEncouragement({ ...base, correct: false, close: true }).key).toBe("incorrect_close");
    expect(pickEncouragement({ ...base, correct: false }).key).toBe("incorrect_first");
    expect(pickEncouragement({ ...base, correct: false, missesInRow: 2 }).key).toBe("incorrect_again");
  });
});

const SKILL_A = asId<SkillId>("11111111-1111-4111-8111-111111111111");
const SKILL_B = asId<SkillId>("22222222-2222-4222-8222-222222222222");

function cachedItem(skillId: SkillId, difficulty: number, scorable: boolean): CachedItem {
  const item: PublicItem = {
    id: asId<ItemId>(randomUUID()),
    skillId,
    kind: "multiple_choice",
    prompt: "Which fraction is equivalent to 1/2?",
    difficulty,
    hints: ["Multiply the top and bottom by the same number."],
    choices: [
      { id: "a", text: "2/4" },
      { id: "b", text: "2/3" },
    ],
  };
  return { item, key: scorable ? { kind: "multiple_choice", choiceId: "a" } : null, explanation: null };
}

function evidence(skillId: SkillId, correct: boolean | null, minute: number): AttemptMeta {
  return {
    kind: "attempt",
    skillId,
    difficulty: 0.5,
    correct,
    hintsUsed: 0,
    answeredAt: new Date(Date.UTC(2024, 8, 1, 10, minute)).toISOString(),
  };
}

describe("replayEvidence", () => {
  it("layers unconfirmed local attempts on top of server mastery", () => {
    const server: SkillMastery[] = [{ ...initialMastery(SKILL_A), attempts: 3, band: "learning" }];
    const map = replayEvidence(server, [evidence(SKILL_A, true, 1), evidence(SKILL_A, true, 2)]);
    const a = map.get(SKILL_A);
    expect(a?.attempts).toBe(5);
    expect(a?.ability).toBeGreaterThan(server[0]!.ability);
    expect(a?.lastPracticedAt).toBe(new Date(Date.UTC(2024, 8, 1, 10, 2)).toISOString());
  });

  it("creates mastery for skills the server hasn't reported and skips unscored attempts", () => {
    const map = replayEvidence([], [evidence(SKILL_B, false, 1), evidence(SKILL_B, null, 2)]);
    expect(map.get(SKILL_B)?.attempts).toBe(1);
    expect(map.get(SKILL_B)?.band).toBe("learning");
  });

  it("does not mutate the server rows", () => {
    const row = initialMastery(SKILL_A);
    replayEvidence([row], [evidence(SKILL_A, true, 1)]);
    expect(row.attempts).toBe(0);
  });
});

describe("chooseOfflineItem", () => {
  const noHistory = { itemIds: [], skillIds: [], correct: [] };

  it("prefers items that can be scored on the device", () => {
    const pool = [cachedItem(SKILL_A, 0, false), cachedItem(SKILL_A, 0.2, true), cachedItem(SKILL_B, -0.4, false)];
    const pick = chooseOfflineItem(pool, new Map(), noHistory, () => 0);
    expect(pick?.scorable).toBe(true);
    expect(pick?.item.id).toBe(pool[1]!.item.id);
  });

  it("falls back to unscored items when nothing has a key yet", () => {
    const pool = [cachedItem(SKILL_A, 0, false)];
    expect(chooseOfflineItem(pool, new Map(), noHistory)?.scorable).toBe(false);
  });

  it("never repeats an item from this session", () => {
    const pool = [cachedItem(SKILL_A, 0, true), cachedItem(SKILL_A, 0.1, true)];
    const first = chooseOfflineItem(pool, new Map(), noHistory)!;
    const second = chooseOfflineItem(pool, new Map(), {
      itemIds: [first.item.id],
      skillIds: [first.item.skillId],
      correct: [true],
    });
    expect(second?.item.id).not.toBe(first.item.id);
    expect(
      chooseOfflineItem(pool, new Map(), { itemIds: pool.map((p) => p.item.id), skillIds: [], correct: [] }),
    ).toBeNull();
  });

  it("selects from 5,000 cached items in under 50ms", () => {
    const pool = Array.from({ length: 5000 }, (_, i) =>
      cachedItem(i % 2 ? SKILL_A : SKILL_B, ((i % 60) - 30) / 10, i % 3 !== 0),
    );
    const mastery = new Map<SkillId, SkillMastery>([[SKILL_A, { ...initialMastery(SKILL_A), ability: 0.8, attempts: 6 }]]);
    const started = performance.now();
    const pick = chooseOfflineItem(pool, mastery, noHistory);
    const elapsed = performance.now() - started;
    expect(pick).not.toBeNull();
    expect(elapsed).toBeLessThan(50);
  });
});
