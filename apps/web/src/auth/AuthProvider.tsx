import type { Role, SignInInput, SignUpInput, User } from "@learnly/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, isApiError, queryKeys, tokenStore, type MeResponse, type Preferences } from "../api/client";
import { LogoMark } from "../ui/icons";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  preferences: Preferences | null;
  signIn: (input: SignInInput) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasSession = useSyncExternalStore(tokenStore.subscribe, tokenStore.has, () => false);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    enabled: hasSession,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => !isApiError(error, "unauthorized") && failureCount < 2,
  });

  // A rejected refresh clears the tokens from under us: forget everything cached for that user.
  useEffect(() => {
    if (!hasSession) queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "courses" });
  }, [hasSession, queryClient]);

  // The access token was accepted but the account is gone (deleted, or a stale demo session).
  useEffect(() => {
    if (me.error && isApiError(me.error, "unauthorized")) tokenStore.clear();
  }, [me.error]);

  const establish = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      tokenStore.set(tokens);
      const profile = await queryClient.fetchQuery<MeResponse>({ queryKey: queryKeys.me, queryFn: api.me });
      return profile.user;
    },
    [queryClient],
  );

  const signIn = useCallback(async (input: SignInInput) => establish(await api.signIn(input)), [establish]);
  const signUp = useCallback(async (input: SignUpInput) => establish(await api.signUp(input)), [establish]);

  const signOut = useCallback(async () => {
    const tokens = tokenStore.get();
    if (tokens) {
      // Revoke server-side, but never keep someone signed in because the network is down.
      await api.signOut(tokens.refreshToken).catch(() => undefined);
    }
    tokenStore.clear();
    queryClient.clear();
  }, [queryClient]);

  const status: AuthStatus = !hasSession ? "anonymous" : me.data ? "authenticated" : me.isError ? "anonymous" : "loading";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: me.data?.user ?? null,
      preferences: me.data?.preferences ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [status, me.data, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** The signed-in user. Only call below <RequireAuth>. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser called without an authenticated user");
  return user;
}

export function FullPageLoader({ label = "Loading Learnly" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "var(--color-primary)" }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: "var(--space-4)" }}>
        <LogoMark size={56} className="fade-up" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

export interface RequireAuthProps {
  children: ReactNode;
  /** Restrict to these roles; others are sent to their home screen. */
  roles?: Role[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageLoader />;
  if (status === "anonymous" || !user) {
    return <Navigate to="/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

/**
 * Sign-in and sign-up are only for guests; signed-in users go straight to the
 * app (or back to the page that sent them here). The form stays mounted while
 * a sign-in is in flight so it never flashes away mid-submit.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith("/") && !from.startsWith("//") ? from : "/home"} replace />;
  }
  return <>{children}</>;
}
