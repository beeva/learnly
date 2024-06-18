import { asId, type ItemId, type PublicItem, type SkillId } from "@learnly/shared";
import { describe, expect, it } from "vitest";
import { describeResponse, draftProblem, emptyDraft, move, parseNumeric, toResponse } from "./responses";

const base = { skillId: asId<SkillId>("s1"), prompt: "Prompt", difficulty: 0, hints: [] as string[] };

const mc: PublicItem = { ...base, id: asId<ItemId>("i1"), kind: "multiple_choice", choices: [{ id: "a", text: "1/2" }, { id: "b", text: "3/4" }] };
const numeric: PublicItem = { ...base, id: asId<ItemId>("i2"), kind: "numeric", unit: "pieces" };
const shortText: PublicItem = { ...base, id: asId<ItemId>("i3"), kind: "short_text" };
const ordering: PublicItem = {
  ...base,
  id: asId<ItemId>("i4"),
  kind: "ordering",
  entries: [
    { id: "e1", text: "1/8" },
    { id: "e2", text: "1/4" },
    { id: "e3", text: "1/2" },
  ],
};

describe("parseNumeric", () => {
  it.each([
    ["12", 12],
    ["-3", -3],
    ["-3.5", -3.5],
    ["3,5", 3.5],
    [".5", 0.5],
    ["3/4", 0.75],
    [" 1 000 ", 1000],
    ["-1/2", -0.5],
  ])("parses %j as %d", (raw, expected) => {
    expect(parseNumeric(raw)).toBeCloseTo(expected);
  });

  it.each(["", "   ", "abc", "-", "1/0", "3..4", "12a", "1/2/3"])("rejects %j", (raw) => {
    expect(parseNumeric(raw)).toBeNull();
  });
});

describe("emptyDraft", () => {
  it("starts ordering drafts in the order the server sent", () => {
    expect(emptyDraft(ordering)).toEqual({ kind: "ordering", order: ["e1", "e2", "e3"], touched: false });
  });

  it("starts every other kind empty", () => {
    expect(emptyDraft(mc)).toEqual({ kind: "multiple_choice", choiceId: null });
    expect(emptyDraft(numeric)).toEqual({ kind: "numeric", raw: "" });
    expect(emptyDraft(shortText)).toEqual({ kind: "short_text", text: "" });
  });
});

describe("toResponse and draftProblem", () => {
  it("requires a choice for multiple choice", () => {
    expect(toResponse({ kind: "multiple_choice", choiceId: null })).toBeNull();
    expect(draftProblem({ kind: "multiple_choice", choiceId: null })).toBe("choose");
    expect(toResponse({ kind: "multiple_choice", choiceId: "b" })).toEqual({ kind: "multiple_choice", choiceId: "b" });
    expect(draftProblem({ kind: "multiple_choice", choiceId: "b" })).toBeNull();
  });

  it("distinguishes an empty numeric answer from one that isn't a number", () => {
    expect(draftProblem({ kind: "numeric", raw: "" })).toBe("empty");
    expect(draftProblem({ kind: "numeric", raw: "three" })).toBe("number");
    expect(toResponse({ kind: "numeric", raw: "6/8" })).toEqual({ kind: "numeric", value: 0.75 });
  });

  it("trims short text and rejects whitespace-only answers", () => {
    expect(toResponse({ kind: "short_text", text: "   " })).toBeNull();
    expect(draftProblem({ kind: "short_text", text: "  " })).toBe("empty");
    expect(toResponse({ kind: "short_text", text: "  denominator " })).toEqual({ kind: "short_text", text: "denominator" });
  });

  it("submits orderings of two or more entries", () => {
    expect(toResponse({ kind: "ordering", order: ["e2", "e1"], touched: true })).toEqual({ kind: "ordering", order: ["e2", "e1"] });
    expect(toResponse({ kind: "ordering", order: ["e1"], touched: true })).toBeNull();
  });
});

describe("describeResponse", () => {
  it("uses choice text for multiple choice", () => {
    expect(describeResponse(mc, { kind: "multiple_choice", choiceId: "b" })).toBe("3/4");
    expect(describeResponse(mc, { kind: "multiple_choice", choiceId: "zz" })).toBe("zz");
  });

  it("appends the unit for numeric answers", () => {
    expect(describeResponse(numeric, { kind: "numeric", value: 3 })).toBe("3 pieces");
  });

  it("returns short text as written", () => {
    expect(describeResponse(shortText, { kind: "short_text", text: "3/9" })).toBe("3/9");
  });

  it("joins ordering entries with arrows", () => {
    expect(describeResponse(ordering, { kind: "ordering", order: ["e1", "e2", "e3"] })).toBe("1/8 → 1/4 → 1/2");
  });
});

describe("move", () => {
  it("moves an entry without mutating the input", () => {
    const list = ["a", "b", "c", "d"];
    expect(move(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(move(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores out-of-range moves", () => {
    expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(move(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});
