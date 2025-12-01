import type {
  Course,
  Lesson,
  PublicItem,
  Response,
  SkillMastery,
  SyncDelta,
  Unit,
} from "@learnly/shared";
import { getDb } from "./schema";

/* ----------------------------------------------------------------------------
 * Courses
 * ------------------------------------------------------------------------- */

export const courseRepo = {
  async saveCourses(courses: Course[]): Promise<void> {
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const [position, course] of courses.entries()) {
        await db.runAsync(
          `INSERT INTO courses (slug, id, course_json, position, fetched_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET course_json = excluded.course_json, position = excluded.position,
             fetched_at = excluded.fetched_at`,
          course.slug,
          course.id,
          JSON.stringify(course),
          position,
          now,
        );
      }
    });
  },

  async listCourses(): Promise<Course[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ course_json: string }>("SELECT course_json FROM courses ORDER BY position");
    return rows.map((r) => JSON.parse(r.course_json) as Course);
  },

  async saveDetail(course: Course, units: Unit[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO courses (slug, id, course_json, units_json, fetched_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET course_json = excluded.course_json, units_json = excluded.units_json,
         fetched_at = excluded.fetched_at`,
      course.slug,
      course.id,
      JSON.stringify(course),
      JSON.stringify(units),
      Date.now(),
    );
  },

  async getDetail(slug: string): Promise<{ course: Course; units: Unit[] } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ course_json: string; units_json: string | null }>(
      "SELECT course_json, units_json FROM courses WHERE slug = ?",
      slug,
    );
    if (!row?.units_json) return null;
    return { course: JSON.parse(row.course_json) as Course, units: JSON.parse(row.units_json) as Unit[] };
  },

  /** Every cached course with its units, used to group mastery by unit offline. */
  async allDetails(): Promise<{ course: Course; units: Unit[] }[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ course_json: string; units_json: string }>(
      "SELECT course_json, units_json FROM courses WHERE units_json IS NOT NULL ORDER BY position",
    );
    return rows.map((r) => ({ course: JSON.parse(r.course_json) as Course, units: JSON.parse(r.units_json) as Unit[] }));
  },
};

/* ----------------------------------------------------------------------------
 * Lessons
 * ------------------------------------------------------------------------- */

export interface StoredLesson {
  lesson: Lesson;
  items: PublicItem[];
  downloaded: boolean;
}

export const lessonRepo = {
  async save(
    lesson: Lesson,
    items: PublicItem[],
    options: { courseSlug?: string | null; downloaded?: boolean } = {},
  ): Promise<void> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO lessons (id, skill_id, course_slug, lesson_json, downloaded, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET lesson_json = excluded.lesson_json,
           course_slug = COALESCE(excluded.course_slug, lessons.course_slug),
           downloaded = MAX(lessons.downloaded, excluded.downloaded), fetched_at = excluded.fetched_at`,
        lesson.id,
        lesson.skillId,
        options.courseSlug ?? null,
        JSON.stringify(lesson),
        options.downloaded ? 1 : 0,
        Date.now(),
      );
      await itemRepo.saveMany(items, lesson.id);
    });
  },

  async get(id: string): Promise<StoredLesson | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ lesson_json: string; downloaded: number }>(
      "SELECT lesson_json, downloaded FROM lessons WHERE id = ?",
      id,
    );
    if (!row) return null;
    const lesson = JSON.parse(row.lesson_json) as Lesson;
    const itemIds = lesson.blocks.flatMap((b) => (b.kind === "check" ? [b.itemId] : []));
    const items = await itemRepo.getMany(itemIds);
    return { lesson, items, downloaded: row.downloaded === 1 };
  },

  async downloadedIds(courseSlug?: string): Promise<Set<string>> {
    const db = await getDb();
    const rows = courseSlug
      ? await db.getAllAsync<{ id: string }>(
          "SELECT id FROM lessons WHERE downloaded = 1 AND course_slug = ?",
          courseSlug,
        )
      : await db.getAllAsync<{ id: string }>("SELECT id FROM lessons WHERE downloaded = 1");
    return new Set(rows.map((r) => r.id));
  },

  async listDownloaded(): Promise<{ id: string; title: string; estimatedMinutes: number; courseSlug: string | null }[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ lesson_json: string; course_slug: string | null }>(
      "SELECT lesson_json, course_slug FROM lessons WHERE downloaded = 1 ORDER BY fetched_at DESC",
    );
    return rows.map((r) => {
      const lesson = JSON.parse(r.lesson_json) as Lesson;
      return { id: lesson.id, title: lesson.title, estimatedMinutes: lesson.estimatedMinutes, courseSlug: r.course_slug };
    });
  },

  async removeDownloads(): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE lessons SET downloaded = 0");
  },

  /** Lessons pushed by the server in a sync response (new content, edits, retirements). */
  async applyDelta(delta: SyncDelta<Lesson>): Promise<void> {
    if (delta.upserted.length === 0 && delta.deletedIds.length === 0) return;
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const lesson of delta.upserted) {
        await db.runAsync(
          `INSERT INTO lessons (id, skill_id, lesson_json, downloaded, fetched_at) VALUES (?, ?, ?, 0, ?)
           ON CONFLICT(id) DO UPDATE SET lesson_json = excluded.lesson_json, fetched_at = excluded.fetched_at`,
          lesson.id,
          lesson.skillId,
          JSON.stringify(lesson),
          Date.now(),
        );
      }
      for (const id of delta.deletedIds) {
        await db.runAsync("DELETE FROM lessons WHERE id = ?", id);
      }
    });
  },
};

