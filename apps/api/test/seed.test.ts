import { describe, expect, it } from "vitest";
import { isUuid, type Item } from "@learnly/shared";
import { earthScience } from "../src/db/seed/earth-science.js";
import { fractions } from "../src/db/seed/fractions.js";
import { SEED_COURSES } from "../src/db/seed/index.js";
import { preAlgebra } from "../src/db/seed/pre-algebra.js";
import { readingDetectives } from "../src/db/seed/reading.js";
import { SEED_RULES, materializeCourse, seedId } from "../src/db/seed/types.js";
import { correctResponseFor, scoreResponse } from "../src/lib/scoring.js";
import { wrongResponseFor } from "./support/harness.js";

const courses = [fractions, preAlgebra, readingDetectives, earthScience];
const content = courses.map(materializeCourse);

describe("seed content", () => {
  it("registers every course for seeding, in display order", () => {
    expect(SEED_COURSES.map((course) => course.slug)).toEqual(courses.map((course) => course.slug));
  });

  it.each(content.map((c) => [c.course.title, c] as const))("%s gives every skill enough varied practice", (_title, course) => {
    for (const skill of course.skills) {
      const items = course.items.filter((item) => item.skillId === skill.id);
      expect(items.length, skill.code).toBeGreaterThanOrEqual(SEED_RULES.minItemsPerSkill);
      expect(new Set(items.map((item) => item.kind)), skill.code).toEqual(new Set(SEED_RULES.kinds));
      expect(course.lessons.some((lesson) => lesson.skillId === skill.id), skill.code).toBe(true);
    }
  });

  it("has an answer key that scores its own answers correctly", () => {
    const items: Item[] = content.flatMap((course) => course.items);
    expect(items.length).toBeGreaterThan(130);
    for (const item of items) {
      expect(scoreResponse(item, correctResponseFor(item)).correct, item.prompt).toBe(true);
      expect(scoreResponse(item, wrongResponseFor(item)).correct, item.prompt).toBe(false);
      if (item.kind === "multiple_choice") expect(item.choices.map((c) => c.id)).toContain(item.answer);
      if (item.kind === "ordering") {
        expect(new Set(item.entries.map((e) => e.id))).toEqual(new Set(item.answer));
        expect(item.entries.map((e) => e.id), "learners must not see the answer order").not.toEqual(item.answer);
      }
    }
  });

  it("only checks items that belong to the lesson's skill", () => {
    for (const course of content) {
      const skillOf = new Map(course.items.map((item) => [item.id, item.skillId]));
      for (const lesson of course.lessons) {
        for (const block of lesson.blocks) {
          if (block.kind === "check") expect(skillOf.get(block.itemId), lesson.slug).toBe(lesson.skillId);
        }
      }
    }
  });

  it("uses globally unique, stable ids and slugs", () => {
    const ids = content.flatMap((c) => [c.course.id, ...c.units.map((u) => u.id), ...c.skills.map((s) => s.id), ...c.lessons.map((l) => l.id), ...c.items.map((i) => i.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isUuid)).toBe(true);
    const slugs = content.flatMap((c) => c.lessons.map((l) => l.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(seedId("course", "fractions-foundations")).toBe(materializeCourse(fractions).course.id);
  });

  it("has an acyclic prerequisite graph", () => {
    for (const course of content) {
      const prerequisites = new Map(course.skills.map((skill) => [skill.id, skill.prerequisiteIds]));
      const visiting = new Set<string>();
      const done = new Set<string>();
      const visit = (id: string): void => {
        if (done.has(id)) return;
        expect(visiting.has(id), `cycle through ${id}`).toBe(false);
        visiting.add(id);
        for (const next of prerequisites.get(id as never) ?? []) visit(next);
        visiting.delete(id);
        done.add(id);
      };
      for (const skill of course.skills) visit(skill.id);
    }
  });
});
