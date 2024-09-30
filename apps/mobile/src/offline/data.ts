import { useQuery } from "@tanstack/react-query";
import { levelForXp, type Course, type Lesson, type PublicItem, type SkillMastery, type Unit } from "@learnly/shared";
import {
  catalogApi,
  isNetworkError,
  progressApi,
  type LessonSummary,
  type ProgressSummary,
  type Recommendation,
} from "../lib/api";
import { kvGet, kvSet } from "../db/schema";
import { courseRepo, lessonRepo, masteryRepo, type StoredLesson } from "../db/repo";
import { isOnlineNow, PROGRESS_SNAPSHOT_KEY, type ProgressSnapshot } from "../sync";
import { effectiveMastery } from "./learning";

/**
 * Network-first with a SQLite fallback: when online we refresh the cache and
 * return fresh data; offline (or when the request fails to reach the server)
 * we serve whatever was cached. Queries run with `networkMode: "always"` so
 * TanStack Query never pauses them — the fallback is our job, not its.
 */
async function networkFirst<T>(
  fetchRemote: () => Promise<T>,
  save: (value: T) => Promise<void>,
  readLocal: () => Promise<T | null>,
): Promise<T> {
  if (isOnlineNow()) {
    try {
      const value = await fetchRemote();
      await save(value).catch(() => undefined);
      return value;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  const local = await readLocal();
  if (local !== null) return local;
  throw new OfflineMissError();
}

/** Thrown when we're offline and nothing useful is cached yet. */
export class OfflineMissError extends Error {
  constructor() {
    super("This isn't available offline yet.");
    this.name = "OfflineMissError";
  }
}

export const queryKeys = {
  courses: ["courses"] as const,
  course: (slug: string) => ["course", slug] as const,
  skillLessons: (skillId: string) => ["skill-lessons", skillId] as const,
  lesson: (id: string) => ["lesson", id] as const,
  courseMastery: (slug: string) => ["course-mastery", slug] as const,
  recommendations: ["recommendations"] as const,
  progress: ["progress"] as const,
  downloads: ["downloads"] as const,
};

export function useCourses() {
  return useQuery({
    queryKey: queryKeys.courses,
    networkMode: "always",
    queryFn: () =>
      networkFirst(
        async () => (await catalogApi.courses()).courses,
        (courses) => courseRepo.saveCourses(courses),
        async () => {
          const courses = await courseRepo.listCourses();
          return courses.length ? courses : null;
        },
      ),
  });
}

export function useCourse(slug: string) {
  return useQuery({
    queryKey: queryKeys.course(slug),
    networkMode: "always",
    queryFn: () =>
      networkFirst<{ course: Course; units: Unit[] }>(
        () => catalogApi.course(slug),
        (detail) => courseRepo.saveDetail(detail.course, detail.units),
        () => courseRepo.getDetail(slug),
      ),
  });
}

const skillLessonsKey = (skillId: string) => `skill-lessons:${skillId}`;

export function useSkillLessons(skillId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.skillLessons(skillId),
    networkMode: "always",
    enabled,
    queryFn: () =>
      networkFirst<LessonSummary[]>(
        async () => (await catalogApi.skillLessons(skillId)).lessons,
        (lessons) => kvSet(skillLessonsKey(skillId), lessons),
        () => kvGet<LessonSummary[]>(skillLessonsKey(skillId)),
      ),
  });
}

/** Lessons open from SQLite first when downloaded — that's what keeps them under 2s. */
export async function loadLesson(id: string, courseSlug?: string): Promise<StoredLesson> {
  const local = await lessonRepo.get(id);
  if (local?.downloaded && local.items.length === countChecks(local.lesson)) {
    if (isOnlineNow()) void refreshLesson(id, courseSlug).catch(() => undefined);
    return local;
  }
  return networkFirst<StoredLesson>(
    async () => {
      const { lesson, items } = await catalogApi.lesson(id);
      return { lesson, items, downloaded: local?.downloaded ?? false };
    },
    (value) => lessonRepo.save(value.lesson, value.items, { courseSlug, downloaded: value.downloaded }),
    async () => local,
  );
}

async function refreshLesson(id: string, courseSlug?: string): Promise<void> {
  const { lesson, items } = await catalogApi.lesson(id);
  await lessonRepo.save(lesson, items, { courseSlug, downloaded: true });
}

function countChecks(lesson: Lesson): number {
  return lesson.blocks.filter((b) => b.kind === "check").length;
}

export function useLesson(id: string, courseSlug?: string) {
  return useQuery({
    queryKey: queryKeys.lesson(id),
    networkMode: "always",
    queryFn: () => loadLesson(id, courseSlug),
    staleTime: 5 * 60_000,
  });
}

