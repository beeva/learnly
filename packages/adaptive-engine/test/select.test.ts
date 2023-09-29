import { describe, expect, it } from "vitest";
import type { ItemId, SkillId } from "@learnly/shared";
import { initialMastery } from "../src/mastery.js";
import { selectNextItem, type Candidate } from "../src/select.js";

const a = "skill-a" as SkillId;
const b = "skill-b" as SkillId;
const items: Candidate[] = [-2, -1, 0, 1, 2].flatMap((d, i) => [
  { id: `a${i}` as ItemId, skillId: a, difficulty: d },
  { id: `b${i}` as ItemId, skillId: b, difficulty: d },
]);

describe("selectNextItem", () => {
  const mastery = new Map([
    [a, { ...initialMastery(a), ability: 1, attempts: 5 }],
    [b, { ...initialMastery(b), ability: 1, attempts: 5 }],
  ]);

  it("targets roughly 75% expected success", () => {
    const pick = selectNextItem(items, mastery, { random: () => 0 })!;
    expect(pick.expectedSuccess).toBeGreaterThan(0.65);
    expect(pick.expectedSuccess).toBeLessThan(0.9);
  });

  it("never repeats an item from the session", () => {
    const all = items.map((i) => i.id);
    expect(selectNextItem(items, mastery, { recentItemIds: all })).toBeNull();
  });

  it("prefers interleaving to a different skill", () => {
    const pick = selectNextItem(items, mastery, { recentSkillIds: [a], random: () => 0 })!;
    expect(pick.item.skillId).toBe(b);
    expect(pick.reason).toBe("interleave");
  });
});

