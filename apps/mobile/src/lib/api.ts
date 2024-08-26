import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type {
  AttemptInput,
  AttemptResult,
  Course,
  DiagnosticSummary,
  LevelInfo,
  Lesson,
  NextItemResponse,
  PreferencesInput,
  PublicItem,
  Session,
  SignInInput,
  SignUpInput,
  SkillMastery,
  StartSessionInput,
  StreakState,
  SyncPushInput,
  SyncResponse,
  Unit,
  User,
} from "@learnly/shared";

/* ----------------------------------------------------------------------------
 * Response shapes from tools/API.md that are not part of @learnly/shared.
 * ------------------------------------------------------------------------- */

export interface Preferences {
  dailyGoalMinutes: number;
  reducedMotion: boolean;
  soundEffects: boolean;
  locale: "en" | "es" | "fil";
}

export interface ProgressSummary {
  totalXp: number;
  level: LevelInfo;
  streak: StreakState;
  minutesToday: number;
  dailyGoalMinutes: number;
}

export interface MeResponse {
  user: User;
  preferences: Preferences;
  progress: ProgressSummary;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type RecommendationType = "lesson" | "practice" | "review" | "diagnostic";

export interface Recommendation {
  type: RecommendationType;
  title: string;
  subtitle: string;
  lessonId?: string;
  courseSlug: string;
  estimatedMinutes: number;
}

export type LessonSummary = Pick<Lesson, "id" | "slug" | "title" | "level" | "estimatedMinutes">;

export type ApiErrorCode =
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The request never reached the server (offline, DNS, timeout). Safe to queue. */
export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/* ----------------------------------------------------------------------------
 * Tokens live in the Keychain / Keystore, never in SQLite or AsyncStorage.
 * ------------------------------------------------------------------------- */

const ACCESS_KEY = "learnly.accessToken";
const REFRESH_KEY = "learnly.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokensLoaded = false;

export const tokenStore = {
  async load(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    if (!tokensLoaded) {
      [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      tokensLoaded = true;
    }
    return { accessToken, refreshToken };
  },
  async save(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    tokensLoaded = true;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      }),
    ]);
  },
  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    tokensLoaded = true;
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
  },
  peekRefreshToken(): string | null {
    return refreshToken;
  },
};

/* ----------------------------------------------------------------------------
 * Core request with single-flight refresh on 401.
 * ------------------------------------------------------------------------- */

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
export const API_URL = (extra.apiUrl ?? "https://api.learnly.app").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Fired when the refresh token is rejected; the session provider signs out. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

async function rawFetch(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener("abort", () => controller.abort());
  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : null),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 202) return undefined as T;
  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : undefined;
  if (response.ok) return json as T;
  const err = (json as { error?: { code?: ApiErrorCode; message?: string; details?: unknown } } | undefined)?.error;
  throw new ApiError(response.status, err?.code ?? "internal", err?.message ?? response.statusText, err?.details);
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { refreshToken: current } = await tokenStore.load();
      if (!current) return null;
      const response = await rawFetch("/v1/auth/refresh", { method: "POST", body: { refreshToken: current } }, null);
      if (response.status === 401 || response.status === 403) {
        await tokenStore.clear();
        sessionExpiredListeners.forEach((listener) => listener());
        return null;
      }
      const tokens = await parse<{ accessToken: string; refreshToken: string }>(response);
      await tokenStore.save(tokens);
      return tokens.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  const token = auth ? (await tokenStore.load()).accessToken : null;
  let response = await rawFetch(path, options, token);
  if (auth && response.status === 401) {
    const fresh = await refreshAccessToken();
    if (!fresh) throw new ApiError(401, "unauthorized", "Your session has ended. Please sign in again.");
    response = await rawFetch(path, options, fresh);
  }
  return parse<T>(response);
}

/* ----------------------------------------------------------------------------
 * Endpoints (tools/API.md)
 * ------------------------------------------------------------------------- */

export const authApi = {
  signUp: (input: SignUpInput) =>
    request<AuthResponse>("/v1/auth/sign-up", { method: "POST", body: input, auth: false }),
  signIn: (input: SignInInput) =>
    request<AuthResponse>("/v1/auth/sign-in", { method: "POST", body: input, auth: false }),
  signOut: (token: string) =>
    request<void>("/v1/auth/sign-out", { method: "POST", body: { refreshToken: token }, auth: false }),
  me: () => request<MeResponse>("/v1/me"),
  updatePreferences: (input: PreferencesInput) =>
    request<{ preferences: Preferences }>("/v1/me/preferences", { method: "PATCH", body: input }),
};

export const catalogApi = {
  courses: () => request<{ courses: Course[] }>("/v1/courses"),
  course: (slug: string) => request<{ course: Course; units: Unit[] }>(`/v1/courses/${encodeURIComponent(slug)}`),
  lesson: (id: string) => request<{ lesson: Lesson; items: PublicItem[] }>(`/v1/lessons/${encodeURIComponent(id)}`),
  skillLessons: (skillId: string) =>
    request<{ lessons: LessonSummary[] }>(`/v1/skills/${encodeURIComponent(skillId)}/lessons`),
};

export const learningApi = {
  submitAttempt: (input: AttemptInput) => request<AttemptResult>("/v1/attempts", { method: "POST", body: input }),
  startSession: (input: StartSessionInput) =>
    request<NextItemResponse>("/v1/sessions", { method: "POST", body: input }),
  nextItem: (sessionId: string) => request<NextItemResponse>(`/v1/sessions/${sessionId}/next`),
  completeSession: (sessionId: string) =>
    request<{ session: Session; xpEarned: number; summary?: DiagnosticSummary }>(
      `/v1/sessions/${sessionId}/complete`,
      { method: "POST" },
    ),
  completeLesson: (lessonId: string, durationMs: number) =>
    request<{ xpEarned: number; progress: ProgressSummary }>(`/v1/lessons/${lessonId}/complete`, {
      method: "POST",
      body: { durationMs },
    }),
};

export const progressApi = {
  progress: () => request<ProgressSummary & { mastery: SkillMastery[] }>("/v1/progress"),
  courseMastery: (slug: string) =>
    request<{ mastery: SkillMastery[] }>(`/v1/courses/${encodeURIComponent(slug)}/mastery`),
  recommendations: () => request<{ next: Recommendation[] }>("/v1/recommendations"),
};

export const syncApi = {
  push: (input: SyncPushInput) => request<SyncResponse>("/v1/sync", { method: "POST", body: input }),
};