export function useCourseMastery(slug: string) {
  return useQuery({
    queryKey: queryKeys.courseMastery(slug),
    networkMode: "always",
    queryFn: async (): Promise<Map<string, SkillMastery>> => {
      if (isOnlineNow()) {
        try {
          const { mastery } = await progressApi.courseMastery(slug);
          await masteryRepo.upsert(mastery, new Date().toISOString());
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }
      return effectiveMastery();
    },
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: queryKeys.recommendations,
    networkMode: "always",
    queryFn: () =>
      networkFirst<Recommendation[]>(
        async () => (await progressApi.recommendations()).next,
        (next) => kvSet("recommendations", next),
        () => kvGet<Recommendation[]>("recommendations"),
      ),
  });
}

export interface ProgressView extends ProgressSummary {
  mastery: Map<string, SkillMastery>;
  details: { course: Course; units: Unit[] }[];
  offline: boolean;
}

export function useProgress(fallback: ProgressSummary | null) {
  return useQuery({
    queryKey: queryKeys.progress,
    networkMode: "always",
    queryFn: async (): Promise<ProgressView> => {
      let summary: ProgressSummary | null = null;
      let offline = true;
      if (isOnlineNow()) {
        try {
          const remote = await progressApi.progress();
          await masteryRepo.upsert(remote.mastery, new Date().toISOString());
          summary = {
            totalXp: remote.totalXp,
            level: remote.level,
            streak: remote.streak,
            minutesToday: remote.minutesToday,
            dailyGoalMinutes: remote.dailyGoalMinutes,
          };
          offline = false;
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }
      if (!summary) summary = await localProgress(fallback);
      const [mastery, details] = await Promise.all([effectiveMastery(), courseRepo.allDetails()]);
      return { ...summary, mastery, details, offline };
    },
  });
}

/** Best local estimate: last /me summary updated by the latest sync snapshot. */
async function localProgress(fallback: ProgressSummary | null): Promise<ProgressSummary> {
  const snapshot = await kvGet<ProgressSnapshot>(PROGRESS_SNAPSHOT_KEY);
  const base: ProgressSummary = fallback ?? {
    totalXp: 0,
    level: levelForXp(0),
    streak: { current: 0, longest: 0, lastActiveDay: null, freezesAvailable: 0 },
    minutesToday: 0,
    dailyGoalMinutes: 10,
  };
  if (!snapshot) return base;
  return {
    ...base,
    totalXp: Math.max(base.totalXp, snapshot.totalXp),
    level: levelForXp(Math.max(base.totalXp, snapshot.totalXp)),
    streak: {
      ...base.streak,
      current: snapshot.streak,
      longest: Math.max(base.streak.longest, snapshot.streak),
      freezesAvailable: snapshot.freezesAvailable,
    },
  };
}

/* ----------------------------------------------------------------------------
 * Downloads for offline use
 * ------------------------------------------------------------------------- */

export interface DownloadProgress {
  done: number;
  total: number;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function downloadLesson(id: string, courseSlug: string | null): Promise<{ lesson: Lesson; items: PublicItem[] }> {
  const { lesson, items } = await catalogApi.lesson(id);
  await lessonRepo.save(lesson, items, { courseSlug, downloaded: true });
  return { lesson, items };
}

/**
 * Downloads every lesson in a course (or one unit of it) with its practice items,
 * so lessons, checks and offline practice all work without a connection.
 */
export async function downloadCourse(
  slug: string,
  options: { unitId?: string; onProgress?: (p: DownloadProgress) => void } = {},
): Promise<number> {
  const { course, units } = await catalogApi.course(slug);
  await courseRepo.saveDetail(course, units);
  const skills = units.filter((u) => !options.unitId || u.id === options.unitId).flatMap((u) => u.skills);

  const lessonIds: string[] = [];
  await mapLimit(skills, 4, async (skill) => {
    const { lessons } = await catalogApi.skillLessons(skill.id);
    await kvSet(skillLessonsKey(skill.id), lessons);
    lessonIds.push(...lessons.map((l) => l.id));
  });

  const total = lessonIds.length;
  let done = 0;
  options.onProgress?.({ done, total });
  await mapLimit(lessonIds, 3, async (id) => {
    await downloadLesson(id, slug);
    done += 1;
    options.onProgress?.({ done, total });
  });
  return total;
}

export function useDownloadedLessons() {
  return useQuery({
    queryKey: queryKeys.downloads,
    networkMode: "always",
    queryFn: () => lessonRepo.listDownloaded(),
  });
}
