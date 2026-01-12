import { useEffect } from "react";
import type { RouterLike } from "../a11y/RouteFocus";
import { track } from "../analytics/tracker";

/** Product requirement: a lesson is readable within two seconds of asking for it. */
export const LESSON_BUDGET_MS = 2000;

const LESSON_PATH = /^\/lessons\/([^/]+)$/;

/**
 * Measures time from navigation start to the lesson article rendering
 * (`[data-lesson-ready]`) and reports it, flagging loads over budget.
 */
export function measureLessonLoad(lessonId: string, startedAt: number, onDone: (ms: number) => void, root: Node = document.body): () => void {
  const selector = `[data-lesson-ready="${CSS.escape(lessonId)}"]`;
  const finish = () => {
    observer.disconnect();
    window.clearTimeout(giveUp);
    onDone(Math.round(performance.now() - startedAt));
  };
  const observer = new MutationObserver(() => {
    if (document.querySelector(selector)) finish();
  });
  // Stop waiting after 15s — the learner has clearly hit an error state.
  const giveUp = window.setTimeout(() => observer.disconnect(), 15_000);
  if (document.querySelector(selector)) {
    queueMicrotask(finish);
  } else {
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-lesson-ready"] });
  }
  return () => {
    observer.disconnect();
    window.clearTimeout(giveUp);
  };
}

export function LessonTiming({ router }: { router: RouterLike }) {
  useEffect(() => {
    let cancel: (() => void) | null = null;
    let measuring: string | null = null;

    const start = (pathname: string, startedAt: number) => {
      const lessonId = LESSON_PATH.exec(pathname)?.[1];
      if (!lessonId || lessonId === measuring) return;
      measuring = lessonId;
      cancel?.();
      performance.mark?.(`lesson-start:${lessonId}`);
      cancel = measureLessonLoad(lessonId, startedAt, (ms) => {
        measuring = null;
        performance.measure?.(`lesson-load:${lessonId}`, `lesson-start:${lessonId}`);
        const withinBudget = ms <= LESSON_BUDGET_MS;
        track("lesson_load", { ms, withinBudget });
        if (!withinBudget && import.meta.env.DEV) console.warn(`[learnly] lesson ${lessonId} took ${ms}ms to render (budget ${LESSON_BUDGET_MS}ms)`);
      });
    };

    // A hard load onto a lesson URL counts from navigation start (time origin 0).
    start(router.state.location.pathname, 0);
    const unsubscribe = router.subscribe((state) => {
      if (state.navigation.state === "loading" || state.navigation.state === "idle") start(state.location.pathname, performance.now());
    });
    return () => {
      unsubscribe();
      cancel?.();
    };
  }, [router]);
  return null;
}
