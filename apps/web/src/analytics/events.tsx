import { useEffect } from "react";
import type { RouterLike } from "../a11y/RouteFocus";
import { track } from "./tracker";

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** Collapse ids so page views group by screen and never carry identifiers. */
export function normalizePath(pathname: string): string {
  return pathname.replace(UUID_SEGMENT, "/:id").replace(/\/+$/, "") || "/";
}

/** Tracks one `page_view` per distinct pathname, including the first load. */
export function PageViewTracker({ router }: { router: RouterLike }) {
  useEffect(() => {
    let last = "";
    const report = (pathname: string) => {
      const path = normalizePath(pathname);
      if (path === last) return;
      last = path;
      track("page_view", { path });
    };
    report(router.state.location.pathname);
    return router.subscribe((state) => {
      if (state.navigation.state === "idle") report(state.location.pathname);
    });
  }, [router]);
  return null;
}
