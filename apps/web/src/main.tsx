import "./styles/tokens.css";
import "./styles/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { isApiError } from "./api/client";
import { routes } from "./app/router";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastProvider } from "./ui/components";

type AppRouter = ReturnType<typeof createBrowserRouter>;

export interface WrapperContext {
  router: AppRouter;
  queryClient: QueryClient;
}

/**
 * Setup steps further down register wrappers (providers, global listeners) and
 * boot tasks (mock API, service worker). The first render waits for all boot
 * tasks, then applies wrappers inside the data providers — first registered is
 * outermost.
 */
const wrappers: Array<(children: ReactNode, context: WrapperContext) => ReactNode> = [];
const boot: Array<Promise<unknown>> = [];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 4xx answers won't change on retry; network blips and 5xx get two more tries.
      retry: (failureCount, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});

function App({ router }: { router: AppRouter }) {
  const context: WrapperContext = { router, queryClient };
  const tree = wrappers.reduceRight<ReactNode>((children, wrap) => wrap(children, context), <RouterProvider router={router} />);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <MotionConfig reducedMotion="user">{tree}</MotionConfig>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Runs after this module (and everything it registers below) has evaluated.
queueMicrotask(() => {
  void Promise.allSettled(boot).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") console.error("[learnly] boot step failed", result.reason);
    }
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing #root element");
    const router = createBrowserRouter(routes);
    createRoot(container).render(
      <StrictMode>
        <App router={router} />
      </StrictMode>,
    );
  });
});

const useMockApi = import.meta.env.MODE === "mock" || import.meta.env.VITE_USE_MOCKS === "true";
if (useMockApi) boot.push(import("./mocks/browser").then((m) => m.startMockApi()));

boot.push(
  import("./i18n/I18nProvider").then(({ I18nProvider }) => {
    wrappers.push((children) => <I18nProvider>{children}</I18nProvider>);
  }),
  import("./hooks/preferences").then(({ MotionPreferences }) => {
    wrappers.push((children) => <MotionPreferences>{children}</MotionPreferences>);
  }),
);

boot.push(
  Promise.all([import("./offline/sync"), import("./offline/OfflineBanner"), import("./app/AppShell")]).then(
    ([offline, { OfflineBanner }, { registerShellSlot }]) => {
      offline.installOfflineSupport(queryClient, { serviceWorker: !useMockApi });
      registerShellSlot("banner", OfflineBanner);
    },
  ),
);

boot.push(
  Promise.all([import("./app/ErrorBoundary"), import("./app/RouteError"), import("./app/router")]).then(
    ([{ AppErrorBoundary }, { RouteError }, { rootRoute }]) => {
      rootRoute.errorElement = <RouteError />;
      wrappers.unshift((children) => <AppErrorBoundary>{children}</AppErrorBoundary>);
    },
  ),
  Promise.all([import("./a11y/SkipLink"), import("./a11y/RouteFocus"), import("./a11y/announcer")]).then(
    ([{ SkipLink }, { RouteFocus }, { Announcer }]) => {
      wrappers.push((children, { router }) => (
        <>
          <SkipLink />
          {children}
          <RouteFocus router={router} />
          <Announcer />
        </>
      ));
    },
  ),
  Promise.all([import("./analytics/tracker"), import("./analytics/events"), import("./perf/prefetch"), import("./perf/lessonTiming")]).then(
    ([{ installAnalytics }, { PageViewTracker }, { PrefetchOnIntent }, { LessonTiming }]) => {
      installAnalytics(queryClient);
      wrappers.push((children, context) => (
        <>
          {children}
          <PageViewTracker router={context.router} />
          <PrefetchOnIntent router={context.router} queryClient={context.queryClient} />
          <LessonTiming router={context.router} />
        </>
      ));
    },
  ),
  Promise.all([import("./i18n/I18nProvider"), import("./i18n/LocaleSwitcher"), import("./app/AppShell")]).then(
    ([i18n, { LocaleSwitcher, LocaleSync }, shell]) => {
      shell.shellConfig.navLabel = (item) => i18n.translateOr(`nav.${item.id}`, item.label);
      shell.registerShellSlot("sidebarFooter", LocaleSwitcher);
      wrappers.push((children) => (
        <>
          <LocaleSync />
          {children}
        </>
      ));
    },
  ),
);