/* ----------------------------------------------------------------------------
 * Items and their locally learned answer keys
 * ------------------------------------------------------------------------- */

export interface CachedItem {
  item: PublicItem;
  /** Known once the learner has answered the item online (from AttemptResult). */
  key: Response | null;
  explanation: string | null;
}

export const itemRepo = {
  async saveMany(items: PublicItem[], lessonId: string | null = null): Promise<void> {
    const db = await getDb();
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO items (id, skill_id, lesson_id, difficulty, item_json) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET item_json = excluded.item_json, difficulty = excluded.difficulty,
           lesson_id = COALESCE(excluded.lesson_id, items.lesson_id)`,
        item.id,
        item.skillId,
        lessonId,
        item.difficulty,
        JSON.stringify(item),
      );
    }
  },

  async getMany(ids: string[]): Promise<PublicItem[]> {
    if (ids.length === 0) return [];
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; item_json: string }>(
      `SELECT id, item_json FROM items WHERE id IN (${ids.map(() => "?").join(",")})`,
      ...ids,
    );
    const byId = new Map(rows.map((r) => [r.id, JSON.parse(r.item_json) as PublicItem]));
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  },

  async get(id: string): Promise<CachedItem | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ item_json: string; key_json: string | null; explanation: string | null }>(
      "SELECT item_json, key_json, explanation FROM items WHERE id = ?",
      id,
    );
    if (!row) return null;
    return {
      item: JSON.parse(row.item_json) as PublicItem,
      key: row.key_json ? (JSON.parse(row.key_json) as Response) : null,
      explanation: row.explanation,
    };
  },

  async rememberKey(itemId: string, correctResponse: Response, explanation: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE items SET key_json = ?, explanation = ? WHERE id = ?",
      JSON.stringify(correctResponse),
      explanation,
      itemId,
    );
  },

  /** Items for the given skills (all skills when empty), used for offline selection. */
  async forSkills(skillIds: string[]): Promise<CachedItem[]> {
    const db = await getDb();
    const where = skillIds.length ? `WHERE skill_id IN (${skillIds.map(() => "?").join(",")})` : "";
    const rows = await db.getAllAsync<{ item_json: string; key_json: string | null; explanation: string | null }>(
      `SELECT item_json, key_json, explanation FROM items ${where}`,
      ...skillIds,
    );
    return rows.map((r) => ({
      item: JSON.parse(r.item_json) as PublicItem,
      key: r.key_json ? (JSON.parse(r.key_json) as Response) : null,
      explanation: r.explanation,
    }));
  },
};

/* ----------------------------------------------------------------------------
 * Mastery (server-confirmed rows; optimistic changes are replayed from the outbox)
 * ------------------------------------------------------------------------- */

export const masteryRepo = {
  async all(): Promise<SkillMastery[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ mastery_json: string }>("SELECT mastery_json FROM mastery");
    return rows.map((r) => JSON.parse(r.mastery_json) as SkillMastery);
  },

  async upsert(rows: SkillMastery[], serverTime: string | null = null): Promise<void> {
    if (rows.length === 0) return;
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const m of rows) {
        await db.runAsync(
          `INSERT INTO mastery (skill_id, mastery_json, server_updated_at) VALUES (?, ?, ?)
           ON CONFLICT(skill_id) DO UPDATE SET mastery_json = excluded.mastery_json,
             server_updated_at = excluded.server_updated_at`,
          m.skillId,
          JSON.stringify(m),
          serverTime,
        );
      }
    });
  },

  async applyDelta(delta: SyncDelta<SkillMastery>, serverTime: string): Promise<void> {
    await masteryRepo.upsert(delta.upserted, serverTime);
    if (delta.deletedIds.length) {
      const db = await getDb();
      for (const id of delta.deletedIds) await db.runAsync("DELETE FROM mastery WHERE skill_id = ?", id);
    }
  },
};

export interface StorageStats {
  downloadedLessons: number;
  cachedItems: number;
  scorableItems: number;
  approxBytes: number;
}

export async function storageStats(): Promise<StorageStats> {
  const db = await getDb();
  const lessons = await db.getFirstAsync<{ n: number; bytes: number | null }>(
    "SELECT COUNT(*) AS n, SUM(LENGTH(lesson_json)) AS bytes FROM lessons WHERE downloaded = 1",
  );
  const items = await db.getFirstAsync<{ n: number; keyed: number; bytes: number | null }>(
    "SELECT COUNT(*) AS n, SUM(key_json IS NOT NULL) AS keyed, SUM(LENGTH(item_json)) AS bytes FROM items",
  );
  return {
    downloadedLessons: lessons?.n ?? 0,
    cachedItems: items?.n ?? 0,
    scorableItems: items?.keyed ?? 0,
    approxBytes: (lessons?.bytes ?? 0) + (items?.bytes ?? 0),
  };
}
