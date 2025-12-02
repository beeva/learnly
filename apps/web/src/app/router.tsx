import { Navigate, Outlet, type RouteObject } from "react-router-dom";
import { GuestOnly, RequireAuth, useAuth } from "../auth/AuthProvider";
import { SignInPage, SignUpPage } from "../pages/Auth";
import { CatalogPage, CourseDetailPage } from "../pages/Courses";
import { LandingPage } from "../pages/Landing";
import { ButtonLink, EmptyState } from "../ui/components";
import * as Icons from "../ui/icons";
import { AppShell, FocusLayout, registerNavItem } from "./AppShell";

/*
 * Routes are plain objects grouped by layout. Feature areas append to these
 * arrays as they land; main.tsx creates the browser router once everything has
 * registered, so the order of these modules never matters.
 */

function NotFoundPage() {
  const { status } = useAuth();
  const home = status === "authenticated" ? "/home" : "/";
  return (
    <main id="main" tabIndex={-1} style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
      <EmptyState
        icon={Icons.CompassIcon}
        title="This page wandered off"
        description="The link might be old, or the page moved. Let's get you back on track."
        action={
          <ButtonLink to={home} leadingIcon={Icons.ArrowLeftIcon}>
            {status === "authenticated" ? "Back to home" : "Back to Learnly"}
          </ButtonLink>
        }
      />
    </main>
  );
}

/** `/home` is the landing spot after sign-in; it starts out pointing at the catalog. */
export const homeRoute: RouteObject = { path: "home", element: <Navigate to="/courses" replace /> };

/** Pages rendered inside the app shell (sidebar / bottom nav). */
export const shellChildren: RouteObject[] = [
  homeRoute,
  { path: "courses", element: <CatalogPage /> },
  { path: "courses/:slug", element: <CourseDetailPage /> },
];

/** Full-screen, distraction-free pages (lessons, practice, assessment). */
export const focusChildren: RouteObject[] = [];

export const rootChildren: RouteObject[] = [
  { index: true, element: <LandingPage /> },
  {
    path: "sign-in",
    element: (
      <GuestOnly>
        <SignInPage />
      </GuestOnly>
    ),
  },
  {
    path: "sign-up",
    element: (
      <GuestOnly>
        <SignUpPage />
      </GuestOnly>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: shellChildren,
  },
  {
    element: (
      <RequireAuth>
        <FocusLayout />
      </RequireAuth>
    ),
    children: focusChildren,
  },
  { path: "*", element: <NotFoundPage /> },
];

export const rootRoute: RouteObject = { path: "/", element: <Outlet />, children: rootChildren };

export const routes: RouteObject[] = [rootRoute];

registerNavItem({ id: "courses", to: "/courses", label: "Courses", icon: Icons.BookIcon, order: 20 });

delete homeRoute.element;
homeRoute.lazy = () => import("../pages/Home").then((m) => ({ Component: m.HomePage }));

shellChildren.push(
  { path: "progress", lazy: () => import("../pages/Progress").then((m) => ({ Component: m.ProgressPage })) },
  { path: "settings", lazy: () => import("../pages/Settings").then((m) => ({ Component: m.SettingsPage })) },
);

focusChildren.push(
  { path: "welcome", lazy: () => import("../features/diagnostic/DiagnosticFlow").then((m) => ({ Component: m.WelcomePage })) },
  { path: "assess/:courseSlug", lazy: () => import("../features/diagnostic/DiagnosticFlow").then((m) => ({ Component: m.DiagnosticPage })) },
  { path: "lessons/:lessonId", lazy: () => import("../features/lesson/LessonPlayer").then((m) => ({ Component: m.LessonPlayerPage })) },
  { path: "practice/:courseSlug", lazy: () => import("../features/practice/PracticeSession").then((m) => ({ Component: m.PracticePage })) },
);

registerNavItem({ id: "home", to: "/home", label: "Home", icon: Icons.HomeIcon, order: 0 });
registerNavItem({ id: "progress", to: "/progress", label: "Progress", icon: Icons.ChartIcon, order: 40 });
registerNavItem({ id: "settings", to: "/settings", label: "Settings", icon: Icons.SettingsIcon, order: 90 });

shellChildren.push(
  {
    path: "teach",
    element: (
      <RequireAuth roles={["educator", "admin"]}>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      { index: true, lazy: () => import("../features/educator/ClassroomsPage").then((m) => ({ Component: m.ClassroomsPage })) },
      { path: ":classroomId", lazy: () => import("../features/educator/InsightsPage").then((m) => ({ Component: m.InsightsPage })) },
    ],
  },
  { path: "join", lazy: () => import("../features/classroom/JoinClassroomPage").then((m) => ({ Component: m.JoinClassroomPage })) },
);

// Educators land on their classes; the learner dashboard stays student-only.
const learnerHome = homeRoute.lazy;
homeRoute.lazy = async () => {
  const learner = learnerHome ? await learnerHome() : undefined;
  const LearnerHome = learner?.Component;
  function RoleAwareHome() {
    const { user } = useAuth();
    if (user && user.role !== "student") return <Navigate to="/teach" replace />;
    return LearnerHome ? <LearnerHome /> : null;
  }
  return { Component: RoleAwareHome };
};

registerNavItem({ id: "home", to: "/home", label: "Home", icon: Icons.HomeIcon, order: 0, roles: ["student"] });
registerNavItem({ id: "progress", to: "/progress", label: "Progress", icon: Icons.ChartIcon, order: 40, roles: ["student"] });
registerNavItem({ id: "teach", to: "/teach", label: "Classes", icon: Icons.GraduationCapIcon, order: 5, roles: ["educator", "admin"] });
registerNavItem({ id: "join", to: "/join", label: "Join a class", icon: Icons.GraduationCapIcon, order: 50, roles: ["student"] });
