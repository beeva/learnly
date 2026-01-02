import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { RouterLike } from "../a11y/RouteFocus";
import { api, learnerKeys, queryKeys, type Recommendation } from "../api/client";
import { lessonQueryOptions } from "../api/hooks";

/** Route chunks, keyed by the first path segment, so intent can warm them early. */
const ROUTE_CHUNKS: Record<string, () => Promise<unknown>> = {
  lessons: () => import("../features/lesson/LessonPlayer"),
  practice: () => import("../features/practice/PracticeSession"),
  assess: () => import("../features/diagnostic/DiagnosticFlow"),
  progress: () => import("../pages/Progress"),
  settings: () => import("../pages/Settings"),
  teach: () => import("../features/educator/ClassroomsPage"),
};

const warmed = new Set<string>();

function warmChunk(segment: string) {
  const load = ROUTE_CHUNKS[segment];
  if (!load || warmed.has(segment)) return;
  warmed.add(segment);
  load().catch(() => warmed.delete(segment));
}

export function prefetchLesson(queryClient: QueryClient, lessonId: string): Promise<void> {
  warmChunk("lessons");
  return queryClient.prefetchQuery(lessonQueryOptions(lessonId));
}

/** Prefetch whatever a link points at: the route's code and, where cheap, its data. */
export function prefetchHref(queryClient: QueryClient, href: string): void {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  const [segment, id] = url.pathname.split("/").filter(Boolean);
  if (!segment) return;
  warmChunk(segment);
  if (segment === "lessons" && id) void prefetchLesson(queryClient, id);
  if (segment === "courses" && id) {
    void queryClient.prefetchQuery({ queryKey: queryKeys.course(id), queryFn: () => api.course(id), staleTime: 10 * 60_000 });
  }
}

const idle: (callback: () => void) => void =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (callback) => window.requestIdleCallback(() => callback(), { timeout: 2000 })
    : (callback) => setTimeout(callback, 300);

/** The lesson Learnly expects the learner to open next, from cached recommendations. */
export function nextLessonId(queryClient: QueryClient): string | null {
  const recs = queryClient.getQueryData<{ next: Recommendation[] }>(learnerKeys.recommendations);
  return recs?.next.find((rec) => rec.type === "lesson" && rec.lessonId)?.lessonId ?? null;
}

/**
 * Keeps lessons well under the 2-second budget: warms route chunks and lesson
 * data on hover/focus/touch of a link, and prefetches the recommended next
 * lesson whenever the learner lands on home or finishes something.
 */
export function PrefetchOnIntent({ router, queryClient }: { router: RouterLike; queryClient: QueryClient }) {
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return undefined;

    const onIntent = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      const href = anchor?.getAttribute("href");
      if (href && href.startsWith("/")) prefetchHref(queryClient, href);
    };
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent);
    document.addEventListener("touchstart", onIntent, { passive: true });

    const prefetchNext = () =>
      idle(() => {
        const lessonId = nextLessonId(queryClient);
        if (lessonId) void prefetchLesson(queryClient, lessonId);
      });

    // Recommendations arrive after home renders; prefetch as soon as they do.
    const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success" && event.query.queryKey[0] === learnerKeys.recommendations[0]) prefetchNext();
    });
    const unsubscribeRouter = router.subscribe((state) => {
      if (state.navigation.state === "idle" && state.location.pathname === "/home") prefetchNext();
    });

    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
      document.removeEventListener("touchstart", onIntent);
      unsubscribeCache();
      unsubscribeRouter();
    };
  }, [router, queryClient]);

  return null;
}
