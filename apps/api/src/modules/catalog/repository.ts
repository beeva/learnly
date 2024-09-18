import type { Candidate } from "@learnly/adaptive-engine";
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
import type { Database } from "../../db/sql.js";

export type LessonSummary = Pick<Lesson, "id" | "slug" | "title" | "level" | "estimatedMinutes">;

export interface CatalogRepository {
  listCourses(): Promise<Course[]>;
  findCourseBySlug(slug: string): Promise<Course | null>;
  findCourseById(id: CourseId): Promise<Course | null>;
  /** Units in curriculum order, each with its skills (also in order). */
  listUnits(courseId: CourseId): Promise<Unit[]>;
  findSkill(id: SkillId): Promise<Skill | null>;
  findLesson(id: LessonId): Promise<Lesson | null>;
  listLessonsForSkill(skillId: SkillId): Promise<LessonSummary[]>;
  findItem(id: ItemId): Promise<Item | null>;
  findItems(ids: ItemId[]): Promise<Item[]>;
  /** Active items of a course, trimmed to what the adaptive engine needs. */
  listCandidates(courseId: CourseId): Promise<Candidate[]>;
}

/** Kind-specific fields stored in `items.body`. */
export type ItemBody = Record<string, unknown>;

export function itemBody(item: Item): ItemBody {
  switch (item.kind) {
    case "multiple_choice":
      return { choices: item.choices, answer: item.answer };
    case "numeric":
      return { answer: item.answer, tolerance: item.tolerance, ...(item.unit ? { unit: item.unit } : {}) };
    case "short_text":
      return { acceptedAnswers: item.acceptedAnswers };
    case "ordering":
      return { entries: item.entries, answer: item.answer };
  }
}

interface ItemRow {
  id: ItemId;
  skill_id: SkillId;
  kind: ItemKind;
  prompt: string;
  difficulty: number;
  body: ItemBody;
  hints: string[];
  explanation: string;
}

/** Rebuild a typed item from its row. Bodies are written by our own seed/authoring code. */
export function toItem(row: ItemRow): Item {
  const base = {
    id: row.id,
    skillId: row.skill_id,
    prompt: row.prompt,
    difficulty: row.difficulty,
    hints: row.hints,
    explanation: row.explanation,
  };
  const body = row.body;
  switch (row.kind) {
    case "multiple_choice":
      return {
        ...base,
        kind: "multiple_choice",
        choices: body["choices"] as { id: string; text: string }[],
        answer: String(body["answer"]),
      };
    case "numeric":
      return {
        ...base,
        kind: "numeric",
        answer: Number(body["answer"]),
        tolerance: Number(body["tolerance"] ?? 0),
        ...(typeof body["unit"] === "string" ? { unit: body["unit"] } : {}),
      };
    case "short_text":
      return { ...base, kind: "short_text", acceptedAnswers: body["acceptedAnswers"] as string[] };
    case "ordering":
      return {
        ...base,
        kind: "ordering",
        entries: body["entries"] as { id: string; text: string }[],
        answer: body["answer"] as string[],
      };
  }
}

interface CourseRow {
  id: CourseId;
  slug: string;
  title: string;
  subject: Subject;
  grade_band: GradeBand;
  description: string;
  cover_hue: number;
  unit_count: number;
  estimated_minutes: number;
}

interface LessonRow {
  id: LessonId;
  skill_id: SkillId;
  slug: string;
  title: string;
  level: number;
  estimated_minutes: number;
  blocks: LessonBlock[];
  updated_at: Date;
}

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subject: row.subject,
    gradeBand: row.grade_band,
    description: row.description,
    coverHue: row.cover_hue,
    unitCount: row.unit_count,
    estimatedMinutes: row.estimated_minutes,
  };
}

export function toLessonLevel(level: number): Lesson["level"] {
  return Math.min(5, Math.max(1, Math.round(level))) as Lesson["level"];
}

export function toLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    skillId: row.skill_id,
    slug: row.slug,
    title: row.title,
    level: toLessonLevel(row.level),
    estimatedMinutes: row.estimated_minutes,
    blocks: row.blocks,
  };
}

const COURSE_SELECT = `
  select c.id, c.slug, c.title, c.subject, c.grade_band, c.description, c.cover_hue,
         (select count(*) from units u where u.course_id = c.id)::int as unit_count,
         coalesce((select sum(l.estimated_minutes)
                     from lessons l
                     join skills s on s.id = l.skill_id
                     join units u on u.id = s.unit_id
                    where u.course_id = c.id), 0)::int as estimated_minutes
    from courses c`;

const ITEM_COLUMNS = "id, skill_id, kind, prompt, difficulty, body, hints, explanation";
const LESSON_COLUMNS = "id, skill_id, slug, title, level, estimated_minutes, blocks, updated_at";

