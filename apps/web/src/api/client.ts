import type { AttemptInput, Course, Lesson, PublicItem, SignInInput, SignUpInput, Unit, User } from "@learnly/shared";

export const API_PREFIX = "/v1";

const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type ApiErrorCode =
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal"
  | "network";

/** Error thrown for any non-2xx response, mirroring the API's `{ error }` envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level messages from a zod `flatten()` payload, if the API sent one. */
  get fieldErrors(): Record<string, string> {
    const details = this.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined;
    const out: Record<string, string> = {};
    for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
      const first = messages?.[0];
      if (first) out[field] = first;
    }
    return out;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/* ---------------------------------------------------------------- tokens */

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const TOKEN_KEY = "learnly.session";

type Listener = () => void;

function readStoredTokens(): SessionTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionTokens>;
    return typeof parsed.accessToken === "string" && typeof parsed.refreshToken === "string"
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : null;
  } catch {
    return null;
  }
}

/**
 * Tokens live in localStorage so a refresh keeps you signed in, and are mirrored
 * in memory so every request doesn't hit storage. Other tabs are kept in sync
 * through the `storage` event.
 */
export const tokenStore = (() => {
  let tokens = typeof localStorage === "undefined" ? null : readStoredTokens();
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((listener) => listener());

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== TOKEN_KEY) return;
      tokens = readStoredTokens();
      emit();
    });
  }

  return {
    get: () => tokens,
    has: () => tokens !== null,
    set(next: SessionTokens) {
      tokens = next;
      try {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
      } catch {
        /* private mode: keep the in-memory copy */
      }
      emit();
    },
    clear() {
      if (!tokens) return;
      tokens = null;
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
      emit();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();

/** Seconds until a JWT expires, or null when the token isn't a readable JWT. */
export function secondsUntilExpiry(token: string, now = Date.now()): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp - now / 1000 : null;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- request */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
}

/**
 * Middleware sees every request before it hits the network and may answer it
 * itself (for example from an offline queue) or decorate the result.
 */
export type RequestMiddleware = (request: ApiRequest, next: (request: ApiRequest) => Promise<unknown>) => Promise<unknown>;

const middleware: RequestMiddleware[] = [];

export function addRequestMiddleware(fn: RequestMiddleware): () => void {
  middleware.push(fn);
  return () => {
    const index = middleware.indexOf(fn);
    if (index >= 0) middleware.splice(index, 1);
  };
}

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  parse?: "json" | "text";
  /** Let the request outlive the page (analytics flush on unload). */
  keepalive?: boolean;
}

function urlFor(path: string): string {
  const origin = API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  return new URL(`${API_PREFIX}${path}`, origin).toString();
}

async function toApiError(response: Response): Promise<ApiError> {
  let code: ApiErrorCode = response.status === 401 ? "unauthorized" : response.status === 404 ? "not_found" : "internal";
  let message = response.statusText || "Something went wrong";
  let details: unknown;
  try {
    const body = (await response.json()) as { error?: { code?: ApiErrorCode; message?: string; details?: unknown } };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(response.status, code, message, details);
}

let refreshInFlight: Promise<SessionTokens | null> | null = null;

/**
 * Exchange the refresh token for a new pair. Concurrent 401s share one refresh
 * so a burst of requests never rotates the token twice (which the API would
 * treat as reuse and revoke the whole family).
 */
export function refreshTokens(): Promise<SessionTokens | null> {
  if (refreshInFlight) return refreshInFlight;
  const current = tokenStore.get();
  if (!current) return Promise.resolve(null);
  refreshInFlight = (async () => {
    try {
      const response = await fetch(urlFor("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        // Only drop the session when the server rejected the token, not on a 5xx blip.
        if (response.status === 401 || response.status === 403) tokenStore.clear();
        return null;
      }
      const next = (await response.json()) as SessionTokens;
      tokenStore.set(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function send<T>(path: string, options: RequestOptions, retried = false): Promise<T> {
  const { method = "GET", body, signal, auth = true, parse = "json", keepalive } = options;
  let tokens = auth ? tokenStore.get() : null;

  if (tokens && !retried) {
    const remaining = secondsUntilExpiry(tokens.accessToken);
    if (remaining !== null && remaining < 30) tokens = (await refreshTokens()) ?? tokens;
  }

  const headers: Record<string, string> = { Accept: parse === "json" ? "application/json" : "*/*" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;

  let response: Response;
  try {
    response = await fetch(urlFor(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      keepalive,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", "We couldn't reach Learnly. Check your connection and try again.");
  }

  if (response.status === 401 && auth && tokens && !retried) {
    const refreshed = await refreshTokens();
    if (refreshed) return send<T>(path, options, true);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (parse === "text" ? await response.text() : await response.json()) as T;
}

/** Perform an API request through the middleware chain. */
export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const initial: ApiRequest = { method: options.method ?? "GET", path, body: options.body };
  const chain = middleware.reduceRight<(req: ApiRequest) => Promise<unknown>>(
    (next, fn) => (req) => fn(req, next),
    (req) => send<unknown>(req.path, { ...options, method: req.method, body: req.body }),
  );
  return chain(initial) as Promise<T>;
}

/* ------------------------------------------------------------- endpoints */

export interface Preferences {
  dailyGoalMinutes: number;
  reducedMotion: boolean;
  soundEffects: boolean;
  locale: "en" | "es" | "fil";
}

export interface AuthResponse extends SessionTokens {
  user: User;
}

export interface MeResponse {
  user: User;
  preferences: Preferences;
}

export interface CourseDetail {
  course: Course;
  units: Unit[];
}

export type LessonSummary = Pick<Lesson, "id" | "slug" | "title" | "level" | "estimatedMinutes">;

export interface LessonDetail {
  lesson: Lesson;
  items: PublicItem[];
}

export const api = {
  signIn: (input: SignInInput) => request<AuthResponse>("/auth/sign-in", { method: "POST", body: input, auth: false }),
  signUp: (input: SignUpInput) => request<AuthResponse>("/auth/sign-up", { method: "POST", body: input, auth: false }),
  signOut: (refreshToken: string) =>
    request<void>("/auth/sign-out", { method: "POST", body: { refreshToken }, auth: false }),
  me: () => request<MeResponse>("/me"),
  courses: () => request<{ courses: Course[] }>("/courses"),
  course: (slug: string) => request<CourseDetail>(`/courses/${encodeURIComponent(slug)}`),
  skillLessons: (skillId: string) => request<{ lessons: LessonSummary[] }>(`/skills/${encodeURIComponent(skillId)}/lessons`),
  lesson: (id: string) => request<LessonDetail>(`/lessons/${encodeURIComponent(id)}`),
  submitAttempt: <Result>(input: AttemptInput) => request<Result>("/attempts", { method: "POST", body: input }),
};

/** Query keys shared by every screen so cache updates land in one place. */
export const queryKeys = {
  me: ["me"] as const,
  courses: ["courses"] as const,
  course: (slug: string) => ["course", slug] as const,
  skillLessons: (skillId: string) => ["skill-lessons", skillId] as const,
  lesson: (id: string) => ["lesson", id] as const,
};

