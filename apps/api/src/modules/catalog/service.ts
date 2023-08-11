import type { Course, Item, ItemId, Lesson, LessonId, PublicItem, SkillId, Unit } from "@learnly/shared";
import { notFound } from "../../lib/errors.js";
import type { CatalogRepository, LessonSummary } from "./repository.js";

/** Strip answer keys and explanations: the client only learns those after answering. */
export function toPublicItem(item: Item): PublicItem {
  switch (item.kind) {
    case "multiple_choice": {
      const { answer: _answer, explanation: _explanation, ...rest } = item;
      return rest;
    }
    case "numeric": {
      const { answer: _answer, tolerance: _tolerance, explanation: _explanation, ...rest } = item;
      return rest;
    }
    case "short_text": {
      const { acceptedAnswers: _accepted, explanation: _explanation, ...rest } = item;
      return rest;
    }
    case "ordering": {
      const { answer: _answer, explanation: _explanation, ...rest } = item;
      return rest;
    }
  }
}

/** Item ids referenced by a lesson's `check` blocks, in reading order, without repeats. */
export function checkItemIds(lesson: Lesson): ItemId[] {
  const ids = lesson.blocks.flatMap((block) => (block.kind === "check" ? [block.itemId] : []));
  return [...new Set(ids)];
}

export interface LessonPayload {
  lesson: Lesson;
  items: PublicItem[];
}

export class CatalogService {
  constructor(private readonly catalog: CatalogRepository) {}

  listCourses(): Promise<Course[]> {
    return this.catalog.listCourses();
  }

  async getCourse(slug: string): Promise<{ course: Course; units: Unit[] }> {
    const course = await this.catalog.findCourseBySlug(slug);
    if (!course) throw notFound("course");
    const units = await this.catalog.listUnits(course.id);
    return { course, units };
  }

  async getLesson(id: LessonId): Promise<LessonPayload> {
    const lesson = await this.catalog.findLesson(id);
    if (!lesson) throw notFound("lesson");
    const ids = checkItemIds(lesson);
    const byId = new Map((await this.catalog.findItems(ids)).map((item) => [item.id, item]));
    const items = ids.flatMap((itemId) => {
      const item = byId.get(itemId);
      return item ? [toPublicItem(item)] : [];
    });
    return { lesson, items };
  }

  async lessonsForSkill(skillId: SkillId): Promise<LessonSummary[]> {
    const skill = await this.catalog.findSkill(skillId);
    if (!skill) throw notFound("skill");
    return this.catalog.listLessonsForSkill(skillId);
  }
}
