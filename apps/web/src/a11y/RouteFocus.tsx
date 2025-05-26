import { useEffect } from "react";
import { t } from "../i18n/I18nProvider";
import { announce } from "./announcer";

const APP_NAME = "Learnly";

/** The slice of a react-router data router that route-level listeners need. */
export interface RouterLike {
  state: { location: { pathname: string; search: string }; navigation: { state: string } };
  subscribe(listener: (state: RouterLike["state"]) => void): () => void;
}

/** Wait for React to commit and the browser to lay out the new page. */
function afterPaint(callback: () => void): () => void {
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(callback);
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
  };
}

/** The element that should receive focus after navigating, and the page's name. */
export function findRouteTarget(root: ParentNode = document): { target: HTMLElement | null; title: string | null } {
  const explicit = root.querySelector<HTMLElement>("[data-route-focus]");
  const heading = explicit ?? root.querySelector<HTMLElement>("main h1");
  const main = root.querySelector<HTMLElement>("main#main, main");
  const title = heading?.textContent?.trim() || null;
  return { target: heading ?? main, title };
}

/**
 * Single-page apps don't move focus on navigation, which strands keyboard and
 * screen-reader users at the link they clicked. After each route change this
 * focuses the new page's heading, updates the document title and announces it.
 */
export function RouteFocus({ router }: { router: RouterLike }) {
  useEffect(() => {
    let lastPath = router.state.location.pathname;
    let cancel: (() => void) | null = null;

    const unsubscribe = router.subscribe((state) => {
      if (state.navigation.state !== "idle") return;
      const path = state.location.pathname;
      if (path === lastPath) return;
      lastPath = path;
      cancel?.();
      cancel = afterPaint(() => {
        const { target, title } = findRouteTarget();
        if (title) document.title = `${title} · ${APP_NAME}`;
        if (target) {
          if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
        window.scrollTo({ top: 0 });
        announce(t("a11y.navigated", { title: title ?? APP_NAME }));
      });
    });

    return () => {
      unsubscribe();
      cancel?.();
    };
  }, [router]);

  return null;
}
