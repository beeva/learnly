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