export class PgCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Database) {}

  async listCourses(): Promise<Course[]> {
    const rows = await this.db.query<CourseRow>(`${COURSE_SELECT} where c.published order by c.position, c.title`);
    return rows.map(toCourse);
  }

  async findCourseBySlug(slug: string): Promise<Course | null> {
    const row = await this.db.maybeOne<CourseRow>(`${COURSE_SELECT} where c.slug = $1 and c.published`, [slug]);
    return row ? toCourse(row) : null;
  }

  async findCourseById(id: CourseId): Promise<Course | null> {
    const row = await this.db.maybeOne<CourseRow>(`${COURSE_SELECT} where c.id = $1`, [id]);
    return row ? toCourse(row) : null;
  }

  async listUnits(courseId: CourseId): Promise<Unit[]> {
    // One round trip: skills (with prerequisite ids) are aggregated per unit as JSON.
    const rows = await this.db.query<{
      id: UnitId;
      course_id: CourseId;
      position: number;
      title: string;
      summary: string;
      skills: Skill[];
    }>(
      `select u.id, u.course_id, u.position, u.title, u.summary,
              coalesce(
                json_agg(
                  json_build_object(
                    'id', s.id,
                    'unitId', s.unit_id,
                    'code', s.code,
                    'name', s.name,
                    'prerequisiteIds', coalesce(
                      (select json_agg(sp.prerequisite_id order by sp.prerequisite_id)
                         from skill_prerequisites sp where sp.skill_id = s.id),
                      '[]'::json)
                  ) order by s.position
                ) filter (where s.id is not null),
                '[]'::json) as skills
         from units u
         left join skills s on s.unit_id = u.id
        where u.course_id = $1
        group by u.id
        order by u.position`,
      [courseId],
    );
    return rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      position: row.position,
      title: row.title,
      summary: row.summary,
      skills: row.skills,
    }));
  }

  async findSkill(id: SkillId): Promise<Skill | null> {
    const row = await this.db.maybeOne<{ id: SkillId; unit_id: UnitId; code: string; name: string; prerequisite_ids: SkillId[] }>(
      `select s.id, s.unit_id, s.code, s.name,
              coalesce(array_agg(sp.prerequisite_id) filter (where sp.prerequisite_id is not null), '{}') as prerequisite_ids
         from skills s
         left join skill_prerequisites sp on sp.skill_id = s.id
        where s.id = $1
        group by s.id`,
      [id],
    );
    return row
      ? { id: row.id, unitId: row.unit_id, code: row.code, name: row.name, prerequisiteIds: row.prerequisite_ids }
      : null;
  }

  async findLesson(id: LessonId): Promise<Lesson | null> {
    const row = await this.db.maybeOne<LessonRow>(`select ${LESSON_COLUMNS} from lessons where id = $1`, [id]);
    return row ? toLesson(row) : null;
  }

  async listLessonsForSkill(skillId: SkillId): Promise<LessonSummary[]> {
    const rows = await this.db.query<LessonRow>(
      `select ${LESSON_COLUMNS} from lessons where skill_id = $1 order by level, position`,
      [skillId],
    );
    return rows.map((row) => {
      const { id, slug, title, level, estimatedMinutes } = toLesson(row);
      return { id, slug, title, level, estimatedMinutes };
    });
  }

  async findItem(id: ItemId): Promise<Item | null> {
    const row = await this.db.maybeOne<ItemRow>(`select ${ITEM_COLUMNS} from items where id = $1`, [id]);
    return row ? toItem(row) : null;
  }

  async findItems(ids: ItemId[]): Promise<Item[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query<ItemRow>(`select ${ITEM_COLUMNS} from items where id = any($1::uuid[])`, [ids]);
    return rows.map(toItem);
  }

  async listCandidates(courseId: CourseId): Promise<Candidate[]> {
    const rows = await this.db.query<{ id: ItemId; skill_id: SkillId; difficulty: number }>(
      `select i.id, i.skill_id, i.difficulty
         from items i
         join skills s on s.id = i.skill_id
         join units u on u.id = s.unit_id
        where u.course_id = $1 and i.active
        order by u.position, s.position, i.difficulty`,
      [courseId],
    );
    return rows.map((row) => ({ id: row.id, skillId: row.skill_id, difficulty: row.difficulty }));
  }
}

/** What offline clients need to keep their lesson cache fresh. */
export interface CatalogChangeFeed {
  lessonsChangedSince(since: string | null): Promise<Lesson[]>;
  lessonsDeletedSince(since: string): Promise<LessonId[]>;
}

export class PgCatalogChangeFeed implements CatalogChangeFeed {
  constructor(private readonly db: Database) {}

  async lessonsChangedSince(since: string | null): Promise<Lesson[]> {
    const rows = await this.db.query<LessonRow>(
      `select ${LESSON_COLUMNS} from lessons
        where $1::timestamptz is null or updated_at > $1::timestamptz
        order by updated_at
        limit 500`,
      [since],
    );
    return rows.map(toLesson);
  }

  async lessonsDeletedSince(since: string): Promise<LessonId[]> {
    const rows = await this.db.query<{ entity_id: LessonId }>(
      `select t.entity_id from catalog_tombstones t
        where t.entity = 'lesson' and t.deleted_at > $1
          -- a lesson deleted and later restored is live again
          and not exists (select 1 from lessons l where l.id = t.entity_id)
        order by t.deleted_at`,
      [since],
    );
    return rows.map((row) => row.entity_id);
  }
}

