import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PreferencesInput, SignInInput, SignUpInput, User } from "@learnly/shared";
import {
  authApi,
  isNetworkError,
  onSessionExpired,
  tokenStore,
  type MeResponse,
  type Preferences,
  type ProgressSummary,
} from "../lib/api";
import { clearLearnerData, kvGet, kvSet } from "../db/schema";
import { enqueue, preferencesOperation } from "../sync/outbox";
import { isOnlineNow } from "../sync";
import { setLocale } from "../i18n";

export const DEFAULT_PREFERENCES: Preferences = {
  dailyGoalMinutes: 10,
  reducedMotion: false,
  soundEffects: true,
  locale: "en",
};

type SessionStatus = "loading" | "signedOut" | "signedIn";

export interface SessionValue {
  status: SessionStatus;
  user: User | null;
  preferences: Preferences;
  progress: ProgressSummary | null;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  /** Applies instantly, persists locally and syncs through the outbox (works offline). */
  updatePreferences(patch: PreferencesInput): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);
const ME_KEY = "me";

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const applyMe = useCallback(async (next: MeResponse) => {
    setMe(next);
    setLocale(next.preferences.locale);
    await kvSet(ME_KEY, next);
  }, []);

  const refresh = useCallback(async () => {
    if (!isOnlineNow()) return;
    try {
      await applyMe(await authApi.me());
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }, [applyMe]);

  // Boot: a stored refresh token means we can open straight into the app, offline or not.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { refreshToken } = await tokenStore.load();
      if (!refreshToken) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      const cached = await kvGet<MeResponse>(ME_KEY);
      if (cancelled) return;
      if (cached) {
        setMe(cached);
        setLocale(cached.preferences.locale);
      }
      setStatus("signedIn");
      await refresh().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const resetLocal = useCallback(async () => {
    await clearLearnerData();
    queryClient.clear();
    setMe(null);
    setStatus("signedOut");
  }, [queryClient]);

  useEffect(() => {
    const off = onSessionExpired(() => void resetLocal());
    return () => {
      off();
    };
  }, [resetLocal]);

  const completeAuth = useCallback(
    async (auth: { accessToken: string; refreshToken: string }) => {
      await tokenStore.save(auth);
      await applyMe(await authApi.me());
      setStatus("signedIn");
    },
    [applyMe],
  );

  const signIn = useCallback(
    async (input: SignInInput) => completeAuth(await authApi.signIn(input)),
    [completeAuth],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => completeAuth(await authApi.signUp(input)),
    [completeAuth],
  );

  const signOut = useCallback(async () => {
    const token = tokenStore.peekRefreshToken();
    if (token && isOnlineNow()) await authApi.signOut(token).catch(() => undefined);
    await tokenStore.clear();
    await resetLocal();
  }, [resetLocal]);

  const updatePreferences = useCallback(
    async (patch: PreferencesInput) => {
      if (!me) return;
      const { displayName, avatarColor, ...prefPatch } = patch;
      const next: MeResponse = {
        ...me,
        user: {
          ...me.user,
          ...(displayName ? { displayName } : null),
          ...(avatarColor ? { avatarColor } : null),
        },
        preferences: { ...me.preferences, ...prefPatch },
      };
      await applyMe(next);
      await enqueue(preferencesOperation(patch), { kind: "preferences" });
    },
    [applyMe, me],
  );

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user: me?.user ?? null,
      preferences: me?.preferences ?? DEFAULT_PREFERENCES,
      progress: me?.progress ?? null,
      signIn,
      signUp,
      signOut,
      refresh,
      updatePreferences,
    }),
    [me, refresh, signIn, signOut, signUp, status, updatePreferences],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

export function usePreferences(): Preferences {
  return useSession().preferences;
}
