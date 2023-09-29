import { createHash } from "node:crypto";
import type {
  Course,
  CourseId,
  GradeBand,
  Item,
  ItemId,
  ItemKind,
  Lesson,
  LessonBlock,
  LessonId,
  Skill,
  SkillId,
  Subject,
  Unit,
  UnitId,
} from "@learnly/shared";

/**
 * Seed content is authored with human-readable keys and turned into stable UUIDs, so
 * re-running the seed updates rows in place instead of duplicating them, and a lesson's
 * check block can reference an item before either exists in the database.
 */
export function seedId(namespace: string, key: string): string {
  const hash = createHash("sha1").update(`learnly:${namespace}:${key}`).digest();
  // Shape it like an RFC 4122 version-5 UUID so every validator accepts it.
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

type WithoutIds<T> = T extends unknown ? Omit<T, "id" | "skillId"> : never;

export type SeedItem = WithoutIds<Item> & { key: string };

/** Lesson blocks, except check blocks point at an item key within the same skill. */
export type SeedBlock = Exclude<LessonBlock, { kind: "check" }> | { kind: "check"; item: string };

export interface SeedLesson {
  slug: string;
  title: string;
  level: Lesson["level"];
  estimatedMinutes: number;
  blocks: SeedBlock[];
}

export interface SeedSkill {
  code: string;
  name: string;
  /** Codes of skills (in the same course) that should come first. */
  prerequisites?: string[];
  lessons: SeedLesson[];
  items: SeedItem[];
}

export interface SeedUnit {
  title: string;
  summary: string;
  skills: SeedSkill[];
}

export interface SeedCourse {
  slug: string;
  title: string;
  subject: Subject;
  gradeBand: GradeBand;
  description: string;
  coverHue: number;
  position: number;
  units: SeedUnit[];
}

interface ItemSpec {
  prompt: string;
  /** Logit scale: about -2 (warm-up) to +2 (stretch). */
  difficulty: number;
  hints: string[];
  explanation: string;
}

const CHOICE_IDS = ["a", "b", "c", "d", "e", "f"];

export function mc(key: string, spec: ItemSpec & { choices: string[]; correct: number }): SeedItem {
  const choices = spec.choices.map((text, index) => ({ id: CHOICE_IDS[index] ?? `c${index}`, text }));
  const answer = choices[spec.correct]?.id;
  if (answer === undefined) throw new Error(`Seed item ${key}: correct choice ${spec.correct} is out of range`);
  // Rotate so the right answer isn't always "a", deterministically per item.
  const offset = (seedId("choice", key).charCodeAt(0) + spec.correct) % choices.length;
  const shuffled = [...choices.slice(offset), ...choices.slice(0, offset)];
  return {
    key,
    kind: "multiple_choice",
    prompt: spec.prompt,
    difficulty: spec.difficulty,
    hints: spec.hints,
    explanation: spec.explanation,
    choices: shuffled,
    answer,
  };
}

export function num(key: string, spec: ItemSpec & { answer: number; tolerance?: number; unit?: string }): SeedItem {
  return {
    key,
    kind: "numeric",
    prompt: spec.prompt,
    difficulty: spec.difficulty,
    hints: spec.hints,
    explanation: spec.explanation,
    answer: spec.answer,
    tolerance: spec.tolerance ?? 0,
    ...(spec.unit ? { unit: spec.unit } : {}),
  };
}

export function text(key: string, spec: ItemSpec & { accept: string[] }): SeedItem {
  return {
    key,
    kind: "short_text",
    prompt: spec.prompt,
    difficulty: spec.difficulty,
    hints: spec.hints,
    explanation: spec.explanation,
    acceptedAnswers: spec.accept,
  };
}

/** `steps` are listed in the correct order; learners see them shuffled. */
export function order(key: string, spec: ItemSpec & { steps: string[] }): SeedItem {
  const entries = spec.steps.map((step, index) => ({ id: `s${index + 1}`, text: step }));
  // Rotate then mirror: for 3+ steps that can never reproduce the correct order.
  const shift = 1 + (seedId("order", key).charCodeAt(1) % Math.max(1, entries.length - 1));
  const shown =
    entries.length === 2 ? [...entries].reverse() : [...entries.slice(shift), ...entries.slice(0, shift)].reverse();
  return {
    key,
    kind: "ordering",
    prompt: spec.prompt,
    difficulty: spec.difficulty,
    hints: spec.hints,
    explanation: spec.explanation,
    entries: shown,
    answer: entries.map((entry) => entry.id),
  };
}

export interface MaterializedCourse {
  course: Course & { position: number };
  units: (Omit<Unit, "skills"> & { position: number })[];
  skills: (Skill & { position: number })[];
  lessons: (Lesson & { position: number })[];
  items: Item[];
}

export const SEED_RULES = {
  minItemsPerSkill: 6,
  kinds: ["multiple_choice", "numeric", "short_text", "ordering"] as ItemKind[],
  difficultyRange: [-3, 3] as const,
};

/** Every content rule a skill must satisfy before it can ship. */
export function validateSkill(skill: SeedSkill, knownCodes: Set<string>): string[] {
  const problems: string[] = [];
  const where = `skill ${skill.code}`;
  if (skill.items.length < SEED_RULES.minItemsPerSkill) {
    problems.push(`${where} has ${skill.items.length} items; needs ${SEED_RULES.minItemsPerSkill}`);
  }
  for (const kind of SEED_RULES.kinds) {
    if (!skill.items.some((item) => item.kind === kind)) problems.push(`${where} has no ${kind} item`);
  }
  const keys = new Set<string>();
  for (const item of skill.items) {
    if (keys.has(item.key)) problems.push(`${where} repeats item key ${item.key}`);
    keys.add(item.key);
    const [min, max] = SEED_RULES.difficultyRange;
    if (item.difficulty < min || item.difficulty > max) problems.push(`${item.key} difficulty out of range`);
    if (item.hints.length === 0) problems.push(`${item.key} has no hints`);
    if (item.explanation.trim().length < 10) problems.push(`${item.key} needs an explanation`);
  }
  if (skill.lessons.length === 0) problems.push(`${where} has no lesson`);
  for (const lesson of skill.lessons) {
    for (const block of lesson.blocks) {
      if (block.kind === "check" && !keys.has(block.item)) {
        problems.push(`lesson ${lesson.slug} checks unknown item ${block.item}`);
      }
    }
  }
  for (const code of skill.prerequisites ?? []) {
    if (!knownCodes.has(code)) problems.push(`${where} requires unknown skill ${code}`);
  }
  return problems;
}

/** Resolve keys into ids and shape seed content exactly like the API returns it. */
export function materializeCourse(seed: SeedCourse): MaterializedCourse {
  const codes = new Set(seed.units.flatMap((unit) => unit.skills.map((skill) => skill.code)));
  const problems = seed.units.flatMap((unit) => unit.skills.flatMap((skill) => validateSkill(skill, codes)));
  if (problems.length > 0) throw new Error(`Seed course ${seed.slug} is invalid:\n  ${problems.join("\n  ")}`);

  const courseId = seedId("course", seed.slug) as CourseId;
  const skillId = (code: string) => seedId("skill", code) as SkillId;
  const itemId = (code: string, key: string) => seedId("item", `${code}:${key}`) as ItemId;

  const result: MaterializedCourse = {
    course: {
      id: courseId,
      slug: seed.slug,
      title: seed.title,
      subject: seed.subject,
      gradeBand: seed.gradeBand,
      description: seed.description,
      coverHue: seed.coverHue,
      unitCount: seed.units.length,
      estimatedMinutes: 0,
      position: seed.position,
    },
    units: [],
    skills: [],
    lessons: [],
    items: [],
  };

  seed.units.forEach((unit, unitIndex) => {
    const unitId = seedId("unit", `${seed.slug}:${unitIndex + 1}`) as UnitId;
    result.units.push({ id: unitId, courseId, position: unitIndex + 1, title: unit.title, summary: unit.summary });
    unit.skills.forEach((skill, skillIndex) => {
      result.skills.push({
        id: skillId(skill.code),
        unitId,
        code: skill.code,
        name: skill.name,
        prerequisiteIds: (skill.prerequisites ?? []).map(skillId),
        position: skillIndex + 1,
      });
      for (const { key, ...item } of skill.items) {
        result.items.push({ ...item, id: itemId(skill.code, key), skillId: skillId(skill.code) } as Item);
      }
      skill.lessons.forEach((lesson, lessonIndex) => {
        const blocks = lesson.blocks.map((block): LessonBlock =>
          block.kind === "check" ? { kind: "check", itemId: itemId(skill.code, block.item) } : block,
        );
        result.lessons.push({
          id: seedId("lesson", lesson.slug) as LessonId,
          skillId: skillId(skill.code),
          slug: lesson.slug,
          title: lesson.title,
          level: lesson.level,
          estimatedMinutes: lesson.estimatedMinutes,
          blocks,
          position: lessonIndex + 1,
        });
        result.course.estimatedMinutes += lesson.estimatedMinutes;
      });
    });
  });
  return result;
}
