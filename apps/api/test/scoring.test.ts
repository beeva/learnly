import { describe, expect, it } from "vitest";
import type { Item, ItemId, SkillId } from "@learnly/shared";
import { levenshtein, normalizeText, scoreResponse } from "../src/lib/scoring.js";

const base = {
  id: "00000000-0000-4000-8000-000000000001" as ItemId,
  skillId: "00000000-0000-4000-8000-000000000002" as SkillId,
  prompt: "",
  difficulty: 0,
  hints: ["think"],
  explanation: "because",
};

const multipleChoice: Item = {
  ...base,
  kind: "multiple_choice",
  choices: [
    { id: "a", text: "2/4" },
    { id: "b", text: "2/8" },
  ],
  answer: "a",
};

const numeric: Item = { ...base, kind: "numeric", answer: 0.75, tolerance: 0.01 };
const integer: Item = { ...base, kind: "numeric", answer: -4, tolerance: 0 };
const shortText: Item = { ...base, kind: "short_text", acceptedAnswers: ["3/4", "three quarters"] };
const longWord: Item = { ...base, kind: "short_text", acceptedAnswers: ["metamorphic"] };
const ordering: Item = {
  ...base,
  kind: "ordering",
  entries: [
    { id: "s3", text: "c" },
    { id: "s1", text: "a" },
    { id: "s4", text: "d" },
    { id: "s2", text: "b" },
  ],
  answer: ["s1", "s2", "s3", "s4"],
};

describe("scoreResponse", () => {
  it("scores multiple choice by choice id and returns the right choice", () => {
    expect(scoreResponse(multipleChoice, { kind: "multiple_choice", choiceId: "a" })).toMatchObject({ correct: true });
    const wrong = scoreResponse(multipleChoice, { kind: "multiple_choice", choiceId: "b" });
    expect(wrong.correct).toBe(false);
    expect(wrong.correctResponse).toEqual({ kind: "multiple_choice", choiceId: "a" });
  });

  it("accepts numeric answers within tolerance, including float noise", () => {
    expect(scoreResponse(numeric, { kind: "numeric", value: 0.75 }).correct).toBe(true);
    expect(scoreResponse(numeric, { kind: "numeric", value: 0.759 }).correct).toBe(true);
    expect(scoreResponse(numeric, { kind: "numeric", value: 0.77 }).correct).toBe(false);
    const exact: Item = { ...base, kind: "numeric", answer: 0.3, tolerance: 0 };
    expect(scoreResponse(exact, { kind: "numeric", value: 0.1 + 0.2 }).correct).toBe(true);
  });

  it("flags near misses and sign slips as close", () => {
    expect(scoreResponse(numeric, { kind: "numeric", value: 0.8 })).toMatchObject({ correct: false, close: true });
    expect(scoreResponse(integer, { kind: "numeric", value: 4 })).toMatchObject({ correct: false, close: true });
    expect(scoreResponse(integer, { kind: "numeric", value: 40 })).toMatchObject({ correct: false, close: false });
  });

  it("normalises case, whitespace, curly quotes and trailing punctuation in short text", () => {
    expect(scoreResponse(shortText, { kind: "short_text", text: "  3/4 " }).correct).toBe(true);
    expect(scoreResponse(shortText, { kind: "short_text", text: "Three   Quarters." }).correct).toBe(true);
    expect(scoreResponse(shortText, { kind: "short_text", text: "“three quarters”" }).correct).toBe(true);
    expect(scoreResponse(shortText, { kind: "short_text", text: "" }).correct).toBe(false);
    expect(scoreResponse(shortText, { kind: "short_text", text: "3/5" })).toMatchObject({ correct: false, close: true });
  });

  it("forgives one typo in long words only", () => {
    expect(scoreResponse(longWord, { kind: "short_text", text: "metamorpic" }).correct).toBe(true);
    const cat: Item = { ...base, kind: "short_text", acceptedAnswers: ["cat"] };
    expect(scoreResponse(cat, { kind: "short_text", text: "car" })).toMatchObject({ correct: false, close: true });
  });

  it("treats numerically equal text answers as equal", () => {
    const half: Item = { ...base, kind: "short_text", acceptedAnswers: ["0.5"] };
    expect(scoreResponse(half, { kind: "short_text", text: ".5" }).correct).toBe(true);
  });

  it("requires orderings to match exactly, calling an adjacent swap close", () => {
    expect(scoreResponse(ordering, { kind: "ordering", order: ["s1", "s2", "s3", "s4"] }).correct).toBe(true);
    expect(scoreResponse(ordering, { kind: "ordering", order: ["s2", "s1", "s3", "s4"] })).toMatchObject({
      correct: false,
      close: true,
    });
    expect(scoreResponse(ordering, { kind: "ordering", order: ["s4", "s3", "s2", "s1"] })).toMatchObject({
      correct: false,
      close: false,
    });
    expect(scoreResponse(ordering, { kind: "ordering", order: ["s1", "s2", "s3"] }).correct).toBe(false);
  });

  it("never credits a response of the wrong kind", () => {
    expect(scoreResponse(numeric, { kind: "short_text", text: "0.75" }).correct).toBe(false);
    expect(scoreResponse(ordering, { kind: "multiple_choice", choiceId: "s1" }).correct).toBe(false);
  });
});

describe("text helpers", () => {
  it("normalises text for comparison", () => {
    expect(normalizeText("  The  Main Idea! ")).toBe("the main idea");
    expect(normalizeText("Kenji’s")).toBe("kenji's");
  });

  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});
