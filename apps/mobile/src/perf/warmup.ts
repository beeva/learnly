import { Image } from "expo-image";
import type { Lesson } from "@learnly/shared";
import { analytics } from "../analytics/analytics";
import { kvGet } from "../db/schema";
import { lessonRepo } from "../db/repo";
import type { Recommendation } from "../lib/api";
import { downloadLesson } from "../offline/data";
import { isOnlineNow, syncEngine } from "../sync";

/**
 * Lessons should open in well under two seconds. Lessons already in SQLite render
 * on the first frame, so after each successful sync we quietly pull down the
 * lessons the learner is most likely to open next, with their illustrations.
 */
const WARM_INTERVAL_MS = 30 * 60_000;
const MAX_WARM = 3;

export function lessonImageUrls(lesson: Lesson): string[] {
  return lesson.blocks.flatMap((b) => (b.kind === "image" ? [b.src] : []));
}

export async function prefetchLessonImages(lessons: Lesson[]): Promise<number> {
  const urls = [...new Set(lessons.flatMap(lessonImageUrls))];
  if (urls.length === 0) return 0;
  const ok = await Image.prefetch(urls, "memory-disk").catch(() => false);
  return ok ? urls.length : 0;
}

export async function warmLessons(ids: string[], courseSlug: string | null): Promise<number> {
  const lessons: Lesson[] = [];
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!;
      try {
        const local = await lessonRepo.get(id);
        lessons.push(local?.downloaded ? local.lesson : (await downloadLesson(id, courseSlug)).lesson);
      } catch {
        // A lesson that fails to warm simply loads from the network later.
      }
    }
  };
  await Promise.all([worker(), worker()]);
  await prefetchLessonImages(lessons);
  return lessons.length;
}

export function installWarmup(now: () => number = Date.now): () => void {
  let lastWarm = 0;
  let previous = syncEngine.getState().status;
  const unsubscribe = syncEngine.subscribe((state) => {
    const finishedSync = previous === "syncing" && state.status === "idle";
    previous = state.status;
    if (!finishedSync || !isOnlineNow() || now() - lastWarm < WARM_INTERVAL_MS) return;
    lastWarm = now();
    void kvGet<Recommendation[]>("recommendations")
      .then(async (recs) => {
        const targets = (recs ?? []).filter((r) => r.lessonId).slice(0, MAX_WARM);
        for (const rec of targets) await warmLessons([rec.lessonId!], rec.courseSlug);
      })
      .catch(() => undefined);
  });
  return () => {
    unsubscribe();
  };
}

/** Records how long a lesson took to become readable, so the < 2 s budget is measured, not assumed. */
export function markLessonLoad(lessonId: string, startedAt: number, fromCache: boolean): number {
  const ms = Math.max(0, Date.now() - startedAt);
  analytics.track("lesson_loaded", { ms, fromCache, overBudget: ms > 2000, lesson: lessonId.slice(0, 8) });
  return ms;
}
