import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "framer-motion";
import type { ReactElement } from "react";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router-dom";
import { tokenStore, type AuthResponse } from "../api/client";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../ui/components";

export const DEMO_CREDENTIALS = {
  student: { email: "maya@learnly.app", password: "learnly-demo-1" },
  educator: { email: "rivera@learnly.app", password: "learnly-demo-1" },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;

/** Sign in against the mock API and store real tokens, exactly like the app does. */
export async function signIn(role: DemoRole): Promise<AuthResponse> {
  const response = await fetch(`${window.location.origin}/v1/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(DEMO_CREDENTIALS[role]),
  });
  if (!response.ok) throw new Error(`Demo sign-in failed with ${response.status}`);
  const auth = (await response.json()) as AuthResponse;
  tokenStore.set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken });
  return auth;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderOptions {
  /** Initial URL. */
  route?: string;
  /** Route pattern the UI is mounted at (so `useParams` works). Defaults to a catch-all. */
  path?: string;
  /** Extra routes to register next to the one under test. */
  routes?: RouteObject[];
  signedInAs?: DemoRole | null;
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
  router: ReturnType<typeof createMemoryRouter>;
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Render inside the same providers as main.tsx (query client, auth, toasts,
 * motion) and a memory data router. Placeholder `/sign-in` and `/home` routes
 * make redirects easy to assert.
 */
export async function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): Promise<RenderWithProvidersResult> {
  const { route = "/", path = "*", routes = [], signedInAs = null } = options;
  if (signedInAs) await signIn(signedInAs);
  const queryClient = options.queryClient ?? createTestQueryClient();
  const placeholders: RouteObject[] = [
    { path: "/sign-in", element: <p>Sign-in page</p> },
    { path: "/home", element: <p>Home page</p> },
  ].filter((placeholder) => placeholder.path !== path && !routes.some((extra) => extra.path === placeholder.path));
  const router = createMemoryRouter([{ path, element: ui }, ...routes, ...placeholders], { initialEntries: [route] });
  const user = userEvent.setup();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <MotionConfig reducedMotion="always">
            <RouterProvider router={router} />
          </MotionConfig>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient, router, user };
}

export { screen, userEvent };
