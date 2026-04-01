import type { ItemId, SkillId, SkillMastery } from "@learnly/shared";
import { initialMastery } from "../src/mastery.js";
import { selectNextItem, type Candidate } from "../src/select.js";

/**
 * Selection runs on every "next item" request (and on-device when offline), so it
 * must stay well under a millisecond for a realistic course-sized item bank.
 */
const skills = Array.from({ length: 40 }, (_, i) => `skill-${i}` as SkillId);
const items: Candidate[] = skills.flatMap((skillId, s) =>
  Array.from({ length: 25 }, (_, i) => ({
    id: `item-${s}-${i}` as ItemId,
    skillId,
    difficulty: -3 + (6 * i) / 24,
  })),
);
const mastery = new Map<SkillId, SkillMastery>(
  skills.map((id, i) => [id, { ...initialMastery(id), ability: Math.sin(i), attempts: i % 7 }]),
);

const iterations = 5000;
const recentItemIds = items.slice(0, 20).map((i) => i.id);
const started = performance.now();
for (let i = 0; i < iterations; i++) {
  selectNextItem(items, mastery, { recentItemIds, recentSkillIds: skills.slice(0, 3) });
}
const perCall = (performance.now() - started) / iterations;
console.log(`selectNextItem over ${items.length} items: ${(perCall * 1000).toFixed(1)}µs/call`);
